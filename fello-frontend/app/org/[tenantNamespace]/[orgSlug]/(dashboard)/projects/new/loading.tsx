import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
  return (
    <div className="flex flex-col h-full bg-background animate-in fade-in-50 duration-300">
      <div className="p-6 flex-1 overflow-auto bg-muted/10">
        <div className="max-w-2xl mx-auto py-4 space-y-14">
          <div className="space-y-8">
            <div className="flex gap-3">
              <Skeleton className="h-5 w-5 rounded-full mt-1" />
              <div className="space-y-1.5 flex-1">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-72" />
              </div>
            </div>

            <div className="flex items-center gap-6 mt-2">
              <Skeleton className="h-16 w-16 rounded-xl shrink-0" />
              <div className="flex flex-col gap-2 flex-1">
                <Skeleton className="h-4 w-40" />
                <div className="flex gap-2 items-center flex-wrap">
                  <Skeleton className="h-9 w-11 rounded-lg" />
                  <Skeleton className="h-9 w-9 rounded-lg" />
                  <Skeleton className="h-9 w-9 rounded-lg" />
                  <Skeleton className="h-9 w-9 rounded-lg" />
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="space-y-2">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-9 w-full rounded-full" />
              </div>

              <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-24 w-full rounded-2xl" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
              <div className="space-y-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-10 w-full rounded-full" />
                <Skeleton className="h-3 w-56" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-10 w-full rounded-full" />
                <Skeleton className="h-3 w-48" />
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-72" />
              </div>

              <div className="rounded-xl border bg-card p-4">
                <div className="flex items-start gap-3">
                  <Skeleton className="size-10 rounded-lg shrink-0" />
                  <div className="flex-1 space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1.5">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-3 w-64" />
                      </div>
                      <Skeleton className="h-8 w-32 rounded-full" />
                    </div>
                    <div className="space-y-2">
                      <Skeleton className="h-3 w-28" />
                      <Skeleton className="h-9 w-full rounded-full" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border bg-card p-4">
                <div className="flex items-start gap-3">
                  <Skeleton className="size-10 rounded-lg shrink-0" />
                  <div className="flex-1 space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1.5">
                        <Skeleton className="h-4 w-20" />
                        <Skeleton className="h-3 w-72" />
                      </div>
                      <Skeleton className="h-8 w-24 rounded-full" />
                    </div>
                    <div className="space-y-2">
                      <Skeleton className="h-3 w-36" />
                      <Skeleton className="h-9 w-full rounded-full" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-6">
              <Skeleton className="h-9 w-20 rounded-full" />
              <Skeleton className="h-9 w-28 rounded-full" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
