/**
 * confirmCharge
 *
 * Shared order-creation logic called by:
 *   - POST /api/webhooks/paystack   (live webhook)
 *   - workers/reservation-expiry.worker.ts  (recovery on expiry)
 *   - POST /api/cron/payment-recovery  (manual/scheduled fallback)
 *
 * Safety guarantees
 * ─────────────────
 * 1. Advisory lock via SELECT … FOR UPDATE on the reservation row is the first
 *    thing done inside every write transaction. Only one concurrent caller can
 *    hold this lock; the second blocks until the first commits, then re-reads
 *    the status and exits cleanly if it is already COMPLETED.
 *
 * 2. GA capacity: SELECT … FOR UPDATE on each TicketType row, then recheck
 *    quantity - sold >= requested quantity before issuing. If oversold, the
 *    transaction throws OVERSOLD and no tickets are issued.
 *
 * 3. Time-slot capacity: count existing time_slot_tickets inside the
 *    transaction (after the FOR UPDATE lock on the TicketType row), then check
 *    against time_slot_capacities.capacity. Throws OVERSOLD if exceeded.
 *
 * 4. Reserved seating: re-read EventSeat.status inside the transaction and
 *    throw SEATS_UNAVAILABLE if any seat is no longer HELD. The DB-level
 *    Ticket.eventSeatId @unique constraint is the final backstop.
 *
 * 5. All three handlers are idempotent via the Payment.paystackReference
 *    @unique constraint (throws on duplicate insert) and the reservation-status
 *    re-check inside the locked transaction.
 */
import 'server-only'
import { db } from '@/lib/db'
import { type PaystackVerifyResult } from '@/lib/paystack'
import { resolveFeePercent } from '@/lib/fees'
import { sendTicketConfirmationEmail } from '@/lib/email'
import { createOrder, createPayment, createTicket } from '@/lib/order-helpers'
import { EventSeatStatus, PaymentStatus, ReservationStatus } from '@/app/generated/prisma/client'
import { randomBytes } from 'crypto'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateTicketNumber(): string {
  const year = new Date().getFullYear()
  const hex = randomBytes(3).toString('hex').toUpperCase()
  return `SWT-${year}-${hex}`
}

function generateQrCode(): string {
  return randomBytes(32).toString('hex')
}

// ─── Shared reservation shape ─────────────────────────────────────────────────
// Single query — loads the reservation, event, organizer, and all event seats.

type ReservationWithContext = NonNullable<Awaited<ReturnType<typeof fetchReservation>>>

async function fetchReservation(reservationId: string) {
  return db.reservation.findUnique({
    where: { id: reservationId },
    select: {
      id: true,
      status: true,
      eventId: true,
      userId: true,
      gaHolds: true,
      event: {
        select: {
          id: true,
          slug: true,
          title: true,
          startsAt: true,
          imageUrl: true,
          isFree: true,
          venue: { select: { name: true, city: true } },
          venueName: true,
          venueCity: true,
          organizer: { select: { id: true, feePercent: true } },
        },
      },
      // All held seats loaded in one go — no N+1
      eventSeats: {
        select: {
          id: true,
          ticketTypeId: true,
          ticketType: { select: { id: true, price: true, currency: true } },
        },
      },
    },
  })
}

// ─── Metadata shapes ──────────────────────────────────────────────────────────

interface TicketSelection {
  ticketTypeId: string
  quantity: number
  price: number
  currency: string
}

interface SlotSelection {
  timeSlotId: string
  ticketTypeId: string
  quantity: number
  price: number
  currency: string
}

// ─── Result type ──────────────────────────────────────────────────────────────

export type ConfirmChargeResult =
  | { status: 'confirmed'; reservationId: string }
  | { status: 'skipped'; reason: string }
  | { status: 'error'; reason: string }

// ─── Main entry point ─────────────────────────────────────────────────────────

