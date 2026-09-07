"use client"

import * as React from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import {
  Calendar,
  Users,
  MessageSquare,
  FileText,
  Phone,
  CheckCircle2,
  Circle,
  Plus,
  Info,
  Pencil,
  X,
} from "lucide-react"
import { collection, doc, getDoc, getDocs, limit, query, updateDoc, where } from "firebase/firestore"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { RoundedList, RoundedListItem } from "@/components/ui/rounded-list"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { ProjectIcon } from "@/components/project-icon"
import { useHeaderStore } from "@/hooks/use-header-store"
import { useAuth } from "@/hooks/use-auth"
import { db } from "@/lib/firebase"
import { assignProjectTask, createProjectTask } from "@/lib/actions/tasks"
import { connectProjectDriveToOrgAccount, completeProjectGoogleConnect } from "@/lib/actions/projects"
import {
  connectProjectWhatsapp,
  getProjectWhatsappQr,
  getProjectWhatsappStatus,
  type WhatsappLinkState,
} from "@/lib/actions/whatsapp"
import { inviteExternalContributor } from "@/lib/actions/project-memberships"
import { GoogleDriveIcon } from "@/components/icons/google-icons"
import type { ProjectMembership, Task } from "@/lib/types"

type MemberRow = {
  id: string
  name: string
  role: string
  isGuest: boolean
}

type ProjectDoc = {
  id: string
  name?: string
  description?: string
  date?: { toDate?: () => Date } | Date | string | null
  dueDate?: { toDate?: () => Date } | Date | string | null
  createdAt?: { toDate?: () => Date } | Date | string | null
  status?: string
  icon?: string
  iconUrl?: string
  driveAccountType?: string
  driveGrantRef?: string
  driveRootFolderId?: string
  whatsappGatewayNumber?: string | null
  whatsappStatus?: string
  coordinators?: string[]
  tenantId?: string
  orgId?: string
  createdBy?: string
}

type EditableProjectField =
  | "name"
  | "description"
  | "date"
  | "dueDate"
  | "driveRootFolderId"

