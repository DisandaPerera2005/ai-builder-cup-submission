import type { ActionResult } from "@/lib/types"

export interface WhatsappGroupParticipant {
  memberId: string
  phoneNumber: string
  isActor?: boolean
}

export interface WhatsappGroup {
  id: string
  groupJid: string
  name: string
  memberIds: string[]
  createdBy: string
  createdAt: string
}

export async function listOrgWhatsappGroups(
  idToken: string,
  orgId: string
): Promise<ActionResult<WhatsappGroup[]>> {
  try {
    const res = await fetch(`/api/whatsapp/groups?orgId=${orgId}`, {
      headers: { Authorization: `Bearer ${idToken}` },
    })
    const data = await res.json()
    if (!data.success) throw new Error(data.error || "Failed to list WhatsApp groups.")
    return { data: data.groups ?? [], error: null }
  } catch (error) {
    return { data: null, error: error instanceof Error ? error.message : "Failed to list WhatsApp groups." }
  }
}

export async function sendOrgWhatsappGroupMessage(
  idToken: string,
  orgId: string,
  groupId: string,
  message: string
): Promise<ActionResult<null>> {
  try {
    const res = await fetch(`/api/whatsapp/groups/${groupId}/send`, {
      method: "POST",
      headers: { Authorization: `Bearer ${idToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ orgId, message }),
    })
    const data = await res.json()
    if (!data.success) throw new Error(data.error || "Failed to send the message.")
    return { data: null, error: null }
  } catch (error) {
    return { data: null, error: error instanceof Error ? error.message : "Failed to send the message." }
  }
}

export async function createOrgWhatsappGroup(
  idToken: string,
  orgId: string,
  name: string,
  participants: WhatsappGroupParticipant[]
): Promise<ActionResult<{ id: string; groupJid: string; skipped: string[] }>> {
  try {
    const res = await fetch("/api/whatsapp/groups", {
      method: "POST",
      headers: { Authorization: `Bearer ${idToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ orgId, name, participants }),
    })
    const data = await res.json()
    if (!data.success) throw new Error(data.error || "Failed to create the WhatsApp group.")
    return { data: { id: data.id, groupJid: data.groupJid, skipped: data.skipped ?? [] }, error: null }
  } catch (error) {
    return { data: null, error: error instanceof Error ? error.message : "Failed to create the WhatsApp group." }
  }
}
