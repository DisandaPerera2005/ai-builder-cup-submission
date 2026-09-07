/** Proxy to fello-backend/backend's QR-fetch endpoint — see connect/route.ts for the pattern. */

export async function GET(req: Request) {
  const auth = req.headers.get("authorization") || ""
  const backendUrl = process.env.BACKEND_API_URL
  const params = new URL(req.url).searchParams
  const projectId = params.get("projectId")
  const orgId = params.get("orgId")
  const scopePath = projectId ? `projects/${projectId}` : orgId ? `orgs/${orgId}` : null

  if (!backendUrl) return json({ success: false, error: "WhatsApp backend is not configured." }, 200)
  if (!scopePath) return json({ success: false, error: "Missing projectId or orgId." }, 400)

  try {
    const res = await fetch(`${backendUrl.replace(/\/$/, "")}/${scopePath}/whatsapp/qr`, {
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
