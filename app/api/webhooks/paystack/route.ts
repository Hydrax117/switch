/**
 * POST /api/webhooks/paystack
 *
 * Receives Paystack webhook events, verifies the signature, and handles:
 *  - charge.success   → confirm the order, issue all tickets, create Order + Payment records
 *  - transfer.success → mark PayoutRequest as COMPLETED
 *  - transfer.failed  → mark PayoutRequest as back to APPROVED (retry)
 *
 * Order creation logic lives in lib/confirm-charge.ts so it is shared with
 * the payment-recovery cron job.
 */

import { NextRequest, NextResponse } from 'next/server'
import { paystack } from '@/lib/paystack'
import { confirmCharge } from '@/lib/confirm-charge'
import { db } from '@/lib/db'
import { PayoutStatus } from '@/app/generated/prisma/client'

export const maxDuration = 60

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const signature = req.headers.get('x-paystack-signature') ?? ''

  if (!(await paystack.verifyWebhookSignature(rawBody, signature))) {
    console.warn('[webhook/paystack] Invalid signature')
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let event: { event: string; data: Record<string, unknown> }
  try {
    event = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  try {
    if (event.event === 'charge.success') {
      await handleChargeSuccess(event.data)
    } else if (event.event === 'transfer.success') {
      await handleTransferSuccess(event.data)
    } else if (event.event === 'transfer.failed') {
      await handleTransferFailed(event.data)
    }
  } catch (err) {
    console.error('[webhook/paystack] handler error:', {
      error: err instanceof Error ? err.message : String(err),
      eventType: event.event,
      reference: event.data?.reference,
      stack: err instanceof Error ? err.stack : undefined,
    })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}

// ─── charge.success ───────────────────────────────────────────────────────────

async function handleChargeSuccess(data: Record<string, unknown>) {
  const reference = data.reference as string

  // Re-verify via the Paystack API to get authoritative metadata.
  // The webhook payload can mangle nested arrays; verifyTransaction always
  // returns them intact.
  let verified: Awaited<ReturnType<typeof paystack.verifyTransaction>>
  try {
    verified = await paystack.verifyTransaction(reference)
  } catch (err) {
    console.error('[webhook/paystack] verifyTransaction failed', { reference, err })
    throw err // propagate so Paystack retries the webhook
  }

  if (verified.status !== 'success') {
    console.warn('[webhook/paystack] Transaction not successful', {
      reference,
      status: verified.status,
    })
    return
  }

  const meta = (verified.metadata ?? {}) as Record<string, unknown>

  // Group-booking slot payments are handled by a separate action
  const groupSlotId = meta.groupSlotId as string | undefined
  if (groupSlotId) {
    const { confirmGroupSlotPayment } = await import('@/features/group-booking/actions')
    const result = await confirmGroupSlotPayment({
      slotId: groupSlotId,
      paystackReference: reference,
    })
    if (!result.success) {
      console.error('[webhook/paystack] confirmGroupSlotPayment failed:', result.error)
    }
    return
  }

  // All other orders (reserved, GA, time-slot) go through the shared handler
  const result = await confirmCharge(verified)
  console.log('[webhook/paystack] confirmCharge result', { reference, result })
}

// ─── transfer.success ─────────────────────────────────────────────────────────

async function handleTransferSuccess(data: Record<string, unknown>) {
  const transferCode = data.transfer_code as string
  await db.payoutRequest.updateMany({
    where: { paystackTransferCode: transferCode },
    data: { status: PayoutStatus.COMPLETED, completedAt: new Date() },
  })
}

// ─── transfer.failed ──────────────────────────────────────────────────────────

async function handleTransferFailed(data: Record<string, unknown>) {
  const transferCode = data.transfer_code as string
  await db.payoutRequest.updateMany({
    where: { paystackTransferCode: transferCode },
    data: { status: PayoutStatus.APPROVED },
  })
}
