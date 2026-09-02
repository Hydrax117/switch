'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getSession } from '@/lib/session'
import { EventStatus, SeatingType, TicketTypeStatus } from '@/app/generated/prisma/client'

// ─── Schemas ─────────────────────────────────────────────────────────────────

const createEventSchema = z.object({
  title: z.string().min(3).max(120),
  description: z.string().max(5000).optional(),
  categoryId: z.string().optional(),
  // venueId is resolved server-side via upsertVenue; not accepted directly
  seatingType: z.nativeEnum(SeatingType),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime().optional(),
  salesStart: z.string().datetime().optional(),
  salesEnd: z.string().datetime().optional(),
  capacity: z.coerce.number().int().positive().optional(),
  imageUrl: z.string().url().optional(),
  isFree: z
    .string()
    .optional()
    .transform((v) => v === 'true'),
  isVirtual: z
    .string()
    .optional()
    .transform((v) => v === 'true'),
  virtualLink: z.string().url().optional().or(z.literal('')),
})

const venueInputSchema = z.object({
  venue_name: z.string().max(200).optional(),
  venue_address: z.string().max(500).optional(),
  venue_city: z.string().max(100).optional(),
  venue_state: z.string().max(100).optional(),
})

const updateEventSchema = createEventSchema.partial().extend({
  eventId: z.string().min(1),
})

const createTicketTypeSchema = z.object({
  eventId: z.string().min(1),
  name: z.string().min(1).max(80),
  description: z.string().max(500).optional(),
  price: z.coerce.number().int().min(0),
  currency: z.string().default('NGN'),
  quantity: z.coerce.number().int().positive().optional(),
  salesStart: z.string().datetime().optional(),
  salesEnd: z.string().datetime().optional(),
})

const updateTicketTypeSchema = z.object({
  ticketTypeId: z.string().min(1),
  name: z.string().min(1).max(80).optional(),
  description: z.string().max(500).optional(),
  price: z.coerce.number().int().min(0).optional(),
  currency: z.string().optional(),
  quantity: z.coerce.number().int().positive().optional().nullable(),
  salesStart: z.string().datetime().optional().nullable(),
  salesEnd: z.string().datetime().optional().nullable(),
  status: z.nativeEnum(TicketTypeStatus).optional(),
})

// ─── Helpers ─────────────────────────────────────────────────────────────────

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80)
}

async function uniqueSlug(base: string): Promise<string> {
  let slug = base
  let i = 0
  while (await db.event.findUnique({ where: { slug } })) {
    slug = `${base}-${++i}`
  }
  return slug
}

/**
 * Inline venue data extracted from form — stored directly on Event row.
 */
function extractVenueData(input: z.infer<typeof venueInputSchema>) {
  return {
    venueName: input.venue_name || null,
    venueAddress: input.venue_address || null,
    venueCity: input.venue_city || null,
    venueState: input.venue_state || null,
  }
}

type ActionResult<T = void> = { success: true; data: T } | { success: false; error: string }

// ─── Create event ─────────────────────────────────────────────────────────────

export async function createEvent(
  formData: FormData
): Promise<ActionResult<{ id: string; slug: string }>> {
  const session = await getSession()
  if (!session) return { success: false, error: 'Not authenticated' }
  if (session.role !== 'ORGANIZER' && session.role !== 'ADMIN') {
    return { success: false, error: 'Only organizers can create events' }
  }

  const organizer = await db.organizer.findUnique({
    where: { userId: session.userId },
    select: { id: true, status: true },
  })
  if (!organizer || organizer.status !== 'ACTIVE') {
    return { success: false, error: 'Your organizer account is not active' }
  }

  const raw = Object.fromEntries(formData)
  const parsed = createEventSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }

  // Extract inline venue data — stored directly on the event row
  const venueInput = venueInputSchema.parse(raw)
  const venueData = extractVenueData(venueInput)

  const { title, ...rest } = parsed.data
  const slug = await uniqueSlug(slugify(title))

  const imageUrls = formData.getAll('imageUrls').map(String).filter(Boolean)

  const event = await db.event.create({
    data: {
      organizerId: organizer.id,
      title,
      slug,
      status: EventStatus.DRAFT,
      ...rest,
      ...venueData,
      imageUrl: imageUrls[0] ?? rest.imageUrl,
      startsAt: new Date(rest.startsAt),
      endsAt: rest.endsAt ? new Date(rest.endsAt) : undefined,
      salesStart: rest.salesStart ? new Date(rest.salesStart) : undefined,
      salesEnd: rest.salesEnd ? new Date(rest.salesEnd) : undefined,
    },
    select: { id: true, slug: true },
  })

  // Save all uploaded images to EventImage table
  if (imageUrls.length > 0) {
    await db.eventImage.createMany({
      data: imageUrls.map((url, position) => ({
        eventId: event.id,
        url,
        position,
      })),
      skipDuplicates: true,
    })
  }

  revalidatePath('/dashboard/events')
  return { success: true, data: event }
}

