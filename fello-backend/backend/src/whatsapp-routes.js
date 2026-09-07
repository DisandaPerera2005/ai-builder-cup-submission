const express = require('express');
const { verifyActor, resolveProjectAccess, resolveOrgScope, adminDb } = require('./firebase');
const { setProjectWhatsappStatus, setOrgWhatsappStatus } = require('./projects');
const gateway = require('./gateway-client');

const router = express.Router();

// Org-wide WhatsApp sessions are keyed distinctly from per-project sessions
// (which use the raw projectId) so the two can never collide in the gateway's
// session map. message-webhook.js strips this prefix to tell them apart.
const orgSessionKey = (orgId) => `org_${orgId}`;

// Strips everything but digits and requires a country code to be present
// (8 digits is short even for a bare local number, let alone with a code) —
// good enough to catch "forgot the country code" / empty-string typos
// without pretending to validate real phone numbers.
function toJid(phoneNumber) {
  const digits = String(phoneNumber || '').replace(/\D/g, '');
  if (digits.length < 8) return null;
  return `${digits}@s.whatsapp.net`;
}

// Every route here requires a real Firebase ID token — this is the only
// surface the browser/frontend is allowed to call for WhatsApp linking. The
// gateway VM itself is never reachable from outside this backend.
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

async function requireProjectAccess(req, res) {
  const scope = await resolveProjectAccess(req.actor, req.params.projectId);
  if (!scope) {
    res.status(403).json({ success: false, error: 'no access to this project' });
    return null;
  }
  return scope;
}

async function requireOrgAccess(req, res) {
  const scope = await resolveOrgScope(req.actor, req.params.orgId);
  if (!scope) {
    res.status(403).json({ success: false, error: 'no access to this org' });
    return null;
  }
  return scope;
}

router.post('/projects/:projectId/whatsapp/connect', async (req, res) => {
  const scope = await requireProjectAccess(req, res);
  if (!scope) return;

  try {
    const result = await gateway.startSession(req.params.projectId);
    res.json({ success: true, status: result.status, qr: result.qr });
  } catch (err) {
    console.error(`[${req.params.projectId}] connect failed:`, err);
    res.status(502).json({ success: false, error: 'gateway unavailable' });
  }
});

router.get('/projects/:projectId/whatsapp/qr', async (req, res) => {
  const scope = await requireProjectAccess(req, res);
  if (!scope) return;

  try {
    const result = await gateway.getQr(req.params.projectId);
    res.json({ success: true, status: result.status, qr: result.qr });
  } catch (err) {
    res.status(502).json({ success: false, error: 'gateway unavailable' });
  }
});

router.get('/projects/:projectId/whatsapp/status', async (req, res) => {
  const scope = await requireProjectAccess(req, res);
  if (!scope) return;

  try {
    const result = await gateway.getStatus(req.params.projectId);
    // Persist connected/disconnected so the dashboard reflects a phone-side
    // unlink even before anyone reopens the Connect dialog to poll live.
    if (result.status === 'connected' || result.status === 'disconnected') {
      await setProjectWhatsappStatus(req.params.projectId, {
        status: result.status,
        phoneNumber: result.phoneNumber,
      });
    }
    res.json({ success: true, status: result.status, phoneNumber: result.phoneNumber });
  } catch (err) {
    res.status(502).json({ success: false, error: 'gateway unavailable' });
  }
});

// Org-wide WhatsApp group — one number the whole org shares, configured from
// the Settings page (as opposed to a project's own dedicated number).
router.post('/orgs/:orgId/whatsapp/connect', async (req, res) => {
  const scope = await requireOrgAccess(req, res);
  if (!scope) return;

  try {
    const result = await gateway.startSession(orgSessionKey(req.params.orgId));
    res.json({ success: true, status: result.status, qr: result.qr });
  } catch (err) {
    console.error(`[org ${req.params.orgId}] connect failed:`, err);
    res.status(502).json({ success: false, error: 'gateway unavailable' });
  }
});

router.get('/orgs/:orgId/whatsapp/qr', async (req, res) => {
  const scope = await requireOrgAccess(req, res);
  if (!scope) return;

  try {
    const result = await gateway.getQr(orgSessionKey(req.params.orgId));
    res.json({ success: true, status: result.status, qr: result.qr });
  } catch (err) {
    res.status(502).json({ success: false, error: 'gateway unavailable' });
  }
});

router.get('/orgs/:orgId/whatsapp/status', async (req, res) => {
  const scope = await requireOrgAccess(req, res);
  if (!scope) return;

  try {
    const result = await gateway.getStatus(orgSessionKey(req.params.orgId));
    if (result.status === 'connected' || result.status === 'disconnected') {
      await setOrgWhatsappStatus(req.params.orgId, {
        status: result.status,
        phoneNumber: result.phoneNumber,
      });
    }
    res.json({ success: true, status: result.status, phoneNumber: result.phoneNumber });
  } catch (err) {
    res.status(502).json({ success: false, error: 'gateway unavailable' });
  }
});

