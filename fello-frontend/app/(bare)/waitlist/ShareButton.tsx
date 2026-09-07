"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Link2, Check } from "lucide-react"

export function ShareButton({ domain }: { domain: string }) {
  const [copied, setCopied] = useState(false)

  const handleShare = async () => {
    const url = `${window.location.origin}/waitlist?domain=${encodeURIComponent(domain)}`
    const text = `I just signed up for early access to Fello from ${domain}! The top domain gets 2 months free — help us reach #1!`

    if (navigator.share) {
      try {
        await navigator.share({ title: "Join Fello Waitlist", text, url })
      } catch {
        // user cancelled
      }
    } else {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <Button onClick={handleShare} variant="secondary" className="w-fit">
      {copied ? <Check className="size-4 mr-2" /> : <Link2 className="size-4 mr-2" />}
      {copied ? "Copied" : "Share"}
    </Button>
  )
}