// ─── Update event ─────────────────────────────────────────────────────────────

export async function updateEvent(formData: FormData): Promise<ActionResult> {
  const session = await getSession()
  if (!session) return { success: false, error: 'Not authenticated' }

  const raw = Object.fromEntries(formData)
  const parsed = updateEventSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }

  const { eventId, ...updates } = parsed.data

  // Verify ownership
  const organizer = await db.organizer.findUnique({
    where: { userId: session.userId },
    select: { id: true },
  })
  const event = organizer
    ? await db.event.findUnique({
        where: { id: eventId, organizerId: organizer.id },
        select: { id: true },
      })
    : null

  if (!event) return { success: false, error: 'Event not found' }

  // Extract inline venue data — always overwrite with whatever the form sends
  const venueInput = venueInputSchema.parse(raw)
  const venueData = extractVenueData(venueInput)

  await db.event.update({
    where: { id: eventId },
    data: {
      ...updates,
      ...venueData,
      startsAt: updates.startsAt ? new Date(updates.startsAt) : undefined,
      endsAt: updates.endsAt ? new Date(updates.endsAt) : undefined,
      salesStart: updates.salesStart ? new Date(updates.salesStart) : undefined,
      salesEnd: updates.salesEnd ? new Date(updates.salesEnd) : undefined,
    },
  })

  revalidatePath('/dashboard/events')
  revalidatePath(`/dashboard/events/${eventId}`)
  return { success: true, data: undefined }
}

// ─── Publish / unpublish event ────────────────────────────────────────────────

export async function publishEvent(eventId: string): Promise<ActionResult> {
  const session = await getSession()
  if (!session) return { success: false, error: 'Not authenticated' }

  const organizer = await db.organizer.findUnique({
    where: { userId: session.userId },
    select: { id: true },
  })
  if (!organizer) return { success: false, error: 'Not an organizer' }

  const event = await db.event.findUnique({
    where: { id: eventId, organizerId: organizer.id },
    include: { ticketTypes: true },
  })
  if (!event) return { success: false, error: 'Event not found' }

  // Basic publishing validation
  if (!event.startsAt) return { success: false, error: 'Event must have a start date' }
  if (!event.ticketTypes.length)
    return { success: false, error: 'Event must have at least one ticket type' }
  if (event.ticketTypes.some((tt) => tt.price < 0)) {
    return { success: false, error: 'All ticket types must have a valid price' }
  }

  await db.event.update({
    where: { id: eventId },
    data: { status: EventStatus.PUBLISHED },
  })

  revalidatePath('/dashboard/events')
  revalidatePath(`/events/${event.slug}`)
  return { success: true, data: undefined }
}

export async function unpublishEvent(eventId: string): Promise<ActionResult> {
  const session = await getSession()
  if (!session) return { success: false, error: 'Not authenticated' }

  const organizer = await db.organizer.findUnique({
    where: { userId: session.userId },
    select: { id: true },
  })
  if (!organizer) return { success: false, error: 'Not an organizer' }

  await db.event.update({
    where: { id: eventId, organizerId: organizer.id },
    data: { status: EventStatus.DRAFT },
  })

  revalidatePath('/dashboard/events')
  return { success: true, data: undefined }
}

// ─── Add ticket type ──────────────────────────────────────────────────────────

export async function addTicketType(formData: FormData): Promise<ActionResult<{ id: string }>> {
  const session = await getSession()
  if (!session) return { success: false, error: 'Not authenticated' }

  const raw = Object.fromEntries(formData)
  const parsed = createTicketTypeSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }

  const organizer = await db.organizer.findUnique({
    where: { userId: session.userId },
    select: { id: true },
  })
  if (!organizer) return { success: false, error: 'Not an organizer' }

  const event = await db.event.findUnique({
    where: { id: parsed.data.eventId, organizerId: organizer.id },
    select: { id: true },
  })
  if (!event) return { success: false, error: 'Event not found' }

  const tt = await db.ticketType.create({
    data: {
      ...parsed.data,
      salesStart: parsed.data.salesStart ? new Date(parsed.data.salesStart) : undefined,
      salesEnd: parsed.data.salesEnd ? new Date(parsed.data.salesEnd) : undefined,
    },
    select: { id: true },
  })

  revalidatePath(`/dashboard/events/${parsed.data.eventId}`)
  return { success: true, data: tt }
}

