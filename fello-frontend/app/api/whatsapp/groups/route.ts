/**
 * Thin proxy to fello-backend/backend's org WhatsApp group routes — same
 * forward-the-Authorization-header pattern as app/api/whatsapp/connect etc.
 * BACKEND_API_URL is server-only (no NEXT_PUBLIC_ prefix).
 */

export async function GET(req: Request) {
  const auth = req.headers.get("authorization") || ""
  const backendUrl = process.env.BACKEND_API_URL
  const orgId = new URL(req.url).searchParams.get("orgId")

  if (!backendUrl) return json({ success: false, error: "WhatsApp backend is not configured." }, 200)
  if (!orgId) return json({ success: false, error: "Missing orgId." }, 400)

  try {
    const res = await fetch(`${backendUrl.replace(/\/$/, "")}/orgs/${orgId}/whatsapp/groups`, {
      headers: { Authorization: auth },
    })
    const data = await res.json()
    return json(data, res.status)
  } catch (err) {
    return json({ success: false, error: "Failed to reach the WhatsApp backend." }, 200)
  }
}

export async function POST(req: Request) {
  const auth = req.headers.get("authorization") || ""
  const backendUrl = process.env.BACKEND_API_URL

  if (!backendUrl) return json({ success: false, error: "WhatsApp backend is not configured." }, 200)

  try {
    const { orgId, name, participants } = await req.json()
    if (!orgId || !name || !participants?.length) {
      return json({ success: false, error: "Missing orgId, name, or participants." }, 400)
    }

    const res = await fetch(`${backendUrl.replace(/\/$/, "")}/orgs/${orgId}/whatsapp/groups`, {
      method: "POST",
      headers: { Authorization: auth, "Content-Type": "application/json" },
      body: JSON.stringify({ name, participants }),
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
