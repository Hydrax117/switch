/**
 * Prisma Client Singleton
 *
 * Uses DATABASE_URL (transaction-mode pooler, port 6543) at runtime.
 * Transaction mode is required for serverless — it releases connections
 * immediately after each query, preventing pool exhaustion.
 *
 * DIRECT_URL (session-mode, port 5432) is only for prisma migrate CLI —
 * never for runtime queries.
 *
 * ?pgbouncer=true is stripped — it's a Prisma engine hint, not a valid pg param.
 */
import 'server-only'
import { PrismaClient } from '@/app/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

function buildConnectionString(): string {
  // Always use DATABASE_URL (transaction pooler) at runtime — never DIRECT_URL
  const raw = process.env.DATABASE_URL
  if (!raw) throw new Error('DATABASE_URL is not set in .env')
  // Strip ?pgbouncer=true — only meaningful to the legacy Prisma query engine
  return raw.replace(/([?&])pgbouncer=true&?/gi, '$1').replace(/[?&]$/, '')
}

function createPrismaClient(): PrismaClient {
  const connectionString = buildConnectionString()
  const adapter = new PrismaPg({
    connectionString,
    max: 5,                          // transaction pooler handles concurrency externally
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
  })
  return new PrismaClient({ adapter })
}

export const db = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db
}
