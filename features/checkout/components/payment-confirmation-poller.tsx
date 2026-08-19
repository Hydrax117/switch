'use client'

/**
 * Polls /api/payments/status until the reservation is COMPLETED (webhook
 * processed), then renders the confirmed booking UI.
 *
 * Rendered by the CheckoutSuccessPage server component when the reservation
 * is still ACTIVE — i.e. the user arrived before the Paystack webhook fired.
 */

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import {
  CheckCircle,
  Calendar,
  MapPin,
  Ticket,
  ArrowRight,
  Loader2,
  AlertCircle,
} from 'lucide-react'
import { format } from 'date-fns'
import { formatPrice } from '@/features/events/utils'

// ─── Types (mirroring what the server page passes down) ───────────────────────

export interface ConfirmedTicket {
  id: string
  ticketNumber: string
  ticketTypeName: string
  seatLabel?: string | null
  price: number
  currency: string
}

export interface ConfirmedTicketGroup {
  ticketTypeId: string
  name: string
  price: number
  currency: string
  tickets: { id: string; ticketNumber: string }[]
}

export interface ConfirmedEventInfo {
  title: string
  slug: string
  imageUrl: string | null
  startsAt: Date
  endsAt: Date | null
  venue: { name: string; city: string; state: string | null } | null
}

interface Props {
  reservationId: string
  eventSlug: string
  /** Pre-loaded when reservation was already COMPLETED on first render */
  initiallyConfirmed: boolean
  /** Populated only when initiallyConfirmed = true */
  event?: ConfirmedEventInfo
  reservedTickets?: ConfirmedTicket[]   // reserved seating
  gaTicketGroups?: ConfirmedTicketGroup[] // GA
  totalTicketCount?: number
  totalPaid?: number
  currency?: string
}

const POLL_INTERVAL_MS = 2_000
const POLL_TIMEOUT_MS = 90_000 // give up after 90 s

