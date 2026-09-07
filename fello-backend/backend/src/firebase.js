// Minimal port of fello-frontend/lib/firebase-admin.ts for this standalone
// Express service. Same trust rule (CLAUDE.md §4.1): tenant/org scope is
// derived ONLY from the verified Firebase ID token's custom claims, never
// from the request body or URL.

const { initializeApp, getApps, cert } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');

let _app = null;

function adminApp() {
  if (_app) return _app;
  if (getApps().length) {
    _app = getApps()[0];
    return _app;
  }

  const projectId =
    process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (projectId && clientEmail && privateKey) {
    _app = initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
  } else {
    // No service-account key: use ADC (works automatically on the GCE VM via
    // its attached service account).
    _app = initializeApp(projectId ? { projectId } : undefined);
  }
  return _app;
}

function adminAuth() {
  return getAuth(adminApp());
}

function adminDb() {
  return getFirestore(adminApp());
}

/** Verify a Firebase ID token and pull the Fello custom claims off it. */
async function verifyActor(idToken) {
  const decoded = await adminAuth().verifyIdToken(idToken);
  return {
    uid: decoded.uid,
    tenantId: decoded.tenantId ?? null,
    orgs: decoded.orgs ?? {},
    projects: decoded.projects ?? {},
  };
}

function capabilitiesFor(access, capabilities) {
  const a = (access ?? '').toLowerCase();
  if (a === 'full' || a === 'owner' || a === 'admin') return ['*'];
  return capabilities ?? [];
}

/** Resolve the actor's verified scope for a given internal org id. Null = deny. */
async function resolveOrgScope(actor, orgId) {
  const claim = actor.orgs?.[orgId];
  if (claim && actor.tenantId) {
    return {
      tenantId: actor.tenantId,
      orgId,
      userId: actor.uid,
      capabilities: capabilitiesFor(claim.access, claim.capabilities),
    };
  }

  const snap = await adminDb().collection('memberships').doc(`${actor.uid}_${orgId}`).get();
  if (!snap.exists) return null;
  const m = snap.data();
  if (!m?.tenantId) return null;
  return {
    tenantId: m.tenantId,
    orgId,
    userId: actor.uid,
    capabilities: capabilitiesFor(m.access ?? m.role, m.capabilities),
  };
}

/** Resolve event_only (external contributor) scope for a single project. Null = deny. */
async function resolveProjectScope(actor, projectId) {
  const claim = actor.projects?.[projectId];
  if (claim && actor.tenantId) {
    return {
      tenantId: actor.tenantId,
      orgId: claim.orgId,
      projectId,
      userId: actor.uid,
      capabilities: ['tasks.manage', 'documents.view'],
    };
  }

  const snap = await adminDb()
    .collection('project_memberships')
    .doc(`${actor.uid}_${projectId}`)
    .get();
  if (!snap.exists) return null;
  const m = snap.data();
  if (!m?.tenantId || !m?.orgId || m.status !== 'active') return null;
  return {
    tenantId: m.tenantId,
    orgId: m.orgId,
    projectId,
    userId: actor.uid,
    capabilities: ['tasks.manage', 'documents.view'],
  };
}

/**
 * Resolve a scope for whatsapp-linking a project: prefer full org access
 * (resolveOrgScope, once the project's orgId is known from Firestore), fall
 * back to event_only project scope for external coordinators.
 */
async function resolveProjectAccess(actor, projectId) {
  const projectSnap = await adminDb().collection('projects').doc(projectId).get();
  if (!projectSnap.exists) return null;
  const orgId = projectSnap.data()?.orgId;

  if (orgId) {
    const orgScope = await resolveOrgScope(actor, orgId);
    if (orgScope) return { ...orgScope, projectId };
  }
  return resolveProjectScope(actor, projectId);
}

module.exports = {
  adminAuth,
  adminDb,
  verifyActor,
  resolveOrgScope,
  resolveProjectScope,
  resolveProjectAccess,
  capabilitiesFor,
};
