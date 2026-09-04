import Link from 'next/link'
import { getCategories } from '@/features/events'

export async function CategoriesSection() {
  const categories = await getCategories()
  if (!categories.length) return null

  return (
    <section className="border-border/50 border-b bg-background py-14 sm:py-16" aria-label="Explore by interest">
      <div className="mx-auto max-w-[1120px] px-5 sm:px-8">
        {/* ── Label ── */}
        <p className="text-muted-foreground mb-7 text-[11px] font-semibold tracking-[0.18em] uppercase">
          Explore by interest
        </p>

        {/* ── Category typography list ── */}
        <nav aria-label="Event categories">
          <ul className="flex flex-wrap items-baseline gap-x-6 gap-y-2 sm:gap-x-8">
            <li>
              <Link
                href="/events"
                className="group inline-block"
              >
                <span
                  className="text-foreground font-semibold transition-colors duration-150 group-hover:text-brand-600"
                  style={{ fontSize: 'clamp(20px, 2.8vw, 32px)', letterSpacing: '-0.03em' }}
                >
                  All
                </span>
              </Link>
            </li>
            {categories.map((cat) => (
              <li key={cat.id}>
                <Link
                  href={`/events?category=${cat.slug}`}
                  className="group inline-block"
                >
                  <span
                    className="text-muted-foreground font-semibold transition-colors duration-150 group-hover:text-foreground"
                    style={{ fontSize: 'clamp(20px, 2.8vw, 32px)', letterSpacing: '-0.03em' }}
                  >
                    {cat.name}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </section>
  )
}
