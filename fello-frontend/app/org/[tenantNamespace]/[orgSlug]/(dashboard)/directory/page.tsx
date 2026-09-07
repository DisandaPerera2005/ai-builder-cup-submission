"use client"

import * as React from "react"
import { useParams } from "next/navigation"
import { AlertCircle, CalendarDays, ChevronRight, Hash, Mail, Phone, Search, ShieldCheck, UserPlus, Users, X } from "lucide-react"

import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { RoundedList, RoundedListItem } from "@/components/ui/rounded-list"
import { Skeleton } from "@/components/ui/skeleton"
import { BreadcrumbItem, BreadcrumbList, BreadcrumbPage } from "@/components/ui/breadcrumb"
import { useAuth } from "@/hooks/use-auth"
import { useDetailPanelStore } from "@/hooks/use-detail-panel-store"
import { useHeaderStore } from "@/hooks/use-header-store"
import { db } from "@/lib/firebase"
import { collection, getDocs, limit, query, where } from "firebase/firestore"
import type { Member, OrgInvite } from "@/lib/types"

interface DirectoryMember extends Omit<Member, "role" | "joinedAt"> {
  tenantId: string
  email?: string
  role: string
  status?: "active" | "invited" | "inactive"
  joinedAt: Member["joinedAt"] | string | null
  access?: string
  capabilities?: string[]
  photoUrl?: string
}

function formatDate(value: DirectoryMember["joinedAt"]) {
  if (!value) return "Not joined yet"

  if (typeof value === "string") {
    const parsed = new Date(value)
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    }
    return "Not joined yet"
  }

  try {
    return value.toDate().toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  } catch {
    return "Not joined yet"
  }
}

function normalizeStatus(status: unknown): DirectoryMember["status"] {
  if (status === "active" || status === "invited" || status === "inactive") return status
  return "active"
}

function normalizeCapabilities(capabilities: unknown): string[] {
  if (!Array.isArray(capabilities)) return []
  return capabilities.filter((capability): capability is string => typeof capability === "string")
}

function getStringField(data: Record<string, unknown>, fields: string[]) {
  for (const field of fields) {
    const value = data[field]
    if (typeof value === "string" && value.trim()) return value
  }
  return ""
}

function formatRole(role: string) {
  if (role === "chair") return "Chairperson"
  return role.replace(/_/g, " ")
}

function formatCapabilities(capabilities: string[]) {
  return capabilities.map((capability) => capability.replace(/[._]/g, " ")).join(", ")
}

function MemberAvatar({ member, className = "size-12" }: { member: DirectoryMember; className?: string }) {
  return (
    <div className={`${className} flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted/40 text-sm font-semibold uppercase text-foreground/75`}>
      {member.photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={member.photoUrl} alt={member.displayName} className="size-full object-cover" />
      ) : (
        member.displayName.charAt(0)
      )}
    </div>
  )
}

function DetailRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: React.ReactNode
}) {
  return (
    <div className="flex gap-3 rounded-md border bg-transparent p-3">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <p className="text-[11px] text-muted-foreground">{label}</p>
        <div className="mt-0.5 break-words text-sm text-foreground">{value}</div>
      </div>
    </div>
  )
}

