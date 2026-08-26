import 'server-only'
import { db } from '@/lib/db'
import { EventStatus, TicketStatus } from '@/app/generated/prisma/client'

// ─── Get organizer profile for a user ────────────────────────────────────────

export async function getOrganizerByUserId(userId: string) {
  return db.organizer.findUnique({
    where: { userId },
    select: {
      id: true,
      name: true,
      slug: true,
      logoUrl: true,
      status: true,
    },
  })
}

// ─── Get organizer's events ───────────────────────────────────────────────────

export async function getOrganizerEvents(organizerId: string) {
  return db.event.findMany({
    where: { organizerId },
    select: {
      id: true,
      title: true,
      slug: true,
      imageUrl: true,
      status: true,
      seatingType: true,
      startsAt: true,
      endsAt: true,
      capacity: true,
      category: { select: { name: true, color: true } },
      venue: { select: { name: true, city: true } },
      _count: { select: { tickets: true, eventSeats: true } },
      ticketTypes: {
        select: { price: true, quantity: true, sold: true, currency: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  })
}

// ─── Get single event for management ─────────────────────────────────────────

export async function getOrganizerEvent(eventId: string, organizerId: string) {
  return db.event.findUnique({
    where: { id: eventId, organizerId },
    include: {
      category: true,
      venue: true,
      ticketTypes: { orderBy: { price: 'asc' } },
      _count: { select: { tickets: true, eventSeats: true } },
    },
  })
}

// ─── Dashboard overview stats ─────────────────────────────────────────────────

export async function getOrganizerStats(organizerId: string) {
  const [totalEvents, publishedEvents, totalTickets, upcomingEvents] = await Promise.all([
    db.event.count({ where: { organizerId } }),
    db.event.count({ where: { organizerId, status: EventStatus.PUBLISHED } }),
    db.ticket.count({
      where: { event: { organizerId } },
    }),
    db.event.count({
      where: {
        organizerId,
        status: EventStatus.PUBLISHED,
        startsAt: { gte: new Date() },
      },
    }),
  ])

  // Revenue: sum of prices for sold event seats
  const soldSeats = await db.eventSeat.aggregate({
    where: {
      event: { organizerId },
      status: 'SOLD',
    },
    _sum: { price: true },
  })

  return {
    totalEvents,
    publishedEvents,
    totalTickets,
    upcomingEvents,
    totalRevenue: soldSeats._sum.price ?? 0,
  }
}

// ─── Get event images ─────────────────────────────────────────────────────────

export async function getEventImages(eventId: string) {
  return db.eventImage.findMany({
    where: { eventId },
    select: { url: true, position: true },
    orderBy: { position: 'asc' },
  })
}

// ─── Get event speakers ───────────────────────────────────────────────────────

export async function getEventSpeakers(eventId: string) {
  return db.eventSpeaker.findMany({
    where: { eventId },
    select: { id: true, name: true, role: true, avatarUrl: true, position: true },
    orderBy: { position: 'asc' },
  })
}

// ─── User ticket history ──────────────────────────────────────────────────────

export async function getUserTickets(userId: string, filters?: { status?: string | TicketStatus }): Promise<Array<{
  id: string
  ticketNumber: string
  qrCode: string
  status: TicketStatus
  issuedAt: Date
  createdAt: Date
  updatedAt: Date
  eventId: string
  ticketTypeId: string
  userId: string
  eventSeatId: string | null
  event: {
    id: string
    title: string
    slug: string
    imageUrl: string | null
    startsAt: Date
    venue: { id: string; name: string; city: string } | null
  }
  ticketType: {
    id: string
    name: string
    price: number
    currency: string
  }
  eventSeat: {
    id: string
    seat: { id: string; label: string; number: number | null }
  } | null
}>> {
  // Validate status is a valid TicketStatus if provided
  const validStatuses = ['ACTIVE', 'USED', 'REFUNDED', 'CANCELLED', 'EXPIRED']
  const status = filters?.status && validStatuses.includes(filters.status) 
    ? (filters.status as TicketStatus)
    : undefined

  return db.ticket.findMany({
    where: {
      userId,
      ...(status ? { status } : {}),
    },
    select: {
      id: true,
      ticketNumber: true,
      qrCode: true,
      status: true,
      issuedAt: true,
      createdAt: true,
      updatedAt: true,
      eventId: true,
      ticketTypeId: true,
      userId: true,
      eventSeatId: true,
      event: {
        select: {
          id: true,
          title: true,
          slug: true,
          imageUrl: true,
          startsAt: true,
          venue: { select: { id: true, name: true, city: true } },
        },
      },
      ticketType: { select: { id: true, name: true, price: true, currency: true } },
      eventSeat: {
        select: {
          id: true,
          seat: { select: { id: true, label: true, number: true } },
        },
      },
    },
    orderBy: { issuedAt: 'desc' },
  })
}

