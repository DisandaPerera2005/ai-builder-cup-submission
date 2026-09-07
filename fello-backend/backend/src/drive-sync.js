// Full recursive sync of an org's chosen Google Drive root folder into
// Postgres (fello-backend/db/schema.sql `documents` table), classifying each
// file with an LLM call. See CLAUDE.md §5.3 — every Postgres write here is
// scoped by org_id sourced from the verified caller (drive-sync-routes.js),
// never from an unauthenticated request.
//
// Deliberately no job queue / retry / backoff machinery — this is a
// hackathon-timeline build (see task constraints). One full sync = one
// recursive walk + one LLM call per file, run inline.

const { getOrgAccessToken } = require('./google-token');
const { adminDb } = require('./firebase');
const { getPool, queryWithOrg } = require('./db');
const { FieldValue } = require('firebase-admin/firestore');

const DRIVE_FILES_URL = 'https://www.googleapis.com/drive/v3/files';
const FOLDER_MIME = 'application/vnd.google-apps.folder';
const DOC_MIME = 'application/vnd.google-apps.document';
const SHEET_MIME = 'application/vnd.google-apps.spreadsheet';

const KNOWN_TEAM_NODES = [
  'whatsapp-documents',
  'design-team',
  'publicity-team',
  'logistics',
  'finance',
  'speakers',
  'general',
];

const NVIDIA_BASE = 'https://integrate.api.nvidia.com/v1';

// ---------------------------------------------------------------------------
// Drive tree walk
// ---------------------------------------------------------------------------

async function listChildren(folderId, accessToken) {
  const files = [];
  let pageToken = null;
  do {
    const params = new URLSearchParams({
      q: `'${folderId}' in parents and trashed = false`,
      fields: 'nextPageToken, files(id,name,mimeType,parents)',
      pageSize: '1000',
    });
    if (pageToken) params.set('pageToken', pageToken);

    const res = await fetch(`${DRIVE_FILES_URL}?${params.toString()}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      throw new Error(`Drive list failed (${res.status}): ${(await res.text()).slice(0, 300)}`);
    }
    const data = await res.json();
    files.push(...(data.files || []));
    pageToken = data.nextPageToken || null;
  } while (pageToken);
  return files;
}

/**
 * Recursively walk `rootFolderId`, returning a flat list of real files (not
 * folders) as { id, name, mimeType, path } where `path` is the list of
 * ancestor folder names from the root (root folder itself excluded).
 */
async function walkFolderTree(orgId, rootFolderId, accessToken) {
  const results = [];

  async function walk(folderId, path) {
    const children = await listChildren(folderId, accessToken);
    for (const child of children) {
      if (child.mimeType === FOLDER_MIME) {
        await walk(child.id, [...path, child.name]);
      } else {
        results.push({ id: child.id, name: child.name, mimeType: child.mimeType, path });
      }
    }
  }

  await walk(rootFolderId, []);

  // Resolve event_id from path[0] against this org's active events.
  let events = [];
  try {
    const snap = await adminDb().collection('events').where('orgId', '==', orgId).get();
    events = snap.docs.map((d) => ({ id: d.id, name: (d.data().name || '').toLowerCase() }));
  } catch (err) {
    console.error(`[drive-sync ${orgId}] failed to load events for path resolution:`, err);
  }

  for (const file of results) {
    const topFolder = (file.path[0] || '').toLowerCase();
    const matchedEvent = events.find((e) => e.name && e.name === topFolder);
    file.eventId = matchedEvent ? matchedEvent.id : 'org_root';

    const secondFolder = (file.path[1] || '').toLowerCase();
    file.teamNodeId = KNOWN_TEAM_NODES.includes(secondFolder) ? secondFolder : 'root';
  }

  return results;
}

// ---------------------------------------------------------------------------
// Content extraction (Docs/Sheets only) + classification
// ---------------------------------------------------------------------------

const MAX_CONTENT_CHARS = 4000;

async function exportTextContent(file, accessToken) {
  let exportMime = null;
  if (file.mimeType === DOC_MIME) exportMime = 'text/plain';
  else if (file.mimeType === SHEET_MIME) exportMime = 'text/csv';
  if (!exportMime) return null;

  try {
    const res = await fetch(
      `${DRIVE_FILES_URL}/${file.id}/export?mimeType=${encodeURIComponent(exportMime)}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!res.ok) return null;
    const text = await res.text();
    return text.slice(0, MAX_CONTENT_CHARS);
  } catch (err) {
    console.error(`[drive-sync] export failed for ${file.id}:`, err.message);
    return null;
  }
}

