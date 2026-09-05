'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useReducedMotion } from 'framer-motion'
import { ArrowRight, ArrowUpRight } from 'lucide-react'
import { useState } from 'react'
import type { EventListItem } from '@/features/events/types'

interface HeroSectionProps {
  events: EventListItem[]
  categories: { id: string; name: string; slug: string }[]
}

// ─── Poster slot config ───────────────────────────────────────────────────────

interface PosterSlot {
  eventIndex: number
  w: number
  h: number
  className: string
  rotation?: string
  priority?: boolean
}

const DESKTOP_SLOTS: PosterSlot[] = [
  { eventIndex: 0, w: 210, h: 278, className: 'hidden lg:block absolute left-[2%]  top-[10%]', rotation: '-1.5deg', priority: true },
  { eventIndex: 1, w: 155, h: 205, className: 'hidden lg:block absolute left-[15%] top-[45%]', rotation: '1deg' },
  { eventIndex: 2, w: 178, h: 236, className: 'hidden xl:block absolute left-[27%] top-[7%]',  rotation: '-0.8deg' },
  { eventIndex: 3, w: 178, h: 236, className: 'hidden xl:block absolute right-[27%] top-[9%]', rotation: '0.8deg' },
  { eventIndex: 4, w: 155, h: 205, className: 'hidden lg:block absolute right-[15%] top-[47%]', rotation: '-1deg' },
  { eventIndex: 5, w: 210, h: 278, className: 'hidden lg:block absolute right-[2%]  top-[8%]',  rotation: '1.5deg', priority: true },
  { eventIndex: 6, w: 125, h: 165, className: 'hidden xl:block absolute left-[7%]  bottom-[7%]', rotation: '1.2deg' },
  { eventIndex: 7, w: 125, h: 165, className: 'hidden xl:block absolute right-[7%] bottom-[5%]', rotation: '-1deg' },
]

const MOBILE_SLOTS: PosterSlot[] = [
  { eventIndex: 0, w: 120, h: 158, className: 'absolute left-[3%]  bottom-[5%]', rotation: '-1.5deg' },
  { eventIndex: 1, w: 105, h: 138, className: 'absolute left-[36%] bottom-[3%]', rotation: '1deg' },
  { eventIndex: 2, w: 112, h: 148, className: 'absolute right-[3%] bottom-[6%]', rotation: '1.5deg' },
]

// ─── Poster ───────────────────────────────────────────────────────────────────

