"use client"

import * as React from "react"
import { UIMessage } from "ai"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Bubble, BubbleContent } from "@/components/ui/bubble"
import { Message, MessageAvatar, MessageContent } from "@/components/ui/message"
import { MessageScrollerItem } from "@/components/ui/message-scroller"
import { GeminiSVG } from "@/components/ui/gemini-svg"
import { DynamicUIRenderer } from "@/components/dynamic-ui"

interface MessageAnimatedProps {
  message: UIMessage
  scrollAnchor?: boolean
  userPhotoURL?: string | null
  userDisplayName?: string | null
  onSuggestionClick?: (text: string) => void
}

function renderInlineMarkdown(text: string) {
  return text.split(/(\*\*.*?\*\*|`.*?`)/g).map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**"))
      return <strong key={i} className="font-bold text-foreground">{part.slice(2, -2)}</strong>
    if (part.startsWith("`") && part.endsWith("`"))
      return <code key={i} className="bg-muted/60 px-1.5 py-0.5 rounded-sm font-mono text-xs text-foreground/90">{part.slice(1, -1)}</code>
    return part
  })
}

function UserMarkdown({ content }: { content: string }) {
  const lines = content.split("\n")
  const els: React.ReactNode[] = []
  let list: { t: "ul" | "ol"; items: React.ReactNode[] } | null = null

  const fl = (k: string | number) => {
    if (!list) return
    const El = list.t === "ul" ? "ul" : "ol"
    els.push(<El key={`l${k}`} className={list.t === "ul" ? "list-disc pl-5 my-1" : "list-decimal pl-5 my-1"}>{list.items.map((it, j) => <li key={j}>{it}</li>)}</El>)
    list = null
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const bm = line.match(/^\s*[•\-*]\s+(.*)/)
    const nm = line.match(/^\s*\d+\.\s+(.*)/)
    if (bm)      { if (!list || list.t !== "ul") { fl(i); list = { t: "ul", items: [] } }; list.items.push(renderInlineMarkdown(bm[1])) }
    else if (nm) { if (!list || list.t !== "ol") { fl(i); list = { t: "ol", items: [] } }; list.items.push(renderInlineMarkdown(nm[1])) }
    else { fl(i); if (line.trim() === "") els.push(<div key={`br${i}`} className="h-1.5" />); else els.push(<div key={`p${i}`} className="leading-relaxed">{renderInlineMarkdown(line)}</div>) }
  }
  fl("end")
  return <div className="flex flex-col gap-0.5 text-sm">{els}</div>
}

export function MessageAnimated({ message, scrollAnchor, userPhotoURL, userDisplayName, onSuggestionClick }: MessageAnimatedProps) {
  const isUser = message.role === "user"
  // v5 UIMessages store text in `parts`; fall back to `content` for older shapes.
  const m = message as any
  const content: string = Array.isArray(m.parts)
    ? m.parts.filter((p: any) => p?.type === "text").map((p: any) => p.text).join("")
    : (typeof m.content === "string" ? m.content : "")
  const initials = userDisplayName
    ? userDisplayName.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)
    : "Me"

  return (
    <MessageScrollerItem messageId={message.id} scrollAnchor={scrollAnchor}>
      <Message align={isUser ? "end" : "start"}>
        <MessageAvatar>
          {isUser ? (
            <Avatar>
              <AvatarImage src={userPhotoURL ?? undefined} alt={userDisplayName ?? "You"} />
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
          ) : (
            <div className="size-8 flex items-center justify-center p-1 bg-white rounded-full border border-border shadow-xs">
              <GeminiSVG className="size-full" />
            </div>
          )}
        </MessageAvatar>

        <MessageContent>
          {isUser ? (
            <Bubble variant="default">
              <BubbleContent className={!content.includes("\n") ? "rounded-2xl px-5" : "rounded-lg"}>
                <UserMarkdown content={content} />
              </BubbleContent>
            </Bubble>
          ) : (
            <div className="p-1 pl-2 max-w-full">
              <DynamicUIRenderer content={content} onAction={onSuggestionClick} />
            </div>
          )}
        </MessageContent>
      </Message>
    </MessageScrollerItem>
  )
}
