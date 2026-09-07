"use client"

import { AlertCircle } from "lucide-react"

import { Button } from "@/components/ui/button"

export default function ProfileError({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="flex w-full max-w-md flex-col items-center rounded-lg border bg-card p-6 text-center">
        <div className="flex size-11 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <AlertCircle className="size-5" />
        </div>
        <h1 className="mt-4 text-lg font-semibold">Could not load profile</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong while opening your profile settings.
        </p>
        <Button className="mt-5" onClick={reset}>
          Try again
        </Button>
      </div>
    </div>
  )
}
