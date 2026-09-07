"use client"

/**
 * Dynamic UI renderer — AI returns [BLOCK:type] JSON, this renders it as live shadcn + recharts components.
 */

import * as React from "react"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line,
} from "recharts"
import {
  CheckCircle2Icon, CircleDashedIcon, CircleDotIcon, ZapIcon, AlertCircleIcon,
  CalendarIcon, UserIcon, UsersIcon, TrendingUpIcon, TrendingDownIcon, MinusIcon,
  FileTextIcon, MessageCircleIcon, ActivityIcon, ArrowRightIcon, ClockIcon,
  SparklesIcon, WrenchIcon, ExternalLinkIcon, CopyIcon, CheckIcon, PencilIcon,
  XIcon,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { GoogleFormsIcon, GoogleDocsIcon, GoogleSheetsIcon, GoogleSlidesIcon } from "@/components/icons/google-icons"
import { RoundedList, RoundedListItem } from "@/components/ui/rounded-list"
import { cn } from "@/lib/utils"

// ─── Types ────────────────────────────────────────────────────────────────────

type TaskStatus = "unassigned" | "assigned" | "in_progress" | "completed" | "blocked"
type EventStatus = "planning" | "active" | "closed"

interface StatItem        { label: string; value: string | number; sublabel?: string; trend?: "up" | "down" | "neutral"; urgent?: boolean }
interface TaskItem        { title: string; assignee?: string; status: TaskStatus; dueDate?: string; priority?: "high" | "medium" | "low" }
interface MemberItem      { name: string; role?: string; phone?: string; status?: "active" | "inactive" | "pending" }
interface EventSummary    { name: string; date?: string; status?: EventStatus; tasksDone?: number; tasksTotal?: number }
interface TimelineItem    { time: string; title: string; description?: string; actor?: string; icon?: "task" | "event" | "member" | "message" | "document" | "default" }
interface OutreachStage   { name: string; count: number; contacts?: string[] }
interface BarData         { label: string; value: number }
interface PieData         { label: string; value: number }
interface LinePoint       { label: string; value: number }
interface ActionItem      { icon?: string; label: string; description?: string; prompt: string }
interface FormFieldDef    { name: string; label: string; placeholder?: string; type?: "text" | "textarea"; required?: boolean }
interface InviteSuggestionItem { id: string; name: string; email: string }

export type Block =
  | { type: "text";               content: string }
  | { type: "stats";              items: StatItem[] }
  | { type: "task";               title: string; assignee?: string; status: TaskStatus; dueDate?: string; eventName?: string; priority?: "high" | "medium" | "low" }
  | { type: "task_list";          title?: string; tasks: TaskItem[]; collapsible?: boolean }
  | { type: "member_grid";        members: MemberItem[]; title?: string }
  | { type: "event";              name: string; date?: string; status?: EventStatus; eventType?: "event"|"project"; progress?: number; tasksDone?: number; tasksTotal?: number; coordinators?: string[] }
  | { type: "event_list";         events: EventSummary[] }
  | { type: "timeline";           items: TimelineItem[] }
  | { type: "progress";           label: string; value: number; sublabel?: string }
  | { type: "outreach_pipeline";  stages: OutreachStage[] }
  | { type: "bar_chart";          title?: string; data: BarData[] }
  | { type: "donut_chart";        title?: string; data: PieData[] }
  | { type: "line_chart";         title?: string; data: LinePoint[] }
  | { type: "alert";              level: "info"|"warning"|"error"|"success"; title: string; message?: string; action?: string }
  | { type: "actions";            items: ActionItem[] }
  | { type: "suggestions";        items: string[] }
  | { type: "thinking";           text: string }
  | { type: "tool_call";          name: string; status?: "running" | "done" | "error" }
  | { type: "form";               title?: string; description?: string; fields: FormFieldDef[]; submitLabel?: string; action?: string }
  | { type: "form_result";        title?: string; responderUri?: string; editUri?: string; kind?: "form" | "doc" | "sheet" | "slides" }
  | { type: "invite_review";      title?: string; suggestions: InviteSuggestionItem[] }

// ─── Parser ───────────────────────────────────────────────────────────────────

// Defense-in-depth against leaked chain-of-thought that slips past
// lib/agent-engine.ts's reasoning classification (some models don't mark
// thought parts reliably): a raw `{"text":"..."}` JSON envelope — the shape
// the model uses internally for a would-be [BLOCK:...] payload — optionally
// followed by a stray, opener-less closing tag. Never render this verbatim.
const LEAKED_JSON_ENVELOPE_RE = /\{"text":"(?:[^"\\]|\\.)*"\}\s*(?:\[\/(?:BLOCK|CARD)\])?/g
const ORPHAN_CLOSER_RE = /\[\/(?:BLOCK|CARD)\]/g

function stripLeakedDebris(text: string): string {
  return text.replace(LEAKED_JSON_ENVELOPE_RE, "").replace(ORPHAN_CLOSER_RE, "").trim()
}

