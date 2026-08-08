/**
 * POST /api/auth/send-otp
 *
 * Accepts { email, action: 'sign-in' | 'sign-up' }
 * Generates an OTP, stores it, and emails it via Resend.
 */
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { generateOtp, storeOtp } from '@/lib/otp'
import { resend, FROM_EMAIL } from '@/emails'
import { OtpEmail } from '@/emails/otp-email'

const schema = z.object({
  email: z.string().email('Please enter a valid email address'),
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

    const { email, action } = result.data
    const actionLabel = action === 'sign-up' ? 'sign up' : 'sign in'

    const otp = generateOtp()
    await storeOtp(email, otp)

    // Pass the JSX element directly — Resend handles server-side rendering internally.
    // This avoids importing react-dom/server which is blocked in Next.js App Router routes.
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: `Your SWITCH ${actionLabel} code: ${otp}`,
      react: OtpEmail({ otp, action: actionLabel }),
    })

    if (error) {
      console.error('[send-otp] Resend error:', error)
      return NextResponse.json(
        { error: 'Failed to send email. Please try again.' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[send-otp] Unexpected error:', err)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
