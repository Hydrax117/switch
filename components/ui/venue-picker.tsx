'use client'

/**
 * VenuePicker
 *
 * Manual venue input form.
 * Users manually enter:
 *   - Venue name
 *   - Address
 *   - City
 *   - State
 */

import { useState, useRef } from 'react'
import { MapPin, X } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface VenuePlace {
  name: string
  address: string
  city: string
  state: string
  country: string
  placeId: string
}

interface VenuePickerProps {
  /** Pre-populated value (edit mode) */
  defaultValue?: string
  onSelect?: (place: VenuePlace | null) => void
  className?: string
}

const inputCls = cn(
  'w-full rounded-xl border border-border bg-surface px-3.5 py-2.5',
  'text-[14px] text-foreground placeholder:text-muted-foreground',
  'outline-none transition-colors focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20'
)

export function VenuePicker({ defaultValue, onSelect, className }: VenuePickerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [venueName, setVenueName] = useState('')
  const [venueAddress, setVenueAddress] = useState('')
  const [venueCity, setVenueCity] = useState('')
  const [venueState, setVenueState] = useState('')
  const [selected, setSelected] = useState<VenuePlace | null>(null)

  // In edit mode, populate initial values
  if (defaultValue && !selected && !venueName) {
    // For edit mode, the parent component will pass venue details separately
    // This is a basic initialization
    setVenueName(defaultValue)
  }

  function handleSubmitVenue() {
    if (!venueName.trim()) return

    const venue: VenuePlace = {
      name: venueName.trim(),
      address: venueAddress.trim(),
      city: venueCity.trim(),
      state: venueState.trim(),
      country: 'Nigeria', // Default to Nigeria
      placeId: '', // No place ID for manual entry
    }

    setSelected(venue)
    onSelect?.(venue)
  }

  function handleClear() {
    setVenueName('')
    setVenueAddress('')
    setVenueCity('')
    setVenueState('')
    setSelected(null)
    onSelect?.(null)
  }

  return (
    <div ref={containerRef} className={cn('space-y-4', className)}>
      {/* ── Hidden fields submitted with the form ── */}
      <input type="hidden" name="venue_name" value={selected?.name ?? ''} />
      <input type="hidden" name="venue_address" value={selected?.address ?? ''} />
      <input type="hidden" name="venue_city" value={selected?.city ?? ''} />
      <input type="hidden" name="venue_state" value={selected?.state ?? ''} />
      <input type="hidden" name="venue_country" value={selected?.country ?? 'Nigeria'} />
      <input type="hidden" name="venue_place_id" value="" />

      {/* ── Venue Name ── */}
      <div>
        <label htmlFor="venue_name_input" className="text-sm font-medium text-foreground mb-1.5 block">
          Venue Name
        </label>
        <input
          id="venue_name_input"
          type="text"
          placeholder="e.g., Lekki Coliseum, Eko Hotel & Suites"
          value={venueName}
          onChange={(e) => setVenueName(e.target.value)}
          className={inputCls}
        />
      </div>

      {/* ── Address ── */}
      <div>
        <label htmlFor="venue_address_input" className="text-sm font-medium text-foreground mb-1.5 block">
          Address
        </label>
        <input
          id="venue_address_input"
          type="text"
          placeholder="e.g., 1 Lekki-Epe Expressway"
          value={venueAddress}
          onChange={(e) => setVenueAddress(e.target.value)}
          className={inputCls}
        />
      </div>

      {/* ── City ── */}
      <div>
        <label htmlFor="venue_city_input" className="text-sm font-medium text-foreground mb-1.5 block">
          City
        </label>
        <input
          id="venue_city_input"
          type="text"
          placeholder="e.g., Lagos"
          value={venueCity}
          onChange={(e) => setVenueCity(e.target.value)}
          className={inputCls}
        />
      </div>

      {/* ── State ── */}
      <div>
        <label htmlFor="venue_state_input" className="text-sm font-medium text-foreground mb-1.5 block">
          State
        </label>
        <input
          id="venue_state_input"
          type="text"
          placeholder="e.g., Lagos State"
          value={venueState}
          onChange={(e) => setVenueState(e.target.value)}
          className={inputCls}
        />
      </div>

      {/* ── Confirmed venue chip ── */}
      {selected && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2">
              <MapPin className="h-4 w-4 shrink-0 text-emerald-500 mt-0.5" />
              <div className="min-w-0">
                <p className="font-medium text-foreground">{selected.name}</p>
                <p className="text-sm text-muted-foreground truncate">{selected.address}</p>
                <p className="text-sm text-muted-foreground">
                  {selected.city}, {selected.state}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleClear}
              aria-label="Clear venue"
              className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── Add Venue button ── */}
      {!selected && (
        <button
          type="button"
          onClick={handleSubmitVenue}
          disabled={!venueName.trim()}
          className={cn(
            'w-full px-4 py-2.5 rounded-lg font-medium transition-colors',
            venueName.trim()
              ? 'bg-brand-500 text-white hover:bg-brand-600'
              : 'bg-muted text-muted-foreground cursor-not-allowed'
          )}
        >
          Add Venue
        </button>
      )}
    </div>
  )
}
