import type { ActionResult } from "@/lib/types"
import type { ManualInviteRow } from "@/lib/actions/org-invites"

export interface ImportMembersResult {
  invited: ManualInviteRow[]
  skipped: { row: ManualInviteRow; reason: string }[]
  driveLink: string | null
  emailError: string | null
  whatsappSent: number
}

export async function importMembersFile(
  idToken: string,
  orgId: string,
  file: File,
  rows: ManualInviteRow[]
): Promise<ActionResult<ImportMembersResult>> {
  try {
    const form = new FormData()
    form.append("file", file)
    form.append("rows", JSON.stringify(rows))

    const res = await fetch(`/api/orgs/${orgId}/members/import`, {
      method: "POST",
      headers: { Authorization: `Bearer ${idToken}` },
      body: form,
    })
    const data = await res.json()
    if (!data.success) throw new Error(data.error || "Failed to import members.")
    return {
      data: {
        invited: data.invited ?? [],
        skipped: data.skipped ?? [],
        driveLink: data.driveLink ?? null,
        emailError: data.emailError ?? null,
        whatsappSent: data.whatsappSent ?? 0,
      },
      error: null,
    }
  } catch (error) {
    return { data: null, error: error instanceof Error ? error.message : "Failed to import members." }
  }
}
