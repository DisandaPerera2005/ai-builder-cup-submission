import { collection, deleteDoc, doc, getDocs, query, setDoc, where } from "firebase/firestore"

import { db } from "@/lib/firebase"
import { bakeCustomClaims } from "@/lib/actions/claims"
import type { ActionResult, ProjectMembership } from "@/lib/types"

function syntheticContactId(inviteValue: string): string {
  // Stable placeholder id until the invited person signs in and we can
  // replace it with their real Firebase uid — see acceptPendingProjectInvites.
  let hash = 0
  for (let i = 0; i < inviteValue.length; i++) {
    hash = (hash * 31 + inviteValue.charCodeAt(i)) | 0
  }
  return `ext_${Math.abs(hash).toString(36)}`
}

export interface InviteExternalContributorInput {
  projectId: string
  orgId: string
  tenantId: string
  inviteChannel: "phone" | "email"
  inviteValue: string
  invitedBy: string
}

/**
 * Invite someone OUTSIDE the organization to contribute to a single project.
 * They get event_only access to just this project — never the org's other
 * projects, directory, or settings (enforced by firestore.rules + custom
 * claims, not just UI).
 */
export async function inviteExternalContributor(
  input: InviteExternalContributorInput
): Promise<ActionResult<null>> {
  try {
    const contactId = syntheticContactId(input.inviteValue.trim().toLowerCase())
    const membership: ProjectMembership = {
      contactId,
      projectId: input.projectId,
      orgId: input.orgId,
      tenantId: input.tenantId,
      inviteChannel: input.inviteChannel,
      inviteValue: input.inviteValue.trim().toLowerCase(),
      invitedBy: input.invitedBy,
      invitedAt: new Date().toISOString(),
      status: "invited",
      role: "external_contributor",
      capabilities: ["tasks.manage", "documents.view"],
    }
    await setDoc(doc(db, "project_memberships", `${contactId}_${input.projectId}`), membership)
    return { data: null, error: null }
  } catch (error) {
    console.error("Failed to invite external contributor:", error)
    return { data: null, error: "Failed to send invite." }
  }
}

/** True if this email has an outstanding external-contributor invite. */
export async function hasPendingProjectInvite(email: string): Promise<boolean> {
  try {
    const normalized = email.trim().toLowerCase()
    const snap = await getDocs(
      query(
        collection(db, "project_memberships"),
        where("inviteValue", "==", normalized),
        where("status", "==", "invited")
      )
    )
    return !snap.empty
  } catch (error) {
    console.error("Failed to check pending project invites:", error)
    return false
  }
}

/**
 * Call right after a user signs in (any method). If their email matches an
 * "invited" project_memberships doc, flips it to "active", swaps the
 * synthetic contactId for their real uid, and rebakes their custom claims so
 * the project shows up in their JWT's `projects` map immediately.
 */
export async function acceptPendingProjectInvites(uid: string, email: string): Promise<void> {
  if (!email) return
  try {
    const normalized = email.trim().toLowerCase()
    const pending = await getDocs(
      query(
        collection(db, "project_memberships"),
        where("inviteValue", "==", normalized),
        where("status", "==", "invited")
      )
    )
    if (pending.empty) return

    await Promise.all(
      pending.docs.map(async (d) => {
        const m = d.data() as ProjectMembership
        await setDoc(
          doc(db, "project_memberships", `${uid}_${m.projectId}`),
          { ...m, contactId: uid, status: "active" }
        )
        // Replace the synthetic-id placeholder doc, don't leave a duplicate "invited" one around.
        if (d.id !== `${uid}_${m.projectId}`) await deleteDoc(d.ref)
      })
    )
    await bakeCustomClaims(uid)
  } catch (error) {
    console.error("Failed to accept pending project invites:", error)
  }
}
