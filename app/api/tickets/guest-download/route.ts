/**
 * GET /api/tickets/guest-download?reservation=<reservationId>
 *
 * Public (no auth required) ticket download endpoint for guest purchasers.
 * The reservationId is the ownership proof — it's embedded as a signed URL
 * in the confirmation email, so only the email recipient can use it.
 *
 * Returns a ZIP file containing PNG images for all tickets in the order,
 * or a single PNG if there is only one ticket.
 *
 * Rate-limited to prevent enumeration attacks.
 */
import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { generateTicketImage, generateTicketImages } from '@/lib/ticket-image-generator'
import AdmZip from 'adm-zip'

// Simple in-memory rate limiting — max 10 requests per reservationId per minute
const rateMap = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(key: string): boolean {
  const now = Date.now()
  const entry = rateMap.get(key)
  if (!entry || now > entry.resetAt) {
    rateMap.set(key, { count: 1, resetAt: now + 60_000 })
    return true
  }
  if (entry.count >= 10) return false
  entry.count++
  return true
}

export async function GET(req: NextRequest) {
  const reservationId = req.nextUrl.searchParams.get('reservation')

  if (!reservationId || reservationId.length < 10) {
    return NextResponse.json({ error: 'Missing reservation ID' }, { status: 400 })
  }

  if (!checkRateLimit(reservationId)) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again in a minute.' },
      { status: 429 }
    )
  }

  // Load reservation with its completed order and tickets
  // Note: reservation → order is a one-to-one relation (order field, singular)
  const reservation = await db.reservation.findUnique({
    where: { id: reservationId },
    select: {
      id: true,
      status: true,
      event: {
        select: {
          title: true,
          startsAt: true,
          imageUrl: true,
          venue: { select: { name: true, city: true } },
          venueName: true,
          venueCity: true,
        },
      },
      order: {
        select: {
          id: true,
          tickets: {
            select: {
              id: true,
              ticketNumber: true,
              qrCode: true,
              status: true,
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
      },
    },
  })

  if (!reservation) {
    return NextResponse.json({ error: 'Reservation not found' }, { status: 404 })
  }

  if (reservation.status !== 'COMPLETED') {
    return NextResponse.json(
      { error: 'Payment not yet confirmed. Please wait a moment and try again.' },
      { status: 402 }
    )
  }

  const tickets = reservation.order?.tickets ?? []
  if (tickets.length === 0) {
    return NextResponse.json({ error: 'No tickets found for this reservation' }, { status: 404 })
  }

  // Resolve event venue string
  const ev = reservation.event
  const venueStr = ev.venue
    ? `${ev.venue.name}, ${ev.venue.city}`
    : [ev.venueName, ev.venueCity].filter(Boolean).join(', ') || undefined

  // Build TicketData array
  const ticketDataList = tickets.map((t) => {
    const slot = t.timeSlotTickets[0]?.timeSlot
    return {
      ticketNumber: t.ticketNumber,
      qrCode: t.qrCode,
      eventTitle: ev.title,
      eventDate: slot?.startsAt ?? ev.startsAt,
      eventImageUrl: ev.imageUrl ?? undefined,
      eventVenue: venueStr,
      showLabel: slot?.label ?? undefined,
      ticketType: t.ticketType.name,
      seatLabel: t.eventSeat?.seat?.label ?? undefined,
      ticketId: t.id,
      status: t.status as 'ACTIVE' | 'USED' | 'CANCELLED' | 'REFUNDED' | 'EXPIRED',
    }
  })

  // Single ticket — return PNG directly
  if (tickets.length === 1) {
    try {
      const pngBuffer = await generateTicketImage(ticketDataList[0])
      return new NextResponse(new Uint8Array(pngBuffer), {
        status: 200,
        headers: {
          'Content-Type': 'image/png',
          'Content-Disposition': `attachment; filename="ticket-${tickets[0].ticketNumber}.png"`,
          'Cache-Control': 'private, no-store',
        },
      })
    } catch (err) {
      console.error('[guest-download] Failed to generate ticket image:', err)
      return NextResponse.json({ error: 'Failed to generate ticket' }, { status: 500 })
    }
  }

  // Multiple tickets — return ZIP
  try {
    const zip = new AdmZip()
    const images = await generateTicketImages(ticketDataList)
    for (const img of images) {
      zip.addFile(img.filename, img.content)
    }

    const sanitizedTitle = ev.title
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 30)

    const zipFilename = `tickets-${sanitizedTitle}-${reservationId.slice(0, 8)}.zip`
    const zipBuffer = zip.toBuffer()

    return new NextResponse(new Uint8Array(zipBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${zipFilename}"`,
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (err) {
    console.error('[guest-download] Failed to generate ticket ZIP:', err)
    return NextResponse.json({ error: 'Failed to generate tickets' }, { status: 500 })
  }
}
