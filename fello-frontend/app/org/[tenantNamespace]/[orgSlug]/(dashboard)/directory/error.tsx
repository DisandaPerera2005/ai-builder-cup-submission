"use client"

import * as React from "react"
import { AlertCircle } from "lucide-react"

import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  React.useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="flex-1 overflow-auto bg-muted/10 p-6">
        <div className="mx-auto w-full max-w-4xl py-4">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Directory error</AlertTitle>
            <AlertDescription>
              Failed to load the member directory. Please try again.
            </AlertDescription>
            <AlertAction>
              <Button variant="outline" size="sm" onClick={() => reset()}>
                Try again
              </Button>
            </AlertAction>
          </Alert>
        </div>
      </div>
    </div>
  )
}
