import type { Metadata } from 'next'
import { ProfilePageClient } from './profile-page-client'

export const metadata: Metadata = { title: 'Your Profile' }

export default function ProfilePage() {
  return (
    <div className="mx-auto max-w-lg py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Your profile</h1>
        <p className="text-muted-foreground mt-1 text-sm">Update your display name and avatar.</p>
      </div>
      <div className="border-border bg-surface rounded-xl border p-8 shadow-sm">
        <ProfilePageClient />
      </div>
    </div>
  )
}
