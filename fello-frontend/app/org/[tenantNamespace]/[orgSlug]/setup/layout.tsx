"use client"

import * as React from "react"
import { useAuth } from "@/hooks/use-auth"
import { useRouter } from "next/navigation"
import { Skeleton } from "@/components/ui/skeleton"

export default function SetupLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, loading } = useAuth()
  const router = useRouter()

  React.useEffect(() => {
    if (!loading && !user) {
      router.push("/sign-in")
    }
  }, [user, loading, router])

  if (loading || !user) {
    return (
      <div className="flex flex-col min-h-screen bg-background relative">
        <div className="p-6 flex-grow overflow-auto bg-muted/10 flex justify-center">
          <div className="w-full max-w-xl py-12 space-y-8 animate-pulse">
            {/* Top Org card skeleton */}
            <div className="w-full border rounded-3xl p-2 bg-card/50 flex items-center">
              <Skeleton className="w-12 min-w-12 h-12 min-h-12 rounded-2xl mr-4 bg-muted/70" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4.5 w-32 rounded bg-muted/70" />
                <Skeleton className="h-3 w-40 rounded bg-muted/70" />
              </div>
            </div>

            {/* Title skeleton */}
            <div className="flex gap-3 pt-4">
              <Skeleton className="size-5 rounded-full shrink-0 bg-muted/70" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4.5 w-40 rounded bg-muted/70" />
                <Skeleton className="h-3.5 w-72 rounded bg-muted/70" />
              </div>
            </div>

            {/* Content body skeleton */}
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Skeleton className="size-10 rounded-2xl bg-muted/70" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-32 bg-muted/70" />
                    <Skeleton className="h-3 w-48 bg-muted/70" />
                  </div>
                </div>
                <Skeleton className="h-8 w-20 rounded-full bg-muted/70" />
              </div>

              <div className="border rounded-3xl divide-y">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="p-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Skeleton className="size-7 rounded-lg bg-muted/70" />
                      <Skeleton className="h-3.5 w-24 bg-muted/70" />
                    </div>
                    <Skeleton className="size-4.5 rounded-full bg-muted/70" />
                  </div>
                ))}
              </div>
            </div>

            {/* Bottom buttons skeleton */}
            <div className="flex items-center justify-between pt-6">
              <Skeleton className="h-9 w-28 rounded-full bg-muted/70" />
              <Skeleton className="h-9 w-28 rounded-full bg-muted/70" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen bg-background animate-in fade-in-50 duration-300 relative">
      <div className="p-6 flex-grow overflow-auto bg-muted/10 flex justify-center">
        <div className="w-full max-w-xl py-12 relative">
          {children}
        </div>
      </div>
    </div>
  )
}
