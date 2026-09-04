import Image from 'next/image'
import Link from 'next/link'
import { MapPin, ArrowUpRight } from 'lucide-react'
import { format } from 'date-fns'
import { formatPrice, getMinPrice, isSoldOut } from '../utils'
import type { EventListItem } from '../types'

interface FeaturedEventCardProps {
  event: EventListItem
}

export function FeaturedEventCard({ event }: FeaturedEventCardProps) {
  const minPrice = getMinPrice(event)
  const soldOut = isSoldOut(event)
  const location = event.venue?.city ?? event.venueCity ?? null

  return (
    <Link href={`/events/${event.slug}`} className="group block h-full">
      <article
        className="relative h-full min-h-[340px] overflow-hidden rounded-2xl sm:min-h-[400px]"
        aria-label={event.title}
      >
        {/* Image */}
        {event.imageUrl ? (
          <Image
            src={event.imageUrl}
            alt={event.title}
            fill
            priority
            className="object-cover object-center transition-transform duration-500 ease-out group-hover:scale-[1.025]"
            sizes="(max-width: 1024px) 100vw, 720px"
          />
        ) : (
          <EventFallbackBg category={event.category?.name} title={event.title} />
        )}

        {/* Readability overlay — heavier at the bottom */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/5" />

        {/* Content */}
        <div className="absolute inset-x-0 bottom-0 p-6 sm:p-8">
          {/* Category */}
          {event.category && (
            <p
              className="mb-2 text-[11px] font-semibold tracking-[0.14em] uppercase"
              style={{ color: event.category.color ?? '#a5b4fc' }}
            >
              {event.category.name}
            </p>
          )}

          {/* Title */}
          <h3
            className="text-white font-semibold leading-tight tracking-tight"
            style={{ fontSize: 'clamp(20px, 2.5vw, 28px)', letterSpacing: '-0.03em' }}
          >
            {event.title}
          </h3>

          {/* Meta row */}
          <p className="mt-2 text-[13px] text-white/70">
            {format(event.startsAt, 'EEE, MMM d · h:mm a')}
            {location && (
              <>
                <span className="mx-1.5 opacity-40">·</span>
                <span className="inline-flex items-center gap-1">
                  <MapPin className="inline h-3 w-3" aria-hidden />
                  {location}
                </span>
              </>
            )}
          </p>

          {/* Price + CTA row */}
          <div className="mt-4 flex items-center justify-between gap-4">
            <p className="text-[14px] font-semibold text-white">
              {soldOut
                ? 'Sold out'
                : minPrice !== null
                  ? minPrice === 0
                    ? 'Free'
                    : `From ${formatPrice(minPrice)}`
                  : null}
            </p>
            <span className="card-arrow inline-flex items-center gap-1.5 rounded-full bg-white/15 px-4 py-2 text-[13px] font-medium text-white backdrop-blur-sm">
              View event
              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
            </span>
          </div>
        </div>
      </article>
    </Link>
  )
}

// ─── Branded fallback when no image ──────────────────────────────────────────

function EventFallbackBg({
  category,
  title,
}: {
  category?: string | null
  title: string
}) {
  return (
    <div className="bg-muted absolute inset-0 flex flex-col items-start justify-end p-6 sm:p-8">
      {/* Oversized background category text — adapts to theme */}
      <p
        aria-hidden
        className="text-border pointer-events-none absolute inset-0 flex select-none items-center justify-center overflow-hidden font-semibold"
        style={{ fontSize: 'clamp(80px, 18vw, 160px)', letterSpacing: '-0.04em' }}
      >
        {category ?? 'SWITCH'}
      </p>
      {/* Thin horizontal rules */}
      <div className="bg-border/60 absolute inset-x-6 top-8 h-px" aria-hidden />
      <div className="bg-border/60 absolute inset-x-6 bottom-20 h-px" aria-hidden />
    </div>
  )
}
