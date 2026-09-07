"use client"

import { useAuth } from "@/hooks/use-auth"
import { Skeleton } from "@/components/ui/skeleton"

function getFirstName(displayName?: string | null) {
  const parts = displayName?.trim().split(/\s+/).filter(Boolean) ?? []
  if (parts.length === 0) return "there"

  return /\d/.test(parts[0]) && parts[1] ? parts[1] : parts[0]
}

export function UserProfile() {
  const { user, loading } = useAuth()

  if (loading) return <Skeleton className="h-10 w-48 rounded-full mb-4 mx-auto" />
  
  if (!user) return null

  return (
    <div className="flex items-center gap-3 bg-background p-1.5 pr-4 rounded-full border mb-2 w-max max-w-full">
      {user.photoURL ? (
        <img src={user.photoURL} alt={user.displayName || "User"} className="h-10 w-10 min-w-10 rounded-full border border-primary/10 object-cover" />
      ) : (
        <div className="flex h-10 w-10 min-w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-bold uppercase border border-primary/10">
          {user.displayName?.charAt(0) || "U"}
        </div>
      )}
      <div className="text-left flex flex-col truncate pr-2">
        <span className="font-semibold text-sm leading-tight truncate">{user.displayName}</span>
        <span className="text-xs text-muted-foreground leading-tight truncate">{user.email}</span>
      </div>
    </div>
  )
}

export function WaitlistGreeting({
  count,
  domain,
  isFirst,
}: {
  count: number
  domain: string
  isFirst: boolean
}) {
  const { user, loading } = useAuth()

  if (loading) return <Skeleton className="h-8 w-full rounded-md" />

  const firstName = getFirstName(user?.displayName)

  return (
    <h1 className="text-2xl font-bold">
      {isFirst
        ? `Hello ${firstName}, looks like you're the first from ${domain}.`
        : `Hello ${firstName}, ${count} people have joined from ${domain}.`}
    </h1>
  )
}
