import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
  return (
    <div className="flex h-full flex-col bg-background">
      <div className="flex-1 overflow-auto bg-muted/10 p-6">
        <div className="mx-auto w-full max-w-4xl space-y-6 py-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-2">
              <Skeleton className="h-8 w-40" />
              <Skeleton className="h-4 w-80" />
            </div>
            <div className="grid grid-cols-3 gap-2 sm:w-80">
              <Skeleton className="h-20 rounded-lg" />
              <Skeleton className="h-20 rounded-lg" />
              <Skeleton className="h-20 rounded-lg" />
            </div>
          </div>

          <Skeleton className="h-10 w-full rounded-full" />

          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-20 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
