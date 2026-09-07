"use server"

import { adminAuth, adminDb } from "@/lib/firebase-admin"

export interface FelloCustomClaims {
  tenantId: string
  orgs: Record<
    string,
    { access: string; nodeId?: string; capabilities?: string[]; via?: string }
  >
  projects: Record<string, { access: "event_only"; orgId: string }>
  whatsappVerified: boolean
  claimsVersion: number
}

/**
 * Rebuild and set this user's Firebase custom claims from Firestore membership
 * data (CLAUDE.md §4.3). This is the ONLY place claims are minted — call it
 * whenever a `memberships` or `project_memberships` doc for this user is
 * created, changed, or revoked, so the JWT stays the source of truth for
 * permission checks (zero Firestore reads on the request path).
 *
 * Org membership grants full org access. project_memberships grants
 * "event_only" access scoped to a single project and never appears in `orgs`.
 */
export async function bakeCustomClaims(uid: string): Promise<{ error: string | null }> {
  try {
    const db = adminDb()

    const userSnap = await db.collection("users").doc(uid).get()
    const tenantId = (userSnap.data()?.tenantId as string) ?? (userSnap.data()?.domain as string) ?? ""

    const orgs: FelloCustomClaims["orgs"] = {}
    const membershipSnap = await db.collection("memberships").where("userId", "==", uid).get()
    for (const doc of membershipSnap.docs) {
      const m = doc.data()
      if (!m.orgId) continue
      orgs[m.orgId] = {
        access: m.access ?? m.role ?? "team",
        nodeId: m.nodeId,
        capabilities: m.capabilities ?? [],
        via: m.via,
      }
    }

    const projects: FelloCustomClaims["projects"] = {}
    const projectMembershipSnap = await db
      .collection("project_memberships")
      .where("contactId", "==", uid)
      .where("status", "==", "active")
      .get()
    for (const doc of projectMembershipSnap.docs) {
      const pm = doc.data()
      if (!pm.projectId || !pm.orgId) continue
      // An external contributor only ever gets event_only scope. If this uid is
      // ALSO a full org member (e.g. an admin who invited themselves as a
      // contributor by mistake), the `orgs` entry above already covers them —
      // skip adding a redundant/weaker projects entry for that org.
      if (orgs[pm.orgId]) continue
      projects[pm.projectId] = { access: "event_only", orgId: pm.orgId }
    }

    const existing = (await adminAuth().getUser(uid)).customClaims as
      | Partial<FelloCustomClaims>
      | undefined
    const claimsVersion = (existing?.claimsVersion ?? 0) + 1

    const claims: FelloCustomClaims = {
      tenantId,
      orgs,
      projects,
      whatsappVerified: Boolean(userSnap.data()?.whatsappVerified),
      claimsVersion,
    }

    await adminAuth().setCustomUserClaims(uid, claims)
    return { error: null }
  } catch (error) {
    console.error("Failed to bake custom claims:", error)
    return { error: error instanceof Error ? error.message : "Failed to bake custom claims" }
  }
}
