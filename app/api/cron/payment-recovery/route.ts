/**
 * POST /api/cron/payment-recovery
 *
 * Runs on a schedule (every 5 minutes via Vercel Cron).
 * Finds reservations that are still ACTIVE past their expiry window AND have a
 * stored Paystack reference, then calls verifyTransaction for each one. If
 * Paystack confirms the charge succeeded, confirmCharge() issues the Order,
 * Payment, and Tickets — identical to what the live webhook does.
 *
 * This closes the gap where:
 *  - The webhook fired but got a 308/4xx/5xx and was never retried
 *  - The webhook was delivered after the reservation expiry job ran
 *  - Any other transient failure between Paystack charging and our DB updating
 *
 * Design notes:
 *  - Single DB query fetches ALL candidates — no N+1 per reservation
 *  - verifyTransaction is called once per candidate (unavoidable — Paystack API)
 *  - confirmCharge is fully idempotent, safe to call more than once
 *  - Looks back 2 hours to catch slow Paystack retries; ignores anything older
 *    (those users should contact support, they may have already been refunded)
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { paystack } from '@/lib/paystack'
import { confirmCharge } from '@/lib/confirm-charge'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Look back window: reservations that expired within this many milliseconds ago.
// Wide enough to catch Paystack's own retry window (~30 min), plus buffer.
const LOOKBACK_MS = 2 * 60 * 60 * 1000 // 2 hours

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return req.headers.get('authorization') === `Bearer ${secret}`
}

export async function GET(req: NextRequest) {
  return handler(req)
}
export async function POST(req: NextRequest) {
  return handler(req)
}

async function handler(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const lookbackAt = new Date(now.getTime() - LOOKBACK_MS)

  // ── Single query — fetch ALL candidates at once (no N+1) ─────────────────
  // Index hint: @@index([status, expiresAt]) covers this filter efficiently.
  const candidates = await db.reservation.findMany({
    where: {
      status: 'ACTIVE',
      expiresAt: { lt: now, gte: lookbackAt },
      paystackReference: { not: null },
    },
    select: {
      id: true,
      paystackReference: true,
    },
  })

  if (candidates.length === 0) {
    return NextResponse.json({ ok: true, checked: 0, confirmed: 0, skipped: 0, errors: 0 })
  }

  console.log(`[PaymentRecovery] Checking ${candidates.length} candidate reservation(s)`)

  let confirmed = 0
  let skipped = 0
  let errors = 0

  // Process candidates sequentially to avoid hammering Paystack's rate limits.
  // Each iteration: 1 Paystack API call + 1 DB transaction.
  for (const candidate of candidates) {
    // paystackReference is guaranteed non-null by the where clause above
    const reference = candidate.paystackReference!

    try {
      const verified = await paystack.verifyTransaction(reference)

      if (verified.status === 'success') {
        const result = await confirmCharge(verified)

        if (result.status === 'confirmed') {
          confirmed++
          console.log(`[PaymentRecovery] Confirmed order for reservation ${candidate.id}`)
        } else if (result.status === 'skipped') {
          skipped++
          console.log(`[PaymentRecovery] Skipped ${candidate.id}: ${result.reason}`)
        } else {
          errors++
          console.error(`[PaymentRecovery] Error for ${candidate.id}: ${result.reason}`)
        }
      } else {
        // Payment not successful — abandon the reservation.
        // The reservation expiry worker will (or already did) release the seats.
        skipped++
        console.log(
          `[PaymentRecovery] Transaction ${reference} status=${verified.status} — skipping`
        )
      }
    } catch (err) {
      errors++
      console.error(`[PaymentRecovery] verifyTransaction failed for ${reference}:`, err)
    }
  }

  console.log(`[PaymentRecovery] Done. confirmed=${confirmed} skipped=${skipped} errors=${errors}`)

  return NextResponse.json({
    ok: true,
    checked: candidates.length,
    confirmed,
    skipped,
    errors,
  })
}