export default function ProjectDetailPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const tenantNamespace = params.tenantNamespace as string
  const orgSlug = params.orgSlug as string
  const projectId = params.projectId as string
  const { setBreadcrumbs, clearHeader } = useHeaderStore()

  const { user } = useAuth()
  const [project, setProject] = React.useState<ProjectDoc | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [editingField, setEditingField] = React.useState<EditableProjectField | null>(null)
  const [editValue, setEditValue] = React.useState("")
  const [isSaving, setIsSaving] = React.useState(false)

  const [tasks, setTasks] = React.useState<Task[]>([])
  const [tasksLoading, setTasksLoading] = React.useState(true)
  const [members, setMembers] = React.useState<MemberRow[]>([])
  const [membersLoading, setMembersLoading] = React.useState(true)
  const [memberNames, setMemberNames] = React.useState<Record<string, string>>({})

  const [createTaskOpen, setCreateTaskOpen] = React.useState(false)
  const [newTaskTitle, setNewTaskTitle] = React.useState("")
  const [newTaskDescription, setNewTaskDescription] = React.useState("")
  const [creatingTask, setCreatingTask] = React.useState(false)

  const loadTasksAndMembers = React.useCallback(async () => {
    if (!project?.orgId) return
    setTasksLoading(true)
    setMembersLoading(true)
    try {
      const [taskSnap, membershipSnap, orgMembershipSnap] = await Promise.all([
        getDocs(
          query(
            collection(db, "tasks"),
            where("orgId", "==", project.orgId),
            where("projectId", "==", project.id)
          )
        ),
        getDocs(
          // orgId filter is what makes this query provable under the
          // project_memberships read rule (rules can't prove membership
          // from a projectId-only query — they're not filters).
          query(
            collection(db, "project_memberships"),
            where("orgId", "==", project.orgId),
            where("projectId", "==", project.id)
          )
        ),
        getDocs(query(collection(db, "memberships"), where("orgId", "==", project.orgId))),
      ])

      const loadedTasks = taskSnap.docs.map((d) => d.data() as Task)
      setTasks(loadedTasks)

      // Resolve display names for every uid we might show (assignees, coordinators).
      const uidsToResolve = new Set<string>([
        ...loadedTasks.flatMap((t) => t.assignedTo || []),
        ...(project.coordinators || []),
      ])
      const namePairs = await Promise.all(
        Array.from(uidsToResolve).map(async (uid) => {
          try {
            const userSnap = await getDoc(doc(db, "users", uid))
            const name = (userSnap.data()?.name as string) || uid
            return [uid, name] as const
          } catch {
            return [uid, uid] as const
          }
        })
      )
      const nameMap = Object.fromEntries(namePairs)
      setMemberNames(nameMap)

      const assignedUids = new Set(loadedTasks.flatMap((t) => t.assignedTo || []))
      const coordinatorUids = new Set(project.coordinators || [])
      const orgRoleByUid = new Map<string, string>()
      for (const d of orgMembershipSnap.docs) {
        const m = d.data()
        if (m.userId) orgRoleByUid.set(m.userId, m.role || m.access || "member")
      }

      const orgMemberRows: MemberRow[] = Array.from(
        new Set([...assignedUids, ...coordinatorUids])
      ).map((uid) => ({
        id: uid,
        name: nameMap[uid] || uid,
        role: coordinatorUids.has(uid) ? "coordinator" : orgRoleByUid.get(uid) || "contributor",
        isGuest: false,
      }))

      const guestRows: MemberRow[] = membershipSnap.docs
        .map((d) => d.data() as ProjectMembership)
        .filter((m) => m.status !== "revoked")
        .map((m) => ({
          id: m.contactId || m.inviteValue,
          name: m.inviteValue,
          role: "external contributor",
          isGuest: true,
        }))

      setMembers([...orgMemberRows, ...guestRows])
    } catch (err) {
      console.error("Failed to load tasks/members:", err)
    } finally {
      setTasksLoading(false)
      setMembersLoading(false)
    }
  }, [project?.orgId, project?.id, project?.coordinators])

  React.useEffect(() => {
    void loadTasksAndMembers()
  }, [loadTasksAndMembers])

  const handleCreateTask = async () => {
    if (!project?.id || !project.orgId || !project.tenantId || !newTaskTitle.trim()) return
    setCreatingTask(true)
    const result = await createProjectTask({
      orgId: project.orgId,
      tenantId: project.tenantId,
      projectId: project.id,
      title: newTaskTitle.trim(),
      description: newTaskDescription.trim(),
      assignedTo: [],
      dueDate: null,
      createdBy: user?.uid || "unknown",
    })
    setCreatingTask(false)
    if (result.error) {
      toast.error(result.error)
      return
    }
    toast.success("Task created")
    setNewTaskTitle("")
    setNewTaskDescription("")
    setCreateTaskOpen(false)
    void loadTasksAndMembers()
  }

  const [connectingDrive, setConnectingDrive] = React.useState<"org" | "dedicated" | null>(null)

  // Finish a project-scoped Google OAuth connect (dedicated-account path)
  // when redirected back here with ?oauth=complete.
  React.useEffect(() => {
    const oauth = searchParams.get("oauth")
    if (oauth !== "complete" || !project?.id) return

    setConnectingDrive("dedicated")
    completeProjectGoogleConnect(project.id, user?.uid || "unknown", project.name || "Project")
      .then((result) => {
        if (result.error !== null) {
          toast.error(result.error)
          return
        }
        toast.success(`Connected a dedicated Drive folder (${result.data.email})`)
        setProject((current) =>
          current ? { ...current, driveAccountType: "dedicated", driveRootFolderId: result.data.folderId } : current
        )
      })
      .finally(() => {
        setConnectingDrive(null)
        router.replace(`/org/${tenantNamespace}/${orgSlug}/projects/${project.id}`)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, project?.id])

  const handleConnectOrgDrive = async () => {
    if (!project?.id || !project.orgId || !user) return
    setConnectingDrive("org")
    try {
      const idToken = await user.getIdToken()
      const result = await connectProjectDriveToOrgAccount(idToken, project.orgId, project.id, project.name || "Project")
      if (result.error !== null) {
        toast.error(result.error)
        return
      }
      toast.success("Connected to the org's Drive folder")
      setProject((current) =>
        current ? { ...current, driveAccountType: "org", driveRootFolderId: result.data.folderId } : current
      )
    } finally {
      setConnectingDrive(null)
    }
  }

  const handleConnectDedicatedDrive = () => {
    if (!project?.id || !project.orgId) return
    window.location.href = `/api/auth/google?orgId=${project.orgId}&tenantNamespace=${tenantNamespace}&orgSlug=${orgSlug}&projectId=${project.id}`
  }

  const [whatsappDialogOpen, setWhatsappDialogOpen] = React.useState(false)
  const [whatsappLink, setWhatsappLink] = React.useState<WhatsappLinkState | null>(null)
  const [whatsappError, setWhatsappError] = React.useState<string | null>(null)
  const whatsappPollRef = React.useRef<ReturnType<typeof setInterval> | null>(null)

  const stopWhatsappPolling = React.useCallback(() => {
    if (whatsappPollRef.current) {
      clearInterval(whatsappPollRef.current)
      whatsappPollRef.current = null
    }
  }, [])

  // Poll status (which flips to "connected" once scanned) and, while still
  // pairing, the QR itself — Baileys rotates the QR roughly every 20-60s.
  const startWhatsappPolling = React.useCallback(
    (projectId: string) => {
      stopWhatsappPolling()
      const started = Date.now()
      whatsappPollRef.current = setInterval(async () => {
        if (!user || Date.now() - started > 90_000) {
          stopWhatsappPolling()
          return
        }
        const idToken = await user.getIdToken()
        const statusResult = await getProjectWhatsappStatus(idToken, projectId)
        if (statusResult.error !== null) return
        if (statusResult.data.status === "connected") {
          setWhatsappLink(statusResult.data)
          setProject((current) =>
            current
              ? {
                  ...current,
                  whatsappStatus: "connected",
                  whatsappGatewayNumber: statusResult.data.phoneNumber ?? current.whatsappGatewayNumber,
                }
              : current
          )
          stopWhatsappPolling()
          return
        }
        const qrResult = await getProjectWhatsappQr(idToken, projectId)
        if (qrResult.error === null) setWhatsappLink(qrResult.data)
      }, 2000)
    },
    [user, stopWhatsappPolling]
  )

  React.useEffect(() => stopWhatsappPolling, [stopWhatsappPolling])

  // Refresh the live gateway status once on load — a phone-side unlink
  // (WhatsApp app -> Linked devices -> Log out) can happen while nobody has
  // this dialog open, so the cached Firestore field alone could still say
  // "connected" when it's actually gone.
  React.useEffect(() => {
    if (!project?.id || project.whatsappStatus !== "connected" || !user) return
    let cancelled = false
    ;(async () => {
      const idToken = await user.getIdToken()
      const result = await getProjectWhatsappStatus(idToken, project.id)
      if (cancelled || result.error !== null) return
      if (result.data.status !== "connected") {
        setProject((current) => (current ? { ...current, whatsappStatus: result.data.status } : current))
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id, user])

  const handleConnectWhatsapp = async () => {
    if (!project?.id || !user) return
    setWhatsappDialogOpen(true)
    setWhatsappError(null)
    setWhatsappLink(null)
    const idToken = await user.getIdToken()
    const result = await connectProjectWhatsapp(idToken, project.id)
    if (result.error !== null) {
      setWhatsappError(result.error)
      return
    }
    setWhatsappLink(result.data)
    if (result.data.status !== "connected") startWhatsappPolling(project.id)
  }

  const [inviteOpen, setInviteOpen] = React.useState(false)
  const [inviteValue, setInviteValue] = React.useState("")
  const [inviting, setInviting] = React.useState(false)

  const handleInviteContributor = async () => {
    if (!project?.id || !project.orgId || !project.tenantId || !inviteValue.trim() || !user) return
    setInviting(true)
    const channel = inviteValue.includes("@") ? "email" : "phone"
    const result = await inviteExternalContributor({
      projectId: project.id,
      orgId: project.orgId,
      tenantId: project.tenantId,
      inviteChannel: channel,
      inviteValue: inviteValue.trim(),
      invitedBy: user.uid,
    })
    setInviting(false)
    if (result.error) {
      toast.error(result.error)
      return
    }
    toast.success("Invite sent — they'll get project access on next sign-in")
    setInviteValue("")
    setInviteOpen(false)
    void loadTasksAndMembers()
  }

  const handleClaimTask = async (task: Task) => {
    if (!user?.uid) return
    const alreadyAssigned = task.assignedTo?.includes(user.uid)
    const nextAssignees = alreadyAssigned
      ? task.assignedTo.filter((uid) => uid !== user.uid)
      : [...(task.assignedTo || []), user.uid]
    const result = await assignProjectTask(task.id, nextAssignees)
    if (result.error) {
      toast.error(result.error)
      return
    }
    void loadTasksAndMembers()
  }

  React.useEffect(() => {
    let cancelled = false
    const loadProject = async () => {
      try {
        setLoading(true)
        setError(null)

        const tenantQuery = query(
          collection(db, "tenants"),
          where("urlNamespace", "==", tenantNamespace),
          limit(1)
        )
        const tenantSnap = await getDocs(tenantQuery)
        if (tenantSnap.empty) {
          if (!cancelled) setError("Institution context not found.")
          return
        }

        const tenantId = tenantSnap.docs[0].id
        const orgQuery = query(
          collection(db, "organizations"),
          where("tenantId", "==", tenantId),
          where("slug", "==", orgSlug),
          limit(1)
        )
        const orgSnap = await getDocs(orgQuery)
        if (orgSnap.empty) {
          if (!cancelled) setError("Organization context not found.")
          return
        }

        const orgId = orgSnap.docs[0].id
        const projectQuery = query(
          collection(db, "projects"),
          where("tenantId", "==", tenantId),
          where("orgId", "==", orgId),
          where("id", "==", projectId),
          limit(1)
        )
        const projectSnap = await getDocs(projectQuery)
        if (projectSnap.empty) {
          if (!cancelled) setError("Project not found.")
          return
        }

        const projectDoc = projectSnap.docs[0]
        const data = projectDoc.data() as Omit<ProjectDoc, "id">
        if (!cancelled) {
          setProject({
            id: projectDoc.id,
            name: data.name || "Untitled Project",
            description: data.description || "",
            date: data.date || null,
            dueDate: data.dueDate || null,
            createdAt: data.createdAt || null,
            status: data.status || "planning",
            icon: data.icon || "",
            iconUrl: data.iconUrl || "",
            driveAccountType: data.driveAccountType || "",
            driveRootFolderId: data.driveRootFolderId || "",
            whatsappGatewayNumber: data.whatsappGatewayNumber || null,
            coordinators: data.coordinators || [],
            tenantId: data.tenantId || tenantId,
            orgId: data.orgId || orgId,
            createdBy: data.createdBy || "",
          })
        }
      } catch (err) {
        console.error("Failed to load project:", err)
        if (!cancelled) setError("Failed to load project.")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void loadProject()
    return () => {
      cancelled = true
    }
  }, [projectId, tenantNamespace, orgSlug])

  React.useEffect(() => {
    if (!project) return

    setBreadcrumbs(
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink href={`/org/${tenantNamespace}/${orgSlug}/projects`}>
            Projects
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage>{project.name}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    )

    return () => clearHeader()
  }, [project, tenantNamespace, orgSlug, setBreadcrumbs, clearHeader])

  const formatDate = (dateVal: ProjectDoc["date"]) => {
    if (!dateVal) return "No start date"
    if (typeof dateVal === "string") return new Date(dateVal).toLocaleDateString()
    if (dateVal instanceof Date) return dateVal.toLocaleDateString()
    if (typeof dateVal === "object" && typeof dateVal.toDate === "function") {
      return dateVal.toDate().toLocaleDateString()
    }
    return "Invalid date"
  }

  const formatDateTime = (dateVal: ProjectDoc["date"]) => {
    if (!dateVal) return "Not set"
    if (typeof dateVal === "string") return new Date(dateVal).toLocaleString()
    if (dateVal instanceof Date) return dateVal.toLocaleString()
    if (typeof dateVal === "object" && typeof dateVal.toDate === "function") {
      return dateVal.toDate().toLocaleString()
    }
    return "Invalid date"
  }

  const dateInputValue = (dateVal: ProjectDoc["date"]) => {
    if (!dateVal) return ""
    const date = typeof dateVal === "string" ? new Date(dateVal) : dateVal instanceof Date ? dateVal : dateVal.toDate?.()
    if (!date || Number.isNaN(date.getTime())) return ""
    return date.toISOString().slice(0, 10)
  }

  const startEdit = (field: EditableProjectField, value: string) => {
    setEditingField(field)
    setEditValue(value)
  }

  const updateProjectField = async (
    field: EditableProjectField | "status",
    value: string | Date | null
  ) => {
    if (!project) return

    const promise = (async () => {
      setIsSaving(true)
      await updateDoc(doc(db, "projects", project.id), {
        [field]: value,
        lastUpdated: new Date(),
      })
      setProject((current) => current ? { ...current, [field]: value } : current)
      setEditingField(null)
    })()

    toast.promise(promise, {
      loading: "Saving...",
      success: "Project updated",
      error: "Failed to update project",
    })

    try {
      await promise
    } finally {
      setIsSaving(false)
    }
  }

  const saveEditingField = async () => {
    if (!editingField) return
    if (editingField === "date" || editingField === "dueDate") {
      await updateProjectField(editingField, editValue ? new Date(editValue) : null)
      return
    }
    await updateProjectField(editingField, editValue.trim())
  }

  if (loading) {
    return (
      <div className="flex flex-col h-full overflow-hidden bg-background">
        <div className="flex-1 overflow-auto bg-muted/20">
          <div className="mx-auto max-w-5xl px-6 py-6 space-y-6">
            <div className="space-y-3">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-4 w-72" />
              <Skeleton className="h-5 w-24" />
            </div>
            <Skeleton className="sticky top-0 z-20 h-12 w-full rounded-xl" />
            <Skeleton className="h-48 w-full rounded-xl" />
          </div>
        </div>
      </div>
    )
  }

  if (error || !project) {
    return (
      <div className="flex h-[80vh] flex-col items-center justify-center gap-4 text-center">
        <div>
          <h2 className="text-xl font-semibold">Could not load project</h2>
          <p className="text-sm text-muted-foreground">{error || "Project not found."}</p>
        </div>
        <Button onClick={() => router.refresh()}>Retry</Button>
      </div>
    )
  }

  const tabTriggerClass =
    "h-11 w-fit flex-none rounded-none border-x-0 border-t border-b-0 border-transparent bg-transparent px-3 py-2 text-sm after:!left-0 after:!right-0 after:!bottom-0 after:!h-0.5 after:!w-full after:!translate-x-0 after:!rounded-full after:!bg-primary after:opacity-0 data-active:border-t-border data-active:bg-transparent data-active:text-foreground data-active:shadow-none data-active:after:opacity-100"

  const statusOptions = ["planning", "active", "completed", "closed"]

  const projectDetails = [
    { label: "Project ID", value: project.id },
    { label: "Start Date", field: "date" as const, value: formatDate(project.date), editValue: dateInputValue(project.date), type: "date" as const },
    { label: "Due Date", field: "dueDate" as const, value: project.dueDate ? formatDate(project.dueDate) : "Not set", editValue: dateInputValue(project.dueDate), type: "date" as const },
    { label: "Created At", value: formatDateTime(project.createdAt) },
    { label: "Tenant ID", value: project.tenantId || "Not set" },
    { label: "Organization ID", value: project.orgId || "Not set" },
    { label: "Drive Account", value: project.driveAccountType || "Not set" },
    { label: "Drive Root Folder", field: "driveRootFolderId" as const, value: project.driveRootFolderId || "Not set", editValue: project.driveRootFolderId || "", type: "text" as const },
  ].filter((detail) => detail.value !== "")

  const renderEditableTableValue = (detail: typeof projectDetails[number]) => {
    if (!("field" in detail) || !detail.field) return detail.value

    if (editingField === detail.field) {
      return (
        <div className="flex items-center gap-2">
          <Input
            type={detail.type}
            value={editValue}
            onChange={(event) => setEditValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") setEditingField(null)
              if (event.key === "Enter") void saveEditingField()
            }}
            className="h-8 max-w-sm rounded-lg"
            autoFocus
          />
          <Button size="sm" variant="outline" onClick={() => void saveEditingField()} disabled={isSaving}>
            Save
          </Button>
          <Button size="icon" variant="ghost" onClick={() => setEditingField(null)} disabled={isSaving}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      )
    }

    return (
      <div className="flex min-h-8 items-center justify-between gap-3">
        <span>{detail.value}</span>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 opacity-0 transition-opacity group-hover:opacity-100"
          onClick={() => startEdit(detail.field, detail.editValue)}
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">
      <div className="flex-1 overflow-auto bg-muted/20">
        <Tabs defaultValue="overview" className="space-y-6">
          <div className="sticky top-0 z-20 w-full border-b border-border bg-background/95 px-6 backdrop-blur supports-[backdrop-filter]:bg-background/80">
            <TabsList
              variant="line"
              className="!flex !h-auto !w-full justify-start gap-5 overflow-x-auto rounded-none bg-transparent p-0"
            >
              <TabsTrigger
                value="overview"
                className={tabTriggerClass}
              >
                <Calendar className="mr-2 h-4 w-4" /> Overview
              </TabsTrigger>
              <TabsTrigger
                value="tasks"
                className={tabTriggerClass}
              >
                <CheckCircle2 className="mr-2 h-4 w-4" /> Tasks
              </TabsTrigger>
              <TabsTrigger
                value="members"
                className={tabTriggerClass}
              >
                <Users className="mr-2 h-4 w-4" /> Members
              </TabsTrigger>
              <TabsTrigger
                value="whatsapp"
                className={tabTriggerClass}
              >
                <MessageSquare className="mr-2 h-4 w-4" /> Groups
              </TabsTrigger>
              <TabsTrigger
                value="documents"
                className={tabTriggerClass}
              >
                <FileText className="mr-2 h-4 w-4" /> Docs
              </TabsTrigger>
              <TabsTrigger
                value="outreach"
                className={tabTriggerClass}
              >
                <Phone className="mr-2 h-4 w-4" /> Outreach
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="w-full px-6 pb-3">
            <TabsContent value="overview" className="space-y-4 mt-0">
              <div className="w-full p-4">
                <div className="relative rounded-xl px-5 pt-20 pb-5">
                  <div className="absolute left-0 top-0 z-0 h-30 w-full rounded-xl bg-muted" />
                  <div className="relative z-10 mx-auto flex w-full max-w-2xl gap-3">
                    <div className="flex h-16 min-h-16 w-16 min-w-16 items-center justify-center overflow-hidden rounded-lg bg-background/70 shadow-xl backdrop-blur-md">
                      <ProjectIcon icon={project.icon} iconUrl={project.iconUrl} />
                    </div>
                    <div className="min-w-0 space-y-3">
                      {editingField === "name" ? (
                        <div className="flex items-center gap-2">
                          <Input
                            value={editValue}
                            onChange={(event) => setEditValue(event.target.value)}
                            onKeyDown={(event) => {
                              if (event.key === "Escape") setEditingField(null)
                              if (event.key === "Enter") void saveEditingField()
                            }}
                            className="h-9 max-w-md rounded-lg bg-background"
                            autoFocus
                          />
                          <Button size="sm" variant="outline" onClick={() => void saveEditingField()} disabled={isSaving}>
                            Save
                          </Button>
                        </div>
                      ) : (
                        <div className="group flex items-center gap-2">
                          <h1 className="truncate text-2xl font-semibold">{project.name}</h1>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 opacity-0 transition-opacity group-hover:opacity-100"
                            onClick={() => startEdit("name", project.name || "")}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                      <div className="flex flex-wrap items-center gap-2">
                        <Select
                          value={project.status || "planning"}
                          onValueChange={(value) => void updateProjectField("status", value)}
                          disabled={isSaving}
                        >
                          <SelectTrigger size="sm" className="h-7 rounded-full bg-background px-2.5 text-xs font-semibold capitalize">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {statusOptions.map((status) => (
                              <SelectItem key={status} value={status} className="capitalize">
                                {status}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Badge variant="secondary" className="rounded-full">
                          <Calendar className="mr-1 h-3.5 w-3.5" />
                          {formatDate(project.date)}
                        </Badge>
                        {project.dueDate && (
                          <Badge variant="secondary" className="rounded-full">
                            Due {formatDate(project.dueDate)}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mx-auto w-full max-w-2xl">
                  <div className="mt-8 rounded-md bg-muted/50 p-5">
                    <div className="group">
                      <h3 className="inline-flex items-center gap-2 font-semibold">
                        <Info className="h-4 w-4" />
                        Details
                        <Button
                          size="icon"
                          variant="ghost"
                          className="ml-1 h-7 w-7 opacity-0 transition-opacity group-hover:opacity-100"
                          onClick={() => startEdit("description", project.description || "")}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </h3>
                      {editingField === "description" ? (
                        <div className="mt-3 space-y-3">
                          <Textarea
                            value={editValue}
                            onChange={(event) => setEditValue(event.target.value)}
                            className="min-h-28 bg-background"
                            autoFocus
                          />
                          <div className="flex justify-end gap-2">
                            <Button variant="ghost" onClick={() => setEditingField(null)} disabled={isSaving}>
                              Cancel
                            </Button>
                            <Button variant="outline" onClick={() => void saveEditingField()} disabled={isSaving}>
                              Save
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                          {project.description || "No project details yet."}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="mt-8 overflow-hidden rounded-lg border bg-card">
                    <Table>
                      <TableBody>
                        {projectDetails.map((detail) => (
                          <TableRow key={detail.label} className="group">
                            <TableCell className="font-medium">{detail.label}</TableCell>
                            <TableCell>{renderEditableTableValue(detail)}</TableCell>
                          </TableRow>
                        ))}
                        <TableRow>
                          <TableCell className="font-medium">WhatsApp Gateway</TableCell>
                          <TableCell>
                            <div className="flex min-h-8 items-center justify-between gap-3">
                              <span>
                                {project.whatsappStatus === "connected" && project.whatsappGatewayNumber
                                  ? `Connected — ${project.whatsappGatewayNumber}`
                                  : project.whatsappStatus === "disconnected"
                                    ? `Disconnected${project.whatsappGatewayNumber ? ` — was ${project.whatsappGatewayNumber}` : ""}`
                                    : "Not connected"}
                              </span>
                              <Button size="sm" variant="outline" onClick={() => void handleConnectWhatsapp()}>
                                {project.whatsappStatus === "connected"
                                  ? "Reconnect"
                                  : project.whatsappStatus === "disconnected"
                                    ? "Connect again"
                                    : "Connect WhatsApp"}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-medium">Coordinators</TableCell>
                          <TableCell>{(project.coordinators || []).join(", ") || "None"}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>

              <Dialog
                open={whatsappDialogOpen}
                onOpenChange={(open) => {
                  setWhatsappDialogOpen(open)
                  if (!open) stopWhatsappPolling()
                }}
              >
                <DialogContent className="max-w-sm">
                  <DialogHeader>
                    <DialogTitle>Connect WhatsApp</DialogTitle>
                  </DialogHeader>
                  {whatsappError ? (
                    <Alert variant="destructive">
                      <AlertTitle>Couldn&apos;t connect</AlertTitle>
                      <AlertDescription>{whatsappError}</AlertDescription>
                    </Alert>
                  ) : whatsappLink?.status === "connected" ? (
                    <div className="flex flex-col items-center gap-2 py-4 text-center">
                      <CheckCircle2 className="h-8 w-8 text-primary" />
                      <p className="font-medium">Connected</p>
                      <p className="text-sm text-muted-foreground">{whatsappLink.phoneNumber}</p>
                    </div>
                  ) : whatsappLink?.qr ? (
                    <div className="flex flex-col items-center gap-3 py-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={whatsappLink.qr} alt="Scan with WhatsApp" className="h-56 w-56 rounded-lg border" />
                      <p className="text-sm text-muted-foreground">
                        Open WhatsApp on the number for this project → Linked devices → Link a device, and scan
                        this code.
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-3 py-4">
                      <Skeleton className="h-56 w-56 rounded-lg" />
                      <p className="text-sm text-muted-foreground">Waiting for the gateway to generate a QR code…</p>
                    </div>
                  )}
                </DialogContent>
              </Dialog>
            </TabsContent>

            <TabsContent value="tasks" className="mx-auto w-full max-w-2xl space-y-4 mt-0">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-lg font-semibold">Tasks</h3>
                <Dialog open={createTaskOpen} onOpenChange={setCreateTaskOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm"><Plus className="mr-2 h-4 w-4" /> Create Task</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create task</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3">
                      <Input
                        value={newTaskTitle}
                        onChange={(event) => setNewTaskTitle(event.target.value)}
                        placeholder="Task title"
                        autoFocus
                      />
                      <Textarea
                        value={newTaskDescription}
                        onChange={(event) => setNewTaskDescription(event.target.value)}
                        placeholder="Description (optional)"
                        className="min-h-20"
                      />
                    </div>
                    <DialogFooter>
                      <Button
                        onClick={() => void handleCreateTask()}
                        disabled={creatingTask || !newTaskTitle.trim()}
                      >
                        {creatingTask ? "Creating..." : "Create"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
              {tasksLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-16 w-full rounded-lg" />
                  <Skeleton className="h-16 w-full rounded-lg" />
                </div>
              ) : tasks.length === 0 ? (
                <div className="rounded-lg border border-dashed p-8 text-center">No tasks found.</div>
              ) : (
                <RoundedList>
                  {tasks.map((task) => {
                    const isCompleted = task.status === "completed"
                    const isMine = Boolean(user?.uid && task.assignedTo?.includes(user.uid))
                    return (
                      <RoundedListItem key={task.id} className="flex items-center justify-between p-4">
                        <div className="flex items-center gap-3">
                          {isCompleted ? <CheckCircle2 className="h-5 w-5 text-primary" /> : <Circle className="h-5 w-5 text-muted-foreground" />}
                          <div>
                            <p className="font-medium">{task.title}</p>
                            <p className="text-sm text-muted-foreground">
                              {task.assignedTo?.length
                                ? `Assigned to: ${task.assignedTo.map((uid) => memberNames[uid] || uid).join(", ")}`
                                : "Unassigned"}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={isCompleted ? "secondary" : "outline"}>
                            {task.status.replace("_", " ")}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => void handleClaimTask(task)}
                          >
                            {isMine ? "Unassign me" : "Assign to me"}
                          </Button>
                        </div>
                      </RoundedListItem>
                    )
                  })}
                </RoundedList>
              )}
            </TabsContent>

            <TabsContent value="members" className="mx-auto w-full max-w-2xl space-y-4 mt-0">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-lg font-semibold">Members</h3>
                <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="outline"><Plus className="mr-2 h-4 w-4" /> Invite contributor</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Invite an external contributor</DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-muted-foreground">
                      They get access to only this project — never the rest of the organization.
                    </p>
                    <Input
                      value={inviteValue}
                      onChange={(event) => setInviteValue(event.target.value)}
                      placeholder="Phone number or email"
                      autoFocus
                    />
                    <DialogFooter>
                      <Button
                        onClick={() => void handleInviteContributor()}
                        disabled={inviting || !inviteValue.trim()}
                      >
                        {inviting ? "Sending..." : "Send invite"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
              <div className="overflow-hidden rounded-lg border bg-card">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {membersLoading && (
                      <TableRow>
                        <TableCell colSpan={3} className="py-8 text-center text-muted-foreground">Loading members...</TableCell>
                      </TableRow>
                    )}
                    {!membersLoading && members.map((member) => (
                      <TableRow key={member.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {member.name}
                            {member.isGuest && <Badge variant="secondary">Guest</Badge>}
                          </div>
                        </TableCell>
                        <TableCell><Badge variant="outline">{member.role}</Badge></TableCell>
                        <TableCell className="text-right"><Button variant="ghost" size="sm">Remove</Button></TableCell>
                      </TableRow>
                    ))}
                    {!membersLoading && members.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={3} className="py-8 text-center text-muted-foreground">No members assigned.</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="whatsapp" className="mx-auto w-full max-w-2xl space-y-4 mt-0">
              <div className="rounded-lg border border-dashed bg-card p-8 text-center">
                <MessageSquare className="mx-auto mb-4 h-8 w-8 text-muted-foreground" />
                <h3 className="text-lg font-semibold">WhatsApp Groups</h3>
                <p className="mb-4 text-muted-foreground">No groups created for this project yet.</p>
                <Button variant="outline"><Plus className="mr-2 h-4 w-4" /> Create Group</Button>
              </div>
            </TabsContent>

            <TabsContent value="documents" className="mx-auto w-full max-w-2xl space-y-4 mt-0">
              {project.driveRootFolderId ? (
                <div className="rounded-lg border bg-card p-6">
                  <div className="flex items-center gap-3">
                    <GoogleDriveIcon className="h-8 w-8" />
                    <div>
                      <p className="font-medium">Drive connected</p>
                      <p className="text-sm text-muted-foreground">
                        {project.driveAccountType === "dedicated"
                          ? "Using a dedicated Google account for this project."
                          : "Using the organization's connected Google account."}
                      </p>
                    </div>
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground">
                    The agent creates every Doc, Sheet, Slide, and Form for this project inside its
                    dedicated Drive folder.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <h3 className="text-lg font-semibold">Connect Google Drive</h3>
                    <p className="text-sm text-muted-foreground">
                      Choose how the agent should create Docs, Sheets, Slides, and Forms for this project.
                    </p>
                  </div>
                  <RoundedList>
                    <RoundedListItem className="flex items-center justify-between gap-3 p-4">
                      <div>
                        <p className="font-medium">Use the organization&apos;s Google account</p>
                        <p className="text-sm text-muted-foreground">
                          Fastest option — a dedicated folder is created inside the org&apos;s existing account.
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        onClick={() => void handleConnectOrgDrive()}
                        disabled={connectingDrive !== null}
                      >
                        {connectingDrive === "org" ? "Connecting..." : "Use org account"}
                      </Button>
                    </RoundedListItem>
                    <RoundedListItem className="flex items-center justify-between gap-3 p-4">
                      <div>
                        <p className="font-medium">Connect a separate account for this project</p>
                        <p className="text-sm text-muted-foreground">
                          More secure — a brand-new Google account scoped to only this project, sharing no
                          token access with the rest of the org.
                        </p>
                      </div>
                      <Button
                        onClick={handleConnectDedicatedDrive}
                        disabled={connectingDrive !== null}
                      >
                        {connectingDrive === "dedicated" ? "Connecting..." : "Connect new account"}
                      </Button>
                    </RoundedListItem>
                  </RoundedList>
                </div>
              )}
            </TabsContent>

            <TabsContent value="outreach" className="mx-auto w-full max-w-2xl space-y-4 mt-0">
              <div className="rounded-lg border border-dashed bg-card p-8 text-center">
                <Phone className="mx-auto mb-4 h-8 w-8 text-muted-foreground" />
                <h3 className="text-lg font-semibold">Outreach Log</h3>
                <p className="mb-4 text-muted-foreground">No outreach logged yet.</p>
                <Button variant="outline"><Plus className="mr-2 h-4 w-4" /> Add Log</Button>
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  )
}
