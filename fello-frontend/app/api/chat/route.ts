import { createOpenAI } from "@ai-sdk/openai"
import { createUIMessageStreamResponse, streamText, type UIMessageChunk } from "ai"

import { verifyActor, resolveOrgScope } from "@/lib/firebase-admin"
import {
  agentEngineConfigured,
  createAgentSession,
  streamAgentReply,
} from "@/lib/agent-engine"

const nvidia = createOpenAI({
  baseURL: "https://integrate.api.nvidia.com/v1",
  apiKey: process.env.NVIDIA_API_KEY ?? "",
})

const PRIMARY_MODEL  = process.env.NVIDIA_PRIMARY_MODEL  ?? process.env.NVIDIA_MODEL ?? "thudm/glm-4-9b-chat"
const FALLBACK_MODEL = process.env.NVIDIA_FALLBACK_MODEL ?? "minimax/minimax-text-01"

// System prompt for the DIRECT-NIM fallback path (used in local dev or if the
// deployed agent is unavailable). The deployed ADK agent carries its own prompt
// and tools — see fello-agent/agent.py. Both emit the same [BLOCK:*] markers so
// the dashboard renders identically regardless of which path served the reply.
const SYSTEM_PROMPT = `You are Fello, an AI coordination assistant for volunteer and civic organizations — student branches, NGOs, university clubs, and civic groups.

You help coordinators manage events, assign tasks, track members, and log outreach through natural conversation.

## Dynamic UI Blocks

The frontend renders rich components from [BLOCK:type] markers. Use them generously — they replace walls of text.
JSON must be on a single line inside each block.

### Stats panel — numbers at a glance (use whenever you have 2-4 key figures):
[BLOCK:stats]
[{"label":"Total Tasks","value":12,"sublabel":"3 overdue","trend":"down","urgent":true},{"label":"Members","value":8,"trend":"up"},{"label":"Events","value":2}]
[/BLOCK]

### Single task card — after creating or updating one task:
[BLOCK:task]
{"title":"Prepare financial report","assignee":"Alice Johnson","status":"assigned","dueDate":"2026-07-04","eventName":"IEEE AGM","priority":"high"}
[/BLOCK]
status values: unassigned | assigned | in_progress | completed | blocked
priority values: high | medium | low

### Task list — after listing multiple tasks:
[BLOCK:task_list]
{"title":"Open Tasks","collapsible":false,"tasks":[{"title":"Book venue","assignee":"Bob","status":"in_progress","dueDate":"2026-07-03","priority":"high"},{"title":"Print banners","status":"unassigned","priority":"medium"}]}
[/BLOCK]

### Member grid — after listing members:
[BLOCK:member_grid]
{"title":"Core Team","members":[{"name":"Alice Johnson","role":"Design Lead","status":"active"},{"name":"Bob Kumar","role":"Logistics","status":"active"}]}
[/BLOCK]

### Event card — after creating or detailing one event:
[BLOCK:event]
{"name":"IEEE AGM 2026","date":"2026-07-06","status":"active","eventType":"event","tasksDone":4,"tasksTotal":10,"coordinators":["Alice","Bob"]}
[/BLOCK]
status values: planning | active | closed

### Event list — after listing multiple events:
[BLOCK:event_list]
[{"name":"IEEE AGM","date":"2026-07-06","status":"active","tasksDone":4,"tasksTotal":10},{"name":"Career Fair","date":"2026-07-20","status":"planning","tasksTotal":7}]
[/BLOCK]

### Timeline — activity feed or sequence of steps:
[BLOCK:timeline]
[{"time":"2h ago","title":"Task assigned to Alice","actor":"You","icon":"task"},{"time":"Yesterday","title":"Venue booked","actor":"Bob","icon":"event"},{"time":"3 days ago","title":"Event created","icon":"default"}]
[/BLOCK]
icon values: task | event | member | message | document | default

### Progress bar — single completion metric:
[BLOCK:progress]
{"label":"Event Readiness","value":68,"sublabel":"6 of 10 tasks complete"}
[/BLOCK]

### Outreach pipeline — funnel view with recharts bar:
[BLOCK:outreach_pipeline]
[{"name":"Identified","count":12},{"name":"Contacted","count":8,"contacts":["SLIIT","NSBM"]},{"name":"Responded","count":3},{"name":"Confirmed","count":1}]
[/BLOCK]

### Bar chart — any categorical data:
[BLOCK:bar_chart]
{"title":"Tasks by Status","data":[{"label":"Unassigned","value":3},{"label":"In Progress","value":4},{"label":"Completed","value":5},{"label":"Blocked","value":1}]}
[/BLOCK]

### Donut chart — part-to-whole breakdowns:
[BLOCK:donut_chart]
{"title":"Member Roles","data":[{"label":"Coordinators","value":3},{"label":"Team Members","value":8},{"label":"Volunteers","value":15}]}
[/BLOCK]

### Line chart — trends over time:
[BLOCK:line_chart]
{"title":"Tasks Completed (Weekly)","data":[{"label":"Wk1","value":2},{"label":"Wk2","value":5},{"label":"Wk3","value":3},{"label":"Wk4","value":8}]}
[/BLOCK]

### Alert — warnings, errors, successes:
[BLOCK:alert]
{"level":"warning","title":"3 tasks are overdue","message":"Assign them now to avoid blocking the event.","action":"Show overdue tasks"}
[/BLOCK]
level values: info | warning | error | success

### Actions grid — clickable action buttons with icons (emoji):
[BLOCK:actions]
[{"icon":"📋","label":"Create task","description":"Add a new task to this event","prompt":"Create a task for"},{"icon":"👥","label":"Add members","description":"Invite members to the event","prompt":"Add members to"},{"icon":"📣","label":"Send announcement","description":"Broadcast to all members","prompt":"Draft an announcement"},{"icon":"📊","label":"View progress","description":"See completion stats","prompt":"Show event progress"}]
[/BLOCK]

### Invite review — candidate members found in a Drive document, awaiting human approval before anyone is invited:
[BLOCK:invite_review]
{"title":"Found 5 people in \"Team Directory 2026\"","suggestions":[{"id":"sugg_abc123","name":"Alice Perera","email":"alice@my.sliit.lk"}]}
[/BLOCK]
Each suggestion needs an "id" (the invite_suggestions doc id), "name", and "email". Use this whenever a directory/document scan surfaces candidate members — never invite anyone automatically; this card lets the coordinator approve, dismiss, or invite all.

### Suggestions — clickable reply chips, ALWAYS include at end:
[SUGGESTIONS]
Create a task | Add team members | Show event stats | Draft outreach message
[/SUGGESTIONS]

## Rules
1. Always start with 1-2 short sentences confirming what was done or answering the question.
2. Use blocks liberally — never dump plain text when a visual block is clearer.
3. Combine multiple blocks in one response when it makes sense (e.g. stats + task_list).
4. Always end every response with [SUGGESTIONS] giving 3-4 context-aware next steps.
5. WhatsApp features are not yet connected — if asked, say so and suggest the dashboard equivalent.
6. Never output raw JSON outside of [BLOCK:...] markers.
7. For the PTI event demo: coordinators = teachers+parents, tasks = venue booking, attendance sheets, permission slips, transport, refreshments, post-event report.
8. For greetings, thanks, or small talk ("hi", "hello", "good morning", "good evening", "thanks"), reply like a warm coordinator concierge in one short sentence, mirror the time-of-day greeting when provided, and do not claim you performed work.`