export function parseBlocks(content: string): Block[] {
  const blocks: Block[] = []
  // Tolerant of a missing leading "[" or trailing "]" on the SUGGESTIONS markers,
  // which the model occasionally emits malformed.
  const pattern = /\[(?:BLOCK|CARD):(\w+)\]([\s\S]*?)\[\/(?:BLOCK|CARD)\]|\[?SUGGESTIONS\]([\s\S]*?)\[\/SUGGESTIONS\]?/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = pattern.exec(content)) !== null) {
    if (match.index > lastIndex) {
      const text = content.slice(lastIndex, match.index).trim()
      if (text) blocks.push({ type: "text", content: text })
    }

    if (match[1]) {
      try {
        const raw = JSON.parse(match[2].trim())
        const t = match[1]
        if      (t === "stats")              blocks.push({ type: "stats", items: raw })
        else if (t === "task")               blocks.push({ type: "task", ...raw })
        else if (t === "task_list")          blocks.push({ type: "task_list", ...raw })
        else if (t === "member_grid" || t === "members") blocks.push({ type: "member_grid", members: Array.isArray(raw) ? raw : (raw.members ?? []), title: raw.title })
        else if (t === "event")              blocks.push({ type: "event", ...raw })
        else if (t === "event_list")         blocks.push({ type: "event_list", events: Array.isArray(raw) ? raw : (raw.events ?? []) })
        else if (t === "timeline")           blocks.push({ type: "timeline", items: Array.isArray(raw) ? raw : (raw.items ?? []) })
        else if (t === "progress")           blocks.push({ type: "progress", ...raw })
        else if (t === "outreach_pipeline")  blocks.push({ type: "outreach_pipeline", stages: Array.isArray(raw) ? raw : (raw.stages ?? []) })
        else if (t === "bar_chart")          blocks.push({ type: "bar_chart", title: raw.title, data: raw.data ?? raw })
        else if (t === "donut_chart")        blocks.push({ type: "donut_chart", title: raw.title, data: raw.data ?? raw })
        else if (t === "line_chart")         blocks.push({ type: "line_chart", title: raw.title, data: raw.data ?? raw })
        else if (t === "alert")              blocks.push({ type: "alert", ...raw })
        else if (t === "actions")            blocks.push({ type: "actions", items: Array.isArray(raw) ? raw : (raw.items ?? []) })
        else if (t === "thinking")           blocks.push({ type: "thinking", text: typeof raw === "string" ? raw : (raw.text ?? "") })
        else if (t === "tool_call")          blocks.push({ type: "tool_call", name: raw.name, status: raw.status })
        else if (t === "form")               blocks.push({ type: "form", title: raw.title, description: raw.description, fields: raw.fields ?? [], submitLabel: raw.submitLabel, action: raw.action })
        else if (t === "form_result")        blocks.push({ type: "form_result", title: raw.title, responderUri: raw.responderUri ?? raw.responder_uri, editUri: raw.editUri ?? raw.edit_uri, kind: raw.kind })
        else if (t === "invite_review")      blocks.push({ type: "invite_review", title: raw.title, suggestions: Array.isArray(raw) ? raw : (raw.suggestions ?? []) })
        else                                 blocks.push({ type: "text", content: match[2].trim() })
      } catch {
        blocks.push({ type: "text", content: match[2].trim() })
      }
    } else if (match[3] !== undefined) {
      const items = match[3].split("|").map(s => s.trim()).filter(Boolean)
      if (items.length) blocks.push({ type: "suggestions", items })
    }

    lastIndex = match.index + match[0].length
  }

  if (lastIndex < content.length) {
    const text = content.slice(lastIndex).trim()
    if (text) blocks.push({ type: "text", content: text })
  }

  const cleaned = blocks
    .map((b) => (b.type === "text" ? { ...b, content: stripLeakedDebris(b.content) } : b))
    .filter((b) => b.type !== "text" || b.content.length > 0)

  return extractFormResults(cleaned)
}

// Detect bare Google Forms responder/edit links in plain text and lift them into
// a form_result card with buttons — so even an agent that just prints the links
// (no [BLOCK:form_result] marker) renders nicely.
const RESPONDER_RE = /https:\/\/docs\.google\.com\/forms\/d\/e\/[\w-]+\/viewform[^\s)]*/
const EDIT_RE = /https:\/\/docs\.google\.com\/forms\/d\/[\w-]+\/edit[^\s)]*/

function extractFormResults(blocks: Block[]): Block[] {
  const out: Block[] = []
  for (const b of blocks) {
    if (b.type !== "text") { out.push(b); continue }
    const responder = b.content.match(RESPONDER_RE)?.[0]
    const edit = b.content.match(EDIT_RE)?.[0]
    if (!responder && !edit) { out.push(b); continue }

    // Strip the link lines (and now-empty "Form link:" / "Edit link:" labels).
    const cleaned = b.content
      .split("\n")
      .filter((line) => !RESPONDER_RE.test(line) && !EDIT_RE.test(line))
      .filter((line) => !/^\s*(form|responder|share|edit)\s*link\b.*:\s*$/i.test(line))
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim()

    if (cleaned) out.push({ type: "text", content: cleaned })
    out.push({ type: "form_result", responderUri: responder, editUri: edit })
  }
  return out
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TASK_CFG: Record<TaskStatus, { label: string; Icon: React.ElementType; stripe: string; badge: string }> = {
  unassigned:  { label: "Unassigned",  Icon: CircleDashedIcon, stripe: "border-l-border",       badge: "outline" },
  assigned:    { label: "Assigned",    Icon: CircleDotIcon,    stripe: "border-l-primary/50",   badge: "secondary" },
  in_progress: { label: "In Progress", Icon: ZapIcon,          stripe: "border-l-primary",      badge: "default" },
  completed:   { label: "Completed",   Icon: CheckCircle2Icon, stripe: "border-l-muted",        badge: "secondary" },
  blocked:     { label: "Blocked",     Icon: AlertCircleIcon,  stripe: "border-l-destructive",  badge: "destructive" },
}

const PRIORITY_DOT: Record<string, string> = { high: "bg-destructive", medium: "bg-primary", low: "bg-muted-foreground/40" }
const TL_ICONS: Record<string, React.ElementType> = { task: CheckCircle2Icon, event: CalendarIcon, member: UserIcon, message: MessageCircleIcon, document: FileTextIcon, default: ActivityIcon }

function ini(name: string) { return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) }

// recharts theme hook — reads CSS variables at runtime so charts match the shadcn theme
function useChartColors() {
  const [colors, setColors] = React.useState({ primary: "#6366f1", muted: "#e2e8f0", destructive: "#ef4444", secondary: "#94a3b8" })
  React.useLayoutEffect(() => {
    const s = getComputedStyle(document.documentElement)
    const get = (v: string) => {
      const val = s.getPropertyValue(v).trim()
      return val ? `oklch(${val})` : undefined
    }
    setColors(c => ({
      primary:     get("--primary")     ?? c.primary,
      muted:       get("--muted")       ?? c.muted,
      destructive: get("--destructive") ?? c.destructive,
      secondary:   get("--secondary")   ?? c.secondary,
    }))
  }, [])
  return colors
}

// ─── Stats Block ──────────────────────────────────────────────────────────────

