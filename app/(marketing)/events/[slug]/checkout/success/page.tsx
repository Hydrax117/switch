import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { SiteHeader } from '@/components/layout/site-header'
import { SiteFooter } from '@/components/layout/site-footer'
import { getSession } from '@/lib/session'
import { db } from '@/lib/db'
import {
  PaymentConfirmationPoller,
  type ConfirmedEventInfo,
  type ConfirmedTicket,
  type ConfirmedTicketGroup,
} from '@/features/checkout/components/payment-confirmation-poller'

export const metadata: Metadata = { title: 'Booking Confirmed' }

// Never cache this page — it must re-render fresh on router.refresh() calls
// from the poller so ticket data appears as soon as the webhook fires.
export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ reservation?: string; type?: string }>
}

export default async function CheckoutSuccessPage({ params, searchParams }: PageProps) {
  const { slug } = await params
  const { reservation: reservationId, type } = await searchParams

  const session = await getSession()
  if (!session) redirect(`/login`)
  if (!reservationId) redirect(`/events/${slug}`)

  const isGA = type === 'ga'

  // Load the reservation — we accept both ACTIVE (webhook not yet fired) and
  // COMPLETED (webhook already processed). Any other status means something
  // went wrong and we redirect away.
  const reservation = await db.reservation.findUnique({
    where: { id: reservationId, userId: session.userId },
    include: {
      event: {
        select: {
          id: true,
          title: true,
          slug: true,
          imageUrl: true,
          startsAt: true,
          endsAt: true,
          venue: { select: { name: true, city: true, state: true } },
        },
      },
      eventSeats: {
        include: {
          tickets: {
            select: { id: true, ticketNumber: true },
          },
          seat: { select: { label: true } },
          ticketType: { select: { id: true, name: true, currency: true } },
        },
      },
    },
  })

  // No reservation, wrong owner, or explicitly cancelled → back to event
  if (!reservation) redirect(`/events/${slug}`)
  if (reservation.status === 'CANCELLED') redirect(`/events/${slug}`)

  const isPending = reservation.status === 'ACTIVE'

  // ── Build confirmed data (only meaningful when COMPLETED) ─────────────────

  let event: ConfirmedEventInfo | undefined
  let reservedTickets: ConfirmedTicket[] = []
  let gaTicketGroups: ConfirmedTicketGroup[] = []
  let totalTicketCount = 0
  let totalPaid = 0
  let currency = 'NGN'

  if (!isPending) {
    event = {
      ...reservation.event,
      startsAt: reservation.event.startsAt,
      endsAt: reservation.event.endsAt ?? null,
    }

    if (isGA) {
      // GA: load tickets directly (no eventSeat linkage)
      const rawGaTickets = await db.ticket.findMany({
        where: { eventId: reservation.eventId, userId: session.userId },
        include: {
          ticketType: { select: { id: true, name: true, price: true, currency: true } },
        },
        orderBy: { issuedAt: 'asc' },
      })

      // Group by ticket type
      const groupMap: Record<string, ConfirmedTicketGroup> = {}
      for (const t of rawGaTickets) {
        const key = t.ticketType.id
        if (!groupMap[key]) {
          groupMap[key] = {
            ticketTypeId: key,
            name: t.ticketType.name,
            price: t.ticketType.price,
            currency: t.ticketType.currency,
            tickets: [],
          }
        }
        groupMap[key]!.tickets.push({ id: t.id, ticketNumber: t.ticketNumber })
      }
      gaTicketGroups = Object.values(groupMap)

      totalTicketCount = rawGaTickets.length
      totalPaid = rawGaTickets.reduce((sum, t) => sum + t.ticketType.price, 0)
      currency = rawGaTickets[0]?.ticketType.currency ?? 'NGN'
    } else {
      // Reserved seating: one ticket per eventSeat
      reservedTickets = reservation.eventSeats.map((es) => ({
        id: es.tickets[0]?.id ?? es.id,
        ticketNumber: es.tickets[0]?.ticketNumber ?? '—',
        ticketTypeName: es.ticketType?.name ?? 'Ticket',
        seatLabel: es.seat?.label ?? null,
        price: es.price,
        currency: es.ticketType?.currency ?? 'NGN',
      }))

      totalTicketCount = reservedTickets.length
      totalPaid = reservedTickets.reduce((sum, t) => sum + t.price, 0)
      currency = reservedTickets[0]?.currency ?? 'NGN'
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col">
      <SiteHeader userEmail={session.email} />

      <main className="flex-1 pt-[60px]">
        <PaymentConfirmationPoller
          reservationId={reservationId}
          eventSlug={slug}
          initiallyConfirmed={!isPending}
          event={event}
          reservedTickets={reservedTickets}
          gaTicketGroups={gaTicketGroups}
          totalTicketCount={totalTicketCount}
          totalPaid={totalPaid}
          currency={currency}
        />
      </main>

      <SiteFooter />
    </div>
  )
}
