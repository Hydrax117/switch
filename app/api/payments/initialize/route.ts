/**
 * POST /api/payments/initialize
 *
 * Initializes a Paystack transaction for a reservation.
 * Returns the authorization_url to redirect the user to Paystack Checkout.
 *
 * Body: { reservationId: string; promoCode?: string; billingInfo: BillingInfo }
 *
 * Works for both authenticated users and guests. Guests must supply billingInfo
 * whose email is used to upsert a User record (so FK constraints are satisfied)
 * and to receive ticket confirmation emails.
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/session'
import { paystack } from '@/lib/paystack'
import { rateLimit } from '@/lib/rate-limit'
import { randomBytes } from 'crypto'
import { z } from 'zod'

// ─── Validation ───────────────────────────────────────────────────────────────

const bodySchema = z.object({
  reservationId: z.string().min(1),
  promoCode: z.string().optional(),
  billingInfo: z.object({
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    phone: z.string().min(1),
    email: z.string().email(),
    country: z.string().min(1),
  }),
})

// ─── Promo code helpers ───────────────────────────────────────────────────────

function calcDiscount(
  discountType: 'PERCENTAGE' | 'FLAT',
  discountValue: number,
  subtotal: number
): number {
  if (discountType === 'PERCENTAGE') {
    return Math.round(subtotal * (discountValue / 100))
  }
  return Math.min(discountValue, subtotal)
}

export async function POST(req: NextRequest) {
  const session = await getSession()

  const body = await req.json().catch(() => null)
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { reservationId, billingInfo, promoCode: promoCodeRaw } = parsed.data
  const promoCodeInput = promoCodeRaw?.toUpperCase().trim() || undefined

  // Rate limit by user or billing email
  const rateLimitKey = session
    ? `pay-init:user:${session.userId}`
    : `pay-init:email:${billingInfo.email.toLowerCase()}`
  const rl = await rateLimit(rateLimitKey, { limit: 10, windowMs: 60_000, failClosed: true })
  if (!rl.success) {
    return NextResponse.json(
      { error: 'Too many requests. Please wait before trying again.' },
      {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)) },
      }
    )
  }

  // Resolve userId — authenticated or guest upsert
  let userId: string
  if (session) {
    userId = session.userId
    await db.user
      .update({
        where: { id: userId },
        data: { name: `${billingInfo.firstName} ${billingInfo.lastName}`.trim() },
      })
      .catch(() => {
        /* non-fatal */
      })
  } else {
    const guest = await db.user.upsert({
      where: { email: billingInfo.email.toLowerCase() },
      update: { name: `${billingInfo.firstName} ${billingInfo.lastName}`.trim() },
      create: {
        email: billingInfo.email.toLowerCase(),
        name: `${billingInfo.firstName} ${billingInfo.lastName}`.trim(),
      },
      select: { id: true },
    })
    userId = guest.id
  }

  const reservation = await db.reservation.findUnique({
    where: { id: reservationId },
    include: {
      eventSeats: {
        include: { ticketType: { select: { id: true, price: true, currency: true } } },
      },
      event: { select: { id: true, slug: true, title: true } },
    },
  })

  if (!reservation) {
    return NextResponse.json({ error: 'Reservation not found' }, { status: 404 })
  }
  // Ownership check: must match the resolved userId
  if (reservation.userId !== userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }
  if (reservation.status !== 'ACTIVE') {
    return NextResponse.json({ error: 'Reservation is no longer active' }, { status: 400 })
  }
  if (new Date(reservation.expiresAt) < new Date()) {
    return NextResponse.json({ error: 'Reservation has expired' }, { status: 400 })
  }

  // Calculate base subtotal
  const subtotal = reservation.eventSeats.reduce((sum, seat) => {
    return sum + (seat.ticketType?.price ?? 0)
  }, 0)

  // ── Promo code validation ────────────────────────────────────────────────
  let promoCodeId: string | undefined
  let discountAmount = 0
  let totalAmount = subtotal

  if (promoCodeInput && subtotal > 0) {
    const ticketTypeIds = [
      ...new Set(
        reservation.eventSeats
          .map((es) => es.ticketType?.id)
          .filter((id): id is string => Boolean(id))
      ),
    ]

    const promo = await db.promoCode.findFirst({
      where: { code: promoCodeInput, isActive: true, eventId: reservation.eventId },
      select: {
        id: true,
        discountType: true,
        discountValue: true,
        maxUses: true,
        usedCount: true,
        expiresAt: true,
        ticketTypeId: true,
      },
    })

    if (!promo) {
      return NextResponse.json({ error: 'Invalid or expired promo code' }, { status: 400 })
    }
    if (promo.expiresAt && new Date(promo.expiresAt) < new Date()) {
      return NextResponse.json({ error: 'This promo code has expired' }, { status: 400 })
    }
    if (promo.maxUses !== null && promo.usedCount >= promo.maxUses) {
      return NextResponse.json(
        { error: 'This promo code has reached its usage limit' },
        { status: 400 }
      )
    }
    if (promo.ticketTypeId && !ticketTypeIds.includes(promo.ticketTypeId)) {
      return NextResponse.json(
        { error: 'This code is not valid for the selected ticket types' },
        { status: 400 }
      )
    }

    discountAmount = calcDiscount(
      promo.discountType as 'PERCENTAGE' | 'FLAT',
      promo.discountValue,
      subtotal
    )
    totalAmount = Math.max(0, subtotal - discountAmount)
    promoCodeId = promo.id
  }

  // Free (original or post-discount) — skip Paystack, confirm directly
  if (totalAmount === 0) {
    return NextResponse.json({
      free: true,
      reservationId,
      promoCodeId: promoCodeId ?? null,
      discountAmount,
    })
  }

  const paystackEmail = billingInfo.email.toLowerCase()
  const reference = `SWT-${Date.now()}-${randomBytes(4).toString('hex')}`
  const callbackUrl = `${process.env.NEXT_PUBLIC_APP_URL}/events/${reservation.event.slug}/checkout/success?reservation=${reservationId}`

  const result = await paystack.initializeTransaction({
    email: paystackEmail,
    amount: totalAmount,
    reference,
    callback_url: callbackUrl,
    metadata: {
      reservationId,
      userId,
      isGuest: !session,
      eventId: reservation.event.id,
      promoCodeId: promoCodeId ?? null,
      discountAmount,
      custom_fields: [
        {
          display_name: 'Event',
          variable_name: 'event_title',
          value: reservation.event.title,
        },
      ],
    },
  })

  return NextResponse.json({
    authorizationUrl: result.authorization_url,
    reference,
    discountAmount,
    finalTotal: totalAmount,
  })
}
