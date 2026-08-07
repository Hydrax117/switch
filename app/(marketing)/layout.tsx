import { SiteHeader } from '@/components/layout/site-header'
import { SiteFooter } from '@/components/layout/site-footer'

/**
 * Marketing layout.
 *
 * The header is `position: fixed` so we do NOT add top padding here —
 * each section is responsible for its own spacing above the fold.
 */
export default function MarketingLayout({ children }: LayoutProps<'/'>) {
  return (
    <div className="relative flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  )
}
