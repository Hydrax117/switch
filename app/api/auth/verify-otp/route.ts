/**
 * POST /api/auth/verify-otp
 *
 * Accepts { email, otp, action: 'sign-in' | 'sign-up' }
 * Verifies the OTP, upserts the user (sign-up creates; sign-in finds),
 * then triggers an Auth.js Credentials sign-in token.
 *
 * Returns { success: true, isNewUser: boolean } on success.
 */
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { verifyOtp } from '@/lib/otp'
import { db } from '@/lib/prisma'

const schema = z.object({
  email: z.string().email('Please enter a valid email address'),
  otp: z.string().length(6, 'OTP must be 6 digits'),
  action: z.enum(['sign-in', 'sign-up']).default('sign-in'),
})

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const result = schema.safeParse(body)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.errors[0]?.message ?? 'Invalid request' },
        { status: 400 }
      )
    }

    const { email, otp, action } = result.data

    const valid = await verifyOtp(email, otp)
    if (!valid) {
      return NextResponse.json(
        { error: 'Invalid or expired code. Please request a new one.' },
        { status: 401 }
      )
    }

    // Upsert the user — creates on first sign-up, finds on sign-in
    const user = await db.user.upsert({
      where: { email: email.toLowerCase() },
      create: {
        email: email.toLowerCase(),
        emailVerified: new Date(),
      },
      update: {
        emailVerified: new Date(),
      },
    })

    const isNewUser = action === 'sign-up' || !user.name

    return NextResponse.json({ success: true, userId: user.id, isNewUser })
  } catch (err) {
    console.error('[verify-otp] Unexpected error:', err)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
