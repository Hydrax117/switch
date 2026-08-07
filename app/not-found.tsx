import Link from 'next/link'
import { Home, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function NotFound() {
  return (
    <div className="flex min-h-[80vh] flex-col items-center justify-center px-4 text-center">
      {/* Large 404 */}
      <div className="relative select-none">
        <span className="gradient-text text-[9rem] leading-none font-black tracking-tighter sm:text-[12rem]">
          404
        </span>
      </div>

      <h1 className="mt-4 text-2xl font-bold tracking-tight sm:text-3xl">Page not found</h1>
      <p className="text-muted-foreground mt-3 max-w-sm">
        Sorry, we couldn&#39;t find the page you&#39;re looking for. It may have been moved or
        deleted.
      </p>

      <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
        <Button asChild className="gap-2">
          <Link href="/">
            <Home className="h-4 w-4" />
            Go home
          </Link>
        </Button>
        <Button variant="outline" asChild className="gap-2">
          <Link href="/events">
            <Search className="h-4 w-4" />
            Browse events
          </Link>
        </Button>
      </div>
    </div>
  )
}
