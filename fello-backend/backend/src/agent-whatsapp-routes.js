const express = require('express');
const gateway = require('./gateway-client');

const router = express.Router();

// The Python agent (fello-agent, deployed remotely on Vertex AI Agent Engine)
// can never reach the gateway directly — only this backend's port is exposed
// externally (CLAUDE.md §7, "the gateway VM is never reachable from outside
// the backend"). This mirrors /internal (gateway -> backend) but the other
// direction: agent -> backend -> gateway, gated by its own shared secret so
// it's a separate trust boundary from both BAILEYS_API_SECRET (backend ->
// gateway) and Firebase ID tokens (browser -> backend). The agent has already
// verified org/tenant scope itself (context.py's identity()) before calling
// here, so channelKey (a raw projectId or "org_<orgId>") is trusted as-is.
router.use((req, res, next) => {
  const secret = process.env.AGENT_BACKEND_SECRET;
  const header = req.header('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : null;
  if (!secret || token !== secret) {
    return res.status(401).json({ success: false, error: 'unauthorized' });
  }
  next();
});

router.post('/whatsapp/:channelKey/send', async (req, res) => {
  const { jid, message } = req.body || {};
  if (!jid || !message) {
    return res.status(400).json({ success: false, error: 'jid and message are required' });
  }
  try {
    const result = await gateway.sendMessage(req.params.channelKey, jid, message);
    res.json(result);
  } catch (err) {
    res.status(err.status || 502).json({ success: false, error: err.message || 'gateway unavailable' });
  }
});

router.post('/whatsapp/:channelKey/groups', async (req, res) => {
  const { name, participants } = req.body || {};
  if (!name || !participants?.length) {
    return res.status(400).json({ success: false, error: 'name and participants are required' });
  }
  try {
    const result = await gateway.createGroup(req.params.channelKey, name, participants);
    res.json(result);
  } catch (err) {
    res.status(err.status || 502).json({ success: false, error: err.message || 'gateway unavailable' });
  }
});

router.post('/whatsapp/:channelKey/groups/:groupJid/participants', async (req, res) => {
  const { participants, action } = req.body || {};
  if (!participants?.length) {
    return res.status(400).json({ success: false, error: 'participants are required' });
  }
  try {
    const result = await gateway.updateParticipants(req.params.channelKey, req.params.groupJid, participants, action);
    res.json(result);
  } catch (err) {
    res.status(err.status || 502).json({ success: false, error: err.message || 'gateway unavailable' });
  }
});

module.exports = router;
