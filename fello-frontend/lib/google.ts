/**
 * Server-side Google Workspace helper.
 *
 * Reads an org's connected Google grant from Firestore (google_integrations/{orgId}),
 * refreshes the access token, and creates a Google Form. Mirrors the agent's
 * Python skill so the same flow can be tested directly from the frontend.
 */

import "server-only";

import { adminDb } from "@/lib/firebase-admin";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const FORMS_API = "https://forms.googleapis.com/v1/forms";

interface GoogleIntegration {
  connected?: boolean;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: string | number;
  scopes?: string[];
  email?: string;
}

export async function getOrgIntegration(orgId: string): Promise<GoogleIntegration | null> {
  const snap = await adminDb().collection("google_integrations").doc(orgId).get();
  return snap.exists ? (snap.data() as GoogleIntegration) : null;
}

function expired(expiresAt: string | number | undefined): boolean {
  if (!expiresAt) return true;
  const ms = typeof expiresAt === "number" ? expiresAt : Date.parse(String(expiresAt));
  if (Number.isNaN(ms)) return true;
  return Date.now() >= ms - 60_000;
}

/** Return a usable access token for the org's Google account (refreshing if needed). */
export async function getOrgAccessToken(
  orgId: string,
): Promise<{ token?: string; error?: string; email?: string; scopes?: string[] }> {
  const integ = await getOrgIntegration(orgId);
  if (!integ || !integ.connected) {
    return { error: "No Google account is connected for this organization. Connect one in Settings." };
  }
  if (integ.accessToken && !expired(integ.expiresAt)) {
    return { token: integ.accessToken, email: integ.email, scopes: integ.scopes };
  }
  if (!integ.refreshToken) {
    if (integ.accessToken) return { token: integ.accessToken, email: integ.email, scopes: integ.scopes };
    return { error: "The connected Google account needs to be reconnected in Settings." };
  }

  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) return { error: "Google OAuth client is not configured on the server." };

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: integ.refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    return { error: `Token refresh failed (${res.status}): ${(await res.text()).slice(0, 300)}` };
  }
  const data = await res.json();

  // Persist the refreshed token + new expiry so the Settings page (which
  // only ever reads the cached Firestore doc, not this live call) stops
  // showing a stale "expiring soon" warning the moment any actual API call
  // refreshes it here. Google doesn't re-issue refresh_token on refresh, so
  // integ.refreshToken stays valid and reusable indefinitely (see note on
  // OAuth consent screen publishing status below).
  const expiresAt = Date.now() + (data.expires_in ?? 3600) * 1000;
  await adminDb().collection("google_integrations").doc(orgId).update({
    accessToken: data.access_token,
    expiresAt,
  });

  return { token: data.access_token, email: integ.email, scopes: integ.scopes };
}

/** Send an email from the connected Google account (requires the gmail.send scope). */
export async function sendGmailMessage(
  token: string,
  input: { to: string; subject: string; body: string },
): Promise<{ messageId?: string; error?: string }> {
  const raw = [
    `To: ${input.to}`,
    `Subject: ${input.subject}`,
    "Content-Type: text/plain; charset=UTF-8",
    "",
    input.body,
  ].join("\r\n");
  const encoded = Buffer.from(raw).toString("base64url");

  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ raw: encoded }),
  });
  if (!res.ok) {
    return { error: `Gmail send failed (${res.status}): ${(await res.text()).slice(0, 400)}` };
  }
  const data = await res.json();
  return { messageId: data.id };
}

/**
 * Create a Drive folder using the given access token. Returns the folder id.
 *
 * Pass `parentId` to nest the new folder inside the org's designated
 * `driveRootFolderId` (see FELLO_DRIVE_AND_WHATSAPP_SECURITY.md Part A) —
 * every folder Fello creates must live inside that one root, never loose at
 * the top level of the connected Drive.
 */
export async function createDriveFolder(
  token: string,
  name: string,
  parentId?: string,
): Promise<{ folderId?: string; error?: string }> {
  const res = await fetch("https://www.googleapis.com/drive/v3/files", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      name,
      mimeType: "application/vnd.google-apps.folder",
      ...(parentId ? { parents: [parentId] } : {}),
    }),
  });
  if (!res.ok) {
    return { error: `Drive folder create failed (${res.status}): ${(await res.text()).slice(0, 400)}` };
  }
  const data = await res.json();
  return { folderId: data.id };
}

/**
 * Upload raw file bytes into a Drive folder using the given access token.
 * Used for the member-import CSV/XLSX so the org keeps a copy of exactly
 * what was uploaded, inside its own Drive root folder.
 */
export async function uploadFileToDrive(
  token: string,
  name: string,
  mimeType: string,
  bytes: Buffer,
  parentId?: string,
): Promise<{ fileId?: string; webViewLink?: string; error?: string }> {
  const boundary = `fello-${Date.now().toString(36)}`;
  const metadata = { name, ...(parentId ? { parents: [parentId] } : {}) };
  const body = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n` +
        `--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`,
    ),
    bytes,
    Buffer.from(`\r\n--${boundary}--`),
  ]);

  const res = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
    },
  );
  if (!res.ok) {
    return { error: `Drive upload failed (${res.status}): ${(await res.text()).slice(0, 400)}` };
  }
  const data = await res.json();
  return { fileId: data.id, webViewLink: data.webViewLink };
}

export interface CreateFormInput {
  title: string;
  description?: string;
  questions?: string[];
}

export interface CreateFormResult {
  success: boolean;
  formId?: string;
  responderUri?: string;
  editUri?: string;
  error?: string;
}

/** Create a Google Form using the given access token. */
export async function createGoogleForm(
  token: string,
  input: CreateFormInput,
): Promise<CreateFormResult> {
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  // 1. Create with title only (the API rejects description/items at create time).
  const createRes = await fetch(FORMS_API, {
    method: "POST",
    headers,
    body: JSON.stringify({ info: { title: input.title, documentTitle: input.title } }),
  });
  if (!createRes.ok) {
    return { success: false, error: `Forms create failed (${createRes.status}): ${(await createRes.text()).slice(0, 400)}` };
  }
  const form = await createRes.json();
  const formId: string = form.formId;

  // 2. Add description + questions in a batch update.
  const requests: unknown[] = [];
  if (input.description) {
    requests.push({
      updateFormInfo: { info: { description: input.description }, updateMask: "description" },
    });
  }
  (input.questions ?? []).forEach((q, i) => {
    requests.push({
      createItem: {
        item: {
          title: q,
          questionItem: { question: { required: false, textQuestion: { paragraph: false } } },
        },
        location: { index: i },
      },
    });
  });
  if (requests.length) {
    const updRes = await fetch(`${FORMS_API}/${formId}:batchUpdate`, {
      method: "POST",
      headers,
      body: JSON.stringify({ requests }),
    });
    if (!updRes.ok) {
      return {
        success: false,
        formId,
        error: `Form created but adding fields failed (${updRes.status}): ${(await updRes.text()).slice(0, 400)}`,
      };
    }
  }

  return {
    success: true,
    formId,
    responderUri: form.responderUri || `https://docs.google.com/forms/d/${formId}/viewform`,
    editUri: `https://docs.google.com/forms/d/${formId}/edit`,
  };
}
