'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getSession } from '@/lib/session'
import { EventStatus, SeatingType } from '@/app/generated/prisma/client'

// ─── Schemas ─────────────────────────────────────────────────────────────────

const createEventSchema = z.object({
  title: z.string().min(3).max(120),
  description: z.string().max(5000).optional(),
  categoryId: z.string().optional(),
  venueId: z.string().optional(),
  seatingType: z.nativeEnum(SeatingType),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime().optional(),
  salesStart: z.string().datetime().optional(),
  salesEnd: z.string().datetime().optional(),
  capacity: z.coerce.number().int().positive().optional(),
  imageUrl: z.string().url().optional(),
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

  const { title, ...rest } = parsed.data
  const slug = await uniqueSlug(slugify(title))

  const event = await db.event.create({
    data: {
      organizerId: organizer.id,
      title,
      slug,
      status: EventStatus.DRAFT,
      ...rest,
      startsAt: new Date(rest.startsAt),
      endsAt: rest.endsAt ? new Date(rest.endsAt) : undefined,
      salesStart: rest.salesStart ? new Date(rest.salesStart) : undefined,
      salesEnd: rest.salesEnd ? new Date(rest.salesEnd) : undefined,
    },
    select: { id: true, slug: true },
  })

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

  await db.event.update({
    where: { id: eventId },
    data: {
      ...updates,
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
