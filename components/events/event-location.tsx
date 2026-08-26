'use client'

import { MiniMap } from '@/components/ui/mini-map'
import type { EventDetail } from '@/features/events/types'

interface EventLocationProps {
  venue: EventDetail['venue'] | null
  venueName?: string | null
  venueAddress?: string | null
  venueCity?: string | null
  venueState?: string | null
  venueCountry?: string | null
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
  const address = (venueAddress || venue?.address) ?? undefined
  const city = venueCity || venue?.city
  const state = (venueState || venue?.state) ?? undefined
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
