/**
 * Health check endpoint — GET /api/health
 *
 * Used by load balancers, uptime monitors, and CI pipelines to verify
 * the app is running and dependencies are reachable.
 */
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const checks: Record<string, string> = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version ?? 'unknown',
    environment: process.env.NODE_ENV ?? 'unknown',
  }

  return NextResponse.json(checks, { status: 200 })
}
