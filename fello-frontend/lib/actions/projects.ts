import { doc, setDoc, updateDoc } from "firebase/firestore"

import { db } from "@/lib/firebase"
import type { ActionResult } from "@/lib/types"

/**
 * Connect a project's Drive to the ORG's already-connected Google account —
 * no new OAuth consent needed. A dedicated folder is still created just for
 * this project; nothing else in the org's Drive becomes reachable by it.
 */
export async function connectProjectDriveToOrgAccount(
  idToken: string,
  orgId: string,
  projectId: string,
  projectName: string
): Promise<ActionResult<{ folderId: string }>> {
  try {
    const res = await fetch("/api/drive/connect-org-account", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
      body: JSON.stringify({ orgId, projectName }),
    })
    const data = await res.json()
    if (!data.ok) return { data: null, error: data.error || "Failed to connect Drive." }

    await updateDoc(doc(db, "projects", projectId), {
      driveRootFolderId: data.folderId,
      driveAccountType: "org",
      driveGrantRef: "org",
    })
    return { data: { folderId: data.folderId }, error: null }
  } catch (error) {
    console.error("Failed to connect project Drive to org account:", error)
    return { data: null, error: "Failed to connect Drive." }
  }
}

export interface PendingGoogleOAuthPayload {
  orgId: string
  projectId: string | null
  accessToken: string
  refreshToken?: string
  expiresAt: number
  scopes: string[]
  email: string
  picture: string
  name: string
}

/**
 * Finish a project-scoped Google OAuth connect (the "dedicated new account"
 * path): pulls the just-obtained token off the one-time cookie route, writes
 * project_google_integrations/{projectId}, creates a folder INSIDE that new
 * account (never touching the org's shared account), and updates the project
 * doc to point at it.
 */
export async function completeProjectGoogleConnect(
  projectId: string,
  connectedByUid: string,
  projectName: string
): Promise<ActionResult<{ folderId: string; email: string }>> {
  try {
    const res = await fetch("/api/auth/google/tokens")
    if (!res.ok) return { data: null, error: "No pending Google connection found." }
    const data = (await res.json()) as PendingGoogleOAuthPayload

    await setDoc(doc(db, "project_google_integrations", projectId), {
      projectId,
      orgId: data.orgId,
      connected: true,
      email: data.email,
      picture: data.picture,
      name: data.name,
      accessToken: data.accessToken,
      refreshToken: data.refreshToken || null,
      expiresAt: data.expiresAt,
      scopes: data.scopes,
      connectedBy: connectedByUid,
      connectedAt: new Date().toISOString(),
    })

    const folderRes = await fetch("https://www.googleapis.com/drive/v3/files", {
      method: "POST",
      headers: { Authorization: `Bearer ${data.accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ name: `${projectName} — Fello`, mimeType: "application/vnd.google-apps.folder" }),
    })
    if (!folderRes.ok) {
      return { data: null, error: `Connected, but creating the Drive folder failed (${folderRes.status}).` }
    }
    const folder = await folderRes.json()

    await updateDoc(doc(db, "projects", projectId), {
      driveRootFolderId: folder.id,
      driveAccountType: "dedicated",
      driveGrantRef: projectId,
    })
    await updateDoc(doc(db, "project_google_integrations", projectId), { driveFolderId: folder.id })

    return { data: { folderId: folder.id, email: data.email }, error: null }
  } catch (error) {
    console.error("Failed to complete project Google connect:", error)
    return { data: null, error: "Failed to finish connecting Google." }
  }
}