const FALLBACK_CLASSIFICATION = {
  document_type: 'other',
  description: '',
  ai_extracted_summary: null,
  looks_like_member_directory: false,
};

/**
 * One LLM call per file via the NVIDIA NIM OpenAI-compatible chat completions
 * API (same pattern as fello-agent/agent.py). For Docs/Sheets we export
 * plain-text/CSV content first and include an excerpt; for everything else
 * (images, PDFs, etc.) we classify from filename + mimeType only — no
 * multimodal/vision call, since that path is unverified for the NIM models
 * currently in use. This is a known limitation of this first pass.
 */
async function classifyFile(file, accessToken) {
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) {
    console.error('[drive-sync] NVIDIA_API_KEY not set — skipping classification, using fallback');
    return { ...FALLBACK_CLASSIFICATION, extractedText: null };
  }

  const extractedText = await exportTextContent(file, accessToken);
  const contentSection = extractedText
    ? extractedText
    : '(no content available, classify from name/type only)';

  const prompt = `Classify this file for an organization's document index. File name: "${file.name}". Type: ${file.mimeType}.
${contentSection}

Respond with ONLY this JSON shape, no markdown fences:
{"document_type": one of "logo"|"brief"|"proposal"|"form_response"|"poster"|"report"|"member_directory"|"other", "description": "one sentence, what this file contains", "ai_extracted_summary": "2-3 sentence summary if this is a text document, else null", "looks_like_member_directory": boolean — true only if this looks like a roster/list of people with names and emails/contact info}`;

  const model = process.env.NVIDIA_PRIMARY_MODEL || 'nvidia/nemotron-3-super-120b-a12b';

  try {
    const res = await fetch(`${NVIDIA_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
      }),
    });
    if (!res.ok) {
      console.error(`[drive-sync] classification call failed (${res.status}) for ${file.name}`);
      return { ...FALLBACK_CLASSIFICATION, extractedText };
    }
    const data = await res.json();
    const raw = data?.choices?.[0]?.message?.content || '';
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
    return {
      document_type: parsed.document_type || 'other',
      description: parsed.description || '',
      ai_extracted_summary: parsed.ai_extracted_summary ?? null,
      looks_like_member_directory: !!parsed.looks_like_member_directory,
      extractedText,
    };
  } catch (err) {
    console.error(`[drive-sync] classification failed for ${file.name}:`, err.message);
    return { ...FALLBACK_CLASSIFICATION, extractedText };
  }
}

// ---------------------------------------------------------------------------
// Member-directory candidate detection (tenant-boundary enforced at write time)
// ---------------------------------------------------------------------------

const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/;

function sanitizeDocId(email) {
  return email.toLowerCase().replace(/[@.]/g, '_');
}

/**
 * Regex-extract { name, email } candidates from extracted text (CSV export
 * from Sheets makes this straightforward — split on commas per line). Only
 * candidates whose email domain matches `tenantId` exactly survive — this is
 * the multi-tenant boundary enforced at write time (CLAUDE.md §5), and it is
 * non-negotiable: cross-tenant emails are dropped silently, never stored,
 * never surfaced.
 */
async function detectDirectoryCandidates(file, extractedText, tenantId, orgId, documentId) {
  if (!extractedText || !tenantId) return;

  const lines = extractedText.split(/\r?\n/);
  const candidates = [];

  for (const line of lines) {
    if (!line.trim()) continue;
    const emailMatch = line.match(EMAIL_RE);
    if (!emailMatch) continue;
    const email = emailMatch[0];

    const domain = email.split('@')[1];
    if (!domain || domain.toLowerCase() !== tenantId.toLowerCase()) continue; // cross-tenant — drop silently

    const cells = line.split(',').map((c) => c.trim()).filter(Boolean);
    const nameCell = cells.find((c) => c !== email && !EMAIL_RE.test(c));
    const name = nameCell || email.split('@')[0];

    candidates.push({ name, email });
  }

  for (const candidate of candidates) {
    const docId = `${orgId}_${file.id}_${sanitizeDocId(candidate.email)}`;
    const ref = adminDb().collection('invite_suggestions').doc(docId);
    try {
      const existing = await ref.get();
      if (existing.exists) {
        const status = existing.data()?.status;
        if (status && status !== 'pending') continue; // don't resurrect a reviewed suggestion
        continue; // already pending — leave as-is, don't overwrite detectedAt/etc.
      }
      await ref.set({
        orgId,
        tenantId,
        name: candidate.name,
        email: candidate.email,
        sourceDriveFileId: file.id,
        sourceFileName: file.name,
        sourceDocumentId: documentId,
        status: 'pending',
        detectedAt: FieldValue.serverTimestamp(),
        reviewedBy: null,
        reviewedAt: null,
      });
    } catch (err) {
      console.error(`[drive-sync ${orgId}] failed to write invite_suggestions/${docId}:`, err.message);
    }
  }
}

// ---------------------------------------------------------------------------
// Postgres upsert
// ---------------------------------------------------------------------------

async function upsertDocumentRow(pool, { orgId, tenantId, file, classification }) {
  const result = await queryWithOrg(
    orgId,
    `INSERT INTO documents (
       org_id, event_id, team_node_id, file_name, mime_type, drive_file_id,
       source, uploaded_by, group_jid, message_id, tenant_id, description,
       document_type, ai_extracted_summary
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
     ON CONFLICT (org_id, drive_file_id) DO UPDATE SET
       event_id = EXCLUDED.event_id,
       team_node_id = EXCLUDED.team_node_id,
       file_name = EXCLUDED.file_name,
       mime_type = EXCLUDED.mime_type,
       tenant_id = EXCLUDED.tenant_id,
       description = EXCLUDED.description,
       document_type = EXCLUDED.document_type,
       ai_extracted_summary = EXCLUDED.ai_extracted_summary
     RETURNING id`,
    [
      orgId,
      file.eventId,
      file.teamNodeId,
      file.name,
      file.mimeType,
      file.id,
      'drive_direct',
      null,
      null,
      null,
      tenantId,
      classification.description,
      classification.document_type,
      classification.ai_extracted_summary,
    ]
  );
  return result.rows[0].id;
}

// ---------------------------------------------------------------------------
// Orchestration
// ---------------------------------------------------------------------------

async function syncOrgDrive(orgId) {
  const pool = getPool();
  if (!pool) {
    return { success: false, error: 'DATABASE_URL is not configured — cannot run Drive sync.' };
  }

  const orgRef = adminDb().collection('organizations').doc(orgId);

  try {
    await orgRef.set({ driveSyncStatus: 'syncing' }, { merge: true });

    const orgSnap = await orgRef.get();
    if (!orgSnap.exists) {
      throw new Error(`organizations/${orgId} does not exist`);
    }
    const org = orgSnap.data() || {};
    const rootFolderId = org.driveRootFolderId;
    const tenantId = org.tenantId || null;
    if (!rootFolderId) {
      throw new Error('Organization has no driveRootFolderId configured.');
    }

    const { token, error: tokenError } = await getOrgAccessToken(orgId);
    if (!token) {
      throw new Error(tokenError || 'Failed to obtain a Google access token.');
    }

    const files = await walkFolderTree(orgId, rootFolderId, token);

    for (const file of files) {
      const classification = await classifyFile(file, token);
      const documentId = await upsertDocumentRow(pool, { orgId, tenantId, file, classification });

      if (classification.looks_like_member_directory) {
        await detectDirectoryCandidates(file, classification.extractedText, tenantId, orgId, documentId);
      }
    }

    await orgRef.set(
      { driveSyncStatus: 'synced', driveSyncedAt: FieldValue.serverTimestamp() },
      { merge: true }
    );

    return { success: true, filesSynced: files.length };
  } catch (err) {
    console.error(`[drive-sync ${orgId}] sync failed:`, err);
    try {
      await orgRef.set({ driveSyncStatus: 'error' }, { merge: true });
    } catch (inner) {
      console.error(`[drive-sync ${orgId}] failed to persist error status:`, inner.message);
    }
    return { success: false, error: err.message };
  }
}

module.exports = {
  walkFolderTree,
  classifyFile,
  detectDirectoryCandidates,
  syncOrgDrive,
};
