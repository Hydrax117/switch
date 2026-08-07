/**
 * ioredis singleton — shared across server-side code.
 *
 * Stored on `globalThis` to survive Next.js hot reloads in development,
 * identical to the Prisma singleton pattern.
 */
import IORedis from 'ioredis'

const globalForRedis = globalThis as unknown as {
  redis: IORedis | undefined
}

function createRedisClient() {
  if (!process.env.REDIS_URL) {
    // Return a no-op stub when Redis is not configured (e.g. during initial setup)
    return null
  }

  const client = new IORedis(process.env.REDIS_URL, {
    maxRetriesPerRequest: null, // Required by BullMQ
    enableReadyCheck: false,
  })

  client.on('error', (err) => {
    console.error('[Redis] Connection error:', err)
  })

  return client
}

export const redis = globalForRedis.redis ?? createRedisClient()

if (process.env.NODE_ENV !== 'production') {
  globalForRedis.redis = redis ?? undefined
}
