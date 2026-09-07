"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import { ChevronLeft, ChevronRight, FolderOpen, Link2, Phone, QrCode } from "lucide-react"
import {
  AssistantRuntimeProvider,
  CompositeAttachmentAdapter,
  SimpleImageAttachmentAdapter,
  SimpleTextAttachmentAdapter,
  useExternalStoreRuntime,
  type AppendMessage,
  type ThreadMessageLike,
} from "@assistant-ui/react"

import { useAuth } from "@/hooks/use-auth"
import { useOrgStore } from "@/hooks/use-org-store"
import { auth, db } from "@/lib/firebase"
import { ChatActionsProvider } from "@/lib/chat-actions"
import { Thread } from "@/components/assistant-ui/thread"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { collection, doc, getDoc, getDocs, limit, query, where } from "firebase/firestore"

type ChatMessagePart = {
  type?: unknown
  text?: unknown
  toolCallId?: unknown
  toolName?: unknown
  input?: unknown
  output?: unknown
}

type ChatMessageLike = {
  role: ThreadMessageLike["role"]
  id?: string
  parts?: unknown
  content?: unknown
}

type JsonValue = string | number | boolean | null | JsonValue[] | { readonly [key: string]: JsonValue }
type JsonObject = { readonly [key: string]: JsonValue }

// Default quick-start chips shown on a fresh / empty conversation
const QUICK_START = [
  "What events are active?",
  "Show all open tasks",
  "Who are my members?",
  "Draft a sponsor outreach message",
]

function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return "Good Morning"
  if (hour < 18) return "Good Afternoon"
  return "Good Evening"
}

// Extract plain text from a v5 UIMessage (text lives in `parts`).
function messageText(m: { parts?: unknown; content?: unknown }): string {
  if (Array.isArray(m?.parts)) {
    return m.parts
      .filter((p): p is ChatMessagePart & { type: "text"; text: string } => {
        const part = p as ChatMessagePart
        return part?.type === "text" && typeof part.text === "string"
      })
      .map((p) => p.text)
      .join("")
  }
  return typeof m?.content === "string" ? m.content : ""
}

// Extract plain text out of an assistant-ui AppendMessage (composer submission).
function appendMessageText(message: AppendMessage): string {
  return message.content
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("")
}

function asJsonObject(value: unknown): JsonObject | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined
  return value as JsonObject
}

/**
 * Bridges an AI SDK v5 UIMessage into assistant-ui's ThreadMessageLike.
 * Reasoning and tool-call parts pass through as real message-part types
 * (assistant-ui's Thread renders those natively — see thread.tsx) — the
 * remaining text still carries [BLOCK:...] markers, rendered by FelloText.
 */
function toThreadMessageLike(m: ChatMessageLike): ThreadMessageLike {
  const content: Exclude<ThreadMessageLike["content"], string | undefined>[number][] = []
  const parts = Array.isArray(m.parts) ? (m.parts as ChatMessagePart[]) : []
  for (const p of parts) {
    if (p.type === "text") {
      content.push({ type: "text", text: typeof p.text === "string" ? p.text : "" })
    } else if (p.type === "reasoning") {
      content.push({ type: "reasoning", text: typeof p.text === "string" ? p.text : "" })
    } else if (p.type === "dynamic-tool" || (typeof p.type === "string" && p.type.startsWith("tool-"))) {
      content.push({
        type: "tool-call",
        toolCallId: typeof p.toolCallId === "string" ? p.toolCallId : "",
        toolName: p.type === "dynamic-tool" && typeof p.toolName === "string" ? p.toolName : p.type.slice("tool-".length),
        args: asJsonObject(p.input),
        result: p.output,
      })
    }
  }
  return { role: m.role, content, id: m.id }
}

