"use client"

import * as React from "react"
import { useAuth } from "@/hooks/use-auth"
import { useRouter } from "next/navigation"
import { Skeleton } from "@/components/ui/skeleton"

export default function NewOrgFlowLayout({
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
            {/* Header skeleton */}
            <div className="space-y-2">
              <Skeleton className="h-6 w-48 bg-muted/70 rounded" />
              <Skeleton className="h-4 w-72 bg-muted/70 rounded" />
            </div>
            {/* Form skeleton */}
            <div className="space-y-6">
              <div className="flex items-center gap-6">
                <Skeleton className="size-16 rounded-3xl bg-muted/70" />
                <Skeleton className="h-9 w-32 rounded-full bg-muted/70" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4.5 w-20 bg-muted/70 rounded" />
                <Skeleton className="h-9 w-full bg-muted/70 rounded-full" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4.5 w-20 bg-muted/70 rounded" />
                <Skeleton className="h-9 w-full bg-muted/70 rounded-full" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4.5 w-24 bg-muted/70 rounded" />
                <Skeleton className="h-20 w-full bg-muted/70 rounded-3xl" />
              </div>
            </div>
            {/* Buttons skeleton */}
            <div className="flex items-center justify-end gap-3 pt-6">
              <Skeleton className="h-9 w-20 bg-muted/70 rounded-full" />
              <Skeleton className="h-9 w-28 bg-muted/70 rounded-full" />
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
