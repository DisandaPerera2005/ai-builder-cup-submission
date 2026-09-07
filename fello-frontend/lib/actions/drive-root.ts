import type { ActionResult } from "@/lib/types"

type DriveRootInput = { folderId: string } | { newFolderName: string }

/**
 * Designates the org's ONE Drive root folder — see
 * FELLO_DRIVE_AND_WHATSAPP_SECURITY.md Part A. Either pass an existing
 * folder id (picked via the Google Picker) or a name for a brand-new folder
 * Fello should create.
 */
export async function setOrgDriveRoot(
  idToken: string,
  orgId: string,
  input: DriveRootInput
): Promise<ActionResult<{ folderId: string }>> {
  try {
    const res = await fetch("/api/drive/set-root", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
      body: JSON.stringify({ orgId, ...input }),
    })
    const data = await res.json()
    if (!data.success) return { data: null, error: data.error || "Failed to set the Drive root folder." }
    return { data: { folderId: data.folderId }, error: null }
  } catch (error) {
    console.error("Failed to set org Drive root:", error)
    return { data: null, error: "Failed to set the Drive root folder." }
  }
}

/**
 * Kicks off a Drive sync against the org's designated root folder. The
 * backend responds 202 and syncs in the background — this just surfaces
 * network-level failures to the caller, it does not wait for the sync itself.
 */
export async function triggerOrgDriveSync(idToken: string, orgId: string): Promise<ActionResult<null>> {
  try {
    const res = await fetch("/api/drive/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
      body: JSON.stringify({ orgId }),
    })
    const data = await res.json().catch(() => ({ ok: false, error: "Invalid response from Drive sync." }))
    if (!data.ok) return { data: null, error: data.error || "Failed to start the Drive sync." }
    return { data: null, error: null }
  } catch (error) {
    console.error("Failed to trigger org Drive sync:", error)
    return { data: null, error: "Failed to reach the Drive sync backend." }
  }
}
