// Thin client for the Baileys WhatsApp gateway. Mirrors the shape of
// fello-agent/skills/_baileys.py — this backend is the only caller of the
// gateway's HTTP API; the gateway itself is never reachable from outside
// the VM (CLAUDE.md §7, "safety first").

function baseUrl() {
  return (process.env.BAILEYS_API_URL || 'http://localhost:3000').replace(/\/$/, '');
}

async function call(method, path, body) {
  const secret = process.env.BAILEYS_API_SECRET || '';
  const res = await fetch(`${baseUrl()}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${secret}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data?.error || `gateway ${method} ${path} failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

const startSession = (projectId) => call('POST', `/sessions/${projectId}/start`);

// A 404 here just means no session was ever started for this project/org —
// a normal, common state (e.g. checking status on page load before anyone
// has clicked Connect), not a gateway failure. Only surface other errors.
async function getQr(projectId) {
  try {
    return await call('GET', `/sessions/${projectId}/qr`);
  } catch (err) {
    if (err.status === 404) return { success: true, status: 'not_connected', qr: null };
    throw err;
  }
}

async function getStatus(projectId) {
  try {
    return await call('GET', `/sessions/${projectId}/status`);
  } catch (err) {
    if (err.status === 404) return { success: true, status: 'not_connected', phoneNumber: null };
    throw err;
  }
}

const sendMessage = (projectId, jid, message) =>
  call('POST', `/sessions/${projectId}/send`, { jid, message });

const createGroup = (projectId, name, participants) =>
  call('POST', `/sessions/${projectId}/groups`, { name, participants });

const promoteAdmins = (projectId, groupJid, participants) =>
  call('POST', `/sessions/${projectId}/groups/${groupJid}/admins`, { participants });

const updateParticipants = (projectId, groupJid, participants, action) =>
  call('POST', `/sessions/${projectId}/groups/${groupJid}/participants`, { participants, action });

module.exports = { startSession, getQr, getStatus, sendMessage, createGroup, promoteAdmins, updateParticipants };
