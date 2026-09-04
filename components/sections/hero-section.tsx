'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useReducedMotion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import type { EventListItem } from '@/features/events/types'

interface HeroSectionProps {
  events: EventListItem[]
  categories: { id: string; name: string; slug: string }[]
}

// ─── Poster slot config ───────────────────────────────────────────────────────
// Positions are absolute percentages within the hero container.
// The central 40% width is left clear for the copy block.

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
  if (!event) return null

  return (
    <div
      className={`${className} overflow-hidden rounded-[14px] shadow-[0_8px_40px_rgba(0,0,0,0.6)] poster-fade-in`}
      style={{
        width: w,
        height: h,
        transform: rotation !== '0deg' ? `rotate(${rotation})` : undefined,
        animationDelay: shouldReduce ? undefined : `${delay}ms`,
      }}
      aria-hidden="true"
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
        // No-image fallback stays dark — it lives inside the always-dark hero
        <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-[#1a1a18] p-4">
          <div className="h-px w-6 bg-white/15" />
          <p className="text-center text-[10px] font-semibold tracking-[0.15em] text-white/20 uppercase">
            {(event.category?.name ?? 'SWITCH').slice(0, 6)}
          </p>
          <div className="h-px w-6 bg-white/15" />
        </div>
      )}
    </div>
  )
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

export function HeroSection({ events }: HeroSectionProps) {
  const shouldReduce = useReducedMotion()

  return (
    // The hero is intentionally always dark — it is a cinematic section.
    // Theme toggling affects all sections below it.
    <section
      className="relative overflow-hidden pt-[60px]"
      style={{ backgroundColor: '#0D0D0D', minHeight: 'clamp(560px, 85svh, 780px)' }}
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
          opacity: 0.028,
          mixBlendMode: 'overlay',
        }}
      />

      {/* ── Edge vignette — frames the poster composition ── */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[2]"
        style={{
          background:
            'radial-gradient(ellipse 75% 80% at 50% 45%, transparent 25%, rgba(13,13,13,0.72) 100%)',
        }}
      />

      {/* ── Bottom fade — transitions into the themed page background ── */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 z-[3]"
        style={{
          height: '180px',
          // Goes from transparent → pure #0D0D0D → then the page background var
          // so there is no hard edge between hero and the content below
          background:
            'linear-gradient(to bottom, transparent 0%, #0D0D0D 55%, var(--color-background) 100%)',
        }}
      />

      {/* ── Desktop posters ── */}
      {DESKTOP_SLOTS.map((slot, i) => (
        <Poster key={i} {...slot} event={events[slot.eventIndex]} delay={i * 55} />
      ))}

      {/* ── Mobile posters ── */}
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
        {/* Wordmark label */}
        <p
          className="hero-fade mb-7 text-[11px] font-semibold tracking-[0.22em] text-white/35 uppercase"
          style={{ animationDelay: shouldReduce ? undefined : '60ms' }}
        >
          SWITCH
        </p>

        {/* Main headline */}
        <h1
          className="hero-fade mx-auto font-semibold text-white"
          style={{
            maxWidth: '14ch',
            fontSize: 'clamp(40px, 6.5vw, 76px)',
            lineHeight: 1.05,
            letterSpacing: '-0.04em',
            animationDelay: shouldReduce ? undefined : '140ms',
          }}
        >
          Something worth{' '}
          <span style={{ color: '#a5b4fc' }}>going to</span>{' '}
          is happening.
        </h1>

        {/* Subtext */}
        <p
          className="hero-fade mt-5 text-[15px] leading-relaxed text-white/50 sm:text-[16px]"
          style={{
            maxWidth: '38ch',
            animationDelay: shouldReduce ? undefined : '220ms',
          }}
        >
          Concerts, comedy, culture, sports and more — all on SWITCH.
        </p>

        {/* CTAs */}
        <div
          className="hero-fade mt-8 flex flex-wrap items-center justify-center gap-3"
          style={{ animationDelay: shouldReduce ? undefined : '300ms' }}
        >
          <Link
            href="/events"
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-white px-6 text-[13.5px] font-semibold text-black transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            Explore Events
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
          <Link
            href="/dashboard/events/new"
            className="inline-flex h-11 items-center rounded-xl border border-white/20 px-6 text-[13.5px] font-medium text-white/75 transition-colors hover:border-white/35 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            Create an Event
          </Link>
        </div>

        {/* Event count — only rendered when real events exist */}
        {events.length > 0 && (
          <p
            className="hero-fade mt-7 text-[12px] text-white/25"
            style={{ animationDelay: shouldReduce ? undefined : '380ms' }}
          >
            {events.length}+ events happening soon
          </p>
        )}
      </div>
    </section>
  )
}
