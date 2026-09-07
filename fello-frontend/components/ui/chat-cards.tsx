"use client"

import * as React from "react"
import {
  CheckCircle2Icon,
  CircleDashedIcon,
  CircleDotIcon,
  ClockIcon,
  AlertCircleIcon,
  CalendarIcon,
  UserIcon,
  ChevronRightIcon,
  ZapIcon,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"

// ─── Task Card ────────────────────────────────────────────────────────────────

export interface TaskCardData {
  title: string
  assignee?: string
  status: "unassigned" | "assigned" | "in_progress" | "completed" | "blocked"
  dueDate?: string | null
  eventName?: string
}

const statusConfig: Record<
  TaskCardData["status"],
  { label: string; icon: React.ElementType; variant: "default" | "secondary" | "outline" | "destructive" }
> = {
  unassigned:  { label: "Unassigned",  icon: CircleDashedIcon, variant: "outline" },
  assigned:    { label: "Assigned",    icon: CircleDotIcon,    variant: "secondary" },
  in_progress: { label: "In Progress", icon: ZapIcon,          variant: "default" },
  completed:   { label: "Completed",   icon: CheckCircle2Icon, variant: "secondary" },
  blocked:     { label: "Blocked",     icon: AlertCircleIcon,  variant: "destructive" },
}

export function TaskCard({ data, onAction }: { data: TaskCardData; onAction?: (action: string) => void }) {
  const cfg = statusConfig[data.status] ?? statusConfig.unassigned
  const StatusIcon = cfg.icon
  const initials = data.assignee
    ? data.assignee.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "?"

  return (
    <div className="rounded-xl border border-border bg-card text-card-foreground shadow-xs overflow-hidden my-2">
      <div className="px-4 pt-3 pb-2 flex flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <span className="text-sm font-semibold leading-snug text-foreground">{data.title}</span>
          <Badge variant={cfg.variant} className="shrink-0 gap-1">
            <StatusIcon className="size-3" />
            {cfg.label}
          </Badge>
        </div>

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {data.assignee && (
            <span className="flex items-center gap-1.5">
              <Avatar className="size-4">
                <AvatarFallback className="text-[9px]">{initials}</AvatarFallback>
              </Avatar>
              {data.assignee}
            </span>
          )}
          {!data.assignee && (
            <span className="flex items-center gap-1">
              <UserIcon className="size-3" />
              Unassigned
            </span>
          )}
          {data.dueDate && (
            <span className="flex items-center gap-1">
              <CalendarIcon className="size-3" />
              {data.dueDate}
            </span>
          )}
          {data.eventName && (
            <span className="flex items-center gap-1 text-muted-foreground/70">
              <ChevronRightIcon className="size-3" />
              {data.eventName}
            </span>
          )}
        </div>
      </div>

      {onAction && data.status !== "completed" && (
        <div className="border-t border-border flex">
          <button
            onClick={() => onAction("complete")}
            className="flex-1 px-3 py-2 text-xs text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors text-left"
          >
            Mark complete
          </button>
          <div className="w-px bg-border" />
          <button
            onClick={() => onAction("reassign")}
            className="flex-1 px-3 py-2 text-xs text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors text-left"
          >
            Reassign
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Member Table ─────────────────────────────────────────────────────────────

export interface MemberRow {
  name: string
  role?: string
  phone?: string
  status?: "active" | "inactive" | "pending"
}

export function MemberTable({ data }: { data: MemberRow[] }) {
  if (!data?.length) return null
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden my-2 shadow-xs">
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Name</th>
              <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Role</th>
              <th className="px-4 py-2.5 text-left font-medium text-muted-foreground hidden sm:table-cell">Phone</th>
              <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Status</th>
            </tr>
          </thead>
          <tbody>
            {data.map((m, i) => {
              const initials = m.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
              return (
                <tr key={i} className={cn("border-b border-border last:border-b-0", "hover:bg-muted/20 transition-colors")}>
                  <td className="px-4 py-2.5">
                    <span className="flex items-center gap-2">
                      <Avatar className="size-5">
                        <AvatarFallback className="text-[9px]">{initials}</AvatarFallback>
                      </Avatar>
                      <span className="font-medium text-foreground">{m.name}</span>
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">{m.role ?? "—"}</td>
                  <td className="px-4 py-2.5 text-muted-foreground hidden sm:table-cell">{m.phone ?? "—"}</td>
                  <td className="px-4 py-2.5">
                    <Badge
                      variant={
                        m.status === "active" ? "default" :
                        m.status === "pending" ? "outline" : "secondary"
                      }
                    >
                      {m.status ?? "active"}
                    </Badge>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Event Card ───────────────────────────────────────────────────────────────

export interface EventCardData {
  name: string
  date?: string | null
  status?: "active" | "closed" | "planning"
  coordinators?: string[]
  type?: "event" | "project"
}

export function EventCard({ data, onAction }: { data: EventCardData; onAction?: (action: string) => void }) {
  const statusVariant =
    data.status === "active" ? "default" :
    data.status === "closed" ? "secondary" : "outline"

  return (
    <div className="rounded-xl border border-border bg-card text-card-foreground shadow-xs overflow-hidden my-2">
      <div className="px-4 pt-3 pb-2 flex flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <span className="text-sm font-semibold leading-snug text-foreground">{data.name}</span>
          <div className="flex items-center gap-1.5 shrink-0">
            {data.type && (
              <Badge variant="outline" className="capitalize">{data.type}</Badge>
            )}
            <Badge variant={statusVariant} className="capitalize">{data.status ?? "active"}</Badge>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {data.date && (
            <span className="flex items-center gap-1">
              <CalendarIcon className="size-3" />
              {data.date}
            </span>
          )}
          {data.coordinators?.length ? (
            <span className="flex items-center gap-1">
              <UserIcon className="size-3" />
              {data.coordinators.join(", ")}
            </span>
          ) : null}
        </div>
      </div>

      {onAction && (
        <div className="border-t border-border flex">
          <button
            onClick={() => onAction("tasks")}
            className="flex-1 px-3 py-2 text-xs text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors text-left"
          >
            View tasks
          </button>
          <div className="w-px bg-border" />
          <button
            onClick={() => onAction("members")}
            className="flex-1 px-3 py-2 text-xs text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors text-left"
          >
            View members
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Quick Action Button ──────────────────────────────────────────────────────

export interface QuickActionData {
  label: string
  description?: string
  icon?: string
}

export function QuickActionButton({ data, onClick }: { data: QuickActionData; onClick?: () => void }) {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onClick}
      className="h-auto py-2 px-3 flex items-center gap-2 text-left text-xs font-medium my-1"
    >
      {data.icon && <span className="text-base leading-none">{data.icon}</span>}
      <span className="flex flex-col gap-0.5">
        <span>{data.label}</span>
        {data.description && (
          <span className="font-normal text-muted-foreground">{data.description}</span>
        )}
      </span>
    </Button>
  )
}
