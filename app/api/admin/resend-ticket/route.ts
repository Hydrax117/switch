/**
 * POST /api/admin/resend-ticket
 * ONE-TIME endpoint — delete after use.
 *
 * Sends the ticket confirmation email to David Olaopin for his
 * manually recovered order.
 *
 * Protected by CRON_SECRET so it cannot be called by anyone else.
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sendTicketConfirmationEmail } from '@/lib/email'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  // Auth check
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const RESERVATION_ID = 'cmwm9d3dkc77f2f388f1d8740'
  const USER_ID = 'cmwe3ri8t000008l28uosg5u5'

  // Load the order and tickets in one query
  const order = await db.order.findFirst({
    where: { reservationId: RESERVATION_ID, userId: USER_ID },
    select: {
      id: true,
      tickets: {
        select: {
          ticketNumber: true,
          qrCode: true,
          ticketType: { select: { name: true } },
          timeSlotTickets: {
            select: { timeSlot: { select: { label: true, startsAt: true } } },
            take: 1,
          },
        },
        orderBy: { issuedAt: 'asc' },
      },
    },
  })

  if (!order || order.tickets.length === 0) {
    return NextResponse.json({ error: 'Order or tickets not found' }, { status: 404 })
  }

  // Load event details
  const event = await db.event.findUnique({
    where: { id: 'cmu4cbe9e000004lgbx3y8rf5' },
    select: {
      title: true,
      slug: true,
      startsAt: true,
      imageUrl: true,
      venue: { select: { name: true, city: true } },
      venueName: true,
      venueCity: true,
    },
  })

  if (!event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 })
  }

  await sendTicketConfirmationEmail({
    userId: USER_ID,
    isGuest: false,
    eventTitle: event.title,
    eventDate: event.startsAt,
    eventSlug: event.slug,
    eventImageUrl: event.imageUrl ?? undefined,
    eventVenue: event.venue
      ? `${event.venue.name}, ${event.venue.city}`
      : (event.venueName ?? undefined),
    ticketCount: order.tickets.length,
    reservationId: RESERVATION_ID,
    tickets: order.tickets.map((t) => {
      const slot = t.timeSlotTickets[0]?.timeSlot
      return {
        ticketNumber: t.ticketNumber,
        qrCode: t.qrCode,
        ticketTypeName: t.ticketType.name,
        seatLabel: null,
        showLabel: slot?.label ?? null,
        showDate: slot?.startsAt ?? null,
      }
    }),
  })

  return NextResponse.json({
    ok: true,
    message: `Confirmation email sent to David Olaopin for ${order.tickets.length} ticket(s)`,
    tickets: order.tickets.map((t) => t.ticketNumber),
  })
}
