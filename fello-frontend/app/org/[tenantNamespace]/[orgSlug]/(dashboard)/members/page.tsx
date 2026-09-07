"use client"

import * as React from "react"
import { useParams } from "next/navigation"
import { format } from "date-fns"
import { toast } from "sonner"
import { useAuth } from "@/hooks/use-auth"
import { db } from "@/lib/firebase"
import {
  collection,
  query,
  where,
  limit,
  getDocs,
  doc,
  getDoc,
  updateDoc,
} from "firebase/firestore"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { RoundedList, RoundedListItem, RoundedListItemIcon } from "@/components/ui/rounded-list"
import { MailIcon, Loader2, UserX, UsersIcon, MailPlusIcon, UploadIcon, FileTextIcon } from "lucide-react"
import type { OrgInvite } from "@/lib/types"
import type { ManualInviteRow } from "@/lib/actions/org-invites"
import { parseMemberFile } from "@/lib/member-import"
import { importMembersFile } from "@/lib/actions/member-import"
import { cn } from "@/lib/utils"

// memberships/{userId}_{orgId} — no dedicated interface in lib/types.ts yet,
// matching the shape defined in CLAUDE.md §6.
interface Membership {
  userId: string
  orgId: string
  tenantId: string
  nodeId: string
  role: string
  access: "full" | "coordinator" | "team" | "readonly" | "event_only"
  capabilities: string[]
  addedBy: string
  addedAt: string
}

interface MembershipRow extends Membership {
  id: string
  memberName: string | null
  memberEmail: string | null
}

interface InviteRow extends OrgInvite {
  id: string
}

