"use client"

import * as React from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { Calendar, ChevronRight, Plus, Search, MoreHorizontal, Trash2, ArrowRight, Info, AlertCircle } from "lucide-react"
import { VscGithubProject } from "react-icons/vsc"
import { toast } from "sonner"

import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { RoundedList, RoundedListItem, RoundedListItemIcon } from "@/components/ui/rounded-list"
import { GeminiSVG } from "@/components/ui/gemini-svg"
import { useAuth } from "@/hooks/use-auth"
import { useHeaderStore } from "@/hooks/use-header-store"
import { BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb"
import { db } from "@/lib/firebase"
import { collection, query, where, getDocs, limit, doc, getDoc, deleteDoc, orderBy } from "firebase/firestore"
import { ProjectIcon } from "@/components/project-icon"

// Project Document Type
interface Project {
  id: string
  name: string
  status: "planning" | "active" | "completed" | "closed"
  date: { toDate?: () => Date } | string | null
  icon?: string
  iconUrl?: string
  tenantId: string
  orgId: string
}

const PROJECT_STATUS_CONFIG = {
  planning: { label: "Planning", color: "text-[#0969da] dark:text-[#58a6ff] bg-[#0969da]/10 dark:bg-[#58a6ff]/10 border-[#0969da]/30 dark:border-[#58a6ff]/30" },
  active: { label: "Active", color: "text-[#1a7f37] dark:text-[#3fb950] bg-[#1a7f37]/10 dark:bg-[#3fb950]/10 border-[#1a7f37]/30 dark:border-[#3fb950]/30" },
  completed: { label: "Completed", color: "text-[#8250df] dark:text-[#bc8cff] bg-[#8250df]/10 dark:bg-[#bc8cff]/10 border-[#8250df]/30 dark:border-[#bc8cff]/30" },
  closed: { label: "Closed", color: "text-[#c25000] dark:text-[#f0883e] bg-[#c25000]/10 dark:bg-[#f0883e]/10 border-[#c25000]/30 dark:border-[#f0883e]/30" },
}

export default function ProjectsPage() {
  const { tenantNamespace, orgSlug } = useParams<{ tenantNamespace: string; orgSlug: string }>()
  const router = useRouter()
  const { user } = useAuth()
  const { setBreadcrumbs, setActions, clearHeader } = useHeaderStore()

  // State
  const [tenantId, setTenantId] = React.useState<string | null>(null)
  const [orgId, setOrgId] = React.useState<string | null>(null)
  const [projects, setProjects] = React.useState<Project[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [searchQuery, setSearchQuery] = React.useState("")

  // Set breadcrumbs on load
  React.useEffect(() => {
    setBreadcrumbs(
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbPage>Projects</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    )
    setActions(
      <Link href={`/org/${tenantNamespace}/${orgSlug}/projects/new`}>
        <Button size="icon" variant="outline" className="rounded-full h-8 w-8">
          <Plus className="h-4 w-4" />
          <span className="sr-only">New Project</span>
        </Button>
      </Link>
    )
    return () => clearHeader()
  }, [tenantNamespace, orgSlug, setBreadcrumbs, setActions, clearHeader])

  // Resolve Workspace and permissions
  React.useEffect(() => {
    if (!user) return

    const resolveWorkspace = async () => {
      try {
        setError(null)
        setLoading(true)

        // 1. Resolve tenant domain from urlNamespace
        const instQuery = query(
          collection(db, "tenants"),
          where("urlNamespace", "==", tenantNamespace),
          limit(1)
        )
        const instSnap = await getDocs(instQuery)
        if (instSnap.empty) {
          setError(`No institution found for URL namespace: ${tenantNamespace}`)
          setLoading(false)
          return
        }
        const tId = instSnap.docs[0].id
        setTenantId(tId)

        // 2. Resolve organization by tenantId and slug
        const orgQuery = query(
          collection(db, "organizations"),
          where("tenantId", "==", tId),
          where("slug", "==", orgSlug),
          limit(1)
        )
        const orgSnap = await getDocs(orgQuery)
        if (orgSnap.empty) {
          setError(`No organization found with slug "${orgSlug}"`)
          setLoading(false)
          return
        }
        const oId = orgSnap.docs[0].id
        setOrgId(oId)
      } catch (err) {
        console.error("Workspace resolution error:", err)
        setError("Failed to resolve workspace. Please try again.")
        setLoading(false)
      }
    }

    void resolveWorkspace()
  }, [user, tenantNamespace, orgSlug])

  // Load Projects from Firestore once tenantId and orgId are resolved
  const loadProjects = React.useCallback(async () => {
    if (!tenantId || !orgId) return
    setLoading(true)
    setError(null)

    try {
      // Scoped securely by tenantId and orgId per tenant-safe-query guidelines
      const projectsQuery = query(
        collection(db, "projects"),
        where("tenantId", "==", tenantId),
        where("orgId", "==", orgId),
        orderBy("createdAt", "desc")
      )
      const querySnap = await getDocs(projectsQuery)
      const fetchedProjects: Project[] = querySnap.docs.map((doc) => {
        const data = doc.data()
        return {
          id: doc.id,
          name: data.name || "Untitled Project",
          status: data.status || "planning",
          date: data.date || null,
          icon: data.icon || "",
          iconUrl: data.iconUrl || "",
          tenantId: data.tenantId,
          orgId: data.orgId,
        }
      })
      setProjects(fetchedProjects)
    } catch (err) {
      console.error("Error loading projects:", err)
      setError("Failed to load projects from the database.")
    } finally {
      setLoading(false)
    }
  }, [tenantId, orgId])

  React.useEffect(() => {
    if (tenantId && orgId) {
      void loadProjects()
    }
  }, [tenantId, orgId, loadProjects])

  // Delete project handler
  const handleDeleteProject = async (projectId: string) => {
    const confirmDelete = window.confirm("Are you sure you want to delete this project? All associated tasks will remain but the project link will be deleted.")
    if (!confirmDelete) return

    const toastId = toast.loading("Deleting project...")
    try {
      // Security check: Verify that the project belongs to the current org before deleting
      const projectDocRef = doc(db, "projects", projectId)
      const projectSnap = await getDoc(projectDocRef)
      
      if (!projectSnap.exists()) {
        toast.error("Project not found", { id: toastId })
        return
      }

      const pData = projectSnap.data()
      if (pData.tenantId !== tenantId || pData.orgId !== orgId) {
        toast.error("Security violation: Unauthorized deletion attempt", { id: toastId })
        return
      }

      await deleteDoc(projectDocRef)
      toast.success("Project deleted successfully", { id: toastId })
      setProjects((prev) => prev.filter((p) => p.id !== projectId))
    } catch (err) {
      console.error("Failed to delete project:", err)
      toast.error("Failed to delete project. Please check permissions.", { id: toastId })
    }
  }

  // Format timestamp/date helper
  const formatDate = (dateVal: Project["date"]) => {
    if (!dateVal) return "No start date"
    let d: Date
    if (typeof dateVal === "object" && "toDate" in dateVal && typeof dateVal.toDate === "function") {
      d = dateVal.toDate()
    } else if (typeof dateVal === "string") {
      d = new Date(dateVal)
    } else {
      return "Invalid date"
    }
    if (isNaN(d.getTime())) return "Invalid date"
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
  }

  // Client-side search filtering
  const filteredProjects = projects.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  if (loading && projects.length === 0) {
    return (
      <div className="flex flex-col h-full bg-background animate-in fade-in-50 duration-300">
        <div className="p-6 flex-grow overflow-auto bg-muted/10">
          <div className="max-w-4xl mx-auto py-4 space-y-14">
            <div className="flex items-start gap-3">
              <Skeleton className="h-5 w-5 rounded-full mt-1 animate-pulse" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-5 w-32 animate-pulse" />
                <Skeleton className="h-4 w-72 animate-pulse" />
              </div>
            </div>

            {/* List Skeleton */}
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 w-full rounded-md border bg-card p-2 flex items-center justify-between animate-pulse" />
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-[80vh] items-center justify-center p-6">
        <div className="w-full max-w-md space-y-4">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Database error</AlertTitle>
            <AlertDescription>{error || "Failed to load projects from the database."}</AlertDescription>
            <AlertAction>
              <Button onClick={() => void loadProjects()} variant="outline">
                Try again
              </Button>
            </AlertAction>
          </Alert>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="p-6 flex-grow overflow-auto bg-muted/10">
        <div className="max-w-4xl mx-auto py-4 space-y-14">
          <div id="all-projects" className="scroll-mt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <VscGithubProject className="w-5 h-5 mt-1 text-primary shrink-0" />
              <div>
                <h2 className="font-heading text-base font-medium">All Projects</h2>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Listed below are active and closed projects for your workspace.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center relative w-full sm:w-auto">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  className="rounded-full pl-9 w-full sm:w-[240px]"
                  placeholder="Search Projects"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div>
              {filteredProjects.length === 0 ? (
                searchQuery ? (
                  <div className="flex h-[250px] flex-col items-center justify-center rounded-2xl border border-dashed text-center bg-card p-6">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 mb-4">
                      <VscGithubProject className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="text-lg font-semibold">No search results</h3>
                    <p className="text-sm text-muted-foreground max-w-sm mt-1">
                      No projects match your search query "{searchQuery}".
                    </p>
                  </div>
                ) : (
                  <div className="space-y-8 max-w-2xl mx-auto animate-in fade-in duration-200">
                    <RoundedList>
                      <RoundedListItem className="w-full p-0">
                        <Link 
                          href={`/org/${tenantNamespace}/${orgSlug}/projects/new?mode=manual`} 
                          className="flex w-full h-auto p-3 hover:bg-muted items-center group/card relative rounded-[inherit] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset bg-card border"
                        >
                          <RoundedListItemIcon className="w-12 min-w-12 h-12 min-h-12 flex items-center justify-center bg-muted mr-4 text-foreground/70 !rounded-lg group-first/row:!rounded-tl-2xl group-last/row:!rounded-bl-2xl group-hover/card:bg-background group-hover/card:text-primary transition-colors duration-200">
                            <Plus className="size-5" />
                          </RoundedListItemIcon>
                          <div className="flex flex-col items-start flex-1">
                            <span className="font-semibold text-base">Configure manually</span>
                            <span className="text-xs text-muted-foreground mt-0.5">Manually input details, start date, and choose icons</span>
                          </div>
                          <ArrowRight className="size-4 text-muted-foreground opacity-0 group-hover/card:opacity-100 transition-opacity duration-200 mr-2 self-center shrink-0" />
                        </Link>
                      </RoundedListItem>

                      <RoundedListItem className="w-full p-0">
                        <Link 
                          href={`/org/${tenantNamespace}/${orgSlug}`}
                          className="flex w-full h-auto p-3 hover:bg-muted items-center group/card relative rounded-[inherit] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset bg-card border"
                        >
                          <RoundedListItemIcon className="w-12 min-w-12 h-12 min-h-12 flex items-center justify-center bg-muted mr-4 text-foreground/70 !rounded-lg group-first/row:!rounded-tl-2xl group-last/row:!rounded-bl-2xl group-hover/card:bg-background group-hover/card:text-primary transition-colors duration-200">
                            <GeminiSVG className="size-5" />
                          </RoundedListItemIcon>
                          <div className="flex flex-col items-start flex-1">
                            <span className="font-semibold text-base">Create with Fello Agent</span>
                            <span className="text-xs text-muted-foreground mt-0.5">Have Fello Agent configure and schedule everything for you</span>
                          </div>
                          <ArrowRight className="size-4 text-muted-foreground opacity-0 group-hover/card:opacity-100 transition-opacity duration-200 mr-2 self-center shrink-0" />
                        </Link>
                      </RoundedListItem>
                    </RoundedList>

                    <div className="flex items-start gap-2 text-xs text-muted-foreground max-w-[420px] mx-auto bg-muted/30 border border-border/50 p-3 rounded-xl">
                      <Info className="size-3.5 mt-0.5 shrink-0 text-muted-foreground" />
                      <p className="text-left leading-normal">
                        No projects have been created for this organization yet. Choose how you want to configure your first project:
                      </p>
                    </div>
                  </div>
                )
              ) : (
                <ul className="space-y-3 group">
                  {filteredProjects.map((project) => {
                    const statusCfg = PROJECT_STATUS_CONFIG[project.status] || PROJECT_STATUS_CONFIG.planning
                    return (
                      <li
                        key={project.id}
                        className="group/row flex items-start sm:items-center justify-between gap-3 border p-2 rounded-md overflow-hidden first:rounded-t-3xl last:rounded-b-3xl hover:bg-muted/50 transition-colors bg-card"
                      >
                        <Link
                          href={`/org/${tenantNamespace}/${orgSlug}/projects/${project.id}`}
                          className="flex items-start sm:items-center gap-4 overflow-hidden w-full"
                        >
                          <div className="w-12 min-w-12 h-12 min-h-12 flex items-center justify-center bg-muted rounded-lg overflow-hidden group-first/row:rounded-tl-2xl group-last/row:rounded-bl-2xl">
                            <ProjectIcon icon={project.icon} iconUrl={project.iconUrl} />
                          </div>
                          <div className="overflow-hidden">
                            <p className="font-semibold text-sm sm:text-base line-clamp-1 duration-300">
                              {project.name}
                            </p>
                            <div className="flex flex-wrap gap-2 items-center mt-1 *:duration-300 *:!text-xs">
                              {/* Status Badge */}
                              <div className={`flex items-center gap-1 font-semibold ${statusCfg.color} rounded-full px-2 py-0.5 text-xs w-fit border`}>
                                <span>{statusCfg.label}</span>
                              </div>
                              {/* Start Date Badge */}
                              <div className="flex items-center gap-1 font-semibold bg-slate-100 text-gray-700 rounded-full px-2 py-0.5 dark:bg-muted dark:text-muted-foreground border">
                                <Calendar className="w-3.5 h-3.5" />
                                <span>Start: {formatDate(project.date)}</span>
                              </div>
                            </div>
                          </div>
                        </Link>

                        <div className="flex items-center gap-2">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                className="rounded-full h-8 w-8 p-0"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => router.push(`/org/${tenantNamespace}/${orgSlug}/projects/${project.id}`)}
                              >
                                <ChevronRight className="mr-2 h-4 w-4" />
                                View Details
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => handleDeleteProject(project.id)}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete Project
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
  )
}
