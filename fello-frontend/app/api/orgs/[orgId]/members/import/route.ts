/**
 * Bulk member import from an uploaded CSV/XLSX member-list file.
 *
 * Body: multipart/form-data with:
 *   - file: the original CSV/XLSX (uploaded as-is into the org's Drive root,
 *     per CLAUDE.md §5.1 tenant isolation — never left loose at Drive's top level)
 *   - rows: JSON string of [{ name, email }, ...] parsed client-side for preview
 *
 * Every row is re-validated here (tenant domain match, dedupe) before writing
 * an `org_invites` doc — the client-side parse is a convenience, never trusted
 * for the actual Firestore write (tenant-safe-query discipline, CLAUDE.md §5).
 *
 * After invites are created, the ADK agent is asked (in one turn) to email
 * each newly invited person via `send_org_invite_emails` — this is the
 * "runs on ADK" path for outbound invite email, using the org's own connected
 * Google account (Gmail send scope) rather than a third-party ESP.
 */
import { verifyActor, resolveOrgScope, adminDb } from "@/lib/firebase-admin"
import { getOrgAccessToken, uploadFileToDrive } from "@/lib/google"
import { bulkInviteOrgMembersManual, type ManualInviteRow } from "@/lib/actions/org-invites"
import { getAgentReply } from "@/lib/agent-engine"

export const maxDuration = 60

export async function POST(req: Request, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params
  try {
    const auth = req.headers.get("authorization") || ""
    const idToken = auth.startsWith("Bearer ") ? auth.slice(7) : null
    if (!idToken) return json({ success: false, error: "Missing ID token." }, 401)

    const actor = await verifyActor(idToken)
    const scope = await resolveOrgScope(actor, orgId)
    if (!scope) return json({ success: false, error: "You don't have access to this org." }, 403)
    if (!scope.capabilities.includes("members.manage") && !scope.capabilities.includes("*")) {
      return json({ success: false, error: "You don't have permission to invite members." }, 403)
    }

    const form = await req.formData()
    const file = form.get("file") as File | null
    const rowsRaw = form.get("rows") as string | null
    if (!file || !rowsRaw) return json({ success: false, error: "Missing file or rows." }, 400)

    let rows: ManualInviteRow[]
    try {
      rows = JSON.parse(rowsRaw)
    } catch {
      return json({ success: false, error: "Malformed rows payload." }, 400)
    }
    if (!Array.isArray(rows) || rows.length === 0) {
      return json({ success: false, error: "No member rows to invite." }, 400)
    }

    // 1. Upload the original file into the org's Drive root, for a record of
    // exactly what was imported.
    let driveLink: string | null = null
    const orgSnap = await adminDb().collection("organizations").doc(orgId).get()
    const driveRootFolderId = (orgSnap.data() as { driveRootFolderId?: string } | undefined)?.driveRootFolderId
    const tok = await getOrgAccessToken(orgId)
    if (tok.token && driveRootFolderId) {
      const bytes = Buffer.from(await file.arrayBuffer())
      const uploaded = await uploadFileToDrive(
        tok.token,
        `Member import — ${new Date().toISOString().slice(0, 10)} — ${file.name}`,
        file.type || "application/octet-stream",
        bytes,
        driveRootFolderId,
      )
      driveLink = uploaded.webViewLink ?? null
    }

    // 2. Write the invites (tenant-domain validated, deduped).
    const inviteResult = await bulkInviteOrgMembersManual({
      orgId,
      tenantId: scope.tenantId,
      invitedBy: scope.userId,
      rows,
    })
    if (inviteResult.error !== null) return json({ success: false, error: inviteResult.error }, 200)

    const { invited, skipped }: { invited: ManualInviteRow[]; skipped: unknown[] } = inviteResult.data

    // 3. Ask the agent to email everyone who was actually invited.
    let emailError: string | null = null
    if (invited.length > 0) {
      try {
        await getAgentReply(
          scope,
          `I just imported ${invited.length} new member${invited.length === 1 ? "" : "s"} for this org. ` +
            `Please send each of them an invite email now using send_org_invite_emails. Here they are: ` +
            JSON.stringify(invited.map((r) => ({ name: r.name, email: r.email }))),
          { channel: "dashboard" },
        )
      } catch (e) {
        emailError = e instanceof Error ? e.message : "Failed to reach the AI agent to send invite emails."
      }
    }

    // 4. For rows that also had a WhatsApp number, send a short nudge from
    // the org's shared number — deterministic (not agent-routed), same as
    // the group-send feature, since this is a simple templated text send.
    let whatsappSent = 0
    const backendUrl = process.env.BACKEND_API_URL
    const orgName = (orgSnap.data() as { name?: string } | undefined)?.name ?? "the organization"
    const withPhone = invited.filter((r) => r.phone)
    if (backendUrl && withPhone.length > 0) {
      await Promise.all(
        withPhone.map(async (row) => {
          try {
            const res = await fetch(`${backendUrl.replace(/\/$/, "")}/orgs/${orgId}/whatsapp/send-to`, {
              method: "POST",
              headers: { Authorization: auth, "Content-Type": "application/json" },
              body: JSON.stringify({
                phoneNumber: row.phone,
                message: `Someone invited you to join ${orgName} on Fello. Go to https://app.fello.live to join.`,
              }),
            })
            const data = await res.json()
            if (data.success) whatsappSent += 1
          } catch {
            // Best-effort — a failed WhatsApp nudge never blocks the invite/email flow.
          }
        }),
      )
    }

    return json({
      success: true,
      invited,
      skipped,
      driveLink,
      emailError,
      whatsappSent,
    })
  } catch (err) {
    return json({ success: false, error: err instanceof Error ? err.message : "Import failed." }, 200)
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}
