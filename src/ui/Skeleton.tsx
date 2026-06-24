export function CardSkeleton() {
  return (
    <div className="ps-card flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between">
        <div className="h-4 w-16 animate-pulse rounded-full bg-sunk" />
        <div className="h-3 w-12 animate-pulse rounded bg-sunk" />
      </div>
      <div className="h-3 w-full animate-pulse rounded bg-sunk" />
      <div className="h-3 w-4/5 animate-pulse rounded bg-sunk" />
    </div>
  )
}

export function SkeletonList({ count = 3 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-2" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  )
}
