const express = require('express');
const { insertMessage } = require('./db');
const { getProjectScope, getOrgTenantId } = require('./projects');
const { adminDb, capabilitiesFor } = require('./firebase');
const gateway = require('./gateway-client');
const agent = require('./agent-client');

const router = express.Router();

// Separate from BAILEYS_API_SECRET on purpose: that secret gates backend->gateway
// calls; this one gates gateway->backend calls. Only the gateway process holds it.
router.use((req, res, next) => {
  const secret = process.env.GATEWAY_WEBHOOK_SECRET;
  const header = req.header('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : null;
  if (!secret || token !== secret) {
    return res.status(401).json({ success: false, error: 'unauthorized' });
  }
  next();
});

// A coordinator addresses the bot by name, or issues a slash command — anything
// else is just group chatter that gets stored but never triggers the agent.
function needsAi(body) {
  return /\bfello\b/i.test(body) || body.trim().startsWith('/');
}

// Resolve a WhatsApp sender JID (e.g. "94771234567@s.whatsapp.net") to a
// verified Fello user and their REAL capabilities on this org — the same model
// as fello-agent/skills/whatsapp_auth.py. An unverified sender still gets a
// conversational reply, but with user_id=null and no capabilities the agent's
// authz layer refuses every state-changing tool for them (fail closed). A
// WhatsApp display name is trivially spoofable, so nothing here may ever be
// granted from the message itself.
async function resolveSenderScope(senderId, orgId) {
  const digits = String(senderId || '').split('@')[0].replace(/\D/g, '');
  if (!digits) return { userId: null, capabilities: [] };

  try {
    // whatsappNumber is free-text user input; match the common storage shapes.
    // Prefer an OTP-verified match; fall back to an unverified one because the
    // OTP flow isn't live yet and the sender number itself is attested by
    // WhatsApp (Baileys reports the real sender JID — group members can't
    // spoof each other). TODO: drop the unverified fallback once the WhatsApp
    // OTP verification flow sets users.whatsappVerified.
    const variants = [digits, `+${digits}`];
    for (const verifiedOnly of [true, false]) {
      for (const number of variants) {
        let q = adminDb().collection('users').where('whatsappNumber', '==', number);
        if (verifiedOnly) q = q.where('whatsappVerified', '==', true);
        const snap = await q.limit(1).get();
        if (snap.empty) continue;

        const uid = snap.docs[0].id;
        const membership = await adminDb().collection('memberships').doc(`${uid}_${orgId}`).get();
        if (!membership.exists) return { userId: null, capabilities: [] };
        const m = membership.data();
        return { userId: uid, capabilities: capabilitiesFor(m.access ?? m.role, m.capabilities) };
      }
    }
  } catch (err) {
    console.error('resolveSenderScope failed:', err);
  }
  return { userId: null, capabilities: [] };
}

// The gateway forwards whatever session key it was started under — either a
// bare projectId (per-project number, see whatsapp-routes.js) or "org_<id>"
// (the org-wide shared number). Resolve each to the same {orgId, tenantId,
// eventId} shape; org-wide messages aren't tied to any one project, so they
// get the "org-wide" sentinel event_id (whatsapp_messages.event_id is NOT NULL).
async function resolveChannelScope(channelId) {
  if (channelId.startsWith('org_')) {
    const orgId = channelId.slice(4);
    const tenantId = await getOrgTenantId(orgId);
    return { orgId: tenantId ? orgId : null, tenantId, eventId: 'org-wide' };
  }
  const { orgId, tenantId } = await getProjectScope(channelId);
  return { orgId, tenantId, eventId: channelId };
}

router.post('/whatsapp/message', async (req, res) => {
  const { projectId: channelId, groupJid, senderId, senderName, body, timestamp } = req.body || {};
  if (!channelId || !groupJid || !body) {
    return res.status(400).json({ success: false, error: 'projectId, groupJid and body are required' });
  }

  const { orgId, tenantId, eventId } = await resolveChannelScope(channelId);
  if (!orgId) {
    // Project/org not found or not registered — ignore silently, nothing to scope to.
    return res.json({ success: true, stored: false });
  }

  await insertMessage({
    orgId,
    eventId,
    groupJid,
    senderId: senderId || groupJid,
    senderName: senderName || 'Unknown',
    body,
    timestamp: timestamp ? new Date(timestamp) : new Date(),
  });

  res.json({ success: true, stored: true });

  if (!needsAi(body)) return;

  try {
    const sender = await resolveSenderScope(senderId, orgId);
    const scope = { tenantId, orgId, userId: sender.userId, capabilities: sender.capabilities };
    const reply = await agent.getReply(scope, body, {
      eventId: eventId === 'org-wide' ? null : eventId,
      channel: 'whatsapp',
    });
    if (reply) {
      await gateway.sendMessage(channelId, groupJid, reply);
    }
  } catch (err) {
    console.error(`[${channelId}] AI routing failed:`, err);
  }
});

module.exports = router;