export default function DashboardPage() {
  const activeOrg = useOrgStore((s) => s.activeOrg)
  // Agent Engine session handle — kept across turns so the conversation has memory.
  const sessionIdRef = React.useRef<string | null>(null)
  // Hold the current org id in a ref so the (memoized) transport reads it fresh.
  const orgIdRef = React.useRef<string | null>(null)
  React.useEffect(() => {
    orgIdRef.current = activeOrg?.id ?? null
  }, [activeOrg?.id])

  // AI SDK UI Message Stream transport -> /api/chat. We inject the verified
  // Firebase ID token + org context at send time, and capture the agent
  // session id from the response header so follow-up turns reuse the same
  // conversation. The response carries real text/reasoning/tool-call parts
  // (see lib/agent-engine.ts::streamAgentReply), which assistant-ui's Thread
  // renders natively as it streams in.
  // eslint-disable-next-line react-hooks/preserve-manual-memoization
  const transport = React.useMemo(
    () =>
      // eslint-disable-next-line react-hooks/refs
      new DefaultChatTransport({
        api: "/api/chat",
        fetch: (async (url: string, options: RequestInit) => {
          const res = await fetch(url, options)
          const sid = res.headers.get("x-fello-session-id")
          if (sid) sessionIdRef.current = sid
          return res
        }) as typeof fetch,
        prepareSendMessagesRequest: async ({ messages: msgs }) => {
          const idToken = auth.currentUser ? await auth.currentUser.getIdToken() : null
          const headers: Record<string, string> = {}
          if (idToken) headers.Authorization = `Bearer ${idToken}`
          return {
            headers,
            body: {
              messages: msgs.map((m) => ({ role: m.role, content: messageText(m) })),
              orgId: orgIdRef.current,
              eventId: null,
              sessionId: sessionIdRef.current,
            },
          }
        },
      }),
    []
  )

  const { messages, sendMessage, status, stop } = useChat({ transport })
  const isBusy = status === "submitted" || status === "streaming"

  const handleSend = React.useCallback(
    (text: string) => {
      const msg = text.trim()
      if (!msg || isBusy) return
      void sendMessage({ text: msg })
    },
    [isBusy, sendMessage]
  )

  // Preview-only for now — there's no upload backend, so attachments are
  // shown in the composer but their content never reaches the agent (only
  // the message text does, via appendMessageText below).
  const attachmentsAdapter = React.useMemo(
    () => new CompositeAttachmentAdapter([new SimpleImageAttachmentAdapter(), new SimpleTextAttachmentAdapter()]),
    []
  )

  const runtime = useExternalStoreRuntime({
    messages,
    convertMessage: toThreadMessageLike,
    isRunning: isBusy,
    suggestions: QUICK_START.map((prompt) => ({ prompt })),
    adapters: { attachments: attachmentsAdapter },
    onNew: async (message) => {
      handleSend(appendMessageText(message))
    },
    onCancel: async () => {
      stop()
    },
  })

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <ChatActionsProvider onAction={handleSend}>
        <div className="h-full overflow-x-hidden">
          <Thread
            components={{
              Welcome: FelloWelcome,
            }}
          />
        </div>
      </ChatActionsProvider>
    </AssistantRuntimeProvider>
  )
}