function MemberDetailPanel({ member, onClose }: { member: DirectoryMember; onClose: () => void }) {
  return (
    <div className="flex h-full flex-col bg-background">
      <div className="flex items-center justify-between border-b px-5 py-4">
        <div>
          <p className="text-sm font-medium">Member details</p>
          <p className="text-xs text-muted-foreground">Directory profile</p>
        </div>
        <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close member details">
          <X className="size-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-auto p-5">
        <div className="flex flex-col items-center text-center">
          <MemberAvatar member={member} className="size-20" />
          <h2 className="mt-3 max-w-full truncate text-lg font-semibold">{member.displayName}</h2>
          <p className="text-sm capitalize text-muted-foreground">{formatRole(member.role)}</p>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            <Badge variant="outline" className="rounded-full border-foreground/40 bg-transparent text-[11px] capitalize text-foreground">
              {member.status}
            </Badge>
            {member.access ? (
              <Badge variant="outline" className="rounded-full border-foreground/25 bg-transparent text-[11px] capitalize text-foreground">
                {member.access}
              </Badge>
            ) : null}
          </div>
        </div>

        <div className="mt-6 space-y-3">
          <DetailRow icon={Mail} label="Email" value={member.email || "Not provided"} />
          <DetailRow icon={Phone} label="Phone" value={member.phoneNumber || "Not provided"} />
          <DetailRow
            icon={CalendarDays}
            label={member.status === "invited" ? "Invited" : "Joined"}
            value={formatDate(member.joinedAt)}
          />
          <DetailRow
            icon={ShieldCheck}
            label="Capabilities"
            value={member.capabilities?.length ? formatCapabilities(member.capabilities) : "No specific capabilities"}
          />
          {member.whatsappJid ? (
            <DetailRow icon={Phone} label="WhatsApp JID" value={member.whatsappJid} />
          ) : null}
          <DetailRow icon={Hash} label="Member ID" value={member.id} />
        </div>
      </div>
    </div>
  )
}

