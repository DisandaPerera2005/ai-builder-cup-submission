"use client"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"

export default function Error({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="flex h-[80vh] items-center justify-center p-6">
      <div className="w-full max-w-md space-y-4">
        <Alert>
          <AlertTitle>Could not load project</AlertTitle>
          <AlertDescription>
            There was a problem loading this project. Try again.
          </AlertDescription>
        </Alert>
        <div className="flex justify-end">
          <Button onClick={reset}>Retry</Button>
        </div>
      </div>
    </div>
  )
}
