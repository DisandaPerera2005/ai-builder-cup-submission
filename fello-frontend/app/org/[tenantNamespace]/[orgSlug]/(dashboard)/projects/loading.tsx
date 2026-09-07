import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
  return (
    <div className="flex flex-col h-full bg-background animate-in fade-in-50 duration-300">
      <div className="p-6 flex-grow overflow-auto bg-muted/10">
        <div className="max-w-4xl mx-auto py-4 space-y-14">
          {/* Header Skeleton */}
          <div className="flex items-start gap-3">
            <Skeleton className="h-5 w-5 rounded-full mt-1" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-72" />
            </div>
          </div>

          {/* List Skeleton */}
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 w-full rounded-md border bg-card p-2 flex items-center justify-between">
                <div className="flex items-center gap-4 w-full">
                  <Skeleton className="size-12 rounded-full" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-40" />
                    <div className="flex gap-2">
                      <Skeleton className="h-4 w-16 rounded-full" />
                      <Skeleton className="h-4 w-24 rounded-full" />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
