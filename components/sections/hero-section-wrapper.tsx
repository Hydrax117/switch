import { getCategories } from '@/features/events'
import { HeroSection } from './hero-section'

export async function HeroSectionWrapper() {
  const categories = await getCategories()
  return <HeroSection categories={categories} />
}