function Poster({
  event,
  w,
  h,
  className,
  rotation = '0deg',
  priority = false,
  delay = 0,
}: PosterSlot & { event: EventListItem | undefined; delay?: number }) {
  const shouldReduce = useReducedMotion()
  const [hovered, setHovered] = useState(false)

  if (!event) return null

  return (
    <Link
      href={`/events/${event.slug}`}
      className={`${className} poster-fade-in group`}
      style={{
        display: className.includes('hidden') && !className.includes('block') ? undefined : 'block',
        width: w,
        height: h,
        position: 'absolute',
        animationDelay: shouldReduce ? undefined : `${delay}ms`,
      }}
      aria-label={event.title}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        className="relative h-full w-full overflow-hidden rounded-[14px] transition-all duration-300"
        style={{
          transform: hovered
            ? 'scale(1.04) rotate(0deg) translateY(-4px)'
            : rotation !== '0deg' ? `rotate(${rotation})` : undefined,
          boxShadow: hovered
            ? '0 16px 48px rgba(0,0,0,0.6), 0 0 0 1.5px rgba(255,255,255,0.15)'
            : '0 8px 40px rgba(0,0,0,0.4)',
          transition: 'transform 280ms cubic-bezier(0.16,1,0.3,1), box-shadow 280ms ease',
        }}
      >
        {event.imageUrl ? (
          <Image
            src={event.imageUrl}
            alt=""
            width={w}
            height={h}
            className="h-full w-full object-cover object-center"
            sizes={`${w}px`}
            priority={priority}
            loading={priority ? 'eager' : 'lazy'}
          />
        ) : (
          <div className="bg-[#1a1a18] flex h-full w-full flex-col items-center justify-center gap-3 p-4">
            <div className="h-px w-6 bg-white/15" />
            <p className="text-center text-[10px] font-semibold tracking-[0.15em] text-white/25 uppercase">
              {(event.category?.name ?? 'SWITCH').slice(0, 6)}
            </p>
            <div className="h-px w-6 bg-white/15" />
          </div>
        )}

        {/* Glass name pill — appears on hover */}
        <div
          className="absolute inset-x-0 bottom-0 p-2 transition-opacity duration-200"
          style={{ opacity: hovered ? 1 : 0 }}
          aria-hidden="true"
        >
          <div className="flex items-center gap-1 rounded-lg bg-black/50 px-2 py-1.5 backdrop-blur-md">
            <p className="flex-1 truncate text-[10px] font-semibold leading-tight text-white">
              {event.title}
            </p>
            <ArrowUpRight className="h-3 w-3 shrink-0 text-white/60" />
          </div>
        </div>
      </div>
    </Link>
  )
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

export function HeroSection({ events }: HeroSectionProps) {
  const shouldReduce = useReducedMotion()

  // Find the next upcoming event for the teaser
  const nextEvent = events[0]

  return (
    <section
      className="relative overflow-hidden pt-[60px]"
      style={{ backgroundColor: '#0D0D0D', minHeight: 'clamp(540px, 85svh, 780px)' }}
      aria-label="SWITCH — Discover events"
    >
      {/* ── Grain texture ── */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[1]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23g)'/%3E%3C/svg%3E\")",
          backgroundRepeat: 'repeat',
          backgroundSize: '256px 256px',
          opacity: 0.035,
          mixBlendMode: 'overlay',
        }}
      />

      {/* ── Edge vignette ── */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[2]"
        style={{
          background:
            'radial-gradient(ellipse 75% 80% at 50% 45%, transparent 25%, rgba(13,13,13,0.75) 100%)',
        }}
      />

      {/* ── Bottom fade ── */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 z-[3]"
        style={{
          height: '120px',
          background: 'linear-gradient(to bottom, transparent 0%, #0D0D0D 100%)',
        }}
      />

      {/* ── Desktop posters ── */}
      {DESKTOP_SLOTS.map((slot, i) => (
        <Poster key={i} {...slot} event={events[slot.eventIndex]} delay={i * 55} />
      ))}

      {/* ── Mobile posters — hidden on lg+ ── */}
      {MOBILE_SLOTS.map((slot, i) => (
        <Poster
          key={`m-${i}`}
          {...slot}
          event={events[slot.eventIndex]}
          delay={350 + i * 75}
          className={slot.className + ' lg:hidden'}
        />
      ))}

      {/* ── Central copy ── */}
      <div className="relative z-[10] flex h-full flex-col items-center justify-center px-5 py-20 text-center sm:py-24 lg:py-28">
        {/* Wordmark */}
        <p
          className="hero-fade mb-6 text-[10px] font-semibold tracking-[0.22em] text-white/35 uppercase sm:mb-7 sm:text-[11px]"
          style={{ animationDelay: shouldReduce ? undefined : '60ms' }}
        >
          SWITCH
        </p>

        {/* Headline */}
        <h1
          className="hero-fade mx-auto font-semibold text-white"
          style={{
            maxWidth: '13ch',
            fontSize: 'clamp(36px, 6.5vw, 76px)',
            lineHeight: 1.05,
            letterSpacing: '-0.04em',
            animationDelay: shouldReduce ? undefined : '140ms',
          }}
        >
          Something worth{' '}
          <span style={{ color: '#818cf8' }}>going to</span>{' '}
          is happening.
        </h1>

        {/* Subtext */}
        <p
          className="hero-fade mt-4 text-[14px] leading-relaxed text-white/50 sm:mt-5 sm:text-[16px]"
          style={{
            maxWidth: '36ch',
            animationDelay: shouldReduce ? undefined : '220ms',
          }}
        >
          Concerts, comedy, culture, sports and more — all on SWITCH.
        </p>

        {/* CTAs */}
        <div
          className="hero-fade mt-7 flex flex-wrap items-center justify-center gap-3 sm:mt-8"
          style={{ animationDelay: shouldReduce ? undefined : '300ms' }}
        >
          <Link
            href="/events"
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-white px-5 text-[13px] font-semibold text-black transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:h-11 sm:px-6 sm:text-[13.5px]"
          >
            Explore Events
            <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
          <Link
            href="/dashboard/events/new"
            className="inline-flex h-10 items-center rounded-xl border border-white/25 px-5 text-[13px] font-medium text-white/75 transition-colors hover:border-white/40 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:h-11 sm:px-6 sm:text-[13.5px]"
          >
            Create an Event
          </Link>
        </div>

        {/* Next event teaser */}
        {nextEvent && (
          <p
            className="hero-fade mt-6 text-[11.5px] text-white/25 sm:mt-7"
            style={{ animationDelay: shouldReduce ? undefined : '380ms' }}
          >
            Next up:{' '}
            <Link
              href={`/events/${nextEvent.slug}`}
              className="text-white/40 underline underline-offset-2 transition-colors hover:text-white/60"
            >
              {nextEvent.title}
            </Link>
          </p>
        )}
      </div>
    </section>
  )
}
