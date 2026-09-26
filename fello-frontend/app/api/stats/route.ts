import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const auth = req.headers.get("authorization") || "";
  const backendUrl = process.env.BACKEND_API_URL;
  const orgId = new URL(req.url).searchParams.get("orgId");

  if (!backendUrl) return NextResponse.json({ success: false, error: "Backend is not configured." }, { status: 200 });
  if (!orgId) return NextResponse.json({ success: false, error: "Missing orgId." }, { status: 400 });

  try {
    const res = await fetch(`${backendUrl.replace(/\/$/, "")}/orgs/${orgId}/stats`, {
      headers: { Authorization: auth },
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    return NextResponse.json({ success: false, error: "Failed to reach backend stats service." }, { status: 200 });
  }
}
