/**
 * Email module — powered by Resend.
 *
 * Email templates (React Email components) live in this directory.
 * The Resend client is initialised once and exported for use in
 * server-side code and workers.
 */
import { Resend } from 'resend'

const globalForResend = globalThis as unknown as { resend: Resend | undefined }

export const resend = globalForResend.resend ?? new Resend(process.env.RESEND_API_KEY)

if (process.env.NODE_ENV !== 'production') {
  globalForResend.resend = resend
}

export const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? 'noreply@switchapp.io'
