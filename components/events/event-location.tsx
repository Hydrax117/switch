'use client'

import { MiniMap } from '@/components/ui/mini-map'
import type { EventDetail } from '@/features/events/types'

interface EventLocationProps {
  venue: EventDetail['venue'] | null
  venueName?: string
  venueAddress?: string
  venueCity?: string
  venueState?: string
  venueCountry?: string
}

export function EventLocation({
  venue,
  venueName,
  venueAddress,
  venueCity,
  venueState,
  venueCountry,
}: EventLocationProps) {
  // Use direct venue fields if provided, otherwise fall back to venue object
  const name = venueName || venue?.name
  const address = venueAddress || venue?.address
  const city = venueCity || venue?.city
  const state = venueState || venue?.state
  const country = venueCountry || venue?.country

  if (!name) return null

  return (
    <MiniMap
      venueName={name}
      venueAddress={address}
      venueCity={city}
      venueState={state}
      venueCountry={country}
    />
  )
}
