'use client'

import { useState } from 'react'
import { ProfileForm } from '@/features/auth'

interface UserData {
  id: string
  name: string | null
  image: string | null
}

function readUserId(): UserData | null {
  if (typeof window === 'undefined') return null
  const stored = sessionStorage.getItem('pending_user_id')
  return stored ? { id: stored, name: null, image: null } : null
}

export function ProfilePageClient() {
  // Lazy initializer runs once on mount — avoids useEffect + setState.
  // In production, replace with server-side Auth.js auth() session lookup.
  const [user] = useState<UserData | null>(readUserId)

  if (!user) {
    return <p className="text-muted-foreground text-sm">Please sign in to view your profile.</p>
  }

  return (
    <ProfileForm
      userId={user.id}
      defaultValues={{ name: user.name ?? '', image: user.image ?? '' }}
    />
  )
}