// ─── Delete ticket type ───────────────────────────────────────────────────────

export async function deleteTicketType(ticketTypeId: string): Promise<ActionResult> {
  const session = await getSession()
  if (!session) return { success: false, error: 'Not authenticated' }

  const tt = await db.ticketType.findUnique({
    where: { id: ticketTypeId },
    select: { eventId: true, sold: true, event: { select: { organizerId: true } } },
  })

  const organizer = await db.organizer.findUnique({
    where: { userId: session.userId },
    select: { id: true },
  })
  if (!tt || !organizer || tt.event.organizerId !== organizer.id) {
    return { success: false, error: 'Not found' }
  }
  if (tt.sold > 0) {
    return { success: false, error: 'Cannot delete a ticket type with sold tickets' }
  }

  await db.ticketType.delete({ where: { id: ticketTypeId } })
  revalidatePath(`/dashboard/events/${tt.eventId}`)
  return { success: true, data: undefined }
}

// ─── Save event images (replace all images for an event) ─────────────────────

export async function saveEventImages(eventId: string, imageUrls: string[]): Promise<ActionResult> {
  const session = await getSession()
  if (!session) return { success: false, error: 'Not authenticated' }

  const organizer = await db.organizer.findUnique({
    where: { userId: session.userId },
    select: { id: true },
  })
  if (!organizer) return { success: false, error: 'Not an organizer' }

  const event = await db.event.findUnique({
    where: { id: eventId, organizerId: organizer.id },
    select: { id: true },
  })
  if (!event) return { success: false, error: 'Event not found' }

  await db.$transaction(async (tx) => {
    // Replace all existing images
    await tx.eventImage.deleteMany({ where: { eventId } })

    if (imageUrls.length > 0) {
      await tx.eventImage.createMany({
        data: imageUrls.map((url, position) => ({ eventId, url, position })),
      })
    }

    // Keep Event.imageUrl in sync with the primary (position 0)
    await tx.event.update({
      where: { id: eventId },
      data: { imageUrl: imageUrls[0] ?? null },
    })
  })

  revalidatePath(`/dashboard/events/${eventId}`)
  return { success: true, data: undefined }
}

// ─── Speakers / Guests / Performers ──────────────────────────────────────────

const upsertSpeakerSchema = z.object({
  eventId: z.string().min(1),
  speakerId: z.string().optional(), // present when updating
  name: z.string().min(1).max(120),
  role: z.string().max(80).optional(),
  avatarUrl: z.string().url().optional().or(z.literal('')),
})

export async function saveSpeaker(formData: FormData): Promise<ActionResult<{ id: string }>> {
  const session = await getSession()
  if (!session) return { success: false, error: 'Not authenticated' }

  const raw = Object.fromEntries(formData)
  const parsed = upsertSpeakerSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }

  const { eventId, speakerId, name, role, avatarUrl } = parsed.data

  // Verify ownership
  const organizer = await db.organizer.findUnique({
    where: { userId: session.userId },
    select: { id: true },
  })
  const event = organizer
    ? await db.event.findUnique({
        where: { id: eventId, organizerId: organizer.id },
        select: { id: true },
      })
    : null
  if (!event) return { success: false, error: 'Event not found' }

  const data = {
    name,
    role: role || null,
    avatarUrl: avatarUrl || null,
  }

  if (speakerId) {
    // Update existing
    await db.eventSpeaker.update({
      where: { id: speakerId, eventId },
      data,
    })
    revalidatePath(`/dashboard/events/${eventId}`)
    return { success: true, data: { id: speakerId } }
  } else {
    // Create new — append at end
    const count = await db.eventSpeaker.count({ where: { eventId } })
    const speaker = await db.eventSpeaker.create({
      data: { eventId, ...data, position: count },
      select: { id: true },
    })
    revalidatePath(`/dashboard/events/${eventId}`)
    return { success: true, data: speaker }
  }
}