export async function confirmCharge(verified: PaystackVerifyResult): Promise<ConfirmChargeResult> {
  const reference = verified.reference
  const paystackTxId = String(verified.id)
  const amountPaid = verified.amount
  const meta = (verified.metadata ?? {}) as Record<string, unknown>

  const reservationId = meta.reservationId as string | undefined
  const userId = meta.userId as string | undefined

  if (!reservationId || !userId) {
    return { status: 'skipped', reason: 'Missing reservationId or userId in metadata' }
  }

  // ── Pre-transaction idempotency ───────────────────────────────────────────
  // Fast path: if the reservation is already COMPLETED or the payment is already
  // recorded, skip without acquiring any locks.
  const reservation = await fetchReservation(reservationId)
  if (!reservation) {
    return { status: 'error', reason: `Reservation ${reservationId} not found` }
  }
  if (reservation.status === ReservationStatus.COMPLETED) {
    return { status: 'skipped', reason: 'Already COMPLETED' }
  }
  const existingPayment = await db.payment.findFirst({
    where: { paystackReference: reference, status: PaymentStatus.SUCCESS },
    select: { id: true },
  })
  if (existingPayment) {
    return { status: 'skipped', reason: 'Payment already recorded' }
  }

  const isGuest = meta.isGuest === true
  const promoCodeId =
    typeof meta.promoCodeId === 'string' && meta.promoCodeId ? meta.promoCodeId : undefined
  const discountAmount = typeof meta.discountAmount === 'number' ? meta.discountAmount : 0

  const slotSelections = parseSelections<SlotSelection>(meta.slotSelections)
  const gaSelections = parseSelections<TicketSelection>(meta.gaSelections)

  const isTimeSlotOrder = slotSelections.length > 0
  const isGAOrder = !isTimeSlotOrder && gaSelections.length > 0

  try {
    if (isTimeSlotOrder) {
      await handleTimeSlot(
        reservation,
        slotSelections,
        userId,
        reference,
        paystackTxId,
        amountPaid,
        promoCodeId,
        discountAmount
      )
    } else if (isGAOrder) {
      await handleGA(
        reservation,
        gaSelections,
        userId,
        reference,
        paystackTxId,
        amountPaid,
        promoCodeId,
        discountAmount
      )
    } else {
      await handleReserved(
        reservation,
        userId,
        reference,
        paystackTxId,
        amountPaid,
        promoCodeId,
        discountAmount
      )
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { status: 'error', reason: msg }
  }

  // ── Confirmation email ────────────────────────────────────────────────────
  // Fetch the order + its tickets in one query — no N+1
  try {
    const order = await db.order.findFirst({
      where: { reservationId, userId },
      select: {
        id: true,
        tickets: {
          select: {
            ticketNumber: true,
            qrCode: true,
            ticketType: { select: { name: true } },
            eventSeat: { select: { seat: { select: { label: true } } } },
            timeSlotTickets: {
              select: { timeSlot: { select: { label: true, startsAt: true } } },
              take: 1,
            },
          },
          orderBy: { issuedAt: 'asc' },
        },
      },
    })

    const tickets = order?.tickets ?? []
    if (tickets.length > 0) {
      const ev = reservation.event
      await sendTicketConfirmationEmail({
        userId,
        isGuest,
        eventTitle: ev.title,
        eventDate: ev.startsAt,
        eventSlug: ev.slug,
        eventImageUrl: ev.imageUrl ?? undefined,
        eventVenue: ev.venue
          ? `${ev.venue.name}, ${ev.venue.city}`
          : ev.venueName
            ? [ev.venueName, ev.venueCity].filter(Boolean).join(', ')
            : undefined,
        ticketCount: tickets.length,
        reservationId,
        tickets: tickets.map((t) => {
          const slot = t.timeSlotTickets[0]?.timeSlot
          return {
            ticketNumber: t.ticketNumber,
            qrCode: t.qrCode,
            ticketTypeName: t.ticketType.name,
            seatLabel: t.eventSeat?.seat?.label ?? null,
            showLabel: slot?.label ?? null,
            showDate: slot?.startsAt ?? null,
          }
        }),
      })
    }
  } catch (err) {
    console.error('[confirmCharge] email error', { reservationId, err })
  }

  return { status: 'confirmed', reservationId }
}

// ─── Time-slot handler ────────────────────────────────────────────────────────

async function handleTimeSlot(
  reservation: ReservationWithContext,
  slotSelections: SlotSelection[],
  userId: string,
  reference: string,
  paystackTxId: string,
  amountPaid: number,
  promoCodeId: string | undefined,
  discountAmount: number
) {
  if (slotSelections.length === 0) throw new Error('INVALID_SLOT_SELECTIONS')

  const feePercent = resolveFeePercent(reservation.event.organizer.feePercent)
  const feeAmount = Math.round(amountPaid * (feePercent / 100))
  const netAmount = amountPaid - feeAmount

  await db.$transaction(async (tx) => {
    // ── Advisory lock: serialize concurrent confirmCharge calls ─────────────
    // SELECT FOR UPDATE locks the reservation row until this transaction
    // commits. A concurrent caller (webhook racing the expiry worker) will
    // block here, then re-read status = COMPLETED and exit cleanly.
    const locked = await tx.reservation.findUnique({
      where: { id: reservation.id },
      select: { status: true },
    })
    // Prisma does not expose FOR UPDATE directly — use $queryRaw for the lock
    await tx.$executeRaw`SELECT id FROM reservations WHERE id = ${reservation.id} FOR UPDATE`
    if (locked?.status !== ReservationStatus.ACTIVE) return // already handled

    // ── Capacity re-check inside the lock ────────────────────────────────────
    // Lock each TicketType row (FOR UPDATE) before reading sold.
    // This prevents two concurrent transactions both reading sold=99 for a
    // quantity=100 type and both passing the check.
    for (const sel of slotSelections) {
      // Lock the TicketType row
      await tx.$executeRaw`SELECT id FROM ticket_types WHERE id = ${sel.ticketTypeId} FOR UPDATE`

      // Count confirmed tickets already issued for this slot+ticketType
      const countResult = await tx.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(*)::bigint AS count
        FROM time_slot_tickets tst
        JOIN tickets t ON t.id = tst."ticketId"
        WHERE tst."timeSlotId"   = ${sel.timeSlotId}
          AND tst."ticketTypeId" = ${sel.ticketTypeId}
          AND t.status IN ('ACTIVE','USED')
      `
      const alreadyIssued = Number(countResult[0]?.count ?? 0)

      const capResult = await tx.$queryRaw<[{ capacity: number }]>`
        SELECT capacity FROM time_slot_capacities
        WHERE "timeSlotId"   = ${sel.timeSlotId}
          AND "ticketTypeId" = ${sel.ticketTypeId}
        LIMIT 1
      `
      const capacity = capResult[0]?.capacity ?? 0

      if (alreadyIssued + sel.quantity > capacity) {
        throw new Error(`OVERSOLD:${sel.ticketTypeId}:${sel.timeSlotId}`)
      }
    }

    const order = await createOrder(tx, {
      userId,
      eventId: reservation.eventId,
      reservationId: reservation.id,
      totalAmount: amountPaid,
      currency: slotSelections[0]?.currency ?? 'NGN',
      discountAmount,
      promoCodeId: promoCodeId ?? null,
    })

    await createPayment(tx, {
      orderId: order.id,
      organizerId: reservation.event.organizer.id,
      userId,
      eventId: reservation.eventId,
      amount: amountPaid,
      currency: slotSelections[0]?.currency ?? 'NGN',
      platformFeePercent: feePercent,
      platformFeeAmount: feeAmount,
      netAmount,
      paystackReference: reference,
      paystackTransactionId: paystackTxId,
    })

    for (const sel of slotSelections) {
      for (let i = 0; i < sel.quantity; i++) {
        const ticket = await createTicket(tx, {
          eventId: reservation.eventId,
          userId,
          orderId: order.id,
          ticketTypeId: sel.ticketTypeId,
          ticketNumber: generateTicketNumber(),
          qrCode: generateQrCode(),
        })

        await tx.$executeRaw`
          INSERT INTO time_slot_tickets (id, "ticketId", "timeSlotId", "ticketTypeId", "createdAt")
          VALUES (gen_random_uuid()::text, ${ticket.id}, ${sel.timeSlotId}, ${sel.ticketTypeId}, NOW())
          ON CONFLICT ("ticketId","timeSlotId") DO NOTHING
        `
      }

      // safe to increment — FOR UPDATE on TicketType already acquired above
      await tx.ticketType.update({
        where: { id: sel.ticketTypeId },
        data: { sold: { increment: sel.quantity } },
      })
    }

    await applyPromo(tx, promoCodeId)

    await tx.reservation.update({
      where: { id: reservation.id },
      data: { status: ReservationStatus.COMPLETED },
    })
  })
}

// ─── GA handler ───────────────────────────────────────────────────────────────

async function handleGA(
  reservation: ReservationWithContext,
  gaSelections: TicketSelection[],
  userId: string,
  reference: string,
  paystackTxId: string,
  amountPaid: number,
  promoCodeId: string | undefined,
  discountAmount: number
) {
  const feePercent = resolveFeePercent(reservation.event.organizer.feePercent)
  const feeAmount = Math.round(amountPaid * (feePercent / 100))
  const netAmount = amountPaid - feeAmount

  await db.$transaction(async (tx) => {
    // ── Advisory lock ────────────────────────────────────────────────────────
    await tx.$executeRaw`SELECT id FROM reservations WHERE id = ${reservation.id} FOR UPDATE`
    const locked = await tx.reservation.findUnique({
      where: { id: reservation.id },
      select: { status: true },
    })
    if (locked?.status !== ReservationStatus.ACTIVE) return

    // ── Capacity re-check ─────────────────────────────────────────────────────
    // Lock each TicketType row then verify quantity - sold >= requested.
    for (const sel of gaSelections) {
      await tx.$executeRaw`SELECT id FROM ticket_types WHERE id = ${sel.ticketTypeId} FOR UPDATE`

      const tt = await tx.ticketType.findUnique({
        where: { id: sel.ticketTypeId },
        select: { quantity: true, sold: true },
      })

      if (tt && tt.quantity !== null && tt.quantity - tt.sold < sel.quantity) {
        throw new Error(`OVERSOLD:${sel.ticketTypeId}`)
      }
    }

    const order = await createOrder(tx, {
      userId,
      eventId: reservation.eventId,
      reservationId: reservation.id,
      totalAmount: amountPaid,
      currency: gaSelections[0]?.currency ?? 'NGN',
      discountAmount,
      promoCodeId: promoCodeId ?? null,
    })

    await createPayment(tx, {
      orderId: order.id,
      organizerId: reservation.event.organizer.id,
      userId,
      eventId: reservation.eventId,
      amount: amountPaid,
      currency: gaSelections[0]?.currency ?? 'NGN',
      platformFeePercent: feePercent,
      platformFeeAmount: feeAmount,
      netAmount,
      paystackReference: reference,
      paystackTransactionId: paystackTxId,
    })

    for (const sel of gaSelections) {
      for (let i = 0; i < sel.quantity; i++) {
        await createTicket(tx, {
          eventId: reservation.eventId,
          userId,
          orderId: order.id,
          ticketTypeId: sel.ticketTypeId,
          ticketNumber: generateTicketNumber(),
          qrCode: generateQrCode(),
        })
      }
      // safe to increment — FOR UPDATE on TicketType already acquired above
      await tx.ticketType.update({
        where: { id: sel.ticketTypeId },
        data: { sold: { increment: sel.quantity } },
      })
    }

    await applyPromo(tx, promoCodeId)

    await tx.reservation.update({
      where: { id: reservation.id },
      data: { status: ReservationStatus.COMPLETED },
    })
  })
}

// ─── Reserved seating handler ─────────────────────────────────────────────────

async function handleReserved(
  reservation: ReservationWithContext,
  userId: string,
  reference: string,
  paystackTxId: string,
  amountPaid: number,
  promoCodeId: string | undefined,
  discountAmount: number
) {
  const { eventSeats } = reservation
  const feePercent = resolveFeePercent(reservation.event.organizer.feePercent)
  const feeAmount = Math.round(amountPaid * (feePercent / 100))
  const netAmount = amountPaid - feeAmount
  const currency = eventSeats[0]?.ticketType?.currency ?? 'NGN'

  await db.$transaction(async (tx) => {
    // ── Advisory lock ────────────────────────────────────────────────────────
    await tx.$executeRaw`SELECT id FROM reservations WHERE id = ${reservation.id} FOR UPDATE`
    const locked = await tx.reservation.findUnique({
      where: { id: reservation.id },
      select: { status: true },
    })
    if (locked?.status !== ReservationStatus.ACTIVE) return

    // ── Verify seats are still HELD ───────────────────────────────────────────
    // Re-read inside the transaction so we see the current committed state.
    // If the expiry worker already released them back to AVAILABLE, we bail out
    // cleanly rather than issuing tickets for seats that are no longer reserved.
    if (eventSeats.length > 0) {
      const currentSeats = await tx.eventSeat.findMany({
        where: { id: { in: eventSeats.map((s) => s.id) } },
        select: { id: true, status: true },
      })
      const notHeld = currentSeats.filter((s) => s.status !== EventSeatStatus.HELD)
      if (notHeld.length > 0) {
        throw new Error(`SEATS_UNAVAILABLE:${notHeld.map((s) => s.id).join(',')}`)
      }
    }

    const order = await createOrder(tx, {
      userId,
      eventId: reservation.eventId,
      reservationId: reservation.id,
      totalAmount: amountPaid,
      currency,
      discountAmount,
      promoCodeId: promoCodeId ?? null,
    })

    await createPayment(tx, {
      orderId: order.id,
      organizerId: reservation.event.organizer.id,
      userId,
      eventId: reservation.eventId,
      amount: amountPaid,
      currency,
      platformFeePercent: feePercent,
      platformFeeAmount: feeAmount,
      netAmount,
      paystackReference: reference,
      paystackTransactionId: paystackTxId,
    })

    for (const eventSeat of eventSeats) {
      if (!eventSeat.ticketType) {
        throw new Error(`MISSING_TICKET_TYPE:${eventSeat.id}`)
      }
      await createTicket(tx, {
        eventId: reservation.eventId,
        userId,
        orderId: order.id,
        ticketTypeId: eventSeat.ticketTypeId!,
        ticketNumber: generateTicketNumber(),
        qrCode: generateQrCode(),
        eventSeatId: eventSeat.id,
      })
    }

    // Batch seat update — one query regardless of seat count
    if (eventSeats.length > 0) {
      await tx.eventSeat.updateMany({
        where: { id: { in: eventSeats.map((s) => s.id) } },
        data: { status: EventSeatStatus.SOLD },
      })
    }

    // Batch sold-count increments — one UPDATE per distinct ticketType, not per seat
    const soldByType = new Map<string, number>()
    for (const es of eventSeats) {
      if (es.ticketTypeId) {
        soldByType.set(es.ticketTypeId, (soldByType.get(es.ticketTypeId) ?? 0) + 1)
      }
    }
    await Promise.all(
      Array.from(soldByType, ([id, count]) =>
        tx.ticketType.update({ where: { id }, data: { sold: { increment: count } } })
      )
    )

    await applyPromo(tx, promoCodeId)

    await tx.reservation.update({
      where: { id: reservation.id },
      data: { status: ReservationStatus.COMPLETED },
    })
  })
}

// ─── Promo helper ─────────────────────────────────────────────────────────────

type Tx = Parameters<Parameters<typeof db.$transaction>[0]>[0]

async function applyPromo(tx: Tx, promoCodeId: string | undefined) {
  if (!promoCodeId) return
  const updated = await tx.$executeRaw`
    UPDATE promo_codes
    SET "usedCount" = "usedCount" + 1
    WHERE id = ${promoCodeId}
      AND ("maxUses" IS NULL OR "usedCount" < "maxUses")
  `
  if (updated === 0) throw new Error('PROMO_LIMIT_EXCEEDED')
}

// ─── Selection parser ─────────────────────────────────────────────────────────

function parseSelections<T>(raw: unknown): T[] {
  if (Array.isArray(raw)) return raw as T[]
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as T[]
    } catch {
      /* fall through */
    }
  }
  return []
}
