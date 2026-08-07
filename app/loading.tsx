import { Skeleton } from '@/components/ui/skeleton'

/**
 * Root loading UI — shown while the root layout's async operations are pending.
 * Uses Suspense boundary automatically by Next.js.
 */
export default function Loading() {
  return (
    <div className="container mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      {/* Hero skeleton */}
      <div className="flex flex-col items-center gap-6 py-16">
        <Skeleton className="h-6 w-36 rounded-full" />
        <Skeleton className="h-14 w-3/4 max-w-2xl" />
        <Skeleton className="h-14 w-1/2 max-w-xl" />
        <Skeleton className="h-5 w-2/3 max-w-lg" />
        <div className="mt-4 flex gap-3">
          <Skeleton className="h-11 w-36 rounded-full" />
          <Skeleton className="h-11 w-28 rounded-full" />
        </div>
      </div>

      {/* Content grid skeleton */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="border-border rounded-xl border p-5">
            <Skeleton className="mb-3 h-9 w-9 rounded-lg" />
            <Skeleton className="mb-2 h-4 w-24" />
            <Skeleton className="h-3 w-36" />
          </div>
        ))}
      </div>
    </div>
  )
}
