import Link from "next/link"
import { ArrowLeft, Home, SearchX } from "lucide-react"

import { Button } from "@/components/ui/button"
import { GeminiSVG } from "@/components/ui/gemini-svg"
import { RoundedList, RoundedListItem } from "@/components/ui/rounded-list"

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md">
        <div className="relative overflow-hidden rounded-xl border bg-card shadow-sm">
          <div className="absolute inset-x-0 top-0 h-24 bg-muted/40" aria-hidden="true" />
          <div className="relative flex flex-col items-center px-6 pb-6 pt-8 text-center">
            <div className="flex size-14 items-center justify-center rounded-full border bg-background shadow-sm">
              <GeminiSVG className="size-6 grayscale" />
            </div>
            <div className="mt-5 inline-flex items-center gap-2 rounded-full border bg-background/80 px-2.5 py-1 text-xs text-muted-foreground backdrop-blur-sm">
              <SearchX className="size-3.5" />
              <span>404</span>
            </div>
            <h1 className="mt-4 font-heading text-2xl font-semibold tracking-normal">Page not found</h1>
            <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
              This page does not exist, or it moved to a different workspace path.
            </p>

            <RoundedList className="mt-6 w-full space-y-0">
              <RoundedListItem className="w-full rounded-t-lg rounded-b-none border p-0 shadow-none">
                <Button asChild variant="ghost" className="h-auto w-full justify-start gap-3 rounded-[inherit] p-3">
                  <Link href="/">
                    <span className="flex size-8 items-center justify-center rounded-md border bg-background text-muted-foreground">
                      <Home className="size-4" />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col items-start">
                      <span className="text-sm font-medium text-foreground">Go home</span>
                      <span className="text-xs text-muted-foreground">Choose a workspace or create one.</span>
                    </span>
                  </Link>
                </Button>
              </RoundedListItem>
              <RoundedListItem className="w-full rounded-t-none rounded-b-lg border border-t-0 p-0 shadow-none">
                <Button asChild variant="ghost" className="h-auto w-full justify-start gap-3 rounded-[inherit] p-3">
                  <Link href="/profile">
                    <span className="flex size-8 items-center justify-center rounded-md border bg-background text-muted-foreground">
                      <ArrowLeft className="size-4" />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col items-start">
                      <span className="text-sm font-medium text-foreground">Open profile</span>
                      <span className="text-xs text-muted-foreground">Review your account and organizations.</span>
                    </span>
                  </Link>
                </Button>
              </RoundedListItem>
            </RoundedList>
          </div>
        </div>
      </div>
    </main>
  )
}