function ini(text: string) {
  return text
    .split(/[\s@.]+/)
    .filter(Boolean)
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

function itemRadius(index: number, length: number) {
  if (length === 1) return "rounded-lg"
  if (index === 0) return "rounded-t-lg rounded-b-none"
  if (index === length - 1) return "rounded-t-none rounded-b-lg"
  return "rounded-none"
}

export default function MembersPage() {
  const { tenantNamespace, orgSlug } = useParams<{ tenantNamespace: string; orgSlug: string }>()
  const { user } = useAuth()

  const [orgId, setOrgId] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const [invites, setInvites] = React.useState<InviteRow[]>([])
  const [members, setMembers] = React.useState<MembershipRow[]>([])
  const [revokingId, setRevokingId] = React.useState<string | null>(null)

  const [importOpen, setImportOpen] = React.useState(false)
  const [importFile, setImportFile] = React.useState<File | null>(null)
  const [parsing, setParsing] = React.useState(false)
  const [parseError, setParseError] = React.useState<string | null>(null)
  const [parsedRows, setParsedRows] = React.useState<ManualInviteRow[]>([])
  const [rowIncluded, setRowIncluded] = React.useState<Record<number, boolean>>({})
  const [importing, setImporting] = React.useState(false)
  const [importSummary, setImportSummary] = React.useState<{
    invitedCount: number
    skippedCount: number
    emailError: string | null
    whatsappSent: number
  } | null>(null)

  React.useEffect(() => {
    if (!user) return

    const resolve = async () => {
      try {
        const tenantSnap = await getDocs(
          query(collection(db, "tenants"), where("urlNamespace", "==", tenantNamespace), limit(1))
        )
        if (tenantSnap.empty) {
          setError("Could not find this organization.")
          return
        }
        const tenantId = tenantSnap.docs[0].id

        const orgSnap = await getDocs(
          query(
            collection(db, "organizations"),
            where("tenantId", "==", tenantId),
            where("slug", "==", orgSlug),
            limit(1)
          )
        )
        if (orgSnap.empty) {
          setError("Could not find this organization.")
          return
        }
        const resolvedOrgId = orgSnap.docs[0].id
        setOrgId(resolvedOrgId)

        const [inviteSnap, membershipSnap] = await Promise.all([
          getDocs(query(collection(db, "org_invites"), where("orgId", "==", resolvedOrgId), where("status", "==", "invited"))),
          getDocs(query(collection(db, "memberships"), where("orgId", "==", resolvedOrgId))),
        ])

        setInvites(
          inviteSnap.docs.map((d) => ({ id: d.id, ...(d.data() as OrgInvite) }))
        )

        const membershipRows = await Promise.all(
          membershipSnap.docs.map(async (d) => {
            const data = d.data() as Membership
            let memberName: string | null = null
            let memberEmail: string | null = null
            try {
              const userSnap = await getDoc(doc(db, "users", data.userId))
              if (userSnap.exists()) {
                const u = userSnap.data() as { name?: string; email?: string }
                memberName = u.name ?? null
                memberEmail = u.email ?? null
              }
            } catch {
              // fall back to raw ids below
            }
            return { id: d.id, ...data, memberName, memberEmail }
          })
        )
        setMembers(membershipRows)
      } catch (err) {
        console.error("Members: failed to resolve org", err)
        setError("Something went wrong loading this page.")
      } finally {
        setLoading(false)
      }
    }

    void resolve()
  }, [user, tenantNamespace, orgSlug])

  const revokeInvite = async (inviteId: string) => {
    setRevokingId(inviteId)
    try {
      await updateDoc(doc(db, "org_invites", inviteId), { status: "revoked" })
      setInvites((prev) => prev.filter((inv) => inv.id !== inviteId))
    } catch (err) {
      console.error("Failed to revoke invite:", err)
    } finally {
      setRevokingId(null)
    }
  }

  const openImportDialog = () => {
    setImportFile(null)
    setParsedRows([])
    setRowIncluded({})
    setParseError(null)
    setImportSummary(null)
    setImportOpen(true)
  }

  const handleFileChange = async (file: File | null) => {
    setImportFile(file)
    setParsedRows([])
    setRowIncluded({})
    setParseError(null)
    if (!file) return
    setParsing(true)
    try {
      const result = await parseMemberFile(file)
      if (result.error) {
        setParseError(result.error)
        return
      }
      if (result.rows.length === 0) {
        setParseError("No rows with a usable email address were found in this file.")
        return
      }
      setParsedRows(result.rows)
      setRowIncluded(Object.fromEntries(result.rows.map((_, i) => [i, true])))
    } finally {
      setParsing(false)
    }
  }

  const handleImport = async () => {
    if (!orgId || !user || !importFile) return
    const rows = parsedRows.filter((_, i) => rowIncluded[i])
    if (rows.length === 0) return

    setImporting(true)
    setParseError(null)
    try {
      const idToken = await user.getIdToken()
      const result = await importMembersFile(idToken, orgId, importFile, rows)
      if (result.error !== null || result.data === null) {
        setParseError(result.error ?? "Failed to import members.")
        return
      }
      setImportSummary({
        invitedCount: result.data.invited.length,
        skippedCount: result.data.skipped.length,
        emailError: result.data.emailError,
        whatsappSent: result.data.whatsappSent,
      })
      toast.success(`Invited ${result.data.invited.length} member${result.data.invited.length === 1 ? "" : "s"}`)

      const tenantSnap = await getDocs(
        query(collection(db, "org_invites"), where("orgId", "==", orgId), where("status", "==", "invited"))
      )
      setInvites(tenantSnap.docs.map((d) => ({ id: d.id, ...(d.data() as OrgInvite) })))
    } finally {
      setImporting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col h-full bg-background animate-in fade-in-50 duration-300">
        <div className="p-6 flex-grow overflow-auto bg-muted/10">
          <div className="max-w-xl mx-auto py-4 space-y-14">
            <Skeleton className="h-16 w-full rounded-md" />
            <Skeleton className="h-56 w-full rounded-xl" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="p-6 flex-grow overflow-auto bg-muted/10">
        <div className="max-w-xl mx-auto py-4 space-y-14">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {!error && orgId && (
            <>
              {/* Pending invites */}
              <section className="flex flex-col gap-4">
                <div className="flex items-center gap-2">
                  <MailPlusIcon className="size-4 text-muted-foreground" />
                  <h2 className="font-heading text-base font-medium">Pending invites</h2>
                  <Badge variant="secondary" className="text-[11px]">{invites.length}</Badge>
                  <Button size="sm" variant="outline" className="ml-auto h-8 text-xs" onClick={openImportDialog}>
                    <UploadIcon className="size-3.5" /> Import members
                  </Button>
                </div>

                {invites.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No pending invites right now.</p>
                ) : (
                  <RoundedList className="gap-0 space-y-0">
                    {invites.map((invite, i) => (
                      <RoundedListItem
                        key={invite.id}
                        className={cn("w-full p-0 border shadow-none", itemRadius(i, invites.length))}
                      >
                        <div className="flex w-full items-center gap-3 px-3 py-2.5">
                          <RoundedListItemIcon className="w-8 min-w-8 h-8 min-h-8 flex items-center justify-center bg-muted/40 text-foreground/75 shrink-0">
                            <MailIcon className="size-4" />
                          </RoundedListItemIcon>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">{invite.inviteValue}</div>
                            <div className="text-xs text-muted-foreground truncate">
                              Invited by {invite.invitedBy}
                              {invite.invitedAt ? ` · ${format(new Date(invite.invitedAt), "MMM d, yyyy")}` : ""}
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            className="shrink-0 text-xs h-8"
                            disabled={revokingId === invite.id}
                            onClick={() => void revokeInvite(invite.id)}
                          >
                            {revokingId === invite.id ? (
                              <Loader2 className="size-3.5 animate-spin" />
                            ) : (
                              <UserX className="size-3.5" />
                            )}
                            Revoke
                          </Button>
                        </div>
                      </RoundedListItem>
                    ))}
                  </RoundedList>
                )}
              </section>

              {/* Members */}
              <section className="flex flex-col gap-4">
                <div className="flex items-center gap-2">
                  <UsersIcon className="size-4 text-muted-foreground" />
                  <h2 className="font-heading text-base font-medium">Members</h2>
                  <Badge variant="secondary" className="text-[11px]">{members.length}</Badge>
                </div>

                {members.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No members yet.</p>
                ) : (
                  <RoundedList className="gap-0 space-y-0">
                    {members.map((m, i) => {
                      const label = m.memberName || m.memberEmail || m.userId
                      const sub = m.memberEmail || m.userId
                      return (
                        <RoundedListItem
                          key={m.id}
                          className={cn("w-full p-0 border shadow-none", itemRadius(i, members.length))}
                        >
                          <div className="flex w-full items-center gap-3 px-3 py-2.5">
                            <RoundedListItemIcon className="w-8 min-w-8 h-8 min-h-8 flex items-center justify-center bg-primary/10 text-primary text-xs font-semibold shrink-0 !rounded-full">
                              {ini(label)}
                            </RoundedListItemIcon>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium truncate">{label}</div>
                              {sub !== label && <div className="text-xs text-muted-foreground truncate">{sub}</div>}
                            </div>
                            <Badge variant="outline" className="shrink-0 text-[11px] capitalize">{m.access}</Badge>
                          </div>
                        </RoundedListItem>
                      )
                    })}
                  </RoundedList>
                )}
              </section>
            </>
          )}
        </div>
      </div>

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Import members</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Upload a CSV or Excel file with a <span className="font-medium">name</span> and{" "}
              <span className="font-medium">email</span> column (add a <span className="font-medium">phone</span>{" "}
              column too and they&apos;ll also get a WhatsApp nudge). The file is saved to this org&apos;s Drive, and
              everyone listed gets an invite email — they can sign in right away, even before the org is verified.
            </p>

            <Input
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={(e) => void handleFileChange(e.target.files?.[0] ?? null)}
            />

            {parsing && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" /> Reading file...
              </div>
            )}

            {parseError && (
              <Alert variant="destructive">
                <AlertTitle>Couldn&apos;t import</AlertTitle>
                <AlertDescription>{parseError}</AlertDescription>
              </Alert>
            )}

            {importSummary && (
              <Alert>
                <AlertTitle>Import complete</AlertTitle>
                <AlertDescription>
                  Invited {importSummary.invitedCount} member{importSummary.invitedCount === 1 ? "" : "s"}
                  {importSummary.skippedCount > 0 ? `, skipped ${importSummary.skippedCount}` : ""}.
                  {importSummary.emailError
                    ? ` Invite emails could not be sent: ${importSummary.emailError}`
                    : " Invite emails are on their way."}
                  {importSummary.whatsappSent > 0
                    ? ` Also sent a WhatsApp nudge to ${importSummary.whatsappSent} of them.`
                    : ""}
                </AlertDescription>
              </Alert>
            )}

            {parsedRows.length > 0 && !importSummary && (
              <div className="max-h-64 space-y-2 overflow-y-auto">
                {parsedRows.map((row, i) => (
                  <div key={`${row.email}-${i}`} className="flex items-center gap-3 rounded-lg border p-2.5">
                    <Checkbox
                      checked={!!rowIncluded[i]}
                      onCheckedChange={(checked) =>
                        setRowIncluded((current) => ({ ...current, [i]: !!checked }))
                      }
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{row.name || row.email}</p>
                      {row.name && <p className="truncate text-xs text-muted-foreground">{row.email}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            {importSummary ? (
              <Button onClick={() => setImportOpen(false)}>Done</Button>
            ) : (
              <Button
                onClick={() => void handleImport()}
                disabled={importing || parsedRows.filter((_, i) => rowIncluded[i]).length === 0}
              >
                {importing ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" /> Inviting...
                  </>
                ) : (
                  <>
                    <FileTextIcon className="size-3.5" />
                    Invite {parsedRows.filter((_, i) => rowIncluded[i]).length || ""} member
                    {parsedRows.filter((_, i) => rowIncluded[i]).length === 1 ? "" : "s"}
                  </>
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
