"use client"

import * as React from "react"
import { useParams } from "next/navigation"
import { FaWhatsapp } from "react-icons/fa"
import { CheckCircle2, Loader2, MessageSquareIcon, Plus, RefreshCw, SendIcon, Users } from "lucide-react"
import { collection, getDocs, limit, query, where } from "firebase/firestore"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { RoundedList, RoundedListItem } from "@/components/ui/rounded-list"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { BreadcrumbList, BreadcrumbItem, BreadcrumbPage } from "@/components/ui/breadcrumb"
import { useAuth } from "@/hooks/use-auth"
import { useHeaderStore } from "@/hooks/use-header-store"
import { db } from "@/lib/firebase"
import { connectOrgWhatsapp, getOrgWhatsappQr, getOrgWhatsappStatus, type WhatsappLinkState } from "@/lib/actions/whatsapp"
import {
  listOrgWhatsappGroups,
  createOrgWhatsappGroup,
  sendOrgWhatsappGroupMessage,
  type WhatsappGroup,
  type WhatsappGroupParticipant,
} from "@/lib/actions/whatsapp-groups"

interface DirectoryMember {
  id: string
  displayName: string
  phoneNumber: string
}

const MAX_QR_RETRIES = 2

function normalizePhone(value: unknown): string {
  return typeof value === "string" ? value : ""
}

