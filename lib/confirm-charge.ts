/**
 * confirmCharge
 *
 * Shared order-creation logic called by:
 *   - POST /api/webhooks/paystack  (live webhook)
 *   - POST /api/cron/payment-recovery  (recovery job for missed webhooks)
 *
 * Given a verified Paystack transaction, this function:
 *   1. Reads the reservation + all related data in a SINGLE query (no N+1)
 *   2. Dispatches to the correct order handler based on order type
 *   3. Sends the confirmation email
 *
 * It is fully idempotent — if the reservation is already COMPLETED it
 * returns `{ skipped: true }` without doing any work.
 */
import 'server-only'
import { db } from '@/lib/db'
import { paystack, type PaystackVerifyResult } from '@/lib/paystack'
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
// Fetched once and passed to every sub-handler — no per-seat N+1 queries.

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

// ─── Metadata shapes (mirror the webhook) ─────────────────────────────────────

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

// ─── Main entry point ─────────────────────────────────────────────────────────

export type ConfirmChargeResult =
  | { status: 'confirmed'; reservationId: string }
  | { status: 'skipped'; reason: string }
  | { status: 'error'; reason: string }

/**
 * Process a verified Paystack charge, creating the Order, Payment, and Tickets.
 *
 * @param verified  The result of `paystack.verifyTransaction(reference)`.
 *                  Must have `status === 'success'` before calling this.
 */
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

  // ── Idempotency ───────────────────────────────────────────────────────────
  const reservation = await fetchReservation(reservationId)

  if (!reservation) {
    return { status: 'error', reason: `Reservation ${reservationId} not found` }
  }
  if (reservation.status === ReservationStatus.COMPLETED) {
    return { status: 'skipped', reason: 'Already COMPLETED' }
  }
  // Also guard against a duplicate paystackReference already written to payments
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

  // ── Parse slot / GA selections ────────────────────────────────────────────
  // verifyTransaction returns the metadata exactly as sent, so arrays are real
  // arrays here (not stringified) — but keep the JSON.parse fallback for safety.
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
  // Fetch the order + its tickets in one query to avoid N+1
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
    // Email failure must not roll back the order — log and continue
    console.error('[confirmCharge] email error', { reservationId, err })
  }

  return { status: 'confirmed', reservationId }
}

// ─── Order type handlers ──────────────────────────────────────────────────────

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
          INSERT INTO "time_slot_tickets" ("id","ticketId","timeSlotId","ticketTypeId","createdAt")
          VALUES (gen_random_uuid()::text, ${ticket.id}, ${sel.timeSlotId}, ${sel.ticketTypeId}, NOW())
          ON CONFLICT ("ticketId","timeSlotId") DO NOTHING
        `
      }

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

    // Batch seat status update — one query regardless of seat count
    if (eventSeats.length > 0) {
      await tx.eventSeat.updateMany({
        where: { id: { in: eventSeats.map((s) => s.id) } },
        data: { status: EventSeatStatus.SOLD },
      })
    }

    // Batch sold-count increments — one query per distinct ticketType (not per seat)
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

// ─── Shared promo helper ──────────────────────────────────────────────────────

type Tx = Parameters<Parameters<typeof db.$transaction>[0]>[0]

async function applyPromo(tx: Tx, promoCodeId: string | undefined) {
  if (!promoCodeId) return
  const updated = await tx.$executeRaw`
    UPDATE "promo_codes"
    SET "usedCount" = "usedCount" + 1
    WHERE "id" = ${promoCodeId}
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
