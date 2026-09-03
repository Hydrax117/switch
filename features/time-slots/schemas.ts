import { z } from 'zod'

export const reserveTimeSlotSchema = z.object({
  eventId: z.string().min(1),
  timeSlotId: z.string().min(1),
  quantity: z.number().int().min(1).max(20),
})

export type ReserveTimeSlotInput = z.infer<typeof reserveTimeSlotSchema>
