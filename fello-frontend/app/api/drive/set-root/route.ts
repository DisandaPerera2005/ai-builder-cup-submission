import { verifyActor, resolveOrgScope, adminDb } from "@/lib/firebase-admin"
import { getOrgAccessToken, createDriveFolder } from "@/lib/google"

export const maxDuration = 30

/**
 * Designates the org's ONE Drive root folder (FELLO_DRIVE_AND_WHATSAPP_SECURITY.md
 * Part A). Every Drive API call Fello makes for this org must be scoped under
 * this folder going forward — never a Drive-wide search.
 *
 * Body is either:
 *  - { orgId, folderId }       — admin picked an existing folder via the Picker
 *  - { orgId, newFolderName }  — admin asked Fello to create a fresh folder
 */
export async function POST(req: Request) {
  try {
    const auth = req.headers.get("authorization") || ""
    const idToken = auth.startsWith("Bearer ") ? auth.slice(7) : null
    if (!idToken) return json({ success: false, error: "Missing ID token." }, 401)

    const body = await req.json()
    const orgId: string | undefined = body?.orgId
    const folderId: string | undefined = body?.folderId
    const newFolderName: string | undefined = body?.newFolderName

    if (!orgId) return json({ success: false, error: "Missing orgId." }, 400)
    if (!folderId && !newFolderName) {
      return json({ success: false, error: "Missing folderId or newFolderName." }, 400)
    }

    const actor = await verifyActor(idToken)
    const scope = await resolveOrgScope(actor, orgId)
    if (!scope) return json({ success: false, error: "You don't have access to this org." }, 403)

    let resolvedFolderId = folderId

    if (!resolvedFolderId && newFolderName) {
      const tok = await getOrgAccessToken(orgId)
      if (!tok.token) {
        return json(
          { success: false, error: tok.error || "No Google account connected for this org." },
          200
        )
      }
      // A brand-new root folder has no parent — it IS the root.
      const folder = await createDriveFolder(tok.token, newFolderName)
      if (!folder.folderId) return json({ success: false, error: folder.error }, 200)
      resolvedFolderId = folder.folderId
    }

    if (!resolvedFolderId) return json({ success: false, error: "Could not resolve a folder id." }, 400)

    await adminDb().collection("organizations").doc(orgId).update({
      driveRootFolderId: resolvedFolderId,
      driveConnectedBy: actor.uid,
      driveConnectedAt: new Date().toISOString(),
      driveSyncStatus: "idle",
    })

    return json({ success: true, folderId: resolvedFolderId })
  } catch (err) {
    return json({ success: false, error: String(err) }, 200)
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}
