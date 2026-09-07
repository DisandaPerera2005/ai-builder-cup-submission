import { verifyActor, resolveOrgScope, adminDb } from "@/lib/firebase-admin"
import { getOrgAccessToken, createDriveFolder } from "@/lib/google"

export const maxDuration = 30

/**
 * Reuse-org-account path for per-project Google Drive (CLAUDE.md-adjacent
 * feature: projects can either share the org's connected Google account or
 * get a brand-new dedicated OAuth grant). This route creates a dedicated
 * Drive folder for the project INSIDE the org's already-connected account —
 * no new OAuth consent needed, since the org grant already covers Drive
 * scope. The client writes the returned folder id onto the project doc.
 */
export async function POST(req: Request) {
  try {
    const auth = req.headers.get("authorization") || ""
    const idToken = auth.startsWith("Bearer ") ? auth.slice(7) : null
    const { orgId, projectName } = await req.json()

    if (!idToken) return json({ ok: false, error: "Missing ID token." }, 401)
    if (!orgId || !projectName) return json({ ok: false, error: "Missing orgId or projectName." }, 400)

    const actor = await verifyActor(idToken)
    const scope = await resolveOrgScope(actor, orgId)
    if (!scope) return json({ ok: false, error: "You don't have access to this org." }, 403)

    // Never create a loose top-level folder — every project folder must nest
    // under the org's ONE designated Drive root (FELLO_DRIVE_AND_WHATSAPP_SECURITY.md
    // Part A). If the org hasn't designated a root yet, fail instead of
    // silently creating an orphaned folder outside that scope.
    const orgSnap = await adminDb().collection("organizations").doc(orgId).get()
    const orgData = orgSnap.data() as { driveRootFolderId?: string } | undefined
    if (!orgSnap.exists || !orgData?.driveRootFolderId) {
      return json({ ok: false, error: "Connect an org Drive folder in Settings first." }, 200)
    }

    const tok = await getOrgAccessToken(orgId)
    if (!tok.token) return json({ ok: false, error: tok.error || "No Google account connected for this org." }, 200)

    const folder = await createDriveFolder(tok.token, `${projectName} — Fello`, orgData.driveRootFolderId)
    if (!folder.folderId) return json({ ok: false, error: folder.error }, 200)

    return json({ ok: true, folderId: folder.folderId })
  } catch (err) {
    return json({ ok: false, error: String(err) }, 200)
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}
