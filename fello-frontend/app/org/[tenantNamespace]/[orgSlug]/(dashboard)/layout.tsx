"use client"

import * as React from "react"
import { useParams, useRouter, usePathname } from "next/navigation"
import Link from "next/link"
import { useAuth } from "@/hooks/use-auth"
import { db } from "@/lib/firebase"
import { collection, query, where, getDocs, limit, doc, getDoc, orderBy, updateDoc } from "firebase/firestore"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { Separator } from "@/components/ui/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { Loader2, AlertCircle, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { PiSealWarningBold, PiSealCheckBold } from "react-icons/pi"
import { TbHomeDot } from "react-icons/tb"
import { GeminiSVG } from "@/components/ui/gemini-svg"
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable"
import { useDetailPanelStore } from "@/hooks/use-detail-panel-store"
import { useHeaderStore } from "@/hooks/use-header-store"
import { useOrgStore } from "@/hooks/use-org-store"
import { Breadcrumb } from "@/components/ui/breadcrumb"

interface OrgData {
  id: string
  name: string
  logo: string
  slug: string
  verified?: boolean
}

interface SidebarProject {
  id: string
  name: string
  icon?: string
  iconUrl?: string
}

export default function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { tenantNamespace, orgSlug } = useParams<{ tenantNamespace: string; orgSlug: string }>()
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()

  const [loading, setLoading] = React.useState(true)
  const [errorStatus, setErrorStatus] = React.useState<"NOT_FOUND" | "NO_ACCESS" | "ERROR" | null>(null)
  
  const [currentOrg, setCurrentOrg] = React.useState<OrgData | null>(null)
  const [userOrgs, setUserOrgs] = React.useState<OrgData[]>([])
  const [sidebarProjects, setSidebarProjects] = React.useState<SidebarProject[]>([])
  // Non-null only for external/guest contributors: the project ids they're
  // allowed to see in this org. Full org members leave this null.
  const [guestProjectIds, setGuestProjectIds] = React.useState<string[] | null>(null)

  const { isOpen, size, setSize, content, closePanel, isOpening } = useDetailPanelStore()
  const { breadcrumbs, actions } = useHeaderStore()
  const setActiveOrg = useOrgStore((s) => s.setActiveOrg)
  const pathname = usePathname()
  
  const segments = pathname ? pathname.split("/").filter(Boolean) : []
  const mainPageSegment = segments[3] || "Fello Agent"
  const formattedPageName = mainPageSegment.charAt(0).toUpperCase() + mainPageSegment.slice(1)

  React.useEffect(() => {
    if (authLoading) return

    if (!user) {
      router.push("/sign-in")
      return
    }

    const resolveWorkspaceAndPermissions = async () => {
      setLoading(true)
      setErrorStatus(null)
      setGuestProjectIds(null)
      setSidebarProjects([])

      try {
        // 1. Resolve tenant domain from urlNamespace (C-3 Improvement)
        const instQuery = query(
          collection(db, "tenants"),
          where("urlNamespace", "==", tenantNamespace),
          limit(1)
        )
        const instSnap = await getDocs(instQuery)
        
        if (instSnap.empty) {
          console.warn(`No institution found for URL namespace: ${tenantNamespace}`)
          setErrorStatus("NOT_FOUND")
          setLoading(false)
          return
        }

        const tenantId = instSnap.docs[0].id // e.g., "my.sliit.lk" or "my-school.lk"

        // 2. Resolve organization by tenantId and slug
        const orgQuery = query(
          collection(db, "organizations"),
          where("tenantId", "==", tenantId),
          where("slug", "==", orgSlug),
          limit(1)
        )
        const orgSnap = await getDocs(orgQuery)

        if (orgSnap.empty) {
          console.warn(`No organization found with slug "${orgSlug}" in tenant "${tenantId}"`)
          setErrorStatus("NOT_FOUND")
          setLoading(false)
          return
        }

        const orgDoc = orgSnap.docs[0]
        const orgData = orgDoc.data()

        // Unverified organization gate: only accessible to the creator
        if (!orgData.verified && orgData.createdBy !== user.uid) {
          console.warn(`Unverified organization "${orgSlug}" is only accessible by its creator (${orgData.createdBy})`)
          setErrorStatus("NO_ACCESS")
          setLoading(false)
          return
        }

        const resolvedOrg: OrgData = {
          id: orgDoc.id,
          name: orgData.name,
          logo: orgData.logo || "",
          slug: orgData.slug,
          verified: orgData.verified || false
        }

        // 3. Verify user membership (C-4 Security validation)
        const membershipRef = doc(db, "memberships", `${user.uid}_${resolvedOrg.id}`)
        const membershipSnap = await getDoc(membershipRef)

        let allowedGuestProjectIds: string[] | null = null

        if (!membershipSnap.exists()) {
          // Not a full org member — check whether they're an external
          // contributor with event_only access to a project in this org.
          // If so, let them through; a route guard below confines them to
          // just that project (the real boundary is firestore.rules, this
          // is UX-level, not the security boundary).
          const guestSnap = await getDocs(
            query(
              collection(db, "project_memberships"),
              where("tenantId", "==", tenantId),
              where("orgId", "==", resolvedOrg.id),
              where("contactId", "==", user.uid),
              where("status", "==", "active")
            )
          )
          if (guestSnap.empty) {
            console.warn(`User ${user.uid} does not have a membership for organization ${resolvedOrg.id}`)
            setErrorStatus("NO_ACCESS")
            setLoading(false)
            return
          }
          allowedGuestProjectIds = guestSnap.docs.map((d) => d.data().projectId as string)
          setGuestProjectIds(allowedGuestProjectIds)
        }

        setCurrentOrg(resolvedOrg)

        // Update user's lastOpenedOrg in Firestore safely
        try {
          await updateDoc(doc(db, "users", user.uid), {
            lastOpenedOrg: resolvedOrg.id
          })
        } catch (updateErr) {
          console.warn("Failed to update user's lastOpenedOrg:", updateErr)
        }

        // Share the resolved internal org id with pages (e.g. the dashboard chat)
        // so the agent route knows which verified org it's operating in.
        setActiveOrg({
          id: resolvedOrg.id,
          name: resolvedOrg.name,
          slug: resolvedOrg.slug,
          tenantNamespace,
        })

        const projectsSnap = allowedGuestProjectIds
          ? allowedGuestProjectIds.length > 0
            ? await getDocs(
                query(
                  collection(db, "projects"),
                  where("tenantId", "==", tenantId),
                  where("orgId", "==", resolvedOrg.id),
                  where("id", "in", allowedGuestProjectIds.slice(0, 10))
                )
              )
            : null
          : await getDocs(
              query(
                collection(db, "projects"),
                where("tenantId", "==", tenantId),
                where("orgId", "==", resolvedOrg.id),
                orderBy("createdAt", "desc")
              )
            )
        const fetchedProjects = projectsSnap
          ? projectsSnap.docs.map((projectDoc) => {
              const data = projectDoc.data()
              return {
                id: projectDoc.id,
                name: data.name || "Untitled Project",
                icon: data.icon || "",
                iconUrl: data.iconUrl || "",
              }
            })
          : []
        setSidebarProjects(fetchedProjects)

        // 4. Fetch all other organizations this user belongs to in the same tenant (for Sidebar Switcher)
        const membershipsQuery = query(
          collection(db, "memberships"),
          where("userId", "==", user.uid),
          where("tenantId", "==", tenantId)
        )
        const membershipsSnap = await getDocs(membershipsQuery)
        
        const orgIds = membershipsSnap.docs.map(doc => doc.data().orgId).filter(Boolean)

        if (orgIds.length > 0) {
          // Query organization details for all membership IDs
          const orgsQuery = query(
            collection(db, "organizations"),
            where("id", "in", orgIds)
          )
          const orgsSnap = await getDocs(orgsQuery)
          const fetchedOrgs = orgsSnap.docs
            .map(d => ({
              id: d.id,
              name: d.data().name,
              logo: d.data().logo || "",
              slug: d.data().slug,
              verified: d.data().verified || false,
              createdBy: d.data().createdBy || ""
            }))
            .filter(org => org.verified || org.createdBy === user.uid)
          setUserOrgs(fetchedOrgs)
        } else {
          setUserOrgs([resolvedOrg])
        }

      } catch (err) {
        console.error("Workspace resolution failed:", err)
        setErrorStatus("ERROR")
      } finally {
        setLoading(false)
      }
    }

    void resolveWorkspaceAndPermissions()
  }, [user, authLoading, tenantNamespace, orgSlug])

  // Guest contributors only ever see their invited project(s) — everything
  // else (project list, directory, settings, other projects) redirects back
  // to their allowed project. This is UX confinement, not the security
  // boundary (firestore.rules enforces the real boundary).
  React.useEffect(() => {
    if (!guestProjectIds || !currentOrg || !pathname) return
    const base = `/org/${tenantNamespace}/${orgSlug}`
    const allowedPath = guestProjectIds[0] ? `${base}/projects/${guestProjectIds[0]}` : base
    const isOnAllowedProject = guestProjectIds.some((id) => pathname.startsWith(`${base}/projects/${id}`))
    if (!isOnAllowedProject) {
      router.replace(allowedPath)
    }
  }, [guestProjectIds, currentOrg, pathname, tenantNamespace, orgSlug, router])

  if (authLoading || loading) {
    return (
      <div className="flex h-screen w-screen bg-background overflow-hidden relative">
        {/* Decorative background glows */}
        <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-96 h-96 rounded-full bg-blue-500/5 blur-3xl" />

        {/* Sidebar Skeleton */}
        <aside className="w-64 bg-card p-4 flex flex-col gap-6 shrink-0 relative z-10 hidden md:flex h-full">
          <div className="flex items-center gap-3 py-2 border-b border-border/40 shrink-0">
            <Skeleton className="size-8 rounded-lg" />
            <div className="flex flex-col gap-1.5 flex-1">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
          <div className="flex-1 flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Skeleton className="h-3.5 w-20 mb-2" />
              <Skeleton className="h-9 w-full rounded-lg" />
              <Skeleton className="h-9 w-full rounded-lg" />
              <Skeleton className="h-9 w-full rounded-lg" />
            </div>
            <div className="flex flex-col gap-2 mt-4">
              <Skeleton className="h-3.5 w-24 mb-2" />
              <Skeleton className="h-9 w-full rounded-lg" />
              <Skeleton className="h-9 w-full rounded-lg" />
            </div>
          </div>
          <div className="flex items-center gap-3 py-2 border-t border-border/40 shrink-0 mt-auto">
            <Skeleton className="size-8 rounded-full" />
            <div className="flex flex-col gap-1.5 flex-1">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-3 w-32" />
            </div>
          </div>
        </aside>

        {/* Main Content Area Skeleton */}
        <div className="flex-1 flex h-screen flex-col *:flex *:h-full *:flex-col *:overflow-hidden *:rounded-xl py-0 md:py-2 pr-0 md:pr-2 duration-300 relative z-10">
          <div className="border border-border/80 bg-background flex flex-col h-full flex-1">
            <header className="h-16 border-b border-border/80 flex items-center px-6 gap-3 shrink-0 bg-background/50 backdrop-blur-sm justify-between">
              <div className="flex items-center gap-3">
                <Skeleton className="size-8 rounded-lg" />
                <div className="h-4 w-px bg-border" />
                <Skeleton className="h-4 w-24" />
              </div>
              <Skeleton className="size-8 rounded-full" />
            </header>
            <main className="flex-1 p-6 md:p-10 flex flex-col gap-6 overflow-y-auto bg-muted/10">
              <div className="flex flex-col gap-2">
                <Skeleton className="h-7 w-48" />
                <Skeleton className="h-4 w-80" />
              </div>
            </main>
          </div>
        </div>
      </div>
    )
  }

  if (errorStatus === "NOT_FOUND") {
    return (
      <div className="flex h-screen w-screen items-center justify-center p-4 bg-background">
        <div className="max-w-md w-full bg-card border border-border rounded-2xl p-6 shadow-lg text-center flex flex-col gap-4">
          <div className="size-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mx-auto">
            <AlertCircle className="size-6" />
          </div>
          <h2 className="text-xl font-bold">Workspace Not Found</h2>
          <p className="text-muted-foreground text-sm">
            We couldn&apos;t find the organization workspace at this path, or it has not been verified yet.
          </p>
          <Button onClick={() => router.push("/")} className="w-full">
            Back to Home
          </Button>
        </div>
      </div>
    )
  }

  if (errorStatus === "NO_ACCESS") {
    return (
      <div className="flex h-screen w-screen items-center justify-center p-4 bg-background">
        <div className="max-w-md w-full bg-card border border-border rounded-2xl p-6 shadow-lg text-center flex flex-col gap-4">
          <div className="size-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mx-auto">
            <AlertCircle className="size-6" />
          </div>
          <h2 className="text-xl font-bold">Access Denied</h2>
          <p className="text-muted-foreground text-sm">
            You do not have membership authorization to access this workspace. Please contact your administrator.
          </p>
          <Button onClick={() => router.push("/")} className="w-full">
            Back to Home
          </Button>
        </div>
      </div>
    )
  }

  if (errorStatus === "ERROR") {
    return (
      <div className="flex h-screen w-screen items-center justify-center p-4 bg-background">
        <div className="max-w-md w-full bg-card border border-border rounded-2xl p-6 shadow-lg text-center flex flex-col gap-4">
          <div className="size-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mx-auto">
            <AlertCircle className="size-6" />
          </div>
          <h2 className="text-xl font-bold">Resolution Error</h2>
          <p className="text-muted-foreground text-sm">
            A connection or database issue occurred while verifying permissions.
          </p>
          <Button onClick={() => router.push("/")} className="w-full">
            Back to Home
          </Button>
        </div>
      </div>
    )
  }

  return (
    <SidebarProvider>
      <AppSidebar currentOrg={currentOrg || undefined} userOrgs={userOrgs} projects={sidebarProjects} />
      <div className="flex h-screen w-full flex-col py-0 md:py-2 pr-0 md:pr-2 duration-300">
        <ResizablePanelGroup
          id="org-layout-panel-group"
          orientation="horizontal"
          className="h-full gap-2"
        >
          <ResizablePanel id="main-content-panel">
            <SidebarInset className="border border-border/80 h-full overflow-hidden rounded-xl">
              <div className="flex flex-col h-full overflow-hidden w-full bg-background">
                 <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-2 bg-background/70 backdrop-blur-md">
                  <div className="flex w-full items-center justify-between px-4">
                    <div className="flex items-center gap-2">
                      <SidebarTrigger className="-ml-1" />
                      <Separator
                        orientation="vertical"
                        className="mr-2 h-4 self-center"
                      />
                      <div className="flex items-center gap-1.5 text-sm font-medium select-none">
                        <Link href={`/org/${tenantNamespace}/${orgSlug}`} className="hover:text-primary transition-colors flex items-center">
                          <TbHomeDot className="size-4 text-muted-foreground/80 hover:text-primary shrink-0" />
                        </Link>
                        <ChevronRight className="size-3 text-muted-foreground/60 shrink-0" />
                        {breadcrumbs ? (
                          <Breadcrumb className="flex items-center">
                            {breadcrumbs}
                          </Breadcrumb>
                        ) : (
                          <span className="capitalize text-foreground font-normal text-sm">
                            {formattedPageName}
                          </span>
                        )}
                      </div>
                    </div>
                    {actions ? (
                      <div className="flex items-center gap-2">
                        {actions}
                      </div>
                    ) : null}
                  </div>
                </header>
                <div className="flex-grow flex flex-col min-h-0 overflow-y-auto w-full relative">
                  {children}
                </div>
              </div>
            </SidebarInset>
          </ResizablePanel>

          {isOpen && <ResizableHandle withHandle />}

          {isOpen && (
            <ResizablePanel
              id="detail-panel"
              collapsible
              collapsedSize="0px"
              minSize="200px"
              maxSize="600px"
              defaultSize="300px"
              onCollapse={closePanel}
              className="h-full"
            >
              <div className="h-full border border-border/80 bg-background rounded-xl overflow-hidden shadow-lg">
                {content}
              </div>
            </ResizablePanel>
          )}
        </ResizablePanelGroup>
      </div>
    </SidebarProvider>
  )
}
