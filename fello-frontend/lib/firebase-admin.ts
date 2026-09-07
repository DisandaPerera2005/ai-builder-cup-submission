/**
 * Firebase Admin (server-only). Used to verify the caller's ID token and to
 * resolve their VERIFIED tenant/org scope before the agent runs.
 *
 * This is the trust boundary referenced in FELLO_ADK_CAPABILITIES_AND_SECURITY.md:
 * tenant_id / org_id / capabilities passed to the agent are derived HERE from the
 * verified token — never trusted from the request body or the URL.
 */

import "server-only";

import { initializeApp, getApps, cert, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

let _app: App | null = null;

function adminApp(): App {
  if (_app) return _app;
  if (getApps().length) {
    _app = getApps()[0]!;
    return _app;
  }

  const projectId =
    process.env.FIREBASE_ADMIN_PROJECT_ID ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  // Private keys are stored with literal "\n" in env — restore real newlines.
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (projectId && clientEmail && privateKey) {
    _app = initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "fello-pt.firebasestorage.app",
    });
  } else {
    // No service-account key set: use Application Default Credentials (Cloud Run /
    // GCE / `gcloud auth application-default login`). Passing projectId explicitly
    // lets verifyIdToken work with ADC even without a full SA key.
    _app = initializeApp(
      projectId
        ? { projectId, storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "fello-pt.firebasestorage.app" }
        : { storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "fello-pt.firebasestorage.app" }
    );
  }
  return _app;
}

export function adminAuth() {
  return getAuth(adminApp());
}

export function adminDb() {
  return getFirestore(adminApp());
}

export function adminStorageBucket() {
  return getStorage(adminApp()).bucket();
}

export interface VerifiedActor {
  uid: string;
  tenantId: string | null;
  /** Internal org UUID -> { capabilities, access } from JWT claims, if present. */
  orgs: Record<string, { capabilities?: string[]; access?: string; nodeId?: string }>;
  /** Internal project UUID -> event_only scope, for external/guest contributors. */
  projects: Record<string, { access: "event_only"; orgId: string }>;
}

/** Verify a Firebase ID token and pull the Fello custom claims off it. */
export async function verifyActor(idToken: string): Promise<VerifiedActor> {
  const decoded = await adminAuth().verifyIdToken(idToken);
  return {
    uid: decoded.uid,
    tenantId: (decoded.tenantId as string) ?? null,
    orgs: (decoded.orgs as VerifiedActor["orgs"]) ?? {},
    projects: (decoded.projects as VerifiedActor["projects"]) ?? {},
  };
}

export interface OrgScope {
  tenantId: string;
  orgId: string;
  userId: string;
  capabilities: string[];
}

/**
 * Resolve the actor's verified scope for a given internal org id.
 *
 * Prefers JWT custom claims (zero Firestore reads — CLAUDE.md §4.1). Falls back
 * to a server-side membership read when claims aren't baked yet, so the demo
 * works before custom claims are wired. Either path is server-trusted.
 *
 * Returns null if the actor has no membership in the org (deny).
 */
export async function resolveOrgScope(
  actor: VerifiedActor,
  orgId: string,
): Promise<OrgScope | null> {
  const claim = actor.orgs?.[orgId];
  if (claim && actor.tenantId) {
    return {
      tenantId: actor.tenantId,
      orgId,
      userId: actor.uid,
      capabilities: capabilitiesFor(claim.access, claim.capabilities),
    };
  }

  // Fallback: verified server-side membership lookup.
  const snap = await adminDb().collection("memberships").doc(`${actor.uid}_${orgId}`).get();
  if (!snap.exists) return null;
  const m = snap.data() as
    | { tenantId?: string; access?: string; role?: string; capabilities?: string[] }
    | undefined;
  if (!m?.tenantId) return null;
  return {
    tenantId: m.tenantId,
    orgId,
    userId: actor.uid,
    capabilities: capabilitiesFor(m.access ?? m.role, m.capabilities),
  };
}

export interface ProjectScope {
  tenantId: string;
  orgId: string;
  projectId: string;
  userId: string;
  capabilities: string[];
}

/**
 * Resolve event_only (external contributor) scope for a single project.
 *
 * Prefers JWT claims. Falls back to a server-side `project_memberships` read
 * (status "active") when claims aren't baked yet, mirroring resolveOrgScope's
 * fallback. Returns null if the actor has no access to this project at all —
 * callers should NOT fall back further (e.g. to org-wide access) for actors
 * who only ever have event_only scope.
 */
export async function resolveProjectScope(
  actor: VerifiedActor,
  projectId: string,
): Promise<ProjectScope | null> {
  // A full org member already has broader access via resolveOrgScope; this
  // path is specifically for guests who never join the org.
  const claim = actor.projects?.[projectId];
  if (claim && actor.tenantId) {
    return {
      tenantId: actor.tenantId,
      orgId: claim.orgId,
      projectId,
      userId: actor.uid,
      capabilities: ["tasks.manage", "documents.view"],
    };
  }

  const snap = await adminDb()
    .collection("project_memberships")
    .doc(`${actor.uid}_${projectId}`)
    .get();
  if (!snap.exists) return null;
  const m = snap.data() as { tenantId?: string; orgId?: string; status?: string } | undefined;
  if (!m?.tenantId || !m?.orgId || m.status !== "active") return null;
  return {
    tenantId: m.tenantId,
    orgId: m.orgId,
    projectId,
    userId: actor.uid,
    capabilities: ["tasks.manage", "documents.view"],
  };
}

/**
 * Full-access owners/admins get the wildcard capability so they're never blocked
 * by a per-action check — matching how the web app treats "full" access. Everyone
 * else keeps exactly the capabilities granted to them.
 */
function capabilitiesFor(access: string | undefined, capabilities: string[] | undefined): string[] {
  const a = (access ?? "").toLowerCase();
  if (a === "full" || a === "owner" || a === "admin") return ["*"];
  return capabilities ?? [];
}
