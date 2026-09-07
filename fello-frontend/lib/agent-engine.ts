/**
 * Vertex AI Agent Engine client (server-only).
 *
 * Talks to the deployed Fello ADK agent (see fello-agent/deploy.py). The flow
 * matches the security model: the SERVER creates the session with the verified
 * tenant/org state, then streams the user's message into it. The browser never
 * supplies tenant/org scope — only the message and a session handle.
 *
 * Set AGENT_ENGINE_RESOURCE_NAME to the resource printed by deploy.py:
 *   projects/<PROJECT>/locations/<LOCATION>/reasoningEngines/<ID>
 * When it's unset, callers fall back to the direct-NIM path.
 */

import "server-only";

import { GoogleAuth } from "google-auth-library";
import type { UIMessageChunk } from "ai";
import type { OrgScope } from "@/lib/firebase-admin";

const RESOURCE = process.env.AGENT_ENGINE_RESOURCE_NAME || "";

export function agentEngineConfigured(): boolean {
  return RESOURCE.startsWith("projects/");
}

function location(): string {
  // Derive region from the resource name, fall back to env / us-central1.
  const m = RESOURCE.match(/locations\/([^/]+)\//);
  return m?.[1] || process.env.GOOGLE_CLOUD_LOCATION || "us-central1";
}

function apiHost(): string {
  return `https://${location()}-aiplatform.googleapis.com`;
}

const auth = new GoogleAuth({
  scopes: ["https://www.googleapis.com/auth/cloud-platform"],
});

async function accessToken(): Promise<string> {
  const client = await auth.getClient();
  const token = await client.getAccessToken();
  if (!token.token) throw new Error("Failed to obtain Google Cloud access token.");
  return token.token;
}

/** Build the session.state the agent binds its tenant scope from. */
function sessionState(scope: OrgScope, opts: { eventId?: string | null; channel?: string }) {
  const state: Record<string, unknown> = {
    tenant_id: scope.tenantId,
    org_id: scope.orgId,
    user_id: scope.userId,
    capabilities: scope.capabilities,
    channel: opts.channel ?? "dashboard",
  };
  if (opts.eventId) state.event_id = opts.eventId;
  return state;
}

/**
 * Create a session bound to the verified scope. Returns the session id, which
 * the client echoes back on subsequent turns so the conversation has memory.
 */
export async function createAgentSession(
  scope: OrgScope,
  opts: { eventId?: string | null; channel?: string } = {},
): Promise<string> {
  const res = await fetch(`${apiHost()}/v1/${RESOURCE}:query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${await accessToken()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      class_method: "create_session",
      input: { user_id: scope.userId, state: sessionState(scope, opts) },
    }),
  });
  if (!res.ok) {
    throw new Error(`create_session failed (${res.status}): ${await safeText(res)}`);
  }
  const data = await res.json();
  // AdkApp returns the session under output (id) — tolerate a couple of shapes.
  const id =
    data?.output?.id ?? data?.output?.session_id ?? data?.id ?? data?.session_id;
  if (!id) throw new Error("create_session returned no session id.");
  return String(id);
}

// Some models (notably the NVIDIA NIM fallback path) don't reliably mark
// chain-of-thought parts with thought=true — the raw reasoning sometimes
// comes back as a plain, untagged text part instead, e.g.
// `{"text":"We need to list tasks... Let's call list_tasks... Let's produce."}[/BLOCK]`.
// That must never reach the user as the "answer" — detect it heuristically
// and route it to reasoning instead, same as properly-tagged thought parts.
const REASONING_LEAK_RE =
  /^\s*(we (need|should|must|want) to|let'?s (call|produce|check|use|respond)|i (need|should) to|first,? (let'?s|i'?ll))/i;

function looksLikeLeakedReasoning(text: string): boolean {
  return REASONING_LEAK_RE.test(text);
}

/**
 * Stream the agent's reply as real AI SDK UI Message chunks, so the client
 * (assistant-ui's Thread, via the AI SDK transport) gets genuine `reasoning`
 * and `tool-call` message parts — not embedded text markers — and its native
 * chain-of-thought / tool-call UI drives itself.
 *
 * Same eager, tight upstream-read loop as before (this is what avoids
 * UND_ERR_BODY_TIMEOUT — undici kills a fetch whose body sits unread for too
 * long); the only change is that each parsed SSE event is translated into a
 * UIMessageChunk and forwarded immediately instead of being buffered into one
 * string, so the reply visibly streams in as it arrives.
 */
export async function streamAgentReply(args: {
  scope: OrgScope;
  sessionId: string;
  message: string;
}): Promise<ReadableStream<UIMessageChunk>> {
  const token = await accessToken();
  const upstream = await fetch(`${apiHost()}/v1/${RESOURCE}:streamQuery?alt=sse`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      class_method: "stream_query",
      input: {
        user_id: args.scope.userId,
        session_id: args.sessionId,
        message: args.message,
      },
    }),
    signal: AbortSignal.timeout(280_000),
  });

  if (!upstream.ok) {
    throw new Error(`stream_query failed (${upstream.status}): ${await safeText(upstream)}`);
  }
  if (!upstream.body) {
    throw new Error("stream_query returned no body");
  }

  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();

  return new ReadableStream<UIMessageChunk>({
    async start(controller) {
      let buf = "";
      let textId: string | null = null;
      let reasoningId: string | null = null;
      let toolCounter = 0;
      let seq = 0;
      const nextId = (prefix: string) => `${prefix}_${++seq}`;

      const closeText = () => {
        if (textId) {
          controller.enqueue({ type: "text-end", id: textId });
          textId = null;
        }
      };
      const closeReasoning = () => {
        if (reasoningId) {
          controller.enqueue({ type: "reasoning-end", id: reasoningId });
          reasoningId = null;
        }
      };

      controller.enqueue({ type: "start" });
      controller.enqueue({ type: "start-step" });

      const emit = (jsonLine: string) => {
        let evt: any;
        try {
          evt = JSON.parse(jsonLine);
        } catch {
          return;
        }
        const parts = evt?.content?.parts ?? evt?.output?.content?.parts ?? [];
        for (const p of parts) {
          if (p?.function_call?.name) {
            closeText();
            closeReasoning();
            const toolCallId = nextId("tool");
            const toolName = p.function_call.name as string;
            controller.enqueue({
              type: "tool-input-available",
              toolCallId,
              toolName,
              input: p.function_call.args ?? {},
            });
            // The ADK stream doesn't surface per-tool results to us — mark it
            // done immediately rather than leaving the UI spinning forever.
            controller.enqueue({ type: "tool-output-available", toolCallId, output: {} });
          } else if (typeof p?.text === "string" && p.text) {
            if (p.thought || looksLikeLeakedReasoning(p.text)) {
              closeText();
              if (!reasoningId) {
                reasoningId = nextId("reasoning");
                controller.enqueue({ type: "reasoning-start", id: reasoningId });
              }
              controller.enqueue({ type: "reasoning-delta", id: reasoningId, delta: p.text });
            } else {
              closeReasoning();
              if (!textId) {
                textId = nextId("text");
                controller.enqueue({ type: "text-start", id: textId });
              }
              controller.enqueue({ type: "text-delta", id: textId, delta: p.text });
            }
          }
        }
      };

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          let idx: number;
          while ((idx = buf.indexOf("\n")) !== -1) {
            const line = buf.slice(0, idx);
            buf = buf.slice(idx + 1);
            const s = line.startsWith("data:") ? line.slice(5).trim() : line.trim();
            if (s) emit(s);
          }
        }
        const tail = buf.startsWith("data:") ? buf.slice(5).trim() : buf.trim();
        if (tail) emit(tail);
      } catch (err) {
        console.error("[agent-engine] stream read failed mid-turn:", err);
        closeReasoning();
        if (!textId) {
          textId = nextId("text");
          controller.enqueue({ type: "text-start", id: textId });
        }
        controller.enqueue({
          type: "text-delta",
          id: textId,
          delta: "\n\nI hit an error partway through that reply. Please try again.",
        });
      } finally {
        closeText();
        closeReasoning();
        controller.enqueue({ type: "finish-step" });
        controller.enqueue({ type: "finish" });
        controller.close();
      }
    },
  });
}

/**
 * One-shot, non-streaming call: create a session bound to the verified scope,
 * send a message, and return the final reply text. For server-triggered
 * actions (e.g. "send invite emails to these new members") that don't need
 * the dashboard's streaming UI — mirrors fello-backend/backend/src/agent-client.js's
 * getReply, used for the WhatsApp channel's one-shot replies.
 */
export async function getAgentReply(
  scope: OrgScope,
  message: string,
  opts: { eventId?: string | null; channel?: string } = {},
): Promise<string> {
  if (!agentEngineConfigured()) {
    throw new Error("The AI agent isn't connected yet (AGENT_ENGINE_RESOURCE_NAME is unset).");
  }
  const sessionId = await createAgentSession(scope, opts);
  const token = await accessToken();
  const res = await fetch(`${apiHost()}/v1/${RESOURCE}:streamQuery?alt=sse`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      class_method: "stream_query",
      input: { user_id: scope.userId, session_id: sessionId, message },
    }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) {
    throw new Error(`stream_query failed (${res.status}): ${await safeText(res)}`);
  }

  const body = await res.text();
  let reply = "";
  for (const rawLine of body.split("\n")) {
    const line = rawLine.startsWith("data:") ? rawLine.slice(5).trim() : rawLine.trim();
    if (!line) continue;
    let evt: any;
    try {
      evt = JSON.parse(line);
    } catch {
      continue;
    }
    const parts = evt?.content?.parts ?? evt?.output?.content?.parts ?? [];
    for (const p of parts) {
      if (typeof p?.text === "string" && p.text && !p.thought) {
        reply += p.text;
      }
    }
  }
  return reply.trim();
}

async function safeText(res: Response): Promise<string> {
  try {
    return (await res.text()).slice(0, 500);
  } catch {
    return "<no body>";
  }
}
