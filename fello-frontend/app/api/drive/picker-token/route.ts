import { verifyActor, resolveOrgScope } from "@/lib/firebase-admin"
import { getOrgAccessToken, getOrgIntegration } from "@/lib/google"

export const maxDuration = 30

/**
 * Hands a short-lived, already scope-limited (drive.file) OAuth token to the
 * client so it can open the Google Picker. This is safe under drive.file
 * scope specifically because the Picker API is designed to grant access to
 * user-selected pre-existing files/folders even under that restrictive
 * scope — a raw Drive files.list browse UI would NOT be allowed to do this.
 */
export async function GET(req: Request) {
  try {
    const auth = req.headers.get("authorization") || ""
    const idToken = auth.startsWith("Bearer ") ? auth.slice(7) : null
    if (!idToken) return json({ error: "Missing ID token." }, 401)

    const { searchParams } = new URL(req.url)
    const orgId = searchParams.get("orgId")
    if (!orgId) return json({ error: "Missing orgId." }, 400)

    const actor = await verifyActor(idToken)
    const scope = await resolveOrgScope(actor, orgId)
    if (!scope) return json({ error: "You don't have access to this org." }, 403)

    const tok = await getOrgAccessToken(orgId)
    if (!tok.token) {
      return json({ error: tok.error || "No Google account connected for this org." }, 200)
    }

    const integ = await getOrgIntegration(orgId)
    const expiresAt = typeof integ?.expiresAt === "number" ? integ.expiresAt : Date.now() + 55 * 60 * 1000

    return json({ token: tok.token, expiresAt })
  } catch (err) {
    return json({ error: String(err) }, 200)
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}
