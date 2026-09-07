import type { ActionResult } from "@/lib/types"

export interface WhatsappLinkState {
  // "disconnected" = was linked, then unlinked from the phone (WhatsApp app ->
  // Linked devices -> Log out) — distinct from "not_connected" (never linked).
  status: "pairing" | "connected" | "disconnected" | "error" | "not_connected"
  qr: string | null
  phoneNumber?: string | null
}

type Scope = { kind: "project" | "org"; id: string }

function withAuth(idToken: string, path: "connect" | "qr" | "status", scope: Scope) {
  return fetch(
    path === "connect" ? `/api/whatsapp/connect` : `/api/whatsapp/${path}?${scope.kind === "project" ? `projectId=${scope.id}` : `orgId=${scope.id}`}`,
    {
      method: path === "connect" ? "POST" : "GET",
      headers: { Authorization: `Bearer ${idToken}`, "Content-Type": "application/json" },
      body:
        path === "connect"
          ? JSON.stringify(scope.kind === "project" ? { projectId: scope.id } : { orgId: scope.id })
          : undefined,
    }
  )
}

async function run(idToken: string, path: "connect" | "qr" | "status", scope: Scope): Promise<ActionResult<WhatsappLinkState>> {
  try {
    const res = await withAuth(idToken, path, scope)
    const data = await res.json()
    if (!data.success) throw new Error(data.error || "WhatsApp gateway request failed.")
    return {
      data: { status: data.status, qr: data.qr ?? null, phoneNumber: data.phoneNumber ?? null },
      error: null,
    }
  } catch (error) {
    return { data: null, error: error instanceof Error ? error.message : "WhatsApp request failed." }
  }
}

/** Starts (or resumes) pairing for a project's dedicated WhatsApp number — returns the QR to scan. */
export const connectProjectWhatsapp = (idToken: string, projectId: string) =>
  run(idToken, "connect", { kind: "project", id: projectId })

/** Polls the current QR code — rotates every ~20-60s until scanned. */
export const getProjectWhatsappQr = (idToken: string, projectId: string) =>
  run(idToken, "qr", { kind: "project", id: projectId })

/** Polls link status — call until status is "connected". */
export const getProjectWhatsappStatus = (idToken: string, projectId: string) =>
  run(idToken, "status", { kind: "project", id: projectId })

/** Starts (or resumes) pairing for the org-wide shared WhatsApp number. */
export const connectOrgWhatsapp = (idToken: string, orgId: string) =>
  run(idToken, "connect", { kind: "org", id: orgId })

/** Polls the current QR code for the org-wide number. */
export const getOrgWhatsappQr = (idToken: string, orgId: string) => run(idToken, "qr", { kind: "org", id: orgId })

/** Polls link status for the org-wide number — call until status is "connected". */
export const getOrgWhatsappStatus = (idToken: string, orgId: string) =>
  run(idToken, "status", { kind: "org", id: orgId })