export default function WhatsappGroupsPage() {
  const { tenantNamespace, orgSlug } = useParams<{ tenantNamespace: string; orgSlug: string }>()
  const { user } = useAuth()
  const { setBreadcrumbs, clearHeader } = useHeaderStore()

  const [orgId, setOrgId] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [whatsappStatus, setWhatsappStatus] = React.useState<string | undefined>(undefined)
  const [groups, setGroups] = React.useState<WhatsappGroup[]>([])
  const [members, setMembers] = React.useState<DirectoryMember[]>([])

  const [createOpen, setCreateOpen] = React.useState(false)
  const [groupName, setGroupName] = React.useState("")
  const [selected, setSelected] = React.useState<Record<string, boolean>>({})
  const [phoneOverrides, setPhoneOverrides] = React.useState<Record<string, string>>({})
  const [creating, setCreating] = React.useState(false)
  const [createError, setCreateError] = React.useState<string | null>(null)

  // Inline connect/QR flow — lets an admin link the org number without
  // leaving this page (previously this only lived in Settings).
  const [connecting, setConnecting] = React.useState(false)
  const [connectError, setConnectError] = React.useState<string | null>(null)
  const [link, setLink] = React.useState<WhatsappLinkState | null>(null)
  const [qrRetries, setQrRetries] = React.useState(0)
  const [qrExhausted, setQrExhausted] = React.useState(false)
  const pollRef = React.useRef<ReturnType<typeof setInterval> | null>(null)
  const linkRef = React.useRef<WhatsappLinkState | null>(null)
  const qrRetriesRef = React.useRef(0)

  // Group detail / send-message sheet.
  const [activeGroup, setActiveGroup] = React.useState<WhatsappGroup | null>(null)
  const [messageText, setMessageText] = React.useState("")
  const [sending, setSending] = React.useState(false)
  const [sendError, setSendError] = React.useState<string | null>(null)

  React.useEffect(() => {
    setBreadcrumbs(
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbPage>WhatsApp</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    )
    return () => clearHeader()
  }, [setBreadcrumbs, clearHeader])

  const updateLink = React.useCallback((next: WhatsappLinkState | null) => {
    linkRef.current = next
    setLink(next)
  }, [])
  const updateQrRetries = React.useCallback((next: number) => {
    qrRetriesRef.current = next
    setQrRetries(next)
  }, [])
  const stopPolling = React.useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }, [])
  const startPolling = React.useCallback(
    (targetOrgId: string) => {
      stopPolling()
      pollRef.current = setInterval(async () => {
        if (!user) return
        const idToken = await user.getIdToken()
        const statusResult = await getOrgWhatsappStatus(idToken, targetOrgId)
        if (statusResult.error === null && statusResult.data.status === "connected") {
          updateLink(statusResult.data)
          setWhatsappStatus("connected")
          stopPolling()
          return
        }
        if (linkRef.current?.qr) return
        const nextRetry = qrRetriesRef.current + 1
        updateQrRetries(nextRetry)
        const qrResult = await getOrgWhatsappQr(idToken, targetOrgId)
        if (qrResult.error === null && qrResult.data.qr) {
          setQrExhausted(false)
          updateLink(qrResult.data)
          return
        }
        if (nextRetry >= MAX_QR_RETRIES) {
          setQrExhausted(true)
          stopPolling()
        }
      }, 2000)
    },
    [user, stopPolling, updateLink, updateQrRetries]
  )
  React.useEffect(() => stopPolling, [stopPolling])

  const handleConnect = async () => {
    if (!orgId || !user) return
    setConnecting(true)
    setConnectError(null)
    updateLink(null)
    setQrExhausted(false)
    updateQrRetries(0)
    try {
      const idToken = await user.getIdToken()
      const result = await connectOrgWhatsapp(idToken, orgId)
      if (result.error !== null) {
        setConnectError(result.error)
        return
      }
      updateLink(result.data)
      if (result.data.status === "connected") {
        setWhatsappStatus("connected")
      } else {
        startPolling(orgId)
      }
    } finally {
      setConnecting(false)
    }
  }

  React.useEffect(() => {
    if (!user) return

    const resolve = async () => {
      try {
        const tenantSnap = await getDocs(
          query(collection(db, "tenants"), where("urlNamespace", "==", tenantNamespace), limit(1))
        )
        if (tenantSnap.empty) return
        const tenantId = tenantSnap.docs[0].id

        const orgSnap = await getDocs(
          query(
            collection(db, "organizations"),
            where("tenantId", "==", tenantId),
            where("slug", "==", orgSlug),
            limit(1)
          )
        )
        if (orgSnap.empty) return
        const resolvedOrgId = orgSnap.docs[0].id
        setOrgId(resolvedOrgId)

        const idToken = await user.getIdToken()

        const [statusResult, groupsResult] = await Promise.all([
          getOrgWhatsappStatus(idToken, resolvedOrgId),
          listOrgWhatsappGroups(idToken, resolvedOrgId),
        ])
        if (statusResult.error === null) setWhatsappStatus(statusResult.data.status)
        if (groupsResult.error === null) setGroups(groupsResult.data)

        // Same memberships ∪ members merge as the Directory page — memberships
        // is always populated, members enriches it with a phone number when set.
        const membersByIdSnap = await getDocs(
          query(collection(db, "members"), where("tenantId", "==", tenantId), where("orgId", "==", resolvedOrgId))
        )
        const fromMembers = new Map<string, DirectoryMember>()
        membersByIdSnap.docs.forEach((d) => {
          const data = d.data()
          fromMembers.set(d.id, {
            id: d.id,
            displayName: String(data.displayName ?? data.name ?? "Unnamed member"),
            phoneNumber: normalizePhone(data.phoneNumber ?? data.phone),
          })
        })

        const membershipsSnap = await getDocs(
          query(collection(db, "memberships"), where("tenantId", "==", tenantId), where("orgId", "==", resolvedOrgId))
        )
        const merged = new Map<string, DirectoryMember>()
        membershipsSnap.docs.forEach((d) => {
          const data = d.data()
          const userId = String(data.userId ?? d.id)
          merged.set(d.id, {
            id: d.id,
            displayName: userId === user.uid ? user.displayName || user.email || "You" : userId,
            phoneNumber: "",
          })
        })
        fromMembers.forEach((m, id) => merged.set(id, m))

        setMembers(Array.from(merged.values()).sort((a, b) => a.displayName.localeCompare(b.displayName)))
      } catch (err) {
        console.error("WhatsApp groups: failed to resolve org", err)
      } finally {
        setLoading(false)
      }
    }

    void resolve()
  }, [user, tenantNamespace, orgSlug])

  const actorMemberId = user ? `${user.uid}_${orgId}` : null

  const openCreateDialog = () => {
    setGroupName("")
    setCreateError(null)
    setPhoneOverrides({})
    // Lock the signed-in user in as a required participant/admin.
    setSelected(actorMemberId ? { [actorMemberId]: true } : {})
    setCreateOpen(true)
  }

  const toggleMember = (memberId: string) => {
    if (memberId === actorMemberId) return // locked on
    setSelected((current) => ({ ...current, [memberId]: !current[memberId] }))
  }

  const phoneFor = (member: DirectoryMember) => phoneOverrides[member.id] ?? member.phoneNumber

  const selectedMembers = members.filter((m) => selected[m.id])
  const canSubmit =
    groupName.trim().length > 0 &&
    selectedMembers.length > 0 &&
    selectedMembers.every((m) => phoneFor(m).replace(/\D/g, "").length >= 8)

  const handleCreate = async () => {
    if (!orgId || !user || !canSubmit) return
    setCreating(true)
    setCreateError(null)
    try {
      const idToken = await user.getIdToken()
      const participants: WhatsappGroupParticipant[] = selectedMembers.map((m) => ({
        memberId: m.id,
        phoneNumber: phoneFor(m),
        isActor: m.id === actorMemberId,
      }))
      const result = await createOrgWhatsappGroup(idToken, orgId, groupName.trim(), participants)
      if (result.error !== null) {
        setCreateError(result.error)
        return
      }
      toast.success(`"${groupName.trim()}" created on WhatsApp`)
      setCreateOpen(false)
      const refreshed = await listOrgWhatsappGroups(idToken, orgId)
      if (refreshed.error === null) setGroups(refreshed.data)
    } finally {
      setCreating(false)
    }
  }

  const openGroup = (group: WhatsappGroup) => {
    setActiveGroup(group)
    setMessageText("")
    setSendError(null)
  }

  const handleSendMessage = async () => {
    if (!orgId || !user || !activeGroup || !messageText.trim()) return
    setSending(true)
    setSendError(null)
    try {
      const idToken = await user.getIdToken()
      const result = await sendOrgWhatsappGroupMessage(idToken, orgId, activeGroup.id, messageText.trim())
      if (result.error !== null) {
        setSendError(result.error)
        return
      }
      toast.success(`Sent to "${activeGroup.name}"`)
      setMessageText("")
    } finally {
      setSending(false)
    }
  }

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-2xl space-y-4 p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>
    )
  }

  if (whatsappStatus !== "connected") {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-4 p-10 text-center">
        {connectError ? (
          <Alert variant="destructive" className="text-left">
            <AlertTitle>Couldn&apos;t connect</AlertTitle>
            <AlertDescription>{connectError}</AlertDescription>
          </Alert>
        ) : link?.qr ? (
          <div className="flex flex-col items-center gap-3 rounded-md border border-border bg-muted/20 px-4 py-5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={link.qr} alt="Scan with WhatsApp" className="h-56 w-56 rounded-lg border" />
            <p className="text-sm text-muted-foreground">
              Open WhatsApp on the number the whole org should share → Linked devices → Link a device, and scan
              this code.
            </p>
          </div>
        ) : qrExhausted ? (
          <button
            type="button"
            onClick={() => void handleConnect()}
            className="flex min-h-[220px] w-full flex-col items-center justify-center gap-3 rounded-md border border-border bg-muted/20 px-4 py-5 text-center transition-colors hover:bg-muted/30"
          >
            <RefreshCw className="size-7 text-muted-foreground" />
            <div>
              <p className="font-medium">Reload WhatsApp QR</p>
              <p className="mt-1 text-sm text-muted-foreground">
                We tried {qrRetries} times and couldn&apos;t load a QR code.
              </p>
            </div>
          </button>
        ) : link ? (
          <div className="flex flex-col items-center gap-3 rounded-md border border-border bg-muted/20 px-4 py-5">
            <Skeleton className="h-56 w-56 rounded-lg" />
            <p className="text-sm text-muted-foreground">Waiting for the gateway to generate a QR code…</p>
          </div>
        ) : (
          <>
            <FaWhatsapp className="h-10 w-10 text-muted-foreground" />
            <div>
              <h2 className="text-lg font-semibold">Connect the org WhatsApp number</h2>
              <p className="text-sm text-muted-foreground">
                Link the number your org shares before creating or messaging groups.
              </p>
            </div>
          </>
        )}

        {!link?.qr && whatsappStatus !== "connected" && (
          <Button onClick={() => void handleConnect()} disabled={connecting}>
            {connecting ? <Loader2 className="mr-2 size-4 animate-spin" /> : <FaWhatsapp className="mr-2 size-4" />}
            {whatsappStatus === "disconnected" ? "Connect again" : "Connect WhatsApp"}
          </Button>
        )}
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">WhatsApp Groups</h1>
        <Button size="sm" onClick={openCreateDialog}>
          <Plus className="mr-2 h-4 w-4" /> Create Group
        </Button>
      </div>

      {groups.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-card p-8 text-center">
          <Users className="mx-auto mb-4 h-8 w-8 text-muted-foreground" />
          <p className="text-muted-foreground">No WhatsApp groups yet.</p>
        </div>
      ) : (
        <RoundedList>
          {groups.map((group) => (
            <RoundedListItem
              key={group.id}
              className="flex cursor-pointer items-center justify-between gap-3 p-4 transition-colors hover:bg-muted/40"
              onClick={() => openGroup(group)}
            >
              <div>
                <p className="font-medium">{group.name}</p>
                <p className="text-xs text-muted-foreground">{group.memberIds.length} members</p>
              </div>
              <MessageSquareIcon className="size-4 text-muted-foreground" />
            </RoundedListItem>
          ))}
        </RoundedList>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create WhatsApp group</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <Input
              placeholder="Group name"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
            />

            {createError && (
              <Alert variant="destructive">
                <AlertTitle>Couldn&apos;t create group</AlertTitle>
                <AlertDescription>{createError}</AlertDescription>
              </Alert>
            )}

            <div className="max-h-80 space-y-2 overflow-y-auto">
              {members.map((member) => {
                const isActor = member.id === actorMemberId
                const isSelected = !!selected[member.id] || isActor
                const phone = phoneFor(member)
                return (
                  <div key={member.id} className="flex items-center gap-3 rounded-lg border p-2.5">
                    <Checkbox
                      checked={isSelected}
                      disabled={isActor}
                      onCheckedChange={() => toggleMember(member.id)}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {member.displayName} {isActor && <span className="text-muted-foreground">(you)</span>}
                      </p>
                      {isSelected && (
                        <Input
                          className="mt-1 h-7 text-xs"
                          placeholder="Phone number with country code"
                          value={phone}
                          onChange={(e) =>
                            setPhoneOverrides((current) => ({ ...current, [member.id]: e.target.value }))
                          }
                        />
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <DialogFooter>
            <Button onClick={() => void handleCreate()} disabled={!canSubmit || creating}>
              {creating ? "Creating..." : "Create Group"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet open={!!activeGroup} onOpenChange={(open) => !open && setActiveGroup(null)}>
        <SheetContent className="flex flex-col gap-4 p-6">
          <SheetHeader className="p-0">
            <SheetTitle>{activeGroup?.name}</SheetTitle>
          </SheetHeader>

          {activeGroup && (
            <>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="size-4" /> {activeGroup.memberIds.length} members
              </div>

              <div className="rounded-lg border bg-muted/20 p-3 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5 text-foreground">
                  <CheckCircle2 className="size-3.5 text-primary" /> Linked to the org WhatsApp number
                </div>
              </div>

              <div className="mt-auto flex flex-col gap-2">
                {sendError && (
                  <Alert variant="destructive">
                    <AlertDescription>{sendError}</AlertDescription>
                  </Alert>
                )}
                <Textarea
                  placeholder="Message this group..."
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  className="min-h-24 resize-none"
                />
                <Button
                  onClick={() => void handleSendMessage()}
                  disabled={sending || !messageText.trim()}
                  className="self-end"
                >
                  {sending ? (
                    <Loader2 className="mr-2 size-3.5 animate-spin" />
                  ) : (
                    <SendIcon className="mr-2 size-3.5" />
                  )}
                  Send
                </Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