function StatsBlock({ items }: { items: StatItem[] }) {
  return (
    <div className={cn("grid gap-2 my-2", items.length <= 2 ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-4")}>
      {items.map((s, i) => (
        <div key={i} className={cn("rounded-xl border bg-card p-3 flex flex-col gap-1 shadow-xs", s.urgent && "border-destructive/40 bg-destructive/5")}>
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{s.label}</span>
          <div className="flex items-end gap-1.5">
            <span className={cn("text-2xl font-bold leading-none tracking-tight", s.urgent && "text-destructive")}>{s.value}</span>
            {s.trend === "up"      && <TrendingUpIcon   className="size-3.5 text-primary mb-0.5" />}
            {s.trend === "down"    && <TrendingDownIcon  className="size-3.5 text-destructive mb-0.5" />}
            {s.trend === "neutral" && <MinusIcon         className="size-3 text-muted-foreground mb-0.5" />}
          </div>
          {s.sublabel && <span className={cn("text-[10px] leading-none", s.urgent ? "text-destructive/80" : "text-muted-foreground")}>{s.sublabel}</span>}
        </div>
      ))}
    </div>
  )
}

// ─── Task Block ───────────────────────────────────────────────────────────────

function TaskBlock({ title, assignee, status, dueDate, eventName, priority, onAction }: Block & { type: "task" } & { onAction?: (p: string) => void }) {
  const c = TASK_CFG[status] ?? TASK_CFG.unassigned
  const Icon = c.Icon
  return (
    <div className={cn("rounded-xl border-l-[3px] border bg-card shadow-xs overflow-hidden my-2", c.stripe)}>
      <div className="px-4 py-3 flex flex-col gap-2">
        <div className="flex items-start gap-2 justify-between">
          <div className="flex items-center gap-2 min-w-0">
            {priority && <span className={cn("size-1.5 rounded-full shrink-0 mt-0.5", PRIORITY_DOT[priority])} />}
            <span className="text-sm font-semibold text-foreground leading-snug">{title}</span>
          </div>
          <Badge variant={c.badge as any} className="shrink-0 gap-1 text-[10px]"><Icon className="size-3" />{c.label}</Badge>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {assignee
            ? <span className="flex items-center gap-1.5"><Avatar className="size-4"><AvatarFallback className="text-[9px] bg-primary/10 text-primary">{ini(assignee)}</AvatarFallback></Avatar>{assignee}</span>
            : <span className="flex items-center gap-1"><UserIcon className="size-3" />Unassigned</span>}
          {dueDate    && <span className="flex items-center gap-1"><CalendarIcon className="size-3" />{dueDate}</span>}
          {eventName  && <span className="flex items-center gap-1 opacity-60"><ArrowRightIcon className="size-3" />{eventName}</span>}
        </div>
      </div>
      {onAction && status !== "completed" && (
        <div className="border-t border-border/60 flex divide-x divide-border/60">
          <button onClick={() => onAction(`Mark task "${title}" as completed`)} className="flex-1 py-2 text-[11px] text-muted-foreground hover:bg-muted/40 hover:text-foreground transition-colors">Mark complete</button>
          <button onClick={() => onAction(`Reassign task "${title}"`)} className="flex-1 py-2 text-[11px] text-muted-foreground hover:bg-muted/40 hover:text-foreground transition-colors">Reassign</button>
        </div>
      )}
    </div>
  )
}

// ─── Task List Block ──────────────────────────────────────────────────────────

function TaskListBlock({ title, tasks, collapsible, onAction }: { title?: string; tasks: TaskItem[]; collapsible?: boolean; onAction?: (p: string) => void }) {
  if (!tasks?.length) return null
  const order: TaskStatus[] = ["blocked", "in_progress", "assigned", "unassigned", "completed"]
  const sorted = [...tasks].sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status))

  const rows = (
    <div className="divide-y divide-border/40">
      {sorted.map((t, i) => {
        const c = TASK_CFG[t.status] ?? TASK_CFG.unassigned
        const Icon = c.Icon
        return (
          <div key={i} className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted/20 transition-colors">
            <Icon className={cn("size-3.5 shrink-0", c.stripe.replace("border-l-", "text-").replace("/50", ""))} />
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-foreground truncate">{t.title}</div>
              <div className="flex items-center gap-2 mt-0.5">
                {t.assignee && <span className="text-[10px] text-muted-foreground">{t.assignee}</span>}
                {t.dueDate  && <span className="text-[10px] text-muted-foreground flex items-center gap-0.5"><ClockIcon className="size-2.5" />{t.dueDate}</span>}
              </div>
            </div>
            {t.priority && <span className={cn("size-1.5 rounded-full shrink-0", PRIORITY_DOT[t.priority])} />}
          </div>
        )
      })}
    </div>
  )

  if (collapsible) return (
    <Accordion type="single" collapsible className="my-2">
      <AccordionItem value="t" className="rounded-xl border bg-card shadow-xs overflow-hidden">
        <AccordionTrigger className="px-3 py-2.5 text-xs font-semibold hover:no-underline">
          <span className="flex items-center gap-2">{title ?? "Tasks"}<Badge variant="secondary" className="text-[10px]">{tasks.length}</Badge></span>
        </AccordionTrigger>
        <AccordionContent className="pb-0 border-t border-border/40">{rows}</AccordionContent>
      </AccordionItem>
    </Accordion>
  )

  return (
    <div className="my-2 rounded-xl border bg-card shadow-xs overflow-hidden">
      {title && (
        <div className="flex items-center justify-between px-3 py-2 border-b border-border/60">
          <span className="text-xs font-semibold text-foreground">{title}</span>
          <Badge variant="secondary" className="text-[10px]">{tasks.length}</Badge>
        </div>
      )}
      {rows}
    </div>
  )
}

// ─── Member Grid Block ────────────────────────────────────────────────────────

