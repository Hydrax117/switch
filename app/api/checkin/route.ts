/**
 * POST /api/checkin
 *
 * Validates a ticket QR code and marks it as USED.
 *
 * Auth — two modes, checked in order:
 *  1. Session cookie (organizer logged in on their own device)
 *  2. Scan PIN  (door staff using a shared PIN — no login required)
 *     Body must include { scanPin: string } alongside qrCode + eventId.
 *
 * Body: { qrCode: string; eventId: string; scanPin?: string }
 *
 * Returns:
 *   200 { success: true;  ticket: { ticketNumber, attendeeName, ticketTypeName, seatLabel } }
 *   200 { success: false; reason: 'ALREADY_USED' | 'INVALID' | 'CANCELLED', ticket? }
 *   400  missing params
 *   401  not authenticated
 *   403  wrong organizer
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/session'
import { verifyScanPin } from '@/lib/scan-pin'
import { TicketStatus } from '@/app/generated/prisma/client'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const qrCode   = body?.qrCode   as string | undefined
  const eventId  = body?.eventId  as string | undefined
  const scanPin  = body?.scanPin  as string | undefined

  if (!qrCode || !eventId) {
    return NextResponse.json({ error: 'qrCode and eventId are required' }, { status: 400 })
  }

  // ── Resolve who is calling ────────────────────────────────────────────────
  let authorized = false

  // 1. Session-based auth (organizer logged in)
  const session = await getSession()
  if (session) {
    if (session.role === 'ADMIN') {
      authorized = true
    } else {
      const organizer = await db.organizer.findUnique({
        where: { userId: session.userId },
        select: { id: true },
      })
      if (organizer) {
        const event = await db.event.findUnique({
          where: { id: eventId, organizerId: organizer.id },
          select: { id: true },
        })
        if (event) authorized = true
      }
    }
  }

  // 2. PIN-based auth (door staff without login)
  if (!authorized && scanPin) {
    const organizerId = await verifyScanPin(eventId, scanPin)
    if (organizerId) {
      // Double-check the event still belongs to that organizer
      const event = await db.event.findUnique({
        where: { id: eventId, organizerId },
        select: { id: true },
      })
      if (event) authorized = true
    }
  }

  if (!authorized) {
    return NextResponse.json(
      { error: session ? 'Event not found or unauthorized' : 'Not authenticated' },
      { status: session ? 403 : 401 },
    )
  }

  // ── Find and validate the ticket ─────────────────────────────────────────
  const ticket = await db.ticket.findFirst({
    where: { qrCode, eventId },
    select: {
      id: true,
      ticketNumber: true,
      status: true,
      ticketType: { select: { name: true } },
      eventSeat: { select: { seat: { select: { label: true } } } },
      user: { select: { name: true, email: true } },
    },
  })

  if (!ticket) {
    return NextResponse.json({ success: false, reason: 'INVALID' })
  }

  if (ticket.status === TicketStatus.USED) {
    return NextResponse.json({
      success: false,
      reason: 'ALREADY_USED',
      ticket: {
        ticketNumber: ticket.ticketNumber,
        attendeeName: ticket.user.name ?? ticket.user.email,
        ticketTypeName: ticket.ticketType.name,
        seatLabel: ticket.eventSeat?.seat?.label ?? null,
      },
    })
  }

  if (
    ticket.status === TicketStatus.CANCELLED ||
    ticket.status === TicketStatus.REFUNDED
  ) {
    return NextResponse.json({ success: false, reason: 'CANCELLED' })
  }

  // ── Mark as USED ──────────────────────────────────────────────────────────
  await db.ticket.update({
    where: { id: ticket.id },
    data: { status: TicketStatus.USED },
  })

  return NextResponse.json({
    success: true,
    ticket: {
      ticketNumber: ticket.ticketNumber,
      attendeeName: ticket.user.name ?? ticket.user.email,
      ticketTypeName: ticket.ticketType.name,
      seatLabel: ticket.eventSeat?.seat?.label ?? null,
    },
  })
}
