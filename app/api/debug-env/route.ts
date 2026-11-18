/**
 * GET /api/debug-env
 * Temporary diagnostic endpoint — reports which env vars are present/absent.
 * DELETE THIS FILE before merging to main.
 */
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const REQUIRED_VARS = [
  'DATABASE_URL',
  'DIRECT_URL',
  'AUTH_SECRET',
  'REDIS_URL',
  'WORKER_REDIS_URL',
  'PAYSTACK_SECRET_KEY',
  'PAYSTACK_WEBHOOK_SECRET',
  'NEXT_PUBLIC_APP_URL',
  'RESEND_API_KEY',
  'RESEND_FROM_EMAIL',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_ANON_KEY',
  'PLATFORM_FEE_PERCENT',
  'NIN_ENCRYPTION_KEY',
]

export async function GET() {
  const result: Record<string, string> = {}

  for (const key of REQUIRED_VARS) {
    const val = process.env[key]
    if (!val) {
      result[key] = '❌ MISSING'
    } else if (
      key.includes('SECRET') ||
      key.includes('KEY') ||
      key.includes('PASSWORD') ||
      key === 'DATABASE_URL' ||
      key === 'DIRECT_URL' ||
      key === 'REDIS_URL'
    ) {
      result[key] = `✅ SET (${val.slice(0, 6)}...)`
    } else {
      result[key] = `✅ ${val}`
    }
  }

  return NextResponse.json(result)
}