export async function deleteSpeaker(speakerId: string, eventId: string): Promise<ActionResult> {
  const session = await getSession()
  if (!session) return { success: false, error: 'Not authenticated' }

  const organizer = await db.organizer.findUnique({
    where: { userId: session.userId },
    select: { id: true },
  })
  const event = organizer
    ? await db.event.findUnique({
        where: { id: eventId, organizerId: organizer.id },
        select: { id: true },
      })
    : null
  if (!event) return { success: false, error: 'Event not found' }

  await db.eventSpeaker.delete({ where: { id: speakerId, eventId } })

  // Re-order remaining speakers
  const remaining = await db.eventSpeaker.findMany({
    where: { eventId },
    orderBy: { position: 'asc' },
    select: { id: true },
  })
  await Promise.all(
    remaining.map((s, i) => db.eventSpeaker.update({ where: { id: s.id }, data: { position: i } }))
  )

  revalidatePath(`/dashboard/events/${eventId}`)
  return { success: true, data: undefined }
}

// ─── Cancel event ─────────────────────────────────────────────────────────────

export async function cancelEvent(eventId: string): Promise<ActionResult> {
  const session = await getSession()
  if (!session) return { success: false, error: 'Not authenticated' }

  const organizer = await db.organizer.findUnique({
    where: { userId: session.userId },
    select: { id: true },
  })
  if (!organizer) return { success: false, error: 'Not an organizer' }

  const event = await db.event.findUnique({
    where: { id: eventId, organizerId: organizer.id },
    select: { id: true, status: true, slug: true },
  })
  if (!event) return { success: false, error: 'Event not found' }
  if (event.status === EventStatus.CANCELLED) {
    return { success: false, error: 'Event is already cancelled' }
  }

  await db.event.update({
    where: { id: eventId },
    data: { status: EventStatus.CANCELLED },
  })

  revalidatePath('/dashboard/events')
  revalidatePath(`/dashboard/events/${eventId}`)
  revalidatePath(`/events/${event.slug}`)
  return { success: true, data: undefined }
}

// ─── Update ticket type ───────────────────────────────────────────────────────

export async function updateTicketType(formData: FormData): Promise<ActionResult> {
  const session = await getSession()
  if (!session) return { success: false, error: 'Not authenticated' }

  const raw = Object.fromEntries(formData)

  // Normalise nullable fields: empty string → null
  if (raw.quantity === '') raw.quantity = null as unknown as string
  if (raw.salesStart === '') raw.salesStart = null as unknown as string
  if (raw.salesEnd === '') raw.salesEnd = null as unknown as string

  const parsed = updateTicketTypeSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }

  const { ticketTypeId, ...updates } = parsed.data

  const tt = await db.ticketType.findUnique({
    where: { id: ticketTypeId },
    select: { eventId: true, event: { select: { organizerId: true } } },
  })
  const organizer = await db.organizer.findUnique({
    where: { userId: session.userId },
    select: { id: true },
  })
  if (!tt || !organizer || tt.event.organizerId !== organizer.id) {
    return { success: false, error: 'Not found' }
  }

  await db.ticketType.update({
    where: { id: ticketTypeId },
    data: {
      ...updates,
      salesStart: updates.salesStart ? new Date(updates.salesStart) : updates.salesStart,
      salesEnd: updates.salesEnd ? new Date(updates.salesEnd) : updates.salesEnd,
    },
  })

  revalidatePath(`/dashboard/events/${tt.eventId}`)
  return { success: true, data: undefined }
}

// ─── Seat configuration ───────────────────────────────────────────────────────

const seatSectionSchema = z.object({
  name: z.string().min(1).max(120),
  code: z.string().min(1).max(20),
  type: z.enum(['RESERVED', 'GENERAL_ADMISSION']),
  ticketTypeId: z.string().min(1),
  priceOverride: z.coerce.number().int().min(0).optional(),
  rows: z
    .array(
      z.object({
        label: z.string().min(1).max(20),
        seatCount: z.coerce.number().int().min(1).max(500),
      })
    )
    .min(1),
})

const saveSeatConfigSchema = z.object({
  eventId: z.string().min(1),
  sections: z.array(seatSectionSchema).min(1),
})

