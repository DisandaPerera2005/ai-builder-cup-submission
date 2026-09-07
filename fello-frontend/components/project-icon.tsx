"use client"

import * as React from "react"
import { getDownloadURL, ref } from "firebase/storage"
import { storage } from "@/lib/firebase"
import { cn } from "@/lib/utils"

import { VscGithubProject } from "react-icons/vsc"

interface ProjectIconProps {
  icon?: string
  iconUrl?: string
  size?: "default" | "compact"
}

export function ProjectIcon({ icon, iconUrl, size = "default" }: ProjectIconProps) {
  const [resolved, setResolved] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(false)
  const source = icon || iconUrl || ""
  const isEmoji = !!source && /^[\p{Emoji}\p{Symbol}]$/u.test(source)
  const compact = size === "compact"
  const imageClassName = compact
    ? "h-full w-full rounded-sm object-cover"
    : "w-full h-full object-contain p-2.5 rounded-md"
  const fallbackIconClassName = compact ? "w-3.5 h-3.5 shrink-0" : "w-6 h-6 shrink-0"

  React.useEffect(() => {
    let cancelled = false
    const run = async () => {
      if (!source) {
        setResolved(null)
        return
      }

      if (
        source.startsWith("gs://") ||
        source.startsWith("firebase:") ||
        source.startsWith("tenants/")
      ) {
        setLoading(true)
        try {
          let path = source
          if (source.startsWith("firebase:")) {
            path = source.replace("firebase:", "")
          } else if (source.startsWith("gs://")) {
            path = source.split("/").slice(3).join("/")
          }
          const iconRef = ref(storage, path)
          const url = await getDownloadURL(iconRef)
          if (!cancelled) {
            setResolved(url)
          }
        } catch (err) {
          console.error("resolveIcon failed:", err)
          if (!cancelled) {
            setResolved(iconUrl || "ERROR")
          }
        } finally {
          if (!cancelled) {
            setLoading(false)
          }
        }
      } else {
        // direct URL or emoji
        if (!cancelled) {
          setResolved(source)
        }
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [iconUrl, source])

  if (isEmoji) {
    return <span className={cn("leading-none", compact ? "text-sm" : "text-2xl")}>{source}</span>
  }

  if (!source) {
    return (
      <div className="w-full h-full bg-muted flex items-center justify-center text-muted-foreground">
        <VscGithubProject className={fallbackIconClassName} />
      </div>
    )
  }

  if (loading) {
    if (iconUrl) {
      return (
        <img
          src={iconUrl}
          alt="Project Icon"
          width={48}
          height={48}
          className={imageClassName}
        />
      )
    }

    return <div className="w-full h-full bg-muted animate-pulse duration-300 rounded-lg" />
  }

  if (resolved === "ERROR") {
    return (
      <div className={cn("w-full h-full bg-destructive/10 flex items-center justify-center text-destructive font-semibold", compact ? "text-[10px]" : "text-sm")}>
        ⚠️
      </div>
    )
  }

  const src = resolved || iconUrl || source
  return (
    <img
      src={src}
      alt="Project Icon"
      width={48}
      height={48}
      className={imageClassName}
      onError={(e) => {
        e.currentTarget.onerror = null
        e.currentTarget.style.display = "none"
      }}
    />
  )
}