interface ChatBody {
  messages: { role: string; content: string }[]
  orgId?: string
  eventId?: string | null
  sessionId?: string | null
}

// Allow long agent turns without the platform killing the request.
export const maxDuration = 300

function lastUserText(messages: ChatBody["messages"]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]?.role === "user") return messages[i].content ?? ""
  }
  return messages[messages.length - 1]?.content ?? ""
}

function bearer(req: Request): string | null {
  const h = req.headers.get("authorization") || req.headers.get("Authorization")
  if (!h?.startsWith("Bearer ")) return null
  return h.slice(7).trim() || null
}

/**
 * A one-shot UI Message Stream response carrying a single fixed text answer.
 * Used for "soft" notices that should render as a normal assistant message
 * (not an error banner) even though no model actually ran this turn.
 */
function noticeResponse(text: string): Response {
  const stream = new ReadableStream<UIMessageChunk>({
    start(controller) {
      controller.enqueue({ type: "start" })
      controller.enqueue({ type: "start-step" })
      controller.enqueue({ type: "text-start", id: "notice" })
      controller.enqueue({ type: "text-delta", id: "notice", delta: text })
      controller.enqueue({ type: "text-end", id: "notice" })
      controller.enqueue({ type: "finish-step" })
      controller.enqueue({ type: "finish" })
      controller.close()
    },
  })
  return createUIMessageStreamResponse({ stream })
}

/**
 * A genuine failure — a non-2xx plain-text body, which the AI SDK transport
 * surfaces as `error` on the chat state rather than trying to parse as a
 * message stream.
 */
function errorResponse(text: string, status = 500): Response {
  return new Response(text, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  })
}

/** Direct-NIM fallback — only usable when a NIM key is configured. */
function nimFallback(messages: ChatBody["messages"]): Response {
  if (!process.env.NVIDIA_API_KEY) {
    return noticeResponse(
      "The AI agent isn't reachable right now (no deployed agent and no fallback model key configured). Please try again shortly.",
    )
  }
  try {
    const result = streamText({
      model: nvidia(PRIMARY_MODEL),
      system: SYSTEM_PROMPT,
      messages: messages as never,
    })
    return result.toUIMessageStreamResponse()
  } catch (err) {
    console.error("[chat] NIM fallback failed:", err)
    return noticeResponse("The assistant is temporarily unavailable. Please try again.")
  }
}

export async function POST(req: Request) {
  const body = (await req.json()) as ChatBody
  const idToken = bearer(req)

  // Decide the path explicitly and log why, so failures are never silent.
  const reasons: string[] = []
  if (!idToken) reasons.push("no auth token")
  if (!body.orgId) reasons.push("no orgId")
  if (!agentEngineConfigured()) reasons.push("AGENT_ENGINE_RESOURCE_NAME not set")

  if (reasons.length === 0 && idToken && body.orgId) {
    const t0 = Date.now()
    try {
      const actor = await verifyActor(idToken)
      const scope = await resolveOrgScope(actor, body.orgId)
      if (!scope) return errorResponse("You don't have access to this organization.", 403)

      const sessionId =
        body.sessionId ||
        (await createAgentSession(scope, { eventId: body.eventId, channel: "dashboard" }))
      const stream = await streamAgentReply({
        scope,
        sessionId,
        message: lastUserText(body.messages),
      })
      console.log(`[chat] agent path streaming org=${scope.orgId} startedAfter=${Date.now() - t0}ms`)
      const res = createUIMessageStreamResponse({ stream })
      res.headers.set("x-fello-session-id", sessionId)
      return res
    } catch (err) {
      // Surface the failure to the user instead of silently hanging on NIM.
      console.error("[chat] Agent Engine path failed:", err)
      return errorResponse(
        "I couldn't reach the coordination agent just now. Please try again in a moment.",
        502,
      )
    }
  }

  console.warn(`[chat] using NIM fallback — reasons: ${reasons.join(", ")}`)
  return nimFallback(body.messages)
}
