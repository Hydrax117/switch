import { Suspense } from 'react'
import { HeroSection } from '@/components/sections/hero-section'
import { UpcomingEventsSection } from '@/components/sections/upcoming-events-section'
import { BrowseByCategorySection } from '@/components/sections/browse-by-category-section'

export default function HomePage() {
  return (
    <>
      {/* Hero — full viewport with CTAs and product showcase */}
      <Suspense>
        <HeroSection />
      </Suspense>

      {/* Upcoming events — handpicked events across Nigeria */}
      <Suspense>
        <UpcomingEventsSection />
      </Suspense>

      {/* Browse by category — discover events by type */}
      <Suspense>
        <BrowseByCategorySection />
      </Suspense>
    </>
  )
}
