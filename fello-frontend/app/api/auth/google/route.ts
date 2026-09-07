import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { randomBytes } from "crypto"
import { GOOGLE_OAUTH_SCOPES } from "@/lib/google-workspace-scopes"

const SCOPES = GOOGLE_OAUTH_SCOPES.join(" ")

function getAppUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "")
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const orgId = searchParams.get("orgId")
  const tenantNamespace = searchParams.get("tenantNamespace")
  const orgSlug = searchParams.get("orgSlug")
  // Optional: when present, this connection is dedicated to a single project
  // (a brand-new OAuth grant scoped to just that project's Drive folder)
  // rather than the org-wide Google account.
  const projectId = searchParams.get("projectId")
  const flow = searchParams.get("flow")

  console.log("\n=== [google/init] START ===")
  console.log("[google/init] orgId:", orgId)
  console.log("[google/init] tenantNamespace:", tenantNamespace)
  console.log("[google/init] orgSlug:", orgSlug)
  console.log("[google/init] projectId:", projectId ?? "none (org-level connect)")
  console.log("[google/init] flow:", flow ?? "none")
  console.log("[google/init] NEXT_PUBLIC_APP_URL env:", process.env.NEXT_PUBLIC_APP_URL)
  console.log("[google/init] GOOGLE_OAUTH_CLIENT_ID env:", process.env.GOOGLE_OAUTH_CLIENT_ID ? "SET" : "MISSING!")

  if (!orgId || !tenantNamespace || !orgSlug) {
    console.error("[google/init] Missing required params")
    return new NextResponse("Missing required params", { status: 400 })
  }

  const nonce = randomBytes(16).toString("hex")
  console.log("[google/init] Generated nonce:", nonce)

  const state = Buffer.from(
    JSON.stringify({ orgId, tenantNamespace, orgSlug, projectId: projectId ?? null, flow: flow ?? null, nonce })
  ).toString("base64url")

  const appUrl = getAppUrl()
  const redirectUri = `${appUrl}/api/auth/google/callback`
  console.log("[google/init] App URL:", appUrl)
  console.log("[google/init] Redirect URI being sent to Google:", redirectUri)
  console.log("[google/init] *** Copy this and verify it matches Google Cloud Console ***")

  const cookieStore = await cookies()
  cookieStore.set("google_oauth_nonce", nonce, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  })
  console.log("[google/init] Nonce cookie set successfully")

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_OAUTH_CLIENT_ID!,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPES,
    access_type: "offline",
    prompt: "consent",
    state,
  })

  const googleUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params}`
  console.log("[google/init] Redirecting to Google...")
  console.log("=== [google/init] END ===\n")

  return NextResponse.redirect(googleUrl)
}
