import type { TimeSlot, TicketTypeStatus } from '@/app/generated/prisma/client'

/**
 * A TimeSlot enriched with availability counts.
 * Returned by getEventTimeSlots and getTimeSlotAvailability queries.
 */
export type TimeSlotWithAvailability = TimeSlot & {
  /** Number of confirmed tickets for this slot */
  booked: number
  /** Number of active reservation holds (from Redis or DB) for this slot */
  held: number
  /** Remaining capacity: capacity - booked - held */
  available: number
}

export type { TicketTypeStatus }

/**
 * Availability snapshot for a single time slot.
 * Returned by getTimeSlotAvailability.
 */
export interface TimeSlotAvailability {
  capacity: number
  booked: number
  held: number
  available: number
}
