'use server'

import 'server-only'
import { db } from '@/lib/db'
import { acquireSlotHold } from '@/lib/redis'
import { getSession } from '@/lib/session'
import { writeAuditLog } from '@/lib/audit'
import { scheduleReservationExpiry } from '@/lib/queues'
import { reserveTimeSlotSchema } from './schemas'
import {
  AuditAction,
  AuditEntityType,
  ReservationStatus,
  TicketTypeStatus,
  Prisma,
} from '@/app/generated/prisma/client'

// ─── Constants ────────────────────────────────────────────────────────────────

/** Reservation TTL in milliseconds — 10 minutes (matches seat lock TTL) */
const RESERVATION_TTL_MS = 600 * 1000

/** Reservation TTL in seconds — for Redis */
const RESERVATION_TTL_SECONDS = 600

// ─── Reserve Time Slot ────────────────────────────────────────────────────────

export async function reserveTimeSlot(
  input: unknown
): Promise<
  | { success: true; reservationId: string; expiresAt: Date }
  | { success: false; error: string }
> {
  // 1. Authenticate
  const session = await getSession()
  if (!session) return { success: false, error: 'UNAUTHENTICATED' }

  // 2. Validate input
  const parsed = reserveTimeSlotSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Invalid input' }

  const { eventId, timeSlotId, quantity } = parsed.data
  const { userId } = session

  // 3. Validate TimeSlot belongs to event and is ACTIVE
  const slot = await db.timeSlot.findUnique({
    where: { id: timeSlotId },
    select: {
      id: true,
      eventId: true,
      startsAt: true,
      endsAt: true,
      capacity: true,
      status: true,
    },
  })

  if (!slot || slot.eventId !== eventId) {
    return { success: false, error: 'Time slot not found for this event' }
  }

  if (slot.status !== TicketTypeStatus.ACTIVE) {
    return { success: false, error: 'This time slot is not available' }
  }

  // 4. Overlap check — find any existing ACTIVE TimeSlotTickets for this user+event
  //    where the slot's time range overlaps the requested slot
  const existingTickets = await db.timeSlotTicket.findMany({
    where: {
      ticket: {
        userId,
        eventId,
        status: 'ACTIVE',
      },
    },
    include: {
      timeSlot: {
        select: { id: true, startsAt: true, endsAt: true },
      },
    },
  })

  for (const existing of existingTickets) {
    const existingSlot = existing.timeSlot
    // Two intervals [A.start, A.end) and [B.start, B.end) overlap when:
    // A.start < B.end AND B.start < A.end
    const overlaps =
      existingSlot.startsAt < slot.endsAt && slot.startsAt < existingSlot.endsAt

    if (overlaps) {
      return {
        success: false,
        error: 'You already have a ticket for an overlapping time slot',
      }
    }
  }

  // 5. Compute booked count (confirmed TimeSlotTickets)
  const booked = await db.timeSlotTicket.count({
    where: { timeSlotId },
  })

  // 6. Count active holds from DB reservations
  const activeReservations = await db.reservation.findMany({
    where: {
      eventId,
      status: ReservationStatus.ACTIVE,
      expiresAt: { gt: new Date() },
      gaHolds: { not: Prisma.JsonNull },
    },
    select: { gaHolds: true },
  })

  let held = 0
  for (const reservation of activeReservations) {
    const holds = reservation.gaHolds as Record<string, number> | null
    if (!holds) continue
    held += holds[timeSlotId] ?? 0
  }

  // 7. Check capacity: capacity - booked - held >= quantity
  const available = slot.capacity - booked - held
  if (available < quantity) {
    return {
      success: false,
      error: available <= 0 ? 'This time slot is sold out' : `Only ${available} spot(s) remaining`,
    }
  }

  // 8. Acquire Redis slot hold (SET NX EX)
  const holdAcquired = await acquireSlotHold(
    timeSlotId,
    userId,
    quantity,
    RESERVATION_TTL_SECONDS
  )

  if (!holdAcquired) {
    return {
      success: false,
      error: 'A reservation for this slot is already in progress. Please complete or cancel it first.',
    }
  }

  // 9. DB transaction: create Reservation with gaHolds JSON, write AuditLog
  try {
    const expiresAt = new Date(Date.now() + RESERVATION_TTL_MS)

    const reservation = await db.$transaction(async (tx) => {
      const newReservation = await tx.reservation.create({
        data: {
          eventId,
          userId,
          status: ReservationStatus.ACTIVE,
          expiresAt,
          // Store the time-slot hold in gaHolds: { [timeSlotId]: quantity }
          gaHolds: { [timeSlotId]: quantity },
        },
      })

      await writeAuditLog(tx, {
        entityType: AuditEntityType.RESERVATION,
        entityId: newReservation.id,
        action: AuditAction.CREATED,
        newStatus: ReservationStatus.ACTIVE,
        actor: userId,
        metadata: {
          eventId,
          timeSlotId,
          quantity,
          expiresAt: expiresAt.toISOString(),
        },
      })

      return newReservation
    })

    // 10. Schedule reservation expiry job (non-blocking)
    scheduleReservationExpiry(reservation.id, reservation.expiresAt).catch(console.error)

    return {
      success: true,
      reservationId: reservation.id,
      expiresAt: reservation.expiresAt,
    }
  } catch (err) {
    // Release the Redis hold on transaction failure so the user can retry
    const { releaseSlotHold } = await import('@/lib/redis')
    releaseSlotHold(timeSlotId, userId).catch(console.error)

    console.error('[reserveTimeSlot] transaction error:', err)
    return { success: false, error: 'Failed to reserve time slot. Please try again.' }
  }
}