function MemberGridBlock({ members, title }: { members: MemberItem[]; title?: string }) {
  if (!members?.length) return null
  return (
    <div className="my-2">
      {title && <div className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground mb-2 px-0.5">{title}</div>}
      <div className="grid grid-cols-2 gap-2">
        {members.map((m, i) => (
          <div key={i} className="flex items-center gap-2.5 rounded-xl border bg-card px-3 py-2.5 shadow-xs hover:bg-muted/20 transition-colors">
            <Avatar className="size-8 shrink-0">
              <AvatarFallback className="text-xs font-semibold bg-primary/10 text-primary">{ini(m.name)}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-foreground truncate">{m.name}</div>
              {m.role && <div className="text-[10px] text-muted-foreground truncate">{m.role}</div>}
            </div>
            {m.status && <span className={cn("size-1.5 rounded-full shrink-0", m.status === "active" ? "bg-primary" : m.status === "pending" ? "bg-muted-foreground/40" : "bg-muted-foreground/20")} />}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Event Block ──────────────────────────────────────────────────────────────

function EventBlock({ name, date, status, eventType, progress, tasksDone, tasksTotal, coordinators, onAction }: Block & { type: "event" } & { onAction?: (p: string) => void }) {
  const pct = progress ?? (tasksTotal ? Math.round((tasksDone ?? 0) / tasksTotal * 100) : undefined)
  const sv = status === "active" ? "default" : status === "closed" ? "secondary" : "outline"
  return (
    <div className="my-2 rounded-xl border bg-card shadow-xs overflow-hidden">
      <div className="px-4 pt-3 pb-3 flex flex-col gap-2.5">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="text-sm font-bold text-foreground">{name}</div>
            {date && <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5"><CalendarIcon className="size-3" />{date}</div>}
          </div>
          <div className="flex gap-1.5 shrink-0">
            {eventType && <Badge variant="outline" className="text-[10px] capitalize">{eventType}</Badge>}
            {status    && <Badge variant={sv as any} className="text-[10px] capitalize">{status}</Badge>}
          </div>
        </div>
        {pct !== undefined && (
          <div className="space-y-1.5">
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>Progress</span>
              <span>{tasksDone !== undefined ? `${tasksDone}${tasksTotal ? ` / ${tasksTotal} tasks` : ""}` : `${pct}%`}</span>
            </div>
            <Progress value={pct} className="h-1.5" />
          </div>
        )}
        {coordinators?.length ? (
          <div className="flex items-center gap-1.5 flex-wrap">
            <UsersIcon className="size-3 text-muted-foreground" />
            {coordinators.map((c, i) => <span key={i} className="text-[10px] bg-muted/60 text-muted-foreground rounded-full px-2 py-0.5">{c}</span>)}
          </div>
        ) : null}
      </div>
      {onAction && (
        <div className="border-t border-border/60 flex divide-x divide-border/60">
          <button onClick={() => onAction(`Show all tasks for ${name}`)} className="flex-1 py-2 text-[11px] text-muted-foreground hover:bg-muted/40 hover:text-foreground transition-colors">View tasks</button>
          <button onClick={() => onAction(`List team members for ${name}`)} className="flex-1 py-2 text-[11px] text-muted-foreground hover:bg-muted/40 hover:text-foreground transition-colors">View team</button>
        </div>
      )}
    </div>
  )
}

// ─── Event List Block ─────────────────────────────────────────────────────────

function EventListBlock({ events, onAction }: { events: EventSummary[]; onAction?: (p: string) => void }) {
  if (!events?.length) return null
  return (
    <div className="my-2 rounded-xl border bg-card shadow-xs overflow-hidden">
      <div className="px-3 py-2 border-b border-border/60"><span className="text-xs font-semibold">Events</span></div>
      {events.map((ev, i) => {
        const pct = ev.tasksTotal ? Math.round((ev.tasksDone ?? 0) / ev.tasksTotal * 100) : undefined
        const sv = ev.status === "active" ? "default" : ev.status === "closed" ? "secondary" : "outline"
        return (
          <div key={i} className="flex items-center gap-3 px-3 py-2.5 border-b border-border/40 last:border-b-0 hover:bg-muted/20 transition-colors">
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-foreground truncate">{ev.name}</div>
              {ev.date && <div className="text-[10px] text-muted-foreground">{ev.date}</div>}
              {pct !== undefined && <Progress value={pct} className="h-1 mt-1.5 w-20" />}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {ev.tasksTotal !== undefined && <span className="text-[10px] text-muted-foreground">{ev.tasksDone ?? 0}/{ev.tasksTotal}</span>}
              {ev.status && <Badge variant={sv as any} className="text-[10px] capitalize">{ev.status}</Badge>}
              {onAction && <button onClick={() => onAction(`Show details for ${ev.name}`)} className="text-muted-foreground hover:text-foreground transition-colors"><ArrowRightIcon className="size-3.5" /></button>}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Timeline Block ───────────────────────────────────────────────────────────

function TimelineBlock({ items }: { items: TimelineItem[] }) {
  if (!items?.length) return null
  return (
    <div className="my-2">
      <div className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground mb-2 px-0.5">Activity</div>
      <div className="relative">
        <div className="absolute left-[13px] top-4 bottom-4 w-px bg-border/60" />
        <div className="space-y-3">
          {items.map((item, i) => {
            const Icon = TL_ICONS[item.icon ?? "default"]
            return (
              <div key={i} className="flex gap-3">
                <div className="size-7 rounded-full border bg-card flex items-center justify-center shrink-0 z-10 shadow-xs">
                  <Icon className="size-3 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0 pt-0.5">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="text-xs font-medium text-foreground">{item.title}</span>
                    <span className="text-[10px] text-muted-foreground">{item.time}</span>
                  </div>
                  {item.description && <div className="text-[11px] text-muted-foreground mt-0.5">{item.description}</div>}
                  {item.actor       && <div className="text-[10px] text-muted-foreground/60 mt-0.5">by {item.actor}</div>}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── Progress Block ───────────────────────────────────────────────────────────

function ProgressBlock({ label, value, sublabel }: { label: string; value: number; sublabel?: string }) {
  return (
    <div className="my-2 rounded-xl border bg-card px-4 py-3 shadow-xs space-y-2">
      <div className="flex justify-between items-center">
        <span className="text-xs font-semibold text-foreground">{label}</span>
        <span className="text-sm font-bold text-primary">{Math.round(value)}%</span>
      </div>
      <Progress value={value} className="h-2" />
      {sublabel && <div className="text-[10px] text-muted-foreground">{sublabel}</div>}
    </div>
  )
}

// ─── Outreach Pipeline Block ──────────────────────────────────────────────────

function OutreachPipelineBlock({ stages }: { stages: OutreachStage[] }) {
  if (!stages?.length) return null
  const { primary, muted } = useChartColors()
  const data = stages.map(s => ({ name: s.name, value: s.count }))
  return (
    <div className="my-2 rounded-xl border bg-card shadow-xs overflow-hidden">
      <div className="px-3 py-2 border-b border-border/60"><span className="text-xs font-semibold">Outreach Pipeline</span></div>
      <div className="px-3 pt-3 pb-1">
        <ResponsiveContainer width="100%" height={80}>
          <BarChart data={data} barCategoryGap="30%">
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={muted} strokeOpacity={0.4} />
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: "currentColor" }} tickLine={false} axisLine={false} className="text-muted-foreground" />
            <YAxis hide />
            <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid var(--border)" }} />
            <Bar dataKey="value" fill={primary} radius={[4, 4, 0, 0]} maxBarSize={40} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      {stages.some(s => s.contacts?.length) && (
        <div className="border-t border-border/60 px-3 py-2 space-y-0.5">
          {stages.filter(s => s.contacts?.length).map((s, i) => (
            <div key={i} className="text-[10px] text-muted-foreground">
              <span className="font-medium text-foreground">{s.name}:</span> {s.contacts!.join(", ")}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Bar Chart Block ──────────────────────────────────────────────────────────

function BarChartBlock({ title, data }: { title?: string; data: BarData[] }) {
  if (!data?.length) return null
  const { primary, muted } = useChartColors()
  const chartData = data.map(d => ({ name: d.label, value: d.value }))
  return (
    <div className="my-2 rounded-xl border bg-card shadow-xs overflow-hidden">
      {title && <div className="px-3 py-2 border-b border-border/60"><span className="text-xs font-semibold">{title}</span></div>}
      <div className="px-2 pt-3 pb-2">
        <ResponsiveContainer width="100%" height={120}>
          <BarChart data={chartData} barCategoryGap="25%">
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={muted} strokeOpacity={0.4} />
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: "currentColor" }} tickLine={false} axisLine={false} className="text-muted-foreground" />
            <YAxis tick={{ fontSize: 10, fill: "currentColor" }} tickLine={false} axisLine={false} className="text-muted-foreground" width={24} />
            <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid var(--border)" }} />
            <Bar dataKey="value" fill={primary} radius={[4, 4, 0, 0]} maxBarSize={48} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// ─── Donut Chart Block ────────────────────────────────────────────────────────

function DonutChartBlock({ title, data }: { title?: string; data: PieData[] }) {
  if (!data?.length) return null
  const { primary, secondary, muted, destructive } = useChartColors()
  const COLORS = [primary, secondary, muted, destructive]
  const total = data.reduce((s, d) => s + d.value, 0)

  return (
    <div className="my-2 rounded-xl border bg-card shadow-xs overflow-hidden">
      {title && <div className="px-3 py-2 border-b border-border/60"><span className="text-xs font-semibold">{title}</span></div>}
      <div className="flex items-center gap-2 px-3 py-3">
        <div className="shrink-0">
          <ResponsiveContainer width={100} height={100}>
            <PieChart>
              <Pie data={data.map(d => ({ name: d.label, value: d.value }))} cx="50%" cy="50%" innerRadius={28} outerRadius={44} dataKey="value" strokeWidth={0}>
                {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex flex-col gap-1.5">
          {data.map((d, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="size-2 rounded-full shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
              <span className="text-[11px] text-foreground">{d.label}</span>
              <span className="text-[11px] text-muted-foreground ml-auto pl-2">{d.value} · {Math.round(d.value / total * 100)}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Line Chart Block ─────────────────────────────────────────────────────────

function LineChartBlock({ title, data }: { title?: string; data: LinePoint[] }) {
  if (!data?.length) return null
  const { primary, muted } = useChartColors()
  const chartData = data.map(d => ({ name: d.label, value: d.value }))
  return (
    <div className="my-2 rounded-xl border bg-card shadow-xs overflow-hidden">
      {title && <div className="px-3 py-2 border-b border-border/60"><span className="text-xs font-semibold">{title}</span></div>}
      <div className="px-2 pt-3 pb-2">
        <ResponsiveContainer width="100%" height={100}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke={muted} strokeOpacity={0.3} />
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: "currentColor" }} tickLine={false} axisLine={false} className="text-muted-foreground" />
            <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={24} className="text-muted-foreground" />
            <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid var(--border)" }} />
            <Line type="monotone" dataKey="value" stroke={primary} strokeWidth={2} dot={{ fill: primary, r: 3, strokeWidth: 0 }} activeDot={{ r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// ─── Alert Block ─────────────────────────────────────────────────────────────

function AlertBlock({ level, title, message, action, onAction }: { level: string; title: string; message?: string; action?: string; onAction?: (p: string) => void }) {
  return (
    <Alert variant={level === "error" || level === "warning" ? "destructive" : "default"} className="my-2 text-xs">
      <AlertTitle className="text-xs font-semibold">{title}</AlertTitle>
      {message && <AlertDescription className="text-xs mt-0.5">{message}</AlertDescription>}
      {action && onAction && (
        <button onClick={() => onAction(action)} className="text-xs underline underline-offset-2 mt-1 hover:opacity-80 transition-opacity">{action} →</button>
      )}
    </Alert>
  )
}

// ─── Invite Review Block ──────────────────────────────────────────────────────
// Directory-scan candidates awaiting human approval. Buttons don't mutate
// directly (no Firebase auth in this card) — they send a natural-language
// instruction back through the chat, mirroring AlertBlock's action pattern,
// letting the agent's tool call perform the actual invite/dismiss.

function InviteReviewBlock({ title, suggestions, onAction }: { title?: string; suggestions: InviteSuggestionItem[]; onAction?: (p: string) => void }) {
  if (!suggestions?.length) return null
  return (
    <div className="my-2 flex flex-col gap-3 rounded-xl border bg-card p-3 shadow-xs">
      {title && <div className="text-xs font-semibold text-foreground px-0.5">{title}</div>}
      <RoundedList className="gap-0 space-y-0 divide-y divide-border/60 overflow-hidden rounded-lg border">
        {suggestions.map((s, i) => (
          <RoundedListItem
            key={s.id ?? i}
            className={cn(
              "flex items-center gap-2.5 border-0 p-2.5",
              i === 0 && suggestions.length > 1 && "rounded-t-lg rounded-b-none",
              i > 0 && i < suggestions.length - 1 && "rounded-none",
              i === suggestions.length - 1 && suggestions.length > 1 && "rounded-t-none rounded-b-lg",
              suggestions.length === 1 && "rounded-lg"
            )}
          >
            <Avatar className="size-8 shrink-0">
              <AvatarFallback className="text-xs font-semibold bg-primary/10 text-primary">{ini(s.name)}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-foreground truncate">{s.name}</div>
              <div className="text-[10px] text-muted-foreground truncate">{s.email}</div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => onAction?.(`Invite ${s.name} (${s.email})`)}
                aria-label={`Approve ${s.name}`}
                title="Approve"
                className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors"
              >
                <CheckCircle2Icon className="size-4" />
              </button>
              <button
                onClick={() => onAction?.(`Dismiss the invite suggestion for ${s.name} (${s.email})`)}
                aria-label={`Dismiss ${s.name}`}
                title="Dismiss"
                className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
              >
                <XIcon className="size-4" />
              </button>
            </div>
          </RoundedListItem>
        ))}
      </RoundedList>
      <Button
        size="sm"
        variant="outline"
        className="self-start"
        onClick={() => onAction?.(`Invite all ${suggestions.length} people from this list: ${suggestions.map((s) => `${s.name} (${s.email})`).join(", ")}`)}
      >
        <CheckCircle2Icon className="size-3.5" />
        Invite all {suggestions.length}
      </Button>
    </div>
  )
}

// ─── Actions Grid Block ───────────────────────────────────────────────────────

function ActionsBlock({ items, onAction }: { items: ActionItem[]; onAction?: (p: string) => void }) {
  if (!items?.length) return null
  return (
    <div className="my-2 grid grid-cols-2 gap-2">
      {items.map((item, i) => (
        <button key={i} onClick={() => onAction?.(item.prompt)}
          className="flex items-start gap-2.5 rounded-xl border bg-card px-3 py-2.5 text-left hover:bg-muted/30 hover:border-primary/40 transition-all shadow-xs group">
          {item.icon && <span className="text-base leading-none mt-0.5">{item.icon}</span>}
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors">{item.label}</div>
            {item.description && <div className="text-[10px] text-muted-foreground mt-0.5 leading-snug">{item.description}</div>}
          </div>
        </button>
      ))}
    </div>
  )
}

// ─── Thinking Block (collapsible chain-of-thought) ──────────────────────────────

function ThinkingBlock({ text }: { text: string }) {
  // Strip any draft block / suggestion markers the model wrote inside its reasoning
  // so the thinking reads as clean prose, not broken markup.
  const clean = (text ?? "")
    .replace(/\[\/?(?:BLOCK|CARD)(?::\w+)?\]/g, "")
    .replace(/\[?\/?SUGGESTIONS\]?/g, "")
    .trim()
  if (!clean) return null
  return (
    <Accordion type="single" collapsible className="mb-2">
      <AccordionItem value="thinking" className="border-0">
        <AccordionTrigger className="py-1.5 px-2 rounded-lg hover:bg-muted/50 hover:no-underline text-xs text-muted-foreground gap-2 [&>svg]:size-3.5">
          <span className="flex items-center gap-1.5">
            <SparklesIcon className="size-3.5 text-primary/70" />
            Thought for a moment
          </span>
        </AccordionTrigger>
        <AccordionContent className="pb-1">
          <div className="ml-2 border-l-2 border-border/60 pl-3 text-xs leading-relaxed text-muted-foreground/90 whitespace-pre-wrap max-h-64 overflow-y-auto">
            {clean}
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}

// ─── Tool Call Block (themed chip) ──────────────────────────────────────────────

const TOOL_META: Record<string, { label: string; Icon: React.ElementType; brand?: boolean }> = {
  create_google_form:    { label: "Created Google Form",         Icon: GoogleFormsIcon,  brand: true },
  update_google_form:    { label: "Updated Google Form",         Icon: GoogleFormsIcon,  brand: true },
  create_google_doc:     { label: "Created Google Doc",          Icon: GoogleDocsIcon,   brand: true },
  update_google_doc:     { label: "Updated Google Doc",          Icon: GoogleDocsIcon,   brand: true },
  create_google_sheet:   { label: "Created Google Sheet",        Icon: GoogleSheetsIcon, brand: true },
  update_google_sheet:   { label: "Updated Google Sheet",        Icon: GoogleSheetsIcon, brand: true },
  create_google_slides:  { label: "Created Google Slides",       Icon: GoogleSlidesIcon, brand: true },
  update_google_slides:  { label: "Updated Google Slides",       Icon: GoogleSlidesIcon, brand: true },
  create_task:           { label: "Created task",          Icon: CheckCircle2Icon },
  update_task_status:    { label: "Updated task",          Icon: CheckCircle2Icon },
  assign_task:           { label: "Assigned task",         Icon: UserIcon },
  list_tasks:            { label: "Checked tasks",         Icon: CheckCircle2Icon },
  list_members:          { label: "Checked members",       Icon: UsersIcon },
  lookup_member:         { label: "Looked up a member",    Icon: UsersIcon },
  list_upcoming_events:  { label: "Checked events",        Icon: CalendarIcon },
  get_event_details:     { label: "Checked event details", Icon: CalendarIcon },
  find_document:         { label: "Searched documents",    Icon: FileTextIcon },
  log_outreach_attempt:  { label: "Logged outreach",       Icon: MessageCircleIcon },
  draft_outreach_message:{ label: "Drafted outreach",      Icon: MessageCircleIcon },
  send_whatsapp_message: { label: "Sent WhatsApp message", Icon: MessageCircleIcon },
  broadcast_message:     { label: "Broadcast a message",   Icon: MessageCircleIcon },
  create_whatsapp_group: { label: "Created WhatsApp group", Icon: UsersIcon },
  event_health:          { label: "Analyzed event health", Icon: ActivityIcon },
  member_engagement:     { label: "Analyzed workload",     Icon: ActivityIcon },
  outreach_funnel:       { label: "Analyzed outreach",     Icon: ActivityIcon },
}

function humanizeTool(name: string) {
  return name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

function ToolCallBlock({ name, status = "done" }: { name: string; status?: "running" | "done" | "error" }) {
  const meta = TOOL_META[name] ?? { label: humanizeTool(name), Icon: WrenchIcon }
  const Icon = meta.Icon
  return (
    <div className="inline-flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-2.5 py-1.5 text-xs text-foreground/80 mb-1.5 mr-1.5">
      {meta.brand ? (
        <Icon className="size-5 shrink-0" />
      ) : (
        <span className={cn(
          "flex size-5 items-center justify-center rounded-md",
          status === "error" ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary",
        )}>
          <Icon className="size-3.5" />
        </span>
      )}
      <span className="font-medium">{meta.label}</span>
      {status === "done" && <CheckCircle2Icon className="size-3.5 text-primary/70" />}
    </div>
  )
}

// ─── Form Block (fill-in inputs, submit, then freeze) ───────────────────────────

function FormBlock({
  title,
  description,
  fields,
  submitLabel,
  action,
  onAction,
}: {
  title?: string
  description?: string
  fields: FormFieldDef[]
  submitLabel?: string
  action?: string
  onAction?: (prompt: string) => void
}) {
  const [values, setValues] = React.useState<Record<string, string>>({})
  const [submitted, setSubmitted] = React.useState(false)

  const set = (name: string, v: string) => setValues((s) => ({ ...s, [name]: v }))

  const missingRequired = fields.some((f) => f.required && !(values[f.name] || "").trim())

  const submit = () => {
    if (submitted || missingRequired) return
    // Build a clear instruction the agent can act on directly.
    const lines = fields
      .map((f) => {
        const v = (values[f.name] || "").trim()
        return v ? `${f.label}: ${v}` : null
      })
      .filter(Boolean)
    const header = action
      ? `Here are the details — please go ahead and complete this now (${action}).`
      : "Here are the details — please proceed."
    setSubmitted(true)
    onAction?.(`${header}\n${lines.join("\n")}`)
  }

  return (
    <div className="my-1 flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
      {title && <div className="text-sm font-semibold text-foreground">{title}</div>}
      {description && <div className="-mt-1.5 text-xs text-muted-foreground">{description}</div>}

      {fields.map((f) => (
        <div key={f.name} className="flex flex-col gap-1.5">
          <Label htmlFor={f.name} className="text-xs">
            {f.label}
            {f.required && <span className="text-destructive"> *</span>}
          </Label>
          {f.type === "textarea" ? (
            <Textarea
              id={f.name}
              value={values[f.name] || ""}
              onChange={(e) => set(f.name, e.target.value)}
              placeholder={f.placeholder}
              disabled={submitted}
              rows={3}
              className="text-sm"
            />
          ) : (
            <Input
              id={f.name}
              value={values[f.name] || ""}
              onChange={(e) => set(f.name, e.target.value)}
              placeholder={f.placeholder}
              disabled={submitted}
              className="text-sm"
            />
          )}
        </div>
      ))}

      <Button onClick={submit} disabled={submitted || missingRequired} size="sm" className="mt-1 self-start">
        {submitted ? (
          <>
            <CheckCircle2Icon className="size-4" /> Submitted
          </>
        ) : (
          submitLabel || "Submit"
        )}
      </Button>
    </div>
  )
}

// ─── Form Result Block (open / edit / copy buttons for a created Google Form) ───

function CopyButton({ url, label }: { url: string; label: string }) {
  const [copied, setCopied] = React.useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      /* clipboard unavailable */
    }
  }
  return (
    <Button variant="ghost" size="sm" onClick={copy} className="h-8 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground" aria-label={`Copy ${label}`}>
      {copied ? <CheckIcon className="size-3.5 text-primary" /> : <CopyIcon className="size-3.5" />}
      {copied ? "Copied" : "Copy"}
    </Button>
  )
}

function FormLinkRow({ icon: Icon, title, sub, url, openLabel }: { icon: React.ElementType; title: string; sub: string; url: string; openLabel: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-background px-3 py-2">
      <span className="flex size-7 items-center justify-center rounded-md bg-primary/10 text-primary shrink-0">
        <Icon className="size-3.5" />
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-semibold text-foreground">{title}</div>
        <div className="text-[10px] text-muted-foreground truncate">{sub}</div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <Button asChild variant="outline" size="sm" className="h-8 gap-1.5 px-2.5 text-xs">
          <a href={url} target="_blank" rel="noreferrer">
            <ExternalLinkIcon className="size-3.5" />
            {openLabel}
          </a>
        </Button>
        <CopyButton url={url} label={title} />
      </div>
    </div>
  )
}

const _RESULT_META: Record<string, { Icon: React.ElementType; defaultTitle: string; sub: string }> = {
  form:   { Icon: GoogleFormsIcon,  defaultTitle: "Google Form ready",         sub: "Share the form link with respondents; use the edit link to make changes." },
  doc:    { Icon: GoogleDocsIcon,   defaultTitle: "Google Doc ready",           sub: "Collaborate and edit in Google Docs." },
  sheet:  { Icon: GoogleSheetsIcon, defaultTitle: "Google Sheet ready",         sub: "Track and analyze data in Google Sheets." },
  slides: { Icon: GoogleSlidesIcon, defaultTitle: "Google Slides ready",        sub: "Present and edit your slides in Google Slides." },
}

function FormResultBlock({ title, responderUri, editUri, kind }: { title?: string; responderUri?: string; editUri?: string; kind?: string }) {
  if (!responderUri && !editUri) return null
  const meta = _RESULT_META[kind ?? "form"] ?? _RESULT_META.form
  const Icon = meta.Icon
  return (
    <div className="my-2 flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-xs">
      <div className="flex items-center gap-2.5">
        <Icon className="size-8 shrink-0" />
        <div className="min-w-0">
          <div className="text-sm font-semibold text-foreground truncate">{title || meta.defaultTitle}</div>
          <div className="text-[11px] text-muted-foreground">{meta.sub}</div>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        {responderUri && <FormLinkRow icon={ExternalLinkIcon} title="Form link" sub="Share with respondents" url={responderUri} openLabel="Open" />}
        {editUri && <FormLinkRow icon={PencilIcon} title={kind && kind !== "form" ? "Open" : "Edit link"} sub={kind && kind !== "form" ? "Open in Google" : "Edit the form"} url={editUri} openLabel={kind && kind !== "form" ? "Open" : "Edit"} />}
      </div>
    </div>
  )
}

// ─── Suggestions Block ────────────────────────────────────────────────────────

function SuggestionsBlock({ items, onSelect }: { items: string[]; onSelect?: (t: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5 mt-3 pl-0.5">
      {items.map((item, i) => (
        <button key={i} onClick={() => onSelect?.(item)}
          className="inline-flex items-center rounded-full border border-border bg-background px-3 py-1.5 text-xs text-foreground/75 hover:bg-muted hover:text-foreground hover:border-primary/40 transition-all">
          {item}
        </button>
      ))}
    </div>
  )
}

// ─── Text / Markdown Block ────────────────────────────────────────────────────

function renderInline(text: string) {
  return text.split(/(\*\*.*?\*\*|`.*?`)/g).map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**")) return <strong key={i} className="font-bold text-foreground">{p.slice(2, -2)}</strong>
    if (p.startsWith("`")  && p.endsWith("`"))  return <code key={i} className="bg-muted/60 px-1.5 py-0.5 rounded-sm font-mono text-xs">{p.slice(1, -1)}</code>
    return p
  })
}

function TextBlock({ content }: { content: string }) {
  const lines = content.split("\n")
  const els: React.ReactNode[] = []
  let list: { t: "ul"|"ol"; items: React.ReactNode[] } | null = null
  let tbl:  { headers: string[]; rows: string[][] } | null = null

  const fl = (k: number|string) => {
    if (!list) return
    const El = list.t === "ul" ? "ul" : "ol"
    els.push(<El key={`l${k}`} className={cn(list.t === "ul" ? "list-disc" : "list-decimal", "pl-5 my-1 flex flex-col gap-0.5")}>{list.items.map((it, j) => <li key={j}>{it}</li>)}</El>)
    list = null
  }
  const ft = (k: number|string) => {
    if (!tbl) return
    els.push(
      <div key={`t${k}`} className="w-full overflow-x-auto rounded-lg border border-border/80 my-2 shadow-xs">
        <table className="min-w-full border-collapse text-xs">
          <thead><tr className="bg-muted/80 border-b border-border">{tbl.headers.map((h, j) => <th key={j} className="border-r border-border last:border-r-0 px-3 py-2 font-semibold text-left whitespace-nowrap">{renderInline(h)}</th>)}</tr></thead>
          <tbody>{tbl.rows.map((r, ri) => <tr key={ri} className="hover:bg-muted/30 border-b border-border last:border-b-0">{r.map((c, ci) => <td key={ci} className="border-r border-border last:border-r-0 px-3 py-2 whitespace-nowrap">{renderInline(c)}</td>)}</tr>)}</tbody>
        </table>
      </div>
    )
    tbl = null
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (/^\s*\|(.*)\|/.test(line)) {
      fl(i)
      const cells = line.split("|").map(p => p.trim()).filter((_, j, a) => j > 0 && j < a.length - 1)
      if (line.replace(/[|:\s\-]/g, "") === "") continue
      if (!tbl) tbl = { headers: cells, rows: [] }
      else tbl.rows.push(Array.from({ length: tbl.headers.length }, (_, k) => cells[k] ?? ""))
    } else {
      ft(i)
      const bm = line.match(/^\s*[•\-*]\s+(.*)/)
      const nm = line.match(/^\s*\d+\.\s+(.*)/)
      if (bm)       { if (!list || list.t !== "ul") { fl(i); list = { t: "ul", items: [] } }; list.items.push(renderInline(bm[1])) }
      else if (nm)  { if (!list || list.t !== "ol") { fl(i); list = { t: "ol", items: [] } }; list.items.push(renderInline(nm[1])) }
      else { fl(i); if (line.trim() === "") els.push(<div key={`br${i}`} className="h-1.5" />); else els.push(<div key={`p${i}`} className="leading-relaxed">{renderInline(line)}</div>) }
    }
  }
  fl("end"); ft("end")
  return <div className="flex flex-col gap-0.5">{els}</div>
}

// ─── Main Renderer ────────────────────────────────────────────────────────────

export function DynamicUIRenderer({ content, onAction }: { content: string; onAction?: (prompt: string) => void }) {
  const blocks = React.useMemo(() => parseBlocks(content), [content])
  return (
    <div className="flex flex-col gap-0.5 text-sm text-foreground max-w-full">
      {blocks.map((block, i) => {
        switch (block.type) {
          case "text":               return <TextBlock          key={i} content={block.content} />
          case "stats":              return <StatsBlock         key={i} items={block.items} />
          case "task":               return <TaskBlock          key={i} {...block} onAction={onAction} />
          case "task_list":          return <TaskListBlock      key={i} {...block} onAction={onAction} />
          case "member_grid":        return <MemberGridBlock    key={i} members={block.members} title={block.title} />
          case "event":              return <EventBlock         key={i} {...block} onAction={onAction} />
          case "event_list":         return <EventListBlock     key={i} events={block.events} onAction={onAction} />
          case "timeline":           return <TimelineBlock      key={i} items={block.items} />
          case "progress":           return <ProgressBlock      key={i} label={block.label} value={block.value} sublabel={block.sublabel} />
          case "outreach_pipeline":  return <OutreachPipelineBlock key={i} stages={block.stages} />
          case "bar_chart":          return <BarChartBlock      key={i} title={block.title} data={block.data} />
          case "donut_chart":        return <DonutChartBlock    key={i} title={block.title} data={block.data} />
          case "line_chart":         return <LineChartBlock     key={i} title={block.title} data={block.data} />
          case "alert":              return <AlertBlock         key={i} {...block} onAction={onAction} />
          case "actions":            return <ActionsBlock       key={i} items={block.items} onAction={onAction} />
          case "thinking":           return <ThinkingBlock      key={i} text={block.text} />
          case "tool_call":          return <ToolCallBlock      key={i} name={block.name} status={block.status} />
          case "form":               return <FormBlock          key={i} {...block} onAction={onAction} />
          case "form_result":        return <FormResultBlock    key={i} {...block} />
          case "invite_review":      return <InviteReviewBlock  key={i} {...block} onAction={onAction} />
          case "suggestions":        return <SuggestionsBlock   key={i} items={block.items} onSelect={onAction} />
          default:                   return null
        }
      })}
    </div>
  )
}