// Create a real WhatsApp group under the org's shared number. Body:
// { name, participants: [{ memberId, phoneNumber, isActor? }] }. Any
// participant whose phone differs from (or is missing on) their `members`
// doc gets that number persisted back — this is the only writer of the
// `members` collection's phoneNumber/whatsappJid fields today.
router.post('/orgs/:orgId/whatsapp/groups', async (req, res) => {
  const scope = await requireOrgAccess(req, res);
  if (!scope) return;

  const { name, participants } = req.body || {};
  if (!name || !participants?.length) {
    return res.status(400).json({ success: false, error: 'name and participants are required' });
  }

  const resolved = [];
  const skipped = [];
  for (const p of participants) {
    const jid = toJid(p?.phoneNumber);
    if (!jid) {
      skipped.push(p?.memberId);
      continue;
    }
    resolved.push({ memberId: p.memberId, phoneNumber: p.phoneNumber, jid, isActor: !!p.isActor });
  }
  if (!resolved.length) {
    return res.status(400).json({ success: false, error: 'no participant had a usable phone number', skipped });
  }

  try {
    await Promise.all(
      resolved.map((p) =>
        adminDb()
          .collection('members')
          .doc(p.memberId)
          .set(
            { orgId: req.params.orgId, tenantId: scope.tenantId, phoneNumber: p.phoneNumber, whatsappJid: p.jid },
            { merge: true }
          )
      )
    );

    const channelKey = orgSessionKey(req.params.orgId);
    const createResult = await gateway.createGroup(
      channelKey,
      name,
      resolved.map((p) => p.jid)
    );

    const actor = resolved.find((p) => p.isActor);
    if (actor) {
      await gateway.promoteAdmins(channelKey, createResult.groupJid, [actor.jid]);
    }

    const groupDoc = {
      orgId: req.params.orgId,
      tenantId: scope.tenantId,
      groupJid: createResult.groupJid,
      name,
      memberIds: resolved.map((p) => p.memberId),
      createdBy: scope.userId,
      createdAt: new Date().toISOString(),
    };
    const ref = await adminDb().collection('whatsapp_groups').add(groupDoc);

    res.json({ success: true, id: ref.id, groupJid: createResult.groupJid, skipped });
  } catch (err) {
    console.error(`[org ${req.params.orgId}] group create failed:`, err);
    res.status(502).json({ success: false, error: 'gateway unavailable' });
  }
});

// Send a one-off WhatsApp message to an arbitrary phone number through the
// org's shared number — used for the "someone invited you" nudge when a
// bulk member import includes a WhatsApp number alongside the email.
router.post('/orgs/:orgId/whatsapp/send-to', async (req, res) => {
  const scope = await requireOrgAccess(req, res);
  if (!scope) return;

  const { phoneNumber, message } = req.body || {};
  const jid = toJid(phoneNumber);
  if (!jid) return res.status(400).json({ success: false, error: 'a valid phoneNumber is required' });
  if (!message || !String(message).trim()) {
    return res.status(400).json({ success: false, error: 'message is required' });
  }

  try {
    await gateway.sendMessage(orgSessionKey(req.params.orgId), jid, message);
    res.json({ success: true });
  } catch (err) {
    console.error(`[org ${req.params.orgId}] send-to failed:`, err);
    res.status(502).json({ success: false, error: 'gateway unavailable' });
  }
});

// Send a text message to an existing org WhatsApp group.
router.post('/orgs/:orgId/whatsapp/groups/:groupDocId/send', async (req, res) => {
  const scope = await requireOrgAccess(req, res);
  if (!scope) return;

  const { message } = req.body || {};
  if (!message || !String(message).trim()) {
    return res.status(400).json({ success: false, error: 'message is required' });
  }

  try {
    const ref = adminDb().collection('whatsapp_groups').doc(req.params.groupDocId);
    const snap = await ref.get();
    if (!snap.exists || snap.data().orgId !== req.params.orgId) {
      return res.status(404).json({ success: false, error: 'group not found' });
    }

    const channelKey = orgSessionKey(req.params.orgId);
    await gateway.sendMessage(channelKey, snap.data().groupJid, message);
    res.json({ success: true });
  } catch (err) {
    console.error(`[org ${req.params.orgId}] group send failed:`, err);
    res.status(502).json({ success: false, error: 'gateway unavailable' });
  }
});

router.get('/orgs/:orgId/whatsapp/groups', async (req, res) => {
  const scope = await requireOrgAccess(req, res);
  if (!scope) return;

  try {
    const snap = await adminDb().collection('whatsapp_groups').where('orgId', '==', req.params.orgId).get();
    const groups = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    res.json({ success: true, groups });
  } catch (err) {
    console.error(`[org ${req.params.orgId}] group list failed:`, err);
    res.status(502).json({ success: false, error: 'failed to list groups' });
  }
});

module.exports = router;
