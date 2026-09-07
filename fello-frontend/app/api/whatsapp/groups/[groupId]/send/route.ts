/**
 * Thin proxy to fello-backend/backend's org WhatsApp group send endpoint —
 * same forward-the-Authorization-header pattern as ../route.ts.
 */

export async function POST(req: Request, { params }: { params: Promise<{ groupId: string }> }) {
  const auth = req.headers.get("authorization") || ""
  const backendUrl = process.env.BACKEND_API_URL
  const { groupId } = await params

  if (!backendUrl) return json({ success: false, error: "WhatsApp backend is not configured." }, 200)

  try {
    const { orgId, message } = await req.json()
    if (!orgId || !message) {
      return json({ success: false, error: "Missing orgId or message." }, 400)
    }

    const res = await fetch(`${backendUrl.replace(/\/$/, "")}/orgs/${orgId}/whatsapp/groups/${groupId}/send`, {
      method: "POST",
      headers: { Authorization: auth, "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
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
