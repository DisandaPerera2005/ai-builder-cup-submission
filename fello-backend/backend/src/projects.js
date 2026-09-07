// Cached org/project scope lookups, so the message webhook (one call per
// WhatsApp message) doesn't do a Firestore read per message.

const { adminDb } = require('./firebase');

const TTL_MS = 60_000;
const projectCache = new Map(); // projectId -> { orgId, tenantId, expiresAt }
const orgCache = new Map(); // orgId -> { tenantId, expiresAt }

async function getProjectScope(projectId) {
  const cached = projectCache.get(projectId);
  if (cached && cached.expiresAt > Date.now()) return cached;

  const snap = await adminDb().collection('projects').doc(projectId).get();
  const data = snap.exists ? snap.data() : null;
  const entry = {
    orgId: data?.orgId ?? null,
    tenantId: data?.tenantId ?? null,
    expiresAt: Date.now() + TTL_MS,
  };
  projectCache.set(projectId, entry);
  return entry;
}

async function getProjectOrgId(projectId) {
  return (await getProjectScope(projectId)).orgId;
}

async function getOrgTenantId(orgId) {
  const cached = orgCache.get(orgId);
  if (cached && cached.expiresAt > Date.now()) return cached.tenantId;

  const snap = await adminDb().collection('organizations').doc(orgId).get();
  const tenantId = snap.exists ? snap.data()?.tenantId ?? null : null;
  orgCache.set(orgId, { tenantId, expiresAt: Date.now() + TTL_MS });
  return tenantId;
}

async function setProjectWhatsappStatus(projectId, { status, phoneNumber }) {
  const update = { whatsappStatus: status };
  if (phoneNumber) update.whatsappGatewayNumber = phoneNumber;
  await adminDb().collection('projects').doc(projectId).update(update);
}

async function setOrgWhatsappStatus(orgId, { status, phoneNumber }) {
  const update = { whatsappStatus: status };
  if (phoneNumber) update.whatsappGroupNumber = phoneNumber;
  await adminDb().collection('organizations').doc(orgId).update(update);
}

module.exports = {
  getProjectScope,
  getProjectOrgId,
  getOrgTenantId,
  setProjectWhatsappStatus,
  setOrgWhatsappStatus,
};
