import { NextResponse } from "next/server"
import { cookies } from "next/headers"

// One-time endpoint — reads the pending Google OAuth tokens from the httpOnly cookie
// and clears it. The client immediately writes the tokens to Firestore.
export async function GET() {
  const cookieStore = await cookies()
  const pending = cookieStore.get("google_oauth_pending")

  if (!pending) {
    return NextResponse.json({ error: "No pending OAuth session" }, { status: 404 })
  }

  let data: unknown
  try {
    data = JSON.parse(pending.value)
  } catch {
    cookieStore.delete("google_oauth_pending")
    return NextResponse.json({ error: "Invalid OAuth data" }, { status: 400 })
  }

  cookieStore.delete("google_oauth_pending")
  return NextResponse.json(data)
}
