// Node port of fello-frontend/lib/agent-engine.ts, trimmed to a single
// non-streaming call — WhatsApp replies are one shot, they don't need the
// SSE-to-UI-chunk translation the dashboard chat does.
//
// Set AGENT_ENGINE_RESOURCE_NAME to the resource printed by fello-agent/deploy.py:
//   projects/<PROJECT>/locations/<LOCATION>/reasoningEngines/<ID>

const { GoogleAuth } = require('google-auth-library');

const RESOURCE = process.env.AGENT_ENGINE_RESOURCE_NAME || '';

function configured() {
  return RESOURCE.startsWith('projects/');
}

function location() {
  const m = RESOURCE.match(/locations\/([^/]+)\//);
  return m?.[1] || process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';
}

function apiHost() {
  return `https://${location()}-aiplatform.googleapis.com`;
}

const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });

async function accessToken() {
  const client = await auth.getClient();
  const token = await client.getAccessToken();
  if (!token.token) throw new Error('Failed to obtain Google Cloud access token.');
  return token.token;
}

async function safeText(res) {
  try {
    return (await res.text()).slice(0, 500);
  } catch {
    return '<no body>';
  }
}

/** Build the session.state the agent binds its tenant scope from. */
function sessionState({ tenantId, orgId, userId, capabilities, eventId, channel }) {
  const state = {
    tenant_id: tenantId,
    org_id: orgId,
    user_id: userId,
    capabilities,
    channel: channel ?? 'whatsapp',
  };
  if (eventId) state.event_id = eventId;
  return state;
}

// Agent Engine needs a session-keying user_id string even for senders with no
// verified Fello account. This key is ONLY for session bookkeeping — the
// authz-relevant identity is state.user_id, which stays null for unverified
// senders so the agent's capability checks fail closed.
function sessionKey(scope) {
  return scope.userId || `whatsapp:${scope.orgId}:unverified`;
}

async function createSession(scope, opts = {}) {
  const res = await fetch(`${apiHost()}/v1/${RESOURCE}:query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${await accessToken()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      class_method: 'create_session',
      input: { user_id: sessionKey(scope), state: sessionState({ ...scope, ...opts }) },
    }),
  });
  if (!res.ok) throw new Error(`create_session failed (${res.status}): ${await safeText(res)}`);
  const data = await res.json();
  const id = data?.output?.id ?? data?.output?.session_id ?? data?.id ?? data?.session_id;
  if (!id) throw new Error('create_session returned no session id.');
  return String(id);
}

// Dashboard-only structure the model emits ([BLOCK:type]{json}[/BLOCK] and
// [SUGGESTIONS]...) renders into rich cards there, but would show up as raw,
// broken-looking markup in a WhatsApp text bubble. Strip it so WhatsApp always
// gets clean prose, regardless of what the model produced.
const BLOCK_RE = /\[BLOCK:[a-z_]+\][\s\S]*?\[\/BLOCK\]/gi;
const SUGGESTIONS_RE = /\[SUGGESTIONS\][\s\S]*$/i;

function stripDashboardMarkup(text) {
  return text
    .replace(BLOCK_RE, "")
    .replace(SUGGESTIONS_RE, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Nudges the model toward chat-message-length replies. Reasoning (thought=true
// parts) is already dropped below and never reaches WhatsApp — only the final
// answer text does, and this keeps that answer itself short.
const WHATSAPP_STYLE_PREFIX =
  "(Replying in a WhatsApp chat — keep it to 1-3 short, plain-text sentences. " +
  "No markdown, no bullet lists, no [BLOCK] or [SUGGESTIONS] markup.)\n\n";

/**
 * Send a message into a session and collect the plain-text reply. Reasoning
 * (thought=true) parts and tool calls are ignored — WhatsApp only gets the
 * final answer text.
 */
async function queryReply(scope, sessionId, message) {
  const res = await fetch(`${apiHost()}/v1/${RESOURCE}:streamQuery?alt=sse`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${await accessToken()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      class_method: 'stream_query',
      input: { user_id: sessionKey(scope), session_id: sessionId, message: WHATSAPP_STYLE_PREFIX + message },
    }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) throw new Error(`stream_query failed (${res.status}): ${await safeText(res)}`);

  const body = await res.text();
  let reply = '';
  for (const rawLine of body.split('\n')) {
    const line = rawLine.startsWith('data:') ? rawLine.slice(5).trim() : rawLine.trim();
    if (!line) continue;
    let evt;
    try {
      evt = JSON.parse(line);
    } catch {
      continue;
    }
    const parts = evt?.content?.parts ?? evt?.output?.content?.parts ?? [];
    for (const p of parts) {
      if (typeof p?.text === 'string' && p.text && !p.thought) {
        reply += p.text;
      }
    }
  }
  return stripDashboardMarkup(reply);
}

/** One-shot: create a session bound to the verified scope, send the message, return the reply text. */
async function getReply(scope, message, opts = {}) {
  if (!configured()) {
    return "I'm not connected to the AI agent yet — this message was logged but not answered.";
  }
  const sessionId = await createSession(scope, opts);
  return queryReply(scope, sessionId, message);
}

module.exports = { configured, getReply };
