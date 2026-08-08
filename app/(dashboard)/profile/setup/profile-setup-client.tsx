'use client'

/**
 * Thin client wrapper that reads the userId from sessionStorage
 * (written by the OTP verify step) and renders the ProfileForm.
 *
 * In a production app this would read the server session via Auth.js auth().
 * We use sessionStorage here as a lightweight bridge until Auth.js sessions
 * are fully wired.
 */
import { useState } from 'react'
import { ProfileForm } from '@/features/auth'

function readUserId(): string | null {
  if (typeof window === 'undefined') return null
  return sessionStorage.getItem('pending_user_id')
}

export function ProfileSetupClient() {
  // Lazy initializer avoids useEffect + setState pattern.
  const [userId] = useState<string | null>(readUserId)

  if (!userId) {
    return <p className="text-muted-foreground text-center text-sm">Loading your account…</p>
  }

  return <ProfileForm userId={userId} />
}