export function PaymentConfirmationPoller({
  reservationId,
  eventSlug,
  initiallyConfirmed,
  event,
  reservedTickets = [],
  gaTicketGroups = [],
  totalTicketCount = 0,
  totalPaid = 0,
  currency = 'NGN',
}: Props) {
  const router = useRouter()
  const [confirmed, setConfirmed] = useState(initiallyConfirmed)
  const [timedOut, setTimedOut] = useState(false)

  const poll = useCallback(async () => {
    const started = Date.now()

    while (true) {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS))

      if (Date.now() - started > POLL_TIMEOUT_MS) {
        setTimedOut(true)
        return
      }

      try {
        const res = await fetch(`/api/payments/status?reservation=${reservationId}`, {
          cache: 'no-store',
        })
        if (!res.ok) continue

        const json = (await res.json()) as { status: string }

        if (json.status === 'COMPLETED') {
          // Reload the page — the server component will now have tickets to render
          router.refresh()
          setConfirmed(true)
          return
        }

        if (json.status === 'CANCELLED' || json.status === 'EXPIRED') {
          setTimedOut(true)
          return
        }
        // ACTIVE → keep polling
      } catch {
        // network hiccup — keep trying
      }
    }
  }, [reservationId, router])

  useEffect(() => {
    if (initiallyConfirmed) return
    void poll()
  }, [initiallyConfirmed, poll])

  // ── Pending state ──────────────────────────────────────────────────────────
  if (!confirmed && !timedOut) {
    return (
      <div className="flex flex-col items-center justify-center py-28 text-center">
        <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-brand-500/10">
          <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
        </div>
        <h1 className="text-[22px] font-semibold tracking-tight">Confirming your payment…</h1>
        <p className="text-muted-foreground mt-2 max-w-xs text-[14px]">
          This usually takes a few seconds. Please don&apos;t close this tab.
        </p>
      </div>
    )
  }

  // ── Timed-out / failed state ───────────────────────────────────────────────
  if (timedOut) {
    return (
      <div className="flex flex-col items-center justify-center py-28 text-center">
        <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/10">
          <AlertCircle className="h-8 w-8 text-amber-500" />
        </div>
        <h1 className="text-[22px] font-semibold tracking-tight">Payment confirmation delayed</h1>
        <p className="text-muted-foreground mt-2 max-w-sm text-[14px]">
          If your payment went through, your tickets will appear in your dashboard shortly. If you
          were charged and don&apos;t see tickets within 10 minutes, please contact support.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/dashboard/tickets"
            className="from-brand-600 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r to-violet-600 px-5 py-2.5 text-[14px] font-semibold text-white transition-opacity hover:opacity-90"
          >
            Check my tickets
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href={`/events/${eventSlug}`}
            className="border-border hover:bg-muted flex items-center justify-center rounded-xl border px-5 py-2.5 text-[14px] font-medium transition-colors"
          >
            Back to event
          </Link>
        </div>
      </div>
    )
  }

  // ── Confirmed state ────────────────────────────────────────────────────────
  if (!event) {
    // Reload triggered above via router.refresh() — server will re-render with data
    return (
      <div className="flex flex-col items-center justify-center py-28 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
      </div>
    )
  }

  const isGAOrder = gaTicketGroups.length > 0

  return (
    <div className="mx-auto max-w-[680px] px-5 py-12 sm:px-8 sm:py-16">
      {/* ── Success header ── */}
      <div className="mb-10 text-center">
        <div className="mb-4 flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15">
            <CheckCircle className="h-8 w-8 text-emerald-500" />
          </div>
        </div>
        <h1 className="text-[26px] font-semibold tracking-tight">You&apos;re going!</h1>
        <p className="text-muted-foreground mt-2 text-[15px]">
          Your tickets are confirmed. Check your email for a copy.
        </p>
      </div>

      {/* ── Event card ── */}
      <div className="border-border bg-surface mb-6 overflow-hidden rounded-2xl border">
        {event.imageUrl && (
          <div className="relative h-[160px] w-full">
            <Image
              src={event.imageUrl}
              alt={event.title}
              fill
              className="object-cover object-center"
              sizes="680px"
            />
            <div className="from-background/80 absolute inset-0 bg-gradient-to-t to-transparent" />
          </div>
        )}
        <div className="p-5">
          <h2 className="text-[17px] font-semibold">{event.title}</h2>
          <div className="mt-3 space-y-2">
            <div className="text-muted-foreground flex items-center gap-2 text-[13px]">
              <Calendar className="h-4 w-4 shrink-0" />
              {format(event.startsAt, 'EEEE, MMMM d, yyyy · h:mm a')}
              {event.endsAt && ` – ${format(event.endsAt, 'h:mm a')}`}
            </div>
            {event.venue && (
              <div className="text-muted-foreground flex items-center gap-2 text-[13px]">
                <MapPin className="h-4 w-4 shrink-0" />
                {event.venue.name}, {event.venue.city}
                {event.venue.state ? `, ${event.venue.state}` : ''}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Tickets ── */}
      <div className="mb-6 space-y-3">
        {isGAOrder
          ? gaTicketGroups.map((group) => (
              <div
                key={group.ticketTypeId}
                className="border-border bg-surface rounded-2xl border p-4"
              >
                <div className="flex items-center gap-4">
                  <div className="bg-muted flex h-14 w-14 shrink-0 items-center justify-center rounded-xl">
                    <Ticket className="text-muted-foreground h-6 w-6" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13.5px] font-semibold">
                      {group.name}
                      <span className="text-muted-foreground font-normal">
                        {' '}
                        × {group.tickets.length}
                      </span>
                    </p>
                    <p className="text-muted-foreground mt-0.5 font-mono text-[11.5px]">
                      {group.tickets[0]?.ticketNumber}
                      {group.tickets.length > 1 && ` + ${group.tickets.length - 1} more`}
                    </p>
                  </div>
                  <p className="text-brand-500 shrink-0 text-[13.5px] font-bold">
                    {group.price === 0
                      ? 'Free'
                      : formatPrice(group.price * group.tickets.length, group.currency)}
                  </p>
                </div>
              </div>
            ))
          : reservedTickets.map((t) => (
              <div
                key={t.id}
                className="border-border bg-surface flex items-center gap-4 rounded-2xl border p-4"
              >
                <div className="bg-muted flex h-14 w-14 shrink-0 items-center justify-center rounded-xl">
                  <Ticket className="text-muted-foreground h-6 w-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[13.5px] font-semibold">
                    {t.ticketTypeName}
                    {t.seatLabel && (
                      <span className="text-muted-foreground font-normal">
                        {' '}
                        · Seat {t.seatLabel}
                      </span>
                    )}
                  </p>
                  <p className="text-muted-foreground mt-0.5 font-mono text-[11.5px]">
                    {t.ticketNumber}
                  </p>
                </div>
                <p className="text-brand-500 shrink-0 text-[13.5px] font-bold">
                  {t.price === 0 ? 'Free' : formatPrice(t.price, t.currency)}
                </p>
              </div>
            ))}
      </div>

      {/* ── Order total ── */}
      <div className="border-border bg-surface mb-8 rounded-2xl border p-5">
        <div className="flex items-center justify-between text-[13.5px]">
          <span className="text-muted-foreground">
            {totalTicketCount} ticket{totalTicketCount !== 1 ? 's' : ''}
          </span>
          <span className="font-bold">
            {totalPaid === 0 ? 'Free' : formatPrice(totalPaid, currency)}
          </span>
        </div>
        <div className="border-border/60 mt-3 border-t pt-3">
          <p className="text-muted-foreground text-[11.5px]">
            Booking ref:{' '}
            <span className="font-mono font-medium">{reservationId}</span>
          </p>
        </div>
      </div>

      {/* ── Actions ── */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <Link
          href="/dashboard/tickets"
          className="from-brand-600 flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r to-violet-600 py-3 text-[14px] font-semibold text-white transition-opacity hover:opacity-90"
        >
          View my tickets
          <ArrowRight className="h-4 w-4" />
        </Link>
        <Link
          href="/events"
          className="border-border hover:bg-muted flex flex-1 items-center justify-center rounded-xl border py-3 text-[14px] font-medium transition-colors"
        >
          Discover more events
        </Link>
      </div>
    </div>
  )
}
