/**
 * GET /api/payments/status?reservation=<id>
 *
 * Lightweight polling endpoint used by the checkout success page to detect
 * when the Paystack webhook has processed and flipped the reservation to
 * COMPLETED (and created tickets).
 *
 * Returns:
 *   { status: 'COMPLETED' | 'ACTIVE' | 'CANCELLED' | 'EXPIRED' }
 *
 * Only the owner of the reservation can query it.
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/session'

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const reservationId = req.nextUrl.searchParams.get('reservation')
  if (!reservationId) {
    return NextResponse.json({ error: 'reservation param required' }, { status: 400 })
  }

  const reservation = await db.reservation.findUnique({
    where: { id: reservationId, userId: session.userId },
    select: { status: true, expiresAt: true },
  })

  if (!reservation) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Surface an EXPIRED status so the client can stop polling
  const status =
    reservation.status === 'ACTIVE' && new Date(reservation.expiresAt) < new Date()
      ? 'EXPIRED'
      : reservation.status

  return NextResponse.json({ status })
}
