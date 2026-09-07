/**
 * Thin proxy to fello-backend/backend's Drive sync endpoint, mirroring
 * app/api/whatsapp/connect/route.ts — the backend (BACKEND_API_URL) is the
 * only thing that talks to the Drive indexing pipeline. This route just
 * forwards the caller's Firebase ID token so the backend can verify it and
 * check org access itself (CLAUDE.md §4.1). BACKEND_API_URL is
 * intentionally server-only (no NEXT_PUBLIC_ prefix).
 *
 * Fire-and-forget from the client's perspective: the backend is expected to
 * respond 202 immediately and sync in the background, driven off the org's
 * driveRootFolderId (FELLO_DRIVE_AND_WHATSAPP_SECURITY.md Part A).
 */
export async function POST(req: Request) {
  const auth = req.headers.get("authorization") || ""
  const backendUrl = process.env.BACKEND_API_URL

  if (!backendUrl) return json({ ok: false, error: "Drive sync backend is not configured." }, 200)

  try {
    const { orgId } = await req.json()
    if (!orgId) return json({ ok: false, error: "Missing orgId." }, 400)

    const res = await fetch(`${backendUrl.replace(/\/$/, "")}/orgs/${orgId}/drive/sync`, {
      method: "POST",
      headers: { Authorization: auth },
    })
    const data = await res.json().catch(() => ({ ok: res.ok }))
    return json(data, res.status)
  } catch {
    return json({ ok: false, error: "Failed to reach the Drive sync backend." }, 200)
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}
