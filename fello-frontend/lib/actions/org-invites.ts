"use server"

/**
 * Org-level invites sourced from the Drive-directory-scanning agent (or
 * manual approval of its suggestions). Mirrors project-memberships.ts's
 * pending-invite-by-email shape, but resolves into a real ORG membership
 * (`memberships/{uid}_{orgId}`) on signup instead of a project-scoped one.
 *
 * This file is "use server" (unlike project-memberships.ts) because
 * inviteOrgMembers must read/write invite_suggestions and org_invites with
 * the Admin SDK — never trust a client-supplied orgId/tenantId pairing.
 * Keeping every Firestore op here on adminDb() (rather than mixing in the
 * client SDK) also avoids the hanging-connection issue noted in auth.ts's
 * getTopWaitlistDomains when the client SDK is invoked from server code.
 */

import { adminDb } from "@/lib/firebase-admin"
import { bakeCustomClaims } from "@/lib/actions/claims"
import type { ActionResult, OrgInvite, InviteSuggestion } from "@/lib/types"

export interface InviteOrgMembersInput {
  orgId: string
  tenantId: string
  suggestionIds: string[]
  invitedBy: string
}

/**
 * Turn approved directory suggestions into real pending org invites.
 * Each suggestion id is validated independently — a bad id never aborts the
 * rest of the batch, it's just reported as a per-id failure.
 */
export async function inviteOrgMembers(input: InviteOrgMembersInput): Promise<ActionResult<null>> {
  const db = adminDb()
  const failures: string[] = []

  await Promise.all(
    input.suggestionIds.map(async (suggestionId) => {
      try {
        const ref = db.collection("invite_suggestions").doc(suggestionId)
        const snap = await ref.get()
        if (!snap.exists) {
          failures.push(`${suggestionId}: suggestion not found`)
          return
        }

        const suggestion = snap.data() as InviteSuggestion
        if (suggestion.orgId !== input.orgId) {
          failures.push(`${suggestionId}: does not belong to this org`)
          return
        }

        const normalizedEmail = suggestion.email.trim().toLowerCase()
        const emailDomain = normalizedEmail.split("@")[1]?.toLowerCase()
        if (!emailDomain || emailDomain !== input.tenantId.toLowerCase()) {
          failures.push(`${suggestionId}: email domain does not match org tenant`)
          return
        }

        const invite: OrgInvite = {
          inviteValue: normalizedEmail,
          inviteeName: suggestion.name || null,
          orgId: input.orgId,
          tenantId: input.tenantId,
          invitedBy: input.invitedBy,
          invitedAt: new Date().toISOString(),
          status: "invited",
          access: "team",
          capabilities: [],
          sourceType: "directory_suggestion",
          sourceSuggestionId: suggestionId,
        }

        await db
          .collection("org_invites")
          .doc(`${normalizedEmail}_${input.orgId}`)
          .set(invite)

        await ref.update({
          status: "invited",
          reviewedBy: input.invitedBy,
          reviewedAt: new Date().toISOString(),
        })
      } catch (error) {
        console.error(`Failed to invite suggestion ${suggestionId}:`, error)
        failures.push(`${suggestionId}: ${error instanceof Error ? error.message : "unknown error"}`)
      }
    })
  )

  if (failures.length > 0) {
    return { data: null, error: `Some invites failed: ${failures.join("; ")}` }
  }
  return { data: null, error: null }
}

export interface ManualInviteRow {
  name: string
  email: string
  /** Optional WhatsApp number, if the imported file had one — not stored on
   *  OrgInvite (that schema is email-only), only threaded through so the
   *  import route can also send a WhatsApp nudge alongside the invite email. */
  phone?: string
}

export interface BulkInviteOrgMembersInput {
  orgId: string
  tenantId: string
  invitedBy: string
  rows: ManualInviteRow[]
}

export interface BulkInviteResult {
  invited: ManualInviteRow[]
  skipped: { row: ManualInviteRow; reason: string }[]
}

