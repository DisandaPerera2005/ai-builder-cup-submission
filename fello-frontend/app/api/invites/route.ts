import { verifyActor, resolveOrgScope, adminDb } from "@/lib/firebase-admin"
import { inviteOrgMembers } from "@/lib/actions/org-invites"

/**
 * Bearer-auth'd route the invite-review UI calls to turn approved directory
 * suggestions into pending org invites, or to dismiss a suggestion outright.
 * tenantId/invitedBy are always derived from the VERIFIED org scope/actor —
 * never trusted from the request body (CLAUDE.md §5.1, firebase-admin.ts).
 */
export async function POST(req: Request) {
  try {
    const auth = req.headers.get("authorization") || ""
    const idToken = auth.startsWith("Bearer ") ? auth.slice(7) : null
    if (!idToken) return json({ ok: false, error: "Missing ID token." }, 401)

    const body = await req.json()
    const { orgId } = body
    if (!orgId) return json({ ok: false, error: "Missing orgId." }, 400)

    const actor = await verifyActor(idToken)
    const scope = await resolveOrgScope(actor, orgId)
    if (!scope) return json({ ok: false, error: "You don't have access to this org." }, 403)

    if (body.action === "dismiss") {
      const { suggestionId } = body
      if (!suggestionId) return json({ ok: false, error: "Missing suggestionId." }, 400)

      const ref = adminDb().collection("invite_suggestions").doc(suggestionId)
      const snap = await ref.get()
      if (!snap.exists || snap.data()?.orgId !== orgId) {
        return json({ ok: false, error: "Suggestion not found for this org." }, 404)
      }

      await ref.update({
        status: "dismissed",
        reviewedBy: actor.uid,
        reviewedAt: new Date().toISOString(),
      })
      return json({ ok: true })
    }

    const { suggestionIds } = body
    if (!Array.isArray(suggestionIds) || suggestionIds.length === 0) {
      return json({ ok: false, error: "Missing suggestionIds." }, 400)
    }

    const result = await inviteOrgMembers({
      orgId,
      tenantId: scope.tenantId,
      suggestionIds,
      invitedBy: actor.uid,
    })

    if (result.error) return json({ ok: false, error: result.error }, 200)
    return json({ ok: true })
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
