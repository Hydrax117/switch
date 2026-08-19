'use client'

import Image from 'next/image'
import Link from 'next/link'
import { motion, useInView } from 'framer-motion'
import { useRef } from 'react'
import { ArrowRight, Calendar, MapPin, Star, Users, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import type { EventListItem } from '@/features/events/types'

const EASE = [0.16, 1, 0.3, 1] as const

// Cycle through a set of tints so cards stay visually distinct
const TINTS = [
  'rgba(109,40,217,0.45)',
  'rgba(30,64,175,0.55)',
  'rgba(190,24,93,0.50)',
  'rgba(6,78,59,0.55)',
  'rgba(157,23,77,0.50)',
  'rgba(120,53,15,0.55)',
]

// Fallback image for events with no imageUrl
const FALLBACK_IMAGES = ['/live crowd energy.png', '/cinematic-concert.png']

function getMinPrice(event: EventListItem): string {
  const active = event.ticketTypes.filter((tt) => tt.status !== 'INACTIVE')
  if (active.length === 0) return 'Free'
  const min = Math.min(...active.map((tt) => tt.price))
  if (min === 0) return 'Free'
  const currency = active[0]?.currency ?? 'NGN'
  if (currency === 'NGN') return `₦${(min / 100).toLocaleString()}`
  return `${(min / 100).toLocaleString()} ${currency}`
}

function getSpotsLeft(event: EventListItem): number | null {
  const active = event.ticketTypes.filter((tt) => tt.status !== 'INACTIVE' && tt.quantity !== null)
  if (active.length === 0) return null
  return active.reduce((sum, tt) => sum + ((tt.quantity ?? 0) - tt.sold), 0)
}

// ─── Shared entrance ──────────────────────────────────────────────────────────

function FadeIn({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode
  delay?: number
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-60px' })
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.55, delay, ease: EASE }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

// ─── Featured event card (large) ─────────────────────────────────────────────

function FeaturedEventCard({ event, index }: { event: EventListItem; index: number }) {
  const tint = TINTS[index % TINTS.length]!
  const image = event.imageUrl ?? FALLBACK_IMAGES[index % FALLBACK_IMAGES.length]!
  const price = getMinPrice(event)
  const spotsLeft = getSpotsLeft(event)

  return (
    <FadeIn delay={0} className="h-full">
      <Link href={`/events/${event.slug}`} className="group block h-full">
        <div
          className={cn(
            'relative flex h-full min-h-[420px] flex-col justify-end overflow-hidden rounded-3xl',
            'border-border border',
            'transition-all duration-500',
            'hover:-translate-y-1 hover:shadow-[0_24px_64px_rgba(0,0,0,0.2)]',
          )}
        >
          <Image
            src={image}
            alt={event.title}
            fill
            className="object-cover object-center transition-transform duration-700 group-hover:scale-105"
            sizes="(max-width: 1024px) 100vw, 420px"
            priority
          />

          <div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(135deg, ${tint} 0%, rgba(0,0,0,0.2) 100%)`,
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />

          {/* Category pill */}
          {event.category && (
            <div className="absolute top-4 right-4">
              <span className="inline-flex items-center rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur-sm">
                {event.category.name}
              </span>
            </div>
          )}

          {/* Content */}
          <div className="relative p-6">
            <p className="text-[11.5px] font-semibold tracking-wider text-white/60 uppercase">
              Featured Event
            </p>
            <h3 className="mt-1.5 text-[22px] leading-tight font-semibold tracking-tight text-white">
              {event.title}
            </h3>

            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
              <span className="flex items-center gap-1.5 text-[12.5px] text-white/70">
                <Calendar className="h-3.5 w-3.5" />
                {format(event.startsAt, 'MMM d, yyyy · h:mm a')}
              </span>
              {event.venue && (
                <span className="flex items-center gap-1.5 text-[12.5px] text-white/70">
                  <MapPin className="h-3.5 w-3.5" />
                  {event.venue.name}, {event.venue.city}
                </span>
              )}
            </div>

            <div className="mt-4 flex items-center justify-between">
              <div>
                <span className="text-[20px] font-bold text-white">{price}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 rounded-full bg-white/12 px-3 py-1.5 text-[11.5px] font-medium text-white">
                  <Users className="h-3 w-3" />
                  {event._count.tickets.toLocaleString()} going
                </div>
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 backdrop-blur-sm transition-all duration-200 group-hover:bg-white/25">
                  <ArrowRight className="h-4 w-4 text-white transition-transform duration-200 group-hover:translate-x-0.5" />
                </div>
              </div>
            </div>

            {spotsLeft !== null && spotsLeft < 100 && (
              <div className="mt-4 flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/15">
                  <div
                    className="h-full rounded-full bg-white/60"
                    style={{ width: `${Math.max(10, 100 - (spotsLeft / 50) * 100)}%` }}
                  />
                </div>
                <span className="text-[11px] text-white/60">{spotsLeft} spots left</span>
              </div>
            )}
          </div>
        </div>
      </Link>
    </FadeIn>
  )
}

// ─── Regular event card ───────────────────────────────────────────────────────

function EventCard({ event, index, delay }: { event: EventListItem; index: number; delay: number }) {
  const tint = TINTS[index % TINTS.length]!
  const image = event.imageUrl ?? FALLBACK_IMAGES[index % FALLBACK_IMAGES.length]!
  const price = getMinPrice(event)

  return (
    <FadeIn delay={delay}>
      <Link href={`/events/${event.slug}`} className="group block">
        <div
          className={cn(
            'border-border bg-surface overflow-hidden rounded-2xl border',
            'transition-all duration-300',
            'hover:border-border/80 hover:-translate-y-0.5 hover:shadow-[0_8px_32px_rgba(0,0,0,0.1)]',
          )}
        >
          <div className="relative h-[130px] overflow-hidden">
            <Image
              src={image}
              alt={event.title}
              fill
              className="object-cover object-center transition-transform duration-500 group-hover:scale-105"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 280px"
              loading="lazy"
            />
            <div
              className="absolute inset-0"
              style={{
                background: `linear-gradient(135deg, ${tint} 0%, rgba(0,0,0,0.15) 100%)`,
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />

            {event.category && (
              <div className="absolute top-3 right-3">
                <span className="inline-flex items-center rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm">
                  {event.category.name}
                </span>
              </div>
            )}
          </div>

          <div className="p-4">
            <h3 className="text-foreground group-hover:text-brand-400 line-clamp-1 text-[13.5px] leading-tight font-semibold transition-colors duration-200">
              {event.title}
            </h3>

            <div className="mt-2 space-y-1.5">
              <div className="text-muted-foreground flex items-center gap-1.5 text-[11.5px]">
                <Calendar className="h-3 w-3 shrink-0" />
                <span>{format(event.startsAt, 'MMM d, yyyy')}</span>
                <span>·</span>
                <Clock className="h-3 w-3 shrink-0" />
                <span>{format(event.startsAt, 'h:mm a')}</span>
              </div>
              {event.venue && (
                <div className="text-muted-foreground flex items-center gap-1.5 text-[11.5px]">
                  <MapPin className="h-3 w-3 shrink-0" />
                  <span className="truncate">
                    {event.venue.name}, {event.venue.city}
                  </span>
                </div>
              )}
            </div>

            <div className="border-border/60 mt-3.5 flex items-center justify-between border-t pt-3">
              <span className="text-foreground text-[14px] font-bold">{price}</span>
              <div className="flex items-center gap-2">
                <div className="text-muted-foreground flex items-center gap-1 text-[11px]">
                  <Users className="h-2.5 w-2.5" />
                  <span>
                    {event._count.tickets >= 1000
                      ? `${(event._count.tickets / 1000).toFixed(1)}k`
                      : event._count.tickets}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Link>
    </FadeIn>
  )
}

// ─── Main export ──────────────────────────────────────────────────────────────

interface Props {
  events: EventListItem[]
}

export function UpcomingEventsClient({ events }: Props) {
  const [featured, ...rest] = events

  if (!featured) return null

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1.6fr] lg:gap-5">
      {/* Featured card — first event */}
      <div className="row-span-2">
        <FeaturedEventCard event={featured} index={0} />
      </div>

      {/* Regular grid — remaining events */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-2 lg:gap-4">
        {rest.map((ev, i) => (
          <EventCard key={ev.id} event={ev} index={i + 1} delay={0.1 + i * 0.06} />
        ))}
      </div>
    </div>
  )
}