export default function DirectoryPage() {
  const { tenantNamespace, orgSlug } = useParams<{ tenantNamespace: string; orgSlug: string }>()
  const { user } = useAuth()
  const { setBreadcrumbs, setActions, clearHeader } = useHeaderStore()
  const { openPanel, closePanel } = useDetailPanelStore()

  const [tenantId, setTenantId] = React.useState<string | null>(null)
  const [orgId, setOrgId] = React.useState<string | null>(null)
  const [members, setMembers] = React.useState<DirectoryMember[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [searchQuery, setSearchQuery] = React.useState("")

  React.useEffect(() => {
    setBreadcrumbs(
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbPage>Directory</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    )
    setActions(
      <Button size="icon" variant="outline" className="h-8 w-8 rounded-full" disabled>
        <UserPlus className="h-4 w-4" />
        <span className="sr-only">Add member</span>
      </Button>
    )
    return () => clearHeader()
  }, [setBreadcrumbs, setActions, clearHeader])

  React.useEffect(() => {
    if (!user) return

    const resolveWorkspace = async () => {
      try {
        setLoading(true)
        setError(null)

        const tenantQuery = query(
          collection(db, "tenants"),
          where("urlNamespace", "==", tenantNamespace),
          limit(1)
        )
        const tenantSnap = await getDocs(tenantQuery)
        if (tenantSnap.empty) {
          setError(`No institution found for URL namespace: ${tenantNamespace}`)
          setLoading(false)
          return
        }

        const resolvedTenantId = tenantSnap.docs[0].id
        setTenantId(resolvedTenantId)

        const orgQuery = query(
          collection(db, "organizations"),
          where("tenantId", "==", resolvedTenantId),
          where("slug", "==", orgSlug),
          limit(1)
        )
        const orgSnap = await getDocs(orgQuery)
        if (orgSnap.empty) {
          setError(`No organization found with slug "${orgSlug}"`)
          setLoading(false)
          return
        }

        setOrgId(orgSnap.docs[0].id)
      } catch (err) {
        console.error("Directory workspace resolution error:", err)
        setError("Failed to resolve workspace. Please try again.")
        setLoading(false)
      }
    }

    void resolveWorkspace()
  }, [user, tenantNamespace, orgSlug])

  const loadMembers = React.useCallback(async () => {
    if (!tenantId || !orgId) return

    await Promise.resolve()
    setLoading(true)
    setError(null)

    try {
      const membersQuery = query(
        collection(db, "members"),
        where("tenantId", "==", tenantId),
        where("orgId", "==", orgId)
      )
      const membersSnapshot = await getDocs(membersQuery)
      const loadedMembers: DirectoryMember[] = membersSnapshot.docs.map((memberDoc) => {
        const data = memberDoc.data()
        const isCurrentUser = memberDoc.id === user?.uid || memberDoc.id.startsWith(`${user?.uid}_`)

        return {
          id: memberDoc.id,
          tenantId: String(data.tenantId ?? tenantId),
          orgId: String(data.orgId ?? orgId),
          displayName: String(data.displayName ?? data.name ?? "Unnamed member"),
          email: typeof data.email === "string" ? data.email : "",
          phoneNumber: String(data.phoneNumber ?? data.phone ?? ""),
          role: String(data.role ?? "member"),
          status: normalizeStatus(data.status),
          joinedAt: data.joinedAt ?? null,
          whatsappJid: String(data.whatsappJid ?? ""),
          access: typeof data.access === "string" ? data.access : "",
          capabilities: normalizeCapabilities(data.capabilities),
          photoUrl: isCurrentUser
            ? user?.photoURL || getStringField(data, ["photoUrl", "photoURL", "picture", "avatarUrl", "imageUrl"])
            : getStringField(data, ["photoUrl", "photoURL", "picture", "avatarUrl", "imageUrl"]),
        }
      })

      const membershipsQuery = query(
        collection(db, "memberships"),
        where("tenantId", "==", tenantId),
        where("orgId", "==", orgId)
      )
      const membershipsSnapshot = await getDocs(membershipsQuery)
      const membershipMembers: DirectoryMember[] = membershipsSnapshot.docs.map((membershipDoc) => {
        const data = membershipDoc.data()
        const userId = String(data.userId ?? membershipDoc.id)

        return {
          id: membershipDoc.id,
          tenantId: String(data.tenantId ?? tenantId),
          orgId: String(data.orgId ?? orgId),
          displayName: userId === user?.uid ? user.displayName || user.email || "You" : userId,
          email: userId === user?.uid ? user.email || "" : "",
          phoneNumber: "",
          role: String(data.role ?? "member"),
          status: "active",
          joinedAt: typeof data.addedAt === "string" ? data.addedAt : null,
          whatsappJid: "",
          access: typeof data.access === "string" ? data.access : "",
          capabilities: normalizeCapabilities(data.capabilities),
          photoUrl: userId === user?.uid
            ? user.photoURL || getStringField(data, ["photoUrl", "photoURL", "picture", "avatarUrl", "imageUrl"])
            : getStringField(data, ["photoUrl", "photoURL", "picture", "avatarUrl", "imageUrl"]),
        }
      })

      const mergedMembers = new Map<string, DirectoryMember>()
      membershipMembers.forEach((member) => mergedMembers.set(member.id, member))
      loadedMembers.forEach((member) => {
        const existing = mergedMembers.get(member.id)
        mergedMembers.set(member.id, {
          ...existing,
          ...member,
          photoUrl: member.photoUrl || existing?.photoUrl,
          email: member.email || existing?.email,
          phoneNumber: member.phoneNumber || existing?.phoneNumber || "",
          capabilities: member.capabilities?.length ? member.capabilities : existing?.capabilities,
        })
      })

      // Pending invites — people who've been invited but haven't signed in yet.
      // Shown alongside real members with status "invited" so coordinators can
      // see who's still waiting, without conflating them with active members.
      const invitesQuery = query(
        collection(db, "org_invites"),
        where("orgId", "==", orgId),
        where("status", "==", "invited")
      )
      const invitesSnapshot = await getDocs(invitesQuery)
      invitesSnapshot.docs.forEach((inviteDoc) => {
        const data = inviteDoc.data() as OrgInvite
        mergedMembers.set(inviteDoc.id, {
          id: inviteDoc.id,
          tenantId: String(data.tenantId ?? tenantId),
          orgId: String(data.orgId ?? orgId),
          displayName: data.inviteeName || data.inviteValue,
          email: data.inviteValue,
          phoneNumber: "",
          role: "invited",
          status: "invited",
          joinedAt: data.invitedAt ?? null,
          whatsappJid: "",
          access: data.access ?? "",
          capabilities: normalizeCapabilities(data.capabilities),
          photoUrl: "",
        })
      })

      setMembers(
        Array.from(mergedMembers.values()).sort((a, b) =>
          a.displayName.localeCompare(b.displayName)
        )
      )
    } catch (err) {
      console.error("Failed to load directory members:", err)
      setError("Failed to load members from the database.")
    } finally {
      setLoading(false)
    }
  }, [tenantId, orgId, user])

  React.useEffect(() => {
    const timeout = window.setTimeout(() => void loadMembers(), 0)
    return () => window.clearTimeout(timeout)
  }, [loadMembers])

  React.useEffect(() => closePanel, [closePanel])

  const openMemberDetails = React.useCallback(
    (member: DirectoryMember) => {
      openPanel(<MemberDetailPanel member={member} onClose={closePanel} />)
    },
    [openPanel, closePanel]
  )

  const filteredMembers = React.useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase()
    if (!normalizedQuery) return members

    return members.filter((member) =>
      [
        member.displayName,
        member.email,
        member.phoneNumber,
        member.role,
        member.status,
        member.access,
        member.capabilities?.join(" "),
      ].some((value) => value?.toLowerCase().includes(normalizedQuery))
    )
  }, [members, searchQuery])

  const activeCount = members.filter((member) => member.status === "active").length
  const adminCount = members.filter((member) => member.role === "admin" || member.role === "chair").length

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="flex-1 overflow-auto bg-muted/10 p-6">
        <div className="mx-auto w-full max-w-xl space-y-8 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <h1 className="font-heading text-xl font-medium">Directory</h1>
              <p className="text-sm text-muted-foreground">Members, roles, and contact details.</p>
            </div>
            <div className="flex shrink-0 items-center gap-1.5 pt-0.5">
              <Badge variant="outline" className="h-6 rounded-full border-foreground/25 bg-transparent px-2 text-[11px] text-foreground">
                {members.length} members
              </Badge>
              <Badge variant="outline" className="h-6 rounded-full border-foreground/25 bg-transparent px-2 text-[11px] text-foreground">
                {activeCount} active
              </Badge>
              <Badge variant="outline" className="h-6 rounded-full border-foreground/25 bg-transparent px-2 text-[11px] text-foreground">
                {adminCount} admins
              </Badge>
            </div>
          </div>

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search members by name, role, phone, or email"
              className="rounded-full pl-9"
            />
          </div>

          {error ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Database error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
              <AlertAction>
                <Button variant="outline" size="sm" onClick={() => void loadMembers()}>
                  Try again
                </Button>
              </AlertAction>
            </Alert>
          ) : null}

          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, index) => (
                <Skeleton key={index} className="h-20 rounded-xl" />
              ))}
            </div>
          ) : filteredMembers.length === 0 ? (
            <div className="rounded-xl border border-dashed bg-card p-10 text-center">
              <Users className="mx-auto h-8 w-8 text-muted-foreground" />
              <h2 className="mt-4 text-base font-semibold">
                {members.length === 0 ? "No members yet" : "No members match your search"}
              </h2>
              <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
                {members.length === 0
                  ? "Members added to this workspace will appear here with their contact details and access roles."
                  : "Try a different name, role, phone number, or email."}
              </p>
            </div>
          ) : (
            <RoundedList className="w-full">
              {filteredMembers.map((member) => (
                <RoundedListItem key={member.id} className="w-full border p-0 shadow-none">
                  <button
                    type="button"
                    onClick={() => openMemberDetails(member)}
                    className="flex w-full min-w-0 items-center gap-3 p-3 text-left transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
                  >
                    <div className="shrink-0">
                      <MemberAvatar member={member} className="size-12" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">{member.displayName}</p>
                          <p className="truncate text-xs capitalize text-muted-foreground">{formatRole(member.role)}</p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <Badge variant="outline" className="border-foreground/40 bg-transparent text-[11px] capitalize text-foreground">
                            {member.status}
                          </Badge>
                          <ChevronRight className="size-4 text-muted-foreground" />
                        </div>
                      </div>
                    </div>
                  </button>
                </RoundedListItem>
              ))}
            </RoundedList>
          )}
        </div>
      </div>
    </div>
  )
}
