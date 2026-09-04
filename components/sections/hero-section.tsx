import Link from 'next/link'

export function HeroSection() {
  return (
    <section className="pt-[60px]" aria-label="Homepage hero">
      <div className="mx-auto max-w-[1120px] px-5 py-16 sm:px-8 sm:py-24">
        <div className="max-w-2xl">
          <h1
            className="text-foreground font-semibold tracking-tight"
            style={{
              fontSize: 'clamp(36px, 5vw, 60px)',
              lineHeight: 1.1,
              letterSpacing: '-0.04em',
            }}
          >
            Discover events worth going to.
          </h1>
          <p className="text-muted-foreground mt-5 text-[16px] leading-relaxed">
            Find concerts, comedy, culture, sports, and more.
          </p>
          <div className="mt-7">
            <Link
              href="/events"
              className="inline-flex h-11 items-center rounded-lg bg-foreground px-6 text-[14px] font-semibold text-background transition-opacity hover:opacity-85 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
            >
              Explore events
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
