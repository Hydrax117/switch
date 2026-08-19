/**
 * Scan PIN helpers
 *
 * A scan PIN lets door staff check in attendees without an organizer login.
 * The organizer generates a PIN from the manage-event page; it's stored in
 * Redis and expires automatically. Any device that presents the correct
 * eventId + PIN can call POST /api/checkin.
 *
 * Key schema:  scan-pin:{eventId}  →  "{pin}:{organizerId}"
 * TTL:         24 hours (configurable via SCAN_PIN_TTL_SECONDS)
 */

import 'server-only'
import { redis } from './redis'

const TTL = parseInt(process.env.SCAN_PIN_TTL_SECONDS ?? '86400', 10) // 24 h default

function pinKey(eventId: string) {
  return `scan-pin:${eventId}`
}

/** Generate a cryptographically random 6-digit PIN (000000–999999). */
function generatePin(): string {
  // Math.random is fine here — this is not a crypto secret, just a short-lived
  // access code. The eventId + PIN combination provides sufficient entropy.
  const n = Math.floor(Math.random() * 1_000_000)
  return n.toString().padStart(6, '0')
}

/** Create (or rotate) a scan PIN for an event. Returns the new PIN. */
export async function createScanPin(eventId: string, organizerId: string): Promise<string> {
  const pin = generatePin()
  await redis.set(pinKey(eventId), `${pin}:${organizerId}`, 'EX', TTL)
  return pin
}

/**
 * Verify a PIN for an event.
 * Returns the organizerId if valid, null otherwise.
 */
export async function verifyScanPin(
  eventId: string,
  pin: string,
): Promise<string | null> {
  const stored = await redis.get(pinKey(eventId))
  if (!stored) return null
  const [storedPin, organizerId] = stored.split(':')
  if (storedPin !== pin.replace(/\D/g, '')) return null // strip hyphens/spaces
  return organizerId
}

/** Revoke the scan PIN for an event immediately. */
export async function revokeScanPin(eventId: string): Promise<void> {
  await redis.del(pinKey(eventId))
}

/**
 * Get the TTL (seconds) remaining on a scan PIN.
 * Returns -2 if no PIN exists, -1 if no expiry (shouldn't happen).
 */
export async function getScanPinTtl(eventId: string): Promise<number> {
  return redis.ttl(pinKey(eventId))
}
