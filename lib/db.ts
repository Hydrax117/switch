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
 * ?pgbouncer=true is a Prisma-only hint — the pg driver doesn't understand it
 * and can misparse the URL. We strip it before building the Pool.
 */
import 'server-only'
import { Pool } from 'pg'
import { PrismaClient } from '@/app/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

function buildPool(): Pool {
  const raw = process.env.DATABASE_URL
  if (!raw) throw new Error('DATABASE_URL is not set')

  // Parse the URL, strip Prisma-only params, rebuild cleanly
  const url = new URL(raw)
  url.searchParams.delete('pgbouncer')
  url.searchParams.delete('connection_limit')
  url.searchParams.delete('pool_timeout')
  const connectionString = url.toString()

  return new Pool({
    connectionString,
    max: 5,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
    ssl: { rejectUnauthorized: false },
  })
}

function createPrismaClient(): PrismaClient {
  const adapter = new PrismaPg(buildPool())
  return new PrismaClient({ adapter })
}

export const db = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db
}
