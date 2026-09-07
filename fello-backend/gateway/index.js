require('dotenv').config();
const fs = require('fs/promises');
const express = require('express');
const { makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const QRCode = require('qrcode');

// Fello runs ONE dedicated WhatsApp number PER PROJECT (== event). This
// gateway therefore multiplexes many concurrent Baileys sessions, keyed by
// projectId, instead of the single hardcoded session the prototype had.
//
// Linking is QR-code based (scan with the phone that should own this
// project's number) rather than a typed pairing code — the frontend renders
// the QR image and polls for status.
//
// In-memory registry only. A real deployment would need this to survive
// restarts, but for this pass the Baileys `useMultiFileAuthState` folder
// (sessions/<projectId>) already persists credentials to disk per session,
// and re-`start`ing a project after a restart will pick the creds back up.
const sessions = new Map(); // projectId -> { sock, status, qr, phoneNumber }

const logger = pino({ level: 'silent' });

// Non-fatal: forwards a captured message to the backend for persistence +
// AI routing. The gateway never talks to WhatsApp for anything the backend
// asked it to do without being asked — this is a one-way fire-and-forget so a
// down backend never breaks the WhatsApp session itself.
async function forwardToBackend(projectId, message) {
  const backendUrl = process.env.BACKEND_API_URL;
  const secret = process.env.GATEWAY_WEBHOOK_SECRET;
  if (!backendUrl || !secret) return;

  try {
    await fetch(`${backendUrl.replace(/\/$/, '')}/internal/whatsapp/message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify({ projectId, ...message }),
    });
  } catch (err) {
    console.error(`[${projectId}] forwardToBackend failed:`, err);
  }
}

async function startSession(projectId) {
  const { state, saveCreds } = await useMultiFileAuthState(`sessions/${projectId}`);

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
    logger,
  });

  const entry = { sock, status: 'pairing', qr: null, phoneNumber: null };
  sessions.set(projectId, entry);

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      try {
        entry.qr = await QRCode.toDataURL(qr);
      } catch (err) {
        console.error(`[${projectId}] failed to render QR:`, err);
      }
      entry.status = 'pairing';
    }

    if (connection === 'close') {
      const shouldReconnect =
        lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log(`[${projectId}] connection closed:`, lastDisconnect?.error, 'reconnecting:', shouldReconnect);
      if (shouldReconnect) {
        entry.status = 'pairing';
        startSession(projectId).catch((err) =>
          console.error(`[${projectId}] reconnect failed:`, err)
        );
      } else {
        // The phone unlinked this number (WhatsApp app -> Linked devices ->
        // Log out). Keep the entry (don't delete it) so /status and /qr keep
        // reporting "disconnected" instead of 404ing as if nothing was ever
        // linked — the frontend needs to tell "never connected" apart from
        // "was connected, then disconnected". The saved creds are now dead
        // (WhatsApp rejects them), so wipe them; otherwise a later /start
        // would keep retrying the same invalid identity and never produce a
        // fresh QR.
        entry.status = 'disconnected';
        entry.qr = null;
        await fs.rm(`sessions/${projectId}`, { recursive: true, force: true }).catch((err) =>
          console.error(`[${projectId}] failed to clear stale auth state:`, err)
        );
      }
    } else if (connection === 'open') {
      console.log(`[${projectId}] connected`);
      entry.status = 'connected';
      entry.qr = null;
      // Baileys resolves the real linked number only once pairing completes.
      entry.phoneNumber = sock.user?.id?.split(':')[0]?.split('@')[0] ?? entry.phoneNumber;
    }
  });

  sock.ev.on('messages.upsert', async (m) => {
    if (m.type !== 'notify') return;
    const msg = m.messages[0];
    if (!msg.message || msg.key.fromMe) return;

    const groupJid = msg.key.remoteJid;
    if (!groupJid || (!groupJid.endsWith('@g.us') && !groupJid.endsWith('@s.whatsapp.net'))) return;

    const body =
      msg.message?.conversation ||
      msg.message?.extendedTextMessage?.text ||
      null;
    if (!body) return;

    forwardToBackend(projectId, {
      groupJid,
      senderId: msg.key.participant || msg.key.remoteJid,
      senderName: msg.pushName || 'Unknown',
      body,
      timestamp: new Date((msg.messageTimestamp || Date.now() / 1000) * 1000).toISOString(),
    });
  });

  return entry;
}

const app = express();
app.use(express.json());

// Every route requires the shared gateway secret, matching what
// fello-backend/backend sends as `Authorization: Bearer <secret>`. The
// frontend never calls this service directly — only the backend does.
app.use((req, res, next) => {
  const secret = process.env.BAILEYS_API_SECRET;
  const header = req.header('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : null;
  if (!secret || token !== secret) {
    return res.status(401).json({ success: false, error: 'unauthorized' });
  }
  next();
});

app.post('/sessions/:projectId/start', async (req, res) => {
  const { projectId } = req.params;

  const existing = sessions.get(projectId);
  // Already pairing or connected — idempotent, just report current state.
  // A "disconnected" (logged out from the phone) or missing entry needs a
  // fresh session instead, since its creds were already wiped.
  if (existing && existing.status !== 'disconnected') {
    return res.json({ success: true, status: existing.status, qr: existing.qr });
  }

  try {
    const entry = await startSession(projectId);
    res.json({ success: true, status: entry.status, qr: entry.qr });
  } catch (err) {
    console.error(`[${projectId}] failed to start session:`, err);
    res.status(500).json({ success: false, error: 'failed to start session' });
  }
});

app.get('/sessions/:projectId/qr', (req, res) => {
  const entry = sessions.get(req.params.projectId);
  if (!entry) {
    return res.status(404).json({ success: false, status: 'not_connected', qr: null });
  }
  res.json({ success: true, status: entry.status, qr: entry.qr });
});

app.get('/sessions/:projectId/status', (req, res) => {
  const entry = sessions.get(req.params.projectId);
  if (!entry) {
    return res.status(404).json({ success: false, status: 'not_connected' });
  }
  res.json({ success: true, status: entry.status, phoneNumber: entry.phoneNumber });
});

app.post('/sessions/:projectId/send', async (req, res) => {
  const { projectId } = req.params;
  const { jid, message } = req.body || {};
  if (!jid || !message) {
    return res.status(400).json({ success: false, error: 'jid and message are required' });
  }

  const entry = sessions.get(projectId);
  if (!entry || entry.status !== 'connected') {
    return res.status(404).json({ success: false, error: 'session not connected' });
  }

  try {
    await entry.sock.sendMessage(jid, { text: message });
    res.json({ success: true });
  } catch (err) {
    console.error(`[${projectId}] send failed:`, err);
    res.status(500).json({ success: false, error: 'send failed' });
  }
});

app.post('/sessions/:projectId/groups', async (req, res) => {
  const { projectId } = req.params;
  const { name, participants } = req.body || {};
  if (!name || !participants?.length) {
    return res.status(400).json({ success: false, error: 'name and participants are required' });
  }

  const entry = sessions.get(projectId);
  if (!entry || entry.status !== 'connected') {
    return res.status(404).json({ success: false, error: 'session not connected' });
  }

  try {
    const result = await entry.sock.groupCreate(name, participants);
    res.json({ success: true, groupJid: result.id });
  } catch (err) {
    console.error(`[${projectId}] group create failed:`, err);
    res.status(500).json({ success: false, error: 'group create failed' });
  }
});

app.post('/sessions/:projectId/groups/:groupJid/participants', async (req, res) => {
  const { projectId, groupJid } = req.params;
  const { participants, action } = req.body || {};
  if (!participants?.length) {
    return res.status(400).json({ success: false, error: 'participants are required' });
  }

  const entry = sessions.get(projectId);
  if (!entry || entry.status !== 'connected') {
    return res.status(404).json({ success: false, error: 'session not connected' });
  }

  try {
    await entry.sock.groupParticipantsUpdate(groupJid, participants, action === 'remove' ? 'remove' : 'add');
    res.json({ success: true });
  } catch (err) {
    console.error(`[${projectId}] group participants update failed:`, err);
    res.status(500).json({ success: false, error: 'group participants update failed' });
  }
});

app.post('/sessions/:projectId/groups/:groupJid/admins', async (req, res) => {
  const { projectId, groupJid } = req.params;
  const { participants } = req.body || {};
  if (!participants?.length) {
    return res.status(400).json({ success: false, error: 'participants are required' });
  }

  const entry = sessions.get(projectId);
  if (!entry || entry.status !== 'connected') {
    return res.status(404).json({ success: false, error: 'session not connected' });
  }

  try {
    await entry.sock.groupParticipantsUpdate(groupJid, participants, 'promote');
    res.json({ success: true });
  } catch (err) {
    console.error(`[${projectId}] group promote failed:`, err);
    res.status(500).json({ success: false, error: 'group promote failed' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Baileys gateway listening on :${PORT}`);
});