/**
 * Directly invite a batch of {name, email} rows parsed from an uploaded
 * member-list file (CSV/XLSX) — the manual counterpart to inviteOrgMembers's
 * directory-suggestion-approval flow. Same tenant-domain validation and
 * dedupe-by-doc-id semantics, just sourced from a file instead of Drive scans.
 */
export async function bulkInviteOrgMembersManual(
  input: BulkInviteOrgMembersInput
): Promise<ActionResult<BulkInviteResult>> {
  const db = adminDb()
  const invited: ManualInviteRow[] = []
  const skipped: { row: ManualInviteRow; reason: string }[] = []

  await Promise.all(
    input.rows.map(async (row) => {
      try {
        const normalizedEmail = row.email.trim().toLowerCase()
        const emailDomain = normalizedEmail.split("@")[1]?.toLowerCase()
        if (!emailDomain || emailDomain !== input.tenantId.toLowerCase()) {
          skipped.push({ row, reason: "Email domain does not match this org's tenant." })
          return
        }

        const inviteId = `${normalizedEmail}_${input.orgId}`
        const existing = await db.collection("org_invites").doc(inviteId).get()
        if (existing.exists && existing.data()?.status !== "revoked") {
          skipped.push({ row, reason: "Already invited or a member." })
          return
        }

        const invite: OrgInvite = {
          inviteValue: normalizedEmail,
          inviteeName: row.name || null,
          orgId: input.orgId,
          tenantId: input.tenantId,
          invitedBy: input.invitedBy,
          invitedAt: new Date().toISOString(),
          status: "invited",
          access: "team",
          capabilities: [],
          sourceType: "manual",
          sourceSuggestionId: null,
        }

        await db.collection("org_invites").doc(inviteId).set(invite)
        invited.push({ name: row.name, email: normalizedEmail, phone: row.phone })
      } catch (error) {
        console.error(`Failed to invite ${row.email}:`, error)
        skipped.push({ row, reason: error instanceof Error ? error.message : "unknown error" })
      }
    })
  )

  return { data: { invited, skipped }, error: null }
}

/** True if this email has an outstanding org-directory invite. */
export async function hasPendingOrgInvite(email: string): Promise<boolean> {
  try {
    const normalized = email.trim().toLowerCase()
    const snap = await adminDb()
      .collection("org_invites")
      .where("inviteValue", "==", normalized)
      .where("status", "==", "invited")
      .get()
    return !snap.empty
  } catch (error) {
    console.error("Failed to check pending org invites:", error)
    return false
  }
}

/**
 * Call right after a user signs in (any method). If their email matches an
 * "invited" org_invites doc, writes a real `memberships/{uid}_{orgId}` doc
 * per CLAUDE.md §5.2/§6, flips the invite to "active", and rebakes custom
 * claims so the org shows up in their JWT's `orgs` map immediately.
 */
export async function acceptPendingOrgInvites(uid: string, email: string): Promise<void> {
  if (!email) return
  try {
    const normalized = email.trim().toLowerCase()
    const db = adminDb()
    const pending = await db
      .collection("org_invites")
      .where("inviteValue", "==", normalized)
      .where("status", "==", "invited")
      .get()
    if (pending.empty) return

    await Promise.all(
      pending.docs.map(async (d) => {
        const invite = d.data() as OrgInvite
        await db.collection("memberships").doc(`${uid}_${invite.orgId}`).set({
          userId: uid,
          orgId: invite.orgId,
          tenantId: invite.tenantId,
          nodeId: invite.orgId, // directory invites are org-wide, no specific sub-node
          role: "member",
          access: "team",
          capabilities: [],
          addedBy: invite.invitedBy,
          addedAt: new Date().toISOString(),
        })
        await d.ref.update({ status: "active" })
      })
    )
    await bakeCustomClaims(uid)
  } catch (error) {
    console.error("Failed to accept pending org invites:", error)
  }
}
