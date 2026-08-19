/**
 * POST /api/scan-pin   — generate (or rotate) a scan PIN for an event
 * DELETE /api/scan-pin — revoke the scan PIN for an event
 *
 * Both require the caller to be the organizer of the event (or ADMIN).
 * Body: { eventId: string }
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { db } from '@/lib/db'
import { createScanPin, revokeScanPin, getScanPinTtl } from '@/lib/scan-pin'

async function resolveOrganizer(eventId: string, userId: string, role: string) {
  if (role === 'ADMIN') {
    return db.event.findUnique({ where: { id: eventId }, select: { organizerId: true } })
      .then((e) => e?.organizerId ?? null)
  }
  const org = await db.organizer.findUnique({ where: { userId }, select: { id: true } })
  if (!org) return null
  const event = await db.event.findUnique({
    where: { id: eventId, organizerId: org.id },
    select: { id: true },
  })
  return event ? org.id : null
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const eventId = body?.eventId as string | undefined
  if (!eventId) return NextResponse.json({ error: 'eventId required' }, { status: 400 })

  const organizerId = await resolveOrganizer(eventId, session.userId, session.role)
  if (!organizerId) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const pin = await createScanPin(eventId, organizerId)
  const ttl = await getScanPinTtl(eventId)

  // Format pin as XXX-XXX for readability
  const formatted = `${pin.slice(0, 3)}-${pin.slice(3)}`

  return NextResponse.json({ pin: formatted, ttlSeconds: ttl })
}

export async function DELETE(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const eventId = body?.eventId as string | undefined
  if (!eventId) return NextResponse.json({ error: 'eventId required' }, { status: 400 })

  const organizerId = await resolveOrganizer(eventId, session.userId, session.role)
  if (!organizerId) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  await revokeScanPin(eventId)
  return NextResponse.json({ revoked: true })
}
