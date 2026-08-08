import type { Metadata } from 'next'
import { ProfileSetupClient } from './profile-setup-client'

export const metadata: Metadata = { title: 'Set Up Your Profile' }

export default function ProfileSetupPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="border-border bg-surface rounded-xl border p-8 shadow-sm">
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-bold tracking-tight">Set up your profile</h1>
            <p className="text-muted-foreground mt-2 text-sm">
              Just a couple of things to personalise your account.
            </p>
          </div>
          <ProfileSetupClient />
        </div>
      </div>
    </div>
  )
}
