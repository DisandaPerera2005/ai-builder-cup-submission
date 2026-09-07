const express = require('express');
const { verifyActor, resolveOrgScope } = require('./firebase');
const { syncOrgDrive } = require('./drive-sync');

const router = express.Router();

// Same auth pattern as whatsapp-routes.js: every route here requires a real
// Firebase ID token, verified before any org-scoped work happens.
router.use(async (req, res, next) => {
  const header = req.header('authorization') || '';
  const idToken = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : null;
  if (!idToken) return res.status(401).json({ success: false, error: 'missing bearer token' });

  try {
    req.actor = await verifyActor(idToken);
    next();
  } catch (err) {
    res.status(401).json({ success: false, error: 'invalid or expired token' });
  }
});

async function requireOrgAccess(req, res) {
  const scope = await resolveOrgScope(req.actor, req.params.orgId);
  if (!scope) {
    res.status(403).json({ success: false, error: 'no access to this org' });
    return null;
  }
  return scope;
}

// Kicks off a full recursive Drive sync for the org's configured root folder.
// Responds immediately (202) once access is verified — the sync itself runs
// async and is not awaited here, matching the fire-and-log pattern used for
// other long-running gateway calls in this service. Watch-channel/webhook
// routes for live updates are explicitly deferred to a future pass.
router.post('/orgs/:orgId/drive/sync', async (req, res) => {
  const scope = await requireOrgAccess(req, res);
  if (!scope) return;

  res.status(202).json({ success: true, status: 'syncing' });

  syncOrgDrive(req.params.orgId).catch((err) => {
    console.error(`[org ${req.params.orgId}] drive sync failed:`, err);
  });
});

module.exports = router;
