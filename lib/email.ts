/**
 * Email Service — Resend
 *
 * Thin wrapper around the Resend SDK. All email sending goes through here.
 */
import 'server-only'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

const FROM = process.env.RESEND_FROM_EMAIL ?? 'noreply@switchapp.io'
const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? 'SWITCH'

export async function sendOtpEmail(email: string, otp: string): Promise<void> {
  const { error } = await resend.emails.send({
    from: FROM,
    to: email,
    subject: `Your ${APP_NAME} login code`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#09090b;color:#fafafa;border-radius:12px;">
        <h1 style="font-size:24px;font-weight:700;margin:0 0 8px;">${APP_NAME}</h1>
        <p style="color:#a1a1aa;margin:0 0 32px;font-size:14px;">Your one-time login code</p>
        <div style="background:#18181b;border-radius:8px;padding:24px;text-align:center;letter-spacing:0.3em;font-size:32px;font-weight:700;font-family:monospace;">
          ${otp}
        </div>
        <p style="color:#71717a;font-size:13px;margin:24px 0 0;">
          This code expires in <strong style="color:#a1a1aa;">10 minutes</strong>.
          If you didn't request this, you can safely ignore this email.
        </p>
      </div>
    `,
  })

  if (error) {
    throw new Error(`Failed to send OTP email: ${error.message}`)
  }
}
