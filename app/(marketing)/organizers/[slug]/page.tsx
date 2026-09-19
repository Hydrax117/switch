import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { Suspense } from 'react'
import Image from 'next/image'
import { Building2, Globe, CalendarDays } from 'lucide-react'
import { HeaderWithSession } from '@/components/layout/header-with-session'
import { SiteFooter } from '@/components/layout/site-footer'
import { EventCard } from '@/features/events/components/event-card'
import { getOrganizerProfile } from '@/features/organizer/public-queries'
import { siteConfig } from '@/config/site'

interface PageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const organizer = await getOrganizerProfile(slug)
  if (!organizer) return { title: 'Organiser Not Found' }

  return {
    title: `${organizer.name} | SWITCH`,
    description: organizer.bio ?? `Events by ${organizer.name} on SWITCH`,
    openGraph: {
      title: organizer.name,
      description: organizer.bio ?? `Events by ${organizer.name}`,
      images: organizer.logoUrl ? [{ url: organizer.logoUrl, width: 400, height: 400 }] : [],
      type: 'profile',
    },
    alternates: { canonical: `${siteConfig.url}/organizers/${slug}` },
  }
}

export default async function OrganizerProfilePage({ params }: PageProps) {
  const { slug } = await params
  const organizer = await getOrganizerProfile(slug)

  if (!organizer) notFound()

  const upcomingEvents = organizer.events.filter(
    (e) => e.status === 'PUBLISHED' && new Date(e.startsAt) >= new Date()
  )
  const pastEvents = organizer.events.filter(
    (e) => e.status === 'COMPLETED' || (e.status === 'PUBLISHED' && new Date(e.startsAt) < new Date())
  )

  return (
    <div className="relative flex min-h-screen flex-col bg-background">
      <Suspense>
        <HeaderWithSession />
      </Suspense>

      <main className="flex-1">
        {/* ── Profile header ─────────────────────────────────────────── */}
        <div className="border-b border-border/60 bg-background">
          <div className="mx-auto max-w-[1120px] px-5 py-12 sm:px-8 sm:py-16">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:gap-8">
              {/* Avatar */}
              <div className="bg-muted relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl sm:h-24 sm:w-24">
                {organizer.logoUrl ? (
                  <Image
                    src={organizer.logoUrl}
                    alt={organizer.name}
                    fill
                    className="object-cover"
                    sizes="96px"
                    priority
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <Building2 className="h-8 w-8 text-muted-foreground" aria-hidden />
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex flex-1 flex-col gap-3">
                <div>
                  <p className="mb-1 text-[11px] font-semibold tracking-[0.12em] uppercase text-muted-foreground">
                    Organiser
                  </p>
                  <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                    {organizer.name}
                  </h1>
                </div>

                {organizer.bio && (
                  <p className="max-w-2xl text-[14px] leading-relaxed text-muted-foreground">
                    {organizer.bio}
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-4">
                  {organizer.websiteUrl && (
                    <a
                      href={organizer.websiteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
                    >
                      <Globe className="h-3.5 w-3.5" aria-hidden />
                      {organizer.websiteUrl.replace(/^https?:\/\//, '')}
                    </a>
                  )}
                  <div className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
                    <CalendarDays className="h-3.5 w-3.5" aria-hidden />
                    {organizer.events.length} event{organizer.events.length !== 1 ? 's' : ''}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Events ─────────────────────────────────────────────────── */}
        <div className="mx-auto max-w-[1120px] px-5 py-12 sm:px-8 sm:py-16">
          {organizer.events.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Building2 className="mb-4 h-10 w-10 text-muted-foreground/40" aria-hidden />
              <p className="text-[15px] font-medium text-muted-foreground">No events yet</p>
              <p className="mt-1 text-[13px] text-muted-foreground/70">
                Check back soon for upcoming events from {organizer.name}.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-14">
              {/* Upcoming */}
              {upcomingEvents.length > 0 && (
                <section>
                  <h2 className="mb-6 text-[11px] font-semibold tracking-[0.12em] uppercase text-muted-foreground">
                    Upcoming Events
                  </h2>
                  <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {upcomingEvents.map((event, i) => (
                      <EventCard key={event.id} event={event} index={i} />
                    ))}
                  </div>
                </section>
              )}

              {/* Past */}
              {pastEvents.length > 0 && (
                <section>
                  <h2 className="mb-6 text-[11px] font-semibold tracking-[0.12em] uppercase text-muted-foreground">
                    Past Events
                  </h2>
                  <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {pastEvents.map((event, i) => (
                      <EventCard key={event.id} event={event} index={i} />
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}
