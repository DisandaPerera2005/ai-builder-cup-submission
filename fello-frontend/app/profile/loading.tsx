import { Skeleton } from "@/components/ui/skeleton"

export default function ProfileLoading() {
  return (
    <div className="flex h-screen flex-col bg-background">
      <main className="flex-grow overflow-auto bg-muted/10 p-6">
        <div className="mx-auto w-full max-w-xl space-y-8 py-4">
          <section className="rounded-lg border bg-card p-3">
            <div className="flex min-w-0 items-center gap-3">
              <Skeleton className="size-12 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-5 w-36" />
                <Skeleton className="h-3 w-48" />
              </div>
            </div>
          </section>
          <section className="space-y-3">
            <Skeleton className="h-5 w-28" />
            <div className="space-y-0">
              <Skeleton className="h-16 w-full rounded-t-lg rounded-b-none" />
              <Skeleton className="h-16 w-full rounded-none" />
              <Skeleton className="h-16 w-full rounded-t-none rounded-b-lg" />
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}
