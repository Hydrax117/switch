import 'server-only'
import { db } from '@/lib/db'
import { Prisma } from '@/app/generated/prisma/client'
import type { TimeSlotWithAvailability, TimeSlotAvailability } from './types'

/**
 * Get all ACTIVE time slots for an event, enriched with booked and held counts.
 *
 * "booked" = confirmed TimeSlotTicket records (tickets linked to this slot).
 * "held"   = active Reservations whose gaHolds JSON contains this timeSlotId
 *            and whose expiresAt is in the future.
 * "available" = capacity - booked - held  (clamped to 0 minimum).
 */
export async function getEventTimeSlots(eventId: string): Promise<TimeSlotWithAvailability[]> {
  const slots = await db.timeSlot.findMany({
    where: { eventId },
    orderBy: { startsAt: 'asc' },
    include: {
      _count: {
        select: { tickets: true },
      },
    },
  })

  // Fetch active reservations that hold any of these slots
  const slotIds = slots.map((s) => s.id)

  // Active reservations with a non-null gaHolds and not yet expired
  const activeReservations = await db.reservation.findMany({
    where: {
      eventId,
      status: 'ACTIVE',
      expiresAt: { gt: new Date() },
      gaHolds: { not: Prisma.JsonNull },
    },
    select: { gaHolds: true },
  })

  // Build a map of timeSlotId → held quantity from gaHolds JSON
  const heldMap: Record<string, number> = {}
  for (const reservation of activeReservations) {
    const holds = reservation.gaHolds as Record<string, number> | null
    if (!holds) continue
    for (const [slotId, qty] of Object.entries(holds)) {
      if (slotIds.includes(slotId)) {
        heldMap[slotId] = (heldMap[slotId] ?? 0) + qty
      }
    }
  }

  return slots.map((slot) => {
    const booked = slot._count.tickets
    const held = heldMap[slot.id] ?? 0
    const available = Math.max(0, slot.capacity - booked - held)

    // Destructure _count out so the return type matches TimeSlot base
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { _count, ...slotBase } = slot

    return {
      ...slotBase,
      booked,
      held,
      available,
    } satisfies TimeSlotWithAvailability
  })
}

/**
 * Get availability snapshot for a single time slot.
 * Returns { capacity, booked, held, available }.
 */
export async function getTimeSlotAvailability(
  timeSlotId: string
): Promise<TimeSlotAvailability | null> {
  const slot = await db.timeSlot.findUnique({
    where: { id: timeSlotId },
    select: { id: true, eventId: true, capacity: true },
  })

  if (!slot) return null

  const booked = await db.timeSlotTicket.count({
    where: { timeSlotId },
  })

  // Count active holds in gaHolds JSON for this specific slot
  const activeReservations = await db.reservation.findMany({
    where: {
      eventId: slot.eventId,
      status: 'ACTIVE',
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

  const available = Math.max(0, slot.capacity - booked - held)

  return {
    capacity: slot.capacity,
    booked,
    held,
    available,
  }
}
