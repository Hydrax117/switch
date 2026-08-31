import { Suspense } from 'react'
import { SiteFooter } from '@/components/layout/site-footer'
import { HeaderWithSession } from '@/components/layout/header-with-session'
import { HeroSection } from '@/components/sections/hero-section'
import { UpcomingEventsSection } from '@/components/sections/upcoming-events-section'
import { BrowseByCategorySection } from '@/components/sections/browse-by-category-section'

export default function HomePage() {
  return (
    <div className="relative flex min-h-screen flex-col">
      <Suspense>
        <HeaderWithSession />
      </Suspense>
      <main className="flex-1">
        <Suspense>
          <HeroSection />
        </Suspense>
        <Suspense>
          <UpcomingEventsSection />
        </Suspense>
        <Suspense>
          <BrowseByCategorySection />
        </Suspense>
      </main>
      <SiteFooter />
    </div>
  )
}
