/**
 * Thin proxy to fello-backend/backend's WhatsApp connect endpoint. The
 * backend VM (BACKEND_API_URL) is the only thing that talks to the Baileys
 * gateway — this route just forwards the caller's Firebase ID token so the
 * backend can verify it and check org/project access itself (CLAUDE.md §4.1).
 * BACKEND_API_URL is intentionally server-only (no NEXT_PUBLIC_ prefix).
 *
 * Body is either { projectId } (a project's own dedicated number) or
 * { orgId } (the org-wide shared number, configured from Settings).
 */

export async function POST(req: Request) {
  const auth = req.headers.get("authorization") || ""
  const backendUrl = process.env.BACKEND_API_URL

  if (!backendUrl) return json({ success: false, error: "WhatsApp backend is not configured." }, 200)

  try {
    const { projectId, orgId } = await req.json()
    const scopePath = projectId ? `projects/${projectId}` : orgId ? `orgs/${orgId}` : null
    if (!scopePath) return json({ success: false, error: "Missing projectId or orgId." }, 400)

    const res = await fetch(`${backendUrl.replace(/\/$/, "")}/${scopePath}/whatsapp/connect`, {
      method: "POST",
      headers: { Authorization: auth },
    })
    const data = await res.json()
    return json(data, res.status)
  } catch (err) {
    return json({ success: false, error: "Failed to reach the WhatsApp backend." }, 200)
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}
