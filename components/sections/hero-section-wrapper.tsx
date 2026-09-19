import { getCategories } from '@/features/events'
import { HeroSection } from './hero-section'
import type { EventListItem } from '@/features/events/types'

interface HeroSectionWrapperProps {
  events: EventListItem[]
}

export async function HeroSectionWrapper({ events }: HeroSectionWrapperProps) {
  // categories are already cached via unstable_cache — no DB hit if warm
  const categories = await getCategories()
  return <HeroSection events={events} categories={categories} />
}
