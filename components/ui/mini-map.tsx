'use client'

/**
 * MiniMap
 *
 * Displays a mini map of a venue location using Nominatim geocoding
 * and an embedded static map tile from OpenStreetMap.
 *
 * No API key required.
 */

import { useEffect, useState } from 'react'
import { MapPin, AlertCircle } from 'lucide-react'

interface MiniMapProps {
  venueName?: string
  venueAddress?: string
  venueCity?: string
  venueState?: string
  venueCountry?: string
  className?: string
}

interface Coordinates {
  lat: number
  lng: number
}

export function MiniMap({
  venueName,
  venueAddress,
  venueCity,
  venueState,
  venueCountry,
  className,
}: MiniMapProps) {
  const [coordinates, setCoordinates] = useState<Coordinates | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const geocodeVenue = async () => {
      try {
        setLoading(true)
        setError(null)

        // Build the search query
        const parts = [venueName, venueAddress, venueCity, venueState, venueCountry].filter(
          Boolean
        )
        const query = parts.join(', ')

        if (!query) {
          setError('Venue details incomplete')
          setLoading(false)
          return
        }

        // Use Nominatim (OpenStreetMap's geocoding service)
        // No API key required, but be mindful of rate limits (1 req/sec)
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`,
          {
            headers: {
              'User-Agent': 'SWITCH-Events-Platform',
            },
          }
        )

        if (!response.ok) {
          throw new Error('Failed to geocode venue')
        }

        const data = await response.json() as Array<{ lat: string; lon: string }>

        if (data.length === 0) {
          setError('Venue location not found')
          setLoading(false)
          return
        }

        setCoordinates({
          lat: parseFloat(data[0].lat),
          lng: parseFloat(data[0].lon),
        })
      } catch (err) {
        console.error('[MiniMap] Geocoding error:', err)
        setError('Unable to load map')
      } finally {
        setLoading(false)
      }
    }

    geocodeVenue()
  }, [venueName, venueAddress, venueCity, venueState, venueCountry])

  if (loading) {
    return (
      <div
        className={`flex h-[180px] w-full items-center justify-center rounded-2xl border border-white/8 bg-white/[0.03] ${className}`}
      >
        <div className="text-center">
          <div className="mb-2 h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white/40" />
          <p className="text-xs text-white/40">Loading map…</p>
        </div>
      </div>
    )
  }

  if (error || !coordinates) {
    return (
      <div
        className={`flex h-[180px] w-full items-center justify-center rounded-2xl border border-white/8 bg-white/[0.03] ${className}`}
      >
        <div className="text-center">
          <AlertCircle className="mx-auto mb-2 h-5 w-5 text-white/40" />
          <p className="text-xs text-white/40">{error || 'Map unavailable'}</p>
        </div>
      </div>
    )
  }

  // Static map tile from OpenStreetMap using USGS server
  // Format: https://server/z/x/y.png where z=zoom, x/y = tile coordinates
  // We'll use a simpler approach: embed an iframe from OpenStreetMap's Leaflet viewer
  const zoom = 15
  const mapUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${coordinates.lng - 0.01},${coordinates.lat - 0.01},${coordinates.lng + 0.01},${coordinates.lat + 0.01}&layer=mapnik&marker=${coordinates.lat},${coordinates.lng}`

  const mapsQuery = encodeURIComponent(
    [venueName, venueCity, venueState, venueCountry].filter(Boolean).join(', ')
  )
  const directionsUrl = `https://www.openstreetmap.org/directions?engine=osrm_car&route=${coordinates.lat}%2C${coordinates.lng}`

  return (
    <section aria-labelledby="location-heading">
      <h2
        id="location-heading"
        className="mb-5 text-[11px] font-semibold tracking-[0.12em] uppercase text-white/40"
      >
        Location
      </h2>

      <div className="overflow-hidden rounded-2xl border border-white/8 bg-white/[0.03]">
        {/* Embedded map */}
        <div className="relative h-[180px] w-full bg-white/[0.03]">
          <iframe
            title="Event location map"
            width="100%"
            height="180"
            style={{ border: 'none', borderRadius: '1rem' }}
            src={mapUrl}
            className="absolute inset-0"
          />
        </div>

        {/* Venue info */}
        <div className="flex items-start justify-between gap-4 px-5 py-4">
          <div>
            <p className="text-[14px] font-semibold text-white">{venueName}</p>
            <p className="mt-0.5 text-[13px] text-white/50">
              {[venueCity, venueState, venueCountry].filter(Boolean).join(', ')}
            </p>
          </div>

          <a
            href={directionsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex shrink-0 items-center gap-1.5 rounded-lg border border-white/15 px-3 py-2 text-[12.5px] font-medium text-white/70 transition-colors hover:border-white/30 hover:text-white"
            aria-label={`Get directions to ${venueName}`}
          >
            <MapPin className="h-3.5 w-3.5" aria-hidden />
            Directions
          </a>
        </div>
      </div>
    </section>
  )
}