function FelloWelcome() {
  const { user } = useAuth()
  const firstName = user?.displayName?.split(" ")[0] || user?.email?.split("@")[0]
  const greeting = getGreeting()
  const greetingText = `${greeting}${firstName ? `, ${firstName}` : ""}`
  const setupSuggestions = useSetupSuggestions()
  const [lightOn, setLightOn] = React.useState(false)
  const [introFlashOn, setIntroFlashOn] = React.useState(false)
  const introFlashStartedRef = React.useRef(false)
  const introFlashTimersRef = React.useRef<number[]>([])
  const beamVisible = lightOn || introFlashOn

  React.useEffect(() => {
    return () => {
      introFlashTimersRef.current.forEach((timer) => window.clearTimeout(timer))
    }
  }, [])

  const startIntroFlash = React.useCallback(() => {
    if (introFlashStartedRef.current) return
    introFlashStartedRef.current = true

    const flashSteps = [
      { delay: 120, on: true },
      { delay: 260, on: false },
      { delay: 400, on: true },
      { delay: 560, on: false },
    ]

    introFlashTimersRef.current = flashSteps.map(({ delay, on }) =>
      window.setTimeout(() => setIntroFlashOn(on), delay)
    )
  }, [])

  return (
    <div className="mx-auto mb-12 w-full max-w-lg select-none px-6 pb-12 pt-32 text-center">
      <div className="absolute left-0 right-0 top-0 z-0 mx-auto h-72 w-full max-w-lg overflow-visible">
        {beamVisible ? (
          <>
            <div
              aria-hidden="true"
              className="pointer-events-none absolute right-[1.8rem] top-[4.1rem] h-56 w-[calc(var(--spacing)*28.5)] origin-top bg-[linear-gradient(to_bottom,rgba(250,204,21,0.52),rgba(250,204,21,0.24)_42%,transparent_100%)] blur-xl mix-blend-multiply [clip-path:polygon(35%_0,65%_0,100%_100%,0_100%)] after:absolute after:inset-0 after:bg-[repeating-radial-gradient(circle_at_34%_18%,rgba(255,255,255,0.24)_0_1px,transparent_1px_5px)] after:opacity-60 after:[clip-path:inherit] after:blur-sm dark:mix-blend-screen sm:right-[1.8rem] sm:top-[4.7rem]"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute right-[4.05rem] top-[3.55rem] size-10 -rotate-12 rounded-full bg-[radial-gradient(circle,rgba(250,204,21,0.55),rgba(250,204,21,0.18)_58%,transparent_76%)] blur-[2px] mix-blend-multiply dark:mix-blend-screen sm:right-[4.95rem] sm:top-[4.1rem]"
            />
          </>
        ) : null}
        <button
          type="button"
          aria-pressed={lightOn}
          aria-label={lightOn ? "Turn light bulb off" : "Turn light bulb on"}
          onClick={() => setLightOn((current) => !current)}
          className="absolute -top-5 right-3 z-10 w-24 cursor-pointer rounded-full outline-none transition-transform hover:scale-105 focus-visible:ring-2 focus-visible:ring-ring/40 active:scale-95 sm:right-6 sm:w-28"
        >
          <Image
            src="/chrommy-greeting/light-bulb.png"
            alt=""
            width={128}
            height={128}
            priority
            onLoad={startIntroFlash}
            className={`w-full drop-shadow-lg transition-[filter] duration-200 ${
              beamVisible ? "brightness-110 saturate-125 drop-shadow-[0_0_18px_rgba(250,204,21,0.55)]" : ""
            }`}
          />
        </button>
      </div>
      <div className="relative flex justify-center">
        <Image
          src="/chrommy-greeting/apple-1.png"
          alt=""
          width={48}
          height={48}
          priority
          className="pointer-events-none absolute -left-5 top-8 z-0 w-10 -rotate-12 drop-shadow-lg sm:-left-10 sm:w-12"
        />
        <div className="relative z-10 w-fit px-3 text-left">
          <div className="flex items-start gap-3">
            {user?.photoURL ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.photoURL}
                alt={user.displayName || user.email || "Profile"}
                className="mt-1 size-9 rounded-full border object-cover shadow-sm"
              />
            ) : (
              <div className="mt-1 flex size-9 items-center justify-center rounded-full border bg-background text-xs font-semibold text-foreground shadow-sm">
                {(firstName || "U").charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <h2 className="pb-1 font-heading text-3xl font-semibold leading-tight tracking-normal text-foreground drop-shadow-sm">
                {greetingText}
              </h2>
            </div>
          </div>
          <p className="mt-2 max-w-sm pl-12 text-sm text-muted-foreground">
            Where should we start today?
          </p>
        </div>
      </div>
      {setupSuggestions.length > 0 ? (
        <SetupSuggestionRail
          suggestions={setupSuggestions}
        />
      ) : null}
    </div>
  )
}

type SetupSuggestionKind = "google" | "drive-folder" | "personal-whatsapp" | "org-whatsapp"

interface SetupSuggestion {
  kind: SetupSuggestionKind
  title: string
  description: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  action: string
}

interface SetupState {
  googleConnected: boolean
  driveFolderPicked: boolean
  personalWhatsappAdded: boolean
  orgWhatsappConnected: boolean
}

const SETUP_STATE_READY: SetupState = {
  googleConnected: true,
  driveFolderPicked: true,
  personalWhatsappAdded: true,
  orgWhatsappConnected: true,
}

function hasText(value: unknown) {
  return typeof value === "string" && value.trim().length > 0
}

function useSetupSuggestions(): SetupSuggestion[] {
  const { user } = useAuth()
  const activeOrg = useOrgStore((s) => s.activeOrg)
  const [setupState, setSetupState] = React.useState<SetupState>(SETUP_STATE_READY)

  React.useEffect(() => {
    if (!user || !activeOrg?.id) {
      return
    }

    let cancelled = false

    const loadSetupState = async () => {
      try {
        const [googleSnap, orgSnap, directMemberSnap, emailMemberSnap] = await Promise.all([
          // Admin/coordinator-only doc (it holds the org's Google OAuth
          // tokens) — a permission error for a team member just means
          // "not connected" for this setup checklist.
          getDoc(doc(db, "google_integrations", activeOrg.id)).catch(() => null),
          getDoc(doc(db, "organizations", activeOrg.id)),
          // Reading a members doc that doesn't exist (or belongs to another
          // org) is a rules PERMISSION_DENIED, not exists()=false — the rule
          // can't evaluate resource.data.orgId on a missing doc. Treat it as
          // "no member record" instead of failing the whole checklist load.
          getDoc(doc(db, "members", user.uid)).catch(() => null),
          user.email
            ? getDocs(
                query(
                  collection(db, "members"),
                  where("orgId", "==", activeOrg.id),
                  where("email", "==", user.email),
                  limit(1)
                )
              ).catch(() => null)
            : Promise.resolve(null),
        ])

        if (cancelled) return

        const googleData = googleSnap && googleSnap.exists() ? googleSnap.data() : null
        const orgData = orgSnap.exists() ? orgSnap.data() : null
        const directMemberData = directMemberSnap && directMemberSnap.exists() ? directMemberSnap.data() : null
        const emailMemberData = emailMemberSnap && !emailMemberSnap.empty ? emailMemberSnap.docs[0].data() : null
        const memberData =
          directMemberData && directMemberData.orgId === activeOrg.id ? directMemberData : emailMemberData

        setSetupState({
          googleConnected: Boolean(googleData?.connected),
          driveFolderPicked: hasText(orgData?.driveRootFolderId),
          personalWhatsappAdded: hasText(memberData?.phoneNumber) || hasText(memberData?.phone) || hasText(memberData?.whatsappJid),
          orgWhatsappConnected: orgData?.whatsappStatus === "connected",
        })
      } catch (error) {
        console.error("Dashboard setup suggestions failed:", error)
        if (!cancelled) setSetupState(SETUP_STATE_READY)
      }
    }

    void loadSetupState()

    return () => {
      cancelled = true
    }
  }, [activeOrg?.id, user])

  return React.useMemo(() => {
    if (!activeOrg) return []

    const base = `/org/${activeOrg.tenantNamespace}/${activeOrg.slug}`
    const suggestions: SetupSuggestion[] = []

    if (!setupState.googleConnected) {
      suggestions.push({
        kind: "google",
        title: "Connect Google account",
        description: "Let Fello create and find Drive files, Docs, Sheets, and Forms for this workspace.",
        href: `${base}/setup/google`,
        icon: Link2,
        action: "Connect",
      })
    }

    if (setupState.googleConnected && !setupState.driveFolderPicked) {
      suggestions.push({
        kind: "drive-folder",
        title: "Pick Drive folder",
        description: "Choose the one folder Fello can use for workspace files before it creates or indexes documents.",
        href: `${base}/setup/file`,
        icon: FolderOpen,
        action: "Pick folder",
      })
    }

    if (!setupState.personalWhatsappAdded) {
      suggestions.push({
        kind: "personal-whatsapp",
        title: "Add your WhatsApp no.",
        description: "Link your own number so Fello can attribute WhatsApp messages to your account.",
        href: "/profile/setup/whatsapp",
        icon: Phone,
        action: "Add number",
      })
    }

    if (!setupState.orgWhatsappConnected) {
      suggestions.push({
        kind: "org-whatsapp",
        title: "Connect WhatsApp",
        description: "Scan the QR for the shared org number so Fello can coordinate in WhatsApp.",
        href: `${base}/setup/whatsapp`,
        icon: QrCode,
        action: "Open QR",
      })
    }

    return suggestions
  }, [activeOrg, setupState])
}

function SetupSuggestionRail({
  suggestions,
}: {
  suggestions: SetupSuggestion[]
}) {
  const viewportRef = React.useRef<HTMLDivElement | null>(null)

  const scrollByCard = (direction: "left" | "right") => {
    viewportRef.current?.scrollBy({
      left: direction === "left" ? -260 : 260,
      behavior: "smooth",
    })
  }

  return (
    <div className="relative mt-6">
      {suggestions.length > 1 ? (
        <div className="pointer-events-none absolute -top-10 right-0 z-20 flex items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="icon-xs"
            className="pointer-events-auto rounded-full bg-background/80"
            onClick={() => scrollByCard("left")}
            aria-label="Show previous setup suggestion"
          >
            <ChevronLeft className="size-3.5" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon-xs"
            className="pointer-events-auto rounded-full bg-background/80"
            onClick={() => scrollByCard("right")}
            aria-label="Show next setup suggestion"
          >
            <ChevronRight className="size-3.5" />
          </Button>
        </div>
      ) : null}

      <div
        ref={viewportRef}
        className="flex w-full snap-x gap-2 overflow-x-auto overscroll-x-contain scroll-smooth pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {suggestions.map((suggestion) => {
          const Icon = suggestion.icon
          return (
            <Link
              key={suggestion.kind}
              href={suggestion.href}
              className="group/suggestion flex min-h-28 w-[17rem] shrink-0 snap-start items-start gap-3 rounded-lg border bg-card/55 p-3 text-left shadow-sm backdrop-blur-md transition-colors hover:bg-card/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-md border bg-background/60 text-muted-foreground backdrop-blur-sm transition-colors group-hover/suggestion:text-foreground">
                <Icon className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium text-foreground">{suggestion.title}</span>
                  <Badge variant="outline" className="h-5 rounded-full border-foreground/25 bg-transparent px-1.5 text-[10px] text-foreground">
                    Setup
                  </Badge>
                </span>
                <span className="mt-1 block text-xs leading-5 text-muted-foreground">{suggestion.description}</span>
                <span className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-foreground">
                  {suggestion.action}
                  <ChevronRight className="size-3" />
                </span>
              </span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
