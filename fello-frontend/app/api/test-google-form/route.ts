import { verifyActor, resolveOrgScope } from "@/lib/firebase-admin"
import { getOrgAccessToken, createGoogleForm } from "@/lib/google"

export const maxDuration = 60

/**
 * Test endpoint: creates a Google Form in the org's connected account, bypassing
 * the agent. Used by /test-google-form-api to isolate the Forms API integration.
 * Requires a Firebase ID token (Bearer) and an orgId the user belongs to.
 */
export async function POST(req: Request) {
  try {
    const auth = req.headers.get("authorization") || ""
    const idToken = auth.startsWith("Bearer ") ? auth.slice(7) : null
    const { orgId, title, description, questions } = await req.json()

    if (!idToken) return json({ ok: false, step: "auth", error: "Missing ID token." }, 401)
    if (!orgId) return json({ ok: false, step: "input", error: "Missing orgId." }, 400)

    const actor = await verifyActor(idToken)
    const scope = await resolveOrgScope(actor, orgId)
    if (!scope) return json({ ok: false, step: "authz", error: "You don't have access to this org." }, 403)

    const tok = await getOrgAccessToken(orgId)
    if (!tok.token) return json({ ok: false, step: "google_token", error: tok.error }, 200)

    const result = await createGoogleForm(tok.token, {
      title: title || "Fello Test Form",
      description: description || "Created from the Fello test page.",
      questions: Array.isArray(questions) && questions.length ? questions : ["Full name", "Email"],
    })

    return json({
      ok: result.success,
      step: result.success ? "done" : "forms_api",
      account: tok.email,
      scopes: tok.scopes,
      ...result,
    })
  } catch (err) {
    return json({ ok: false, step: "exception", error: String(err) }, 200)
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}
