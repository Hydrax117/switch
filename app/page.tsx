import { Suspense } from 'react'
import { SiteFooter } from '@/components/layout/site-footer'
import { HeaderWithSession } from '@/components/layout/header-with-session'
import { HeroSectionWrapper } from '@/components/sections/hero-section-wrapper'
import { EventsSection } from '@/components/sections/events-section'
import { OrganizerCta } from '@/components/sections/organizer-cta'

export default function HomePage() {
  return (
    <div className="paper-bg relative flex min-h-screen flex-col">
      <Suspense>
        <HeaderWithSession />
      </Suspense>
      <main className="flex-1">
        <Suspense>
          <HeroSectionWrapper />
        </Suspense>
        <Suspense>
          <EventsSection />
        </Suspense>
        <OrganizerCta />
      </main>
      <SiteFooter />
    </div>
  )
}
