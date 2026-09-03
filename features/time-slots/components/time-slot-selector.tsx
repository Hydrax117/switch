'use client'

import { useState, useTransition } from 'react'
import { reserveTimeSlot } from '../actions'
import type { TimeSlotWithAvailability } from '../types'

interface TimeSlotSelectorProps {
  eventId: string
  slots: TimeSlotWithAvailability[]
  /** Called on successful reservation */
  onReserved?: (result: { reservationId: string; expiresAt: Date }) => void
}

function formatTimeRange(startsAt: Date | string, endsAt: Date | string): string {
  const start = new Date(startsAt)
  const end = new Date(endsAt)
  const fmt = (d: Date) =>
    d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })
  return `${fmt(start)} – ${fmt(end)}`
}

function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

function formatPrice(price: number, currency: string): string {
  if (price === 0) return 'Free'
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
  }).format(price / 100)
}

export function TimeSlotSelector({ eventId, slots, onReserved }: TimeSlotSelectorProps) {
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const selectedSlot = slots.find((s) => s.id === selectedSlotId) ?? null

  function handleSelectSlot(slot: TimeSlotWithAvailability) {
    if (slot.available === 0) return
    setSelectedSlotId(slot.id)
    setError(null)
    // Reset quantity to 1 or max available, whichever is smaller
    setQuantity(Math.min(1, slot.available))
  }

  function handleReserve() {
    if (!selectedSlotId) return

    startTransition(async () => {
      setError(null)
      const result = await reserveTimeSlot({ eventId, timeSlotId: selectedSlotId, quantity })

      if (!result.success) {
        setError(result.error)
        return
      }

      onReserved?.({ reservationId: result.reservationId, expiresAt: result.expiresAt })
    })
  }

  if (slots.length === 0) {
    return (
      <p className="text-sm text-zinc-500">No time slots are available for this event.</p>
    )
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium text-zinc-200">Select a time slot</h3>

      {/* Slot grid */}
      <div
        className="grid gap-3 sm:grid-cols-2"
        role="radiogroup"
        aria-label="Available time slots"
      >
        {slots.map((slot) => {
          const isSoldOut = slot.available === 0
          const isSelected = selectedSlotId === slot.id

          return (
            <button
              key={slot.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              aria-disabled={isSoldOut}
              disabled={isSoldOut || isPending}
              onClick={() => handleSelectSlot(slot)}
              className={[
                'relative flex flex-col gap-1.5 rounded-xl border p-4 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500',
                isSoldOut
                  ? 'cursor-not-allowed border-zinc-800 bg-zinc-900/40 opacity-50'
                  : isSelected
                    ? 'border-violet-500 bg-violet-500/10 shadow-[0_0_0_1px] shadow-violet-500'
                    : 'cursor-pointer border-zinc-700 bg-zinc-900 hover:border-zinc-500 hover:bg-zinc-800',
              ].join(' ')}
            >
              {/* Label */}
              <span className="text-sm font-semibold text-zinc-100">{slot.label}</span>

              {/* Date */}
              <span className="text-xs text-zinc-400">{formatDate(slot.startsAt)}</span>

              {/* Time range */}
              <span className="text-xs text-zinc-300">
                {formatTimeRange(slot.startsAt, slot.endsAt)}
              </span>

              {/* Price */}
              <span
                className={[
                  'text-sm font-medium',
                  slot.price === 0 ? 'text-emerald-400' : 'text-zinc-100',
                ].join(' ')}
              >
                {formatPrice(slot.price, slot.currency)}
              </span>

              {/* Availability */}
              <span
                className={[
                  'text-xs',
                  isSoldOut
                    ? 'text-red-400'
                    : slot.available <= 5
                      ? 'text-amber-400'
                      : 'text-zinc-500',
                ].join(' ')}
              >
                {isSoldOut
                  ? 'Sold out'
                  : slot.available === 1
                    ? '1 spot left'
                    : `${slot.available} spots left`}
              </span>

              {/* Selected indicator */}
              {isSelected && (
                <span
                  className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-violet-500"
                  aria-hidden="true"
                >
                  <svg
                    className="h-3 w-3 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={3}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Quantity selector + Reserve button — only shown when a slot is selected */}
      {selectedSlot && (
        <div className="flex items-center gap-3 rounded-xl border border-zinc-700 bg-zinc-900 p-4">
          <div className="flex flex-1 flex-col gap-1">
            <span className="text-xs text-zinc-400">Quantity</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label="Decrease quantity"
                disabled={quantity <= 1 || isPending}
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                className="flex h-7 w-7 items-center justify-center rounded-md border border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <span aria-hidden="true">−</span>
              </button>

              <span
                className="w-8 text-center text-sm font-medium text-zinc-100"
                aria-live="polite"
                aria-label={`${quantity} ticket${quantity !== 1 ? 's' : ''}`}
              >
                {quantity}
              </span>

              <button
                type="button"
                aria-label="Increase quantity"
                disabled={quantity >= selectedSlot.available || isPending}
                onClick={() => setQuantity((q) => Math.min(selectedSlot.available, q + 1))}
                className="flex h-7 w-7 items-center justify-center rounded-md border border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <span aria-hidden="true">+</span>
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={handleReserve}
            disabled={isPending}
            className="rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
            aria-busy={isPending}
          >
            {isPending ? 'Reserving…' : 'Reserve'}
          </button>
        </div>
      )}

      {/* Error message */}
      {error && (
        <p
          role="alert"
          className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-400"
        >
          {error}
        </p>
      )}
    </div>
  )
}
