import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"

function getAppUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "")
}

export async function GET(req: NextRequest) {
  console.log("\n=== [google/callback] START ===")
  const { searchParams } = req.nextUrl

  const code = searchParams.get("code")
  const state = searchParams.get("state")
  const error = searchParams.get("error")

  console.log("[google/callback] error param:", error ?? "none")
  console.log("[google/callback] code:", code ? `present (${code.substring(0, 20)}...)` : "MISSING")
  console.log("[google/callback] state:", state ? "present" : "MISSING")

  const cookieStore = await cookies()
  const storedNonce = cookieStore.get("google_oauth_nonce")?.value
  console.log("[google/callback] nonce cookie:", storedNonce ? `present (${storedNonce.substring(0, 8)}...)` : "MISSING — was the init route called first?")

  const appUrl = getAppUrl()
  console.log("[google/callback] appUrl:", appUrl)

  if (error || !code || !state) {
    console.error("[google/callback] Aborting — error or missing params. error:", error)
    cookieStore.delete("google_oauth_nonce")
    return NextResponse.redirect(`${appUrl}/?oauth_error=cancelled`)
  }

  // --- Decode state ---
  let parsedState: {
    orgId: string
    tenantNamespace: string
    orgSlug: string
    projectId?: string | null
    flow?: string | null
    nonce?: string
  }
  try {
    parsedState = JSON.parse(Buffer.from(state, "base64url").toString())
    console.log("[google/callback] State decoded — orgId:", parsedState.orgId, "projectId:", parsedState.projectId ?? "none", "flow:", parsedState.flow ?? "none", "nonce:", parsedState.nonce?.substring(0, 8) + "...")
  } catch {
    console.error("[google/callback] Failed to decode state")
    return new NextResponse("Invalid state parameter", { status: 400 })
  }

  const { orgId, tenantNamespace, orgSlug, projectId, flow, nonce } = parsedState
  // A project-scoped connect redirects back to that project's page; an
  // org-level connect redirects back to Settings — matching where each
  // flow was initiated from.
  const settingsUrl = flow === "setup"
    ? `${appUrl}/org/${tenantNamespace}/${orgSlug}/setup/google`
    : projectId
      ? `${appUrl}/org/${tenantNamespace}/${orgSlug}/projects/${projectId}`
      : `${appUrl}/org/${tenantNamespace}/${orgSlug}/settings`
  console.log("[google/callback] Redirect base URL:", settingsUrl)

  // --- Nonce check ---
  console.log("[google/callback] Nonce check — cookie:", storedNonce?.substring(0, 8), "| state:", nonce?.substring(0, 8))
  if (!storedNonce || storedNonce !== nonce) {
    console.warn("[google/callback] NONCE MISMATCH — replay blocked. This is usually Fast Refresh re-requesting the callback URL.")
    console.warn("[google/callback] storedNonce:", storedNonce ?? "undefined", "| nonce from state:", nonce ?? "undefined")
    return NextResponse.redirect(`${settingsUrl}?oauth=error&reason=replay`)
  }
  cookieStore.delete("google_oauth_nonce")
  console.log("[google/callback] Nonce valid — proceeding to token exchange")

  // --- Token exchange ---
  const redirectUri = `${appUrl}/api/auth/google/callback`
  console.log("[google/callback] Token exchange redirect_uri:", redirectUri)
  console.log("[google/callback] GOOGLE_OAUTH_CLIENT_ID:", process.env.GOOGLE_OAUTH_CLIENT_ID ? "SET" : "MISSING!")
  console.log("[google/callback] GOOGLE_OAUTH_CLIENT_SECRET:", process.env.GOOGLE_OAUTH_CLIENT_SECRET ? "SET" : "MISSING!")

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_OAUTH_CLIENT_ID!,
      client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET!,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  })

  console.log("[google/callback] Token exchange HTTP status:", tokenRes.status)

  if (!tokenRes.ok) {
    const errBody = await tokenRes.text()
    console.error("[google/callback] Token exchange FAILED:", errBody)
    console.error("[google/callback] *** Verify this redirect_uri is in Google Cloud Console:", redirectUri)
    console.error("[google/callback] *** Common fix: go to Cloud Console → APIs & Services → Credentials → your OAuth client → Authorized redirect URIs")
    return NextResponse.redirect(`${settingsUrl}?oauth=error`)
  }

  const tokenData = await tokenRes.json()
  console.log("[google/callback] Token exchange SUCCESS — scopes:", tokenData.scope)
  console.log("[google/callback] Has refresh_token:", !!tokenData.refresh_token)

  // --- Fetch Google account info ---
  const userinfoRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  })
  const userinfo = userinfoRes.ok ? await userinfoRes.json() : {}
  console.log("[google/callback] Connected as:", userinfo.email ?? "unknown")

  const payload = JSON.stringify({
    orgId,
    projectId: projectId ?? null,
    accessToken: tokenData.access_token,
    refreshToken: tokenData.refresh_token,
    expiresAt: Date.now() + (tokenData.expires_in ?? 3600) * 1000,
    scopes: (tokenData.scope as string | undefined)?.split(" ") ?? [],
    email: userinfo.email ?? "",
    picture: userinfo.picture ?? "",
    name: userinfo.name ?? "",
  })

  cookieStore.set("google_oauth_pending", payload, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 300,
    path: "/",
  })
  console.log("[google/callback] Pending cookie set")

  const finalRedirect = `${settingsUrl}?oauth=complete`
  console.log("[google/callback] Redirecting to:", finalRedirect)
  console.log("=== [google/callback] END ===\n")

  return NextResponse.redirect(finalRedirect)
}