export async function saveSeatConfiguration(input: {
  eventId: string
  sections: Array<{
    name: string
    code: string
    type: 'RESERVED' | 'GENERAL_ADMISSION'
    ticketTypeId: string
    priceOverride?: number
    rows: Array<{ label: string; seatCount: number }>
  }>
}): Promise<ActionResult<{ totalSeats: number }>> {
  const session = await getSession()
  if (!session) return { success: false, error: 'Not authenticated' }

  const parsed = saveSeatConfigSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }

  const { eventId, sections } = parsed.data

  // ── Ownership check ───────────────────────────────────────────────────────
  const organizer = await db.organizer.findUnique({
    where: { userId: session.userId },
    select: { id: true },
  })
  if (!organizer) return { success: false, error: 'Not an organizer' }

  const event = await db.event.findUnique({
    where: { id: eventId, organizerId: organizer.id },
    select: {
      id: true,
      title: true,
      venueCity: true,
      venueId: true,
      seatMapId: true,
      ticketTypes: { select: { id: true, price: true } },
    },
  })
  if (!event) return { success: false, error: 'Event not found' }

  // ── Guard: cannot reconfigure if any seats are SOLD/HELD ─────────────────
  const blockedCount = await db.eventSeat.count({
    where: { eventId, status: { in: ['SOLD', 'HELD', 'RESERVED'] } },
  })
  if (blockedCount > 0) {
    return {
      success: false,
      error: `Cannot reconfigure seats: ${blockedCount} seat(s) are already sold, held, or reserved.`,
    }
  }

  // ── Validate all ticketTypeIds belong to this event ───────────────────────
  const eventTTIds = new Set(event.ticketTypes.map((tt) => tt.id))
  for (const sec of sections) {
    if (!eventTTIds.has(sec.ticketTypeId)) {
      return { success: false, error: `Ticket type not found on this event` }
    }
  }

  const ttPriceMap = new Map(event.ticketTypes.map((tt) => [tt.id, tt.price]))

  // ── Transaction ───────────────────────────────────────────────────────────
  const totalSeats = await db.$transaction(async (tx) => {
    // 1. Find or create a Venue (required FK for SeatMap)
    let venueId = event.venueId
    if (!venueId) {
      const venue = await tx.venue.create({
        data: { name: event.title, city: event.venueCity ?? 'Lagos', country: 'Nigeria' },
        select: { id: true },
      })
      venueId = venue.id
      await tx.event.update({ where: { id: eventId }, data: { venueId } })
    }

    // 2. Find or create a SeatMap for this event
    let seatMapId = event.seatMapId
    if (!seatMapId) {
      const seatMap = await tx.seatMap.create({
        data: { venueId, name: event.title },
        select: { id: true },
      })
      seatMapId = seatMap.id
    }

    // 3. Delete AVAILABLE EventSeats so we can recreate cleanly
    await tx.eventSeat.deleteMany({ where: { eventId, status: 'AVAILABLE' } })

    // 4. Build seat layout and collect EventSeat records
    let count = 0
    const eventSeatData: {
      eventId: string
      seatId: string
      ticketTypeId: string
      price: number
      status: 'AVAILABLE'
    }[] = []

    for (const sec of sections) {
      // Section has no unique constraint on (seatMapId, code) — findFirst then upsert manually
      let section = await tx.section.findFirst({
        where: { seatMapId, code: sec.code },
        select: { id: true },
      })
      if (section) {
        await tx.section.update({
          where: { id: section.id },
          data: { name: sec.name, type: sec.type },
        })
      } else {
        section = await tx.section.create({
          data: { seatMapId, name: sec.name, code: sec.code, type: sec.type },
          select: { id: true },
        })
      }

      const sectionId = section.id
      const price = sec.priceOverride ?? ttPriceMap.get(sec.ticketTypeId) ?? 0

      for (let rowIdx = 0; rowIdx < sec.rows.length; rowIdx++) {
        const rowDef = sec.rows[rowIdx]!

        // Row: @@unique([sectionId, label])
        const row = await tx.row.upsert({
          where: { sectionId_label: { sectionId, label: rowDef.label } },
          update: { position: rowIdx, seatsCount: rowDef.seatCount },
          create: { sectionId, label: rowDef.label, position: rowIdx, seatsCount: rowDef.seatCount },
          select: { id: true },
        })

        for (let seatNum = 1; seatNum <= rowDef.seatCount; seatNum++) {
          const seatLabel = `${rowDef.label}${seatNum}`

          // Seat: @@unique([rowId, label])
          const seat = await tx.seat.upsert({
            where: { rowId_label: { rowId: row.id, label: seatLabel } },
            update: { number: seatNum, sectionId },
            create: { rowId: row.id, sectionId, label: seatLabel, number: seatNum },
            select: { id: true },
          })

          eventSeatData.push({
            eventId,
            seatId: seat.id,
            ticketTypeId: sec.ticketTypeId,
            price,
            status: 'AVAILABLE',
          })
          count++
        }
      }
    }

    // Batch-insert EventSeats (skipDuplicates handles any edge-case overlaps)
    await tx.eventSeat.createMany({ data: eventSeatData, skipDuplicates: true })

    // 5. Link SeatMap to event
    await tx.event.update({ where: { id: eventId }, data: { seatMapId } })

    return count
  })

  revalidatePath(`/dashboard/events/${eventId}`)
  return { success: true, data: { totalSeats } }
}
