"use client"

import * as React from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { Calendar as CalendarIcon, Loader2, Plus, ArrowRight, MessageSquare, FolderOpen, CheckCircle2 } from "lucide-react"
import { VscGithubProject } from "react-icons/vsc"
import { SiGoogledrive } from "react-icons/si"
import { toast } from "sonner"
import { format } from "date-fns"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { Textarea } from "@/components/ui/textarea"
import { RoundedList, RoundedListItem, RoundedListItemIcon } from "@/components/ui/rounded-list"
import { GeminiSVG } from "@/components/ui/gemini-svg"
import { useAuth } from "@/hooks/use-auth"
import { useHeaderStore } from "@/hooks/use-header-store"
import { BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb"
import { db, storage } from "@/lib/firebase"
import { collection, query, where, getDocs, limit, doc, setDoc, serverTimestamp, Timestamp, getDoc } from "firebase/firestore"
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage"
import { ProjectIcon } from "@/components/project-icon"

const PROJECT_DRAFT_KEY = "fello-project-draft-id"

interface GoogleDriveIntegration {
  connected?: boolean
  email?: string
  name?: string
}

export default function NewProjectPage() {
  const { tenantNamespace, orgSlug } = useParams<{ tenantNamespace: string; orgSlug: string }>()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user } = useAuth()
  const { setBreadcrumbs, clearHeader } = useHeaderStore()

  // Generate unique project ID on mount to securely isolate storage uploads
  const [projectId] = React.useState(() => doc(collection(db, "projects")).id)
  const [draftId] = React.useState(() => {
    if (typeof window === "undefined") return ""
    const existing = window.sessionStorage.getItem(PROJECT_DRAFT_KEY)
    if (existing) return existing
    const next = doc(collection(db, "projects")).id
    window.sessionStorage.setItem(PROJECT_DRAFT_KEY, next)
    return next
  })

  // View state: "options" or "manual"
  const [viewMode, setViewMode] = React.useState<"options" | "manual">("options")

  // Form states
  const [projectName, setProjectName] = React.useState("")
  const [startDate, setStartDate] = React.useState("")
  const [dueDate, setDueDate] = React.useState("")
  const [iconValue, setIconValue] = React.useState("")
  const [iconUrl, setIconUrl] = React.useState("")
  const [description, setDescription] = React.useState("")
  const [driveRootFolderId, setDriveRootFolderId] = React.useState("")
  const [whatsappGatewayNumber, setWhatsappGatewayNumber] = React.useState("")
  const [whatsappSetupConfirmed, setWhatsappSetupConfirmed] = React.useState(false)

  // Track session-uploaded icons
  const [firebaseIcons, setFirebaseIcons] = React.useState<string[]>([])

  // Resolution states
  const [tenantId, setTenantId] = React.useState<string | null>(null)
  const [orgId, setOrgId] = React.useState<string | null>(null)
  const [resolving, setResolving] = React.useState(true)

  // UI operation states
  const [isUploading, setIsUploading] = React.useState(false)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [tempIconPath, setTempIconPath] = React.useState("")
  const [googleDriveAccount, setGoogleDriveAccount] = React.useState<GoogleDriveIntegration | null>(null)

  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const whatsappInputRef = React.useRef<HTMLInputElement>(null)

  const cleanupTempIcon = React.useCallback(async () => {
    if (!tempIconPath) return
    try {
      await deleteObject(ref(storage, tempIconPath))
    } catch (err) {
      console.warn("Failed to clean up temp project icon:", err)
    } finally {
      setTempIconPath("")
      setIconValue("")
      setIconUrl("")
    }
  }, [tempIconPath])

  React.useEffect(() => {
    if (searchParams.get("mode") === "manual") {
      setViewMode("manual")
    }
  }, [searchParams])

  React.useEffect(() => {
    return () => {
      void cleanupTempIcon()
    }
  }, [cleanupTempIcon])

  // Set breadcrumbs on load
  React.useEffect(() => {
    setBreadcrumbs(
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink href={`/org/${tenantNamespace}/${orgSlug}/projects`}>
            Projects
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage>New Project</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    )
    return () => clearHeader()
  }, [tenantNamespace, orgSlug, setBreadcrumbs, clearHeader])

  // Resolve tenantId and orgId from URL namespace and slug
  React.useEffect(() => {
    if (!user) return

    const resolveWorkspace = async () => {
      try {
        setResolving(true)
        // Resolve tenant domain from urlNamespace
        const instQuery = query(
          collection(db, "tenants"),
          where("urlNamespace", "==", tenantNamespace),
          limit(1)
        )
        const instSnap = await getDocs(instQuery)
        if (instSnap.empty) {
          toast.error("Institution context not found.")
          setResolving(false)
          return
        }
        const tId = instSnap.docs[0].id
        setTenantId(tId)

        // Resolve organization by tenantId and slug
        const orgQuery = query(
          collection(db, "organizations"),
          where("tenantId", "==", tId),
          where("slug", "==", orgSlug),
          limit(1)
        )
        const orgSnap = await getDocs(orgQuery)
        if (orgSnap.empty) {
          toast.error("Organization context not found.")
          setResolving(false)
          return
        }
        const oId = orgSnap.docs[0].id
        setOrgId(oId)

        // Admin/coordinator-only doc — a permission error here just means
        // this member can't use the org grant, same as "not connected".
        const integrationDoc = await getDoc(doc(db, "google_integrations", oId)).catch(() => null)
        if (integrationDoc && integrationDoc.exists()) {
          setGoogleDriveAccount(integrationDoc.data() as GoogleDriveIntegration)
        } else {
          setGoogleDriveAccount(null)
        }
      } catch (err) {
        console.error("Failed to resolve workspace:", err)
        toast.error("Error loading workspace data.")
      } finally {
        setResolving(false)
      }
    }

    void resolveWorkspace()
  }, [user, tenantNamespace, orgSlug])

  // Client-side file validation and secure instant upload
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // 1. Validate MIME type (images only)
    if (!file.type.startsWith("image/")) {
      toast.error("Invalid file type. Please upload an image.")
      return
    }

    // 2. Validate File Size (cap at 2MB)
    const MAX_SIZE = 2 * 1024 * 1024 // 2MB
    if (file.size > MAX_SIZE) {
      toast.error("File size exceeds 2MB limit. Please upload a smaller image.")
      return
    }

    if (!tenantId || !orgId) {
      toast.error("Tenant/org details not resolved yet. Please wait.")
      return
    }

    setIsUploading(true)
    const toastId = toast.loading("Uploading icon...")
    try {
      const ext = file.name.split(".").pop() || "png"
      // Temporary storage path until the project is actually created
      const storagePath = `tenants/${tenantId}/orgs/${orgId}/projects/tmp/${draftId}/icon.${ext}`
      const storageRef = ref(storage, storagePath)

      if (tempIconPath && tempIconPath !== storagePath) {
        try {
          await deleteObject(ref(storage, tempIconPath))
        } catch (cleanupErr) {
          console.warn("Failed to replace previous temp icon:", cleanupErr)
        }
      }

      await uploadBytes(storageRef, file)
      const downloadUrl = await getDownloadURL(storageRef)

      setTempIconPath(storagePath)
      setIconValue(storagePath)
      setIconUrl(downloadUrl)
      setFirebaseIcons((prev) => [downloadUrl, ...prev])
      toast.success("Icon uploaded successfully!", { id: toastId })
    } catch (uploadErr) {
      console.error("Storage upload failed:", uploadErr)
      toast.error("Icon upload failed.", { id: toastId })
    } finally {
      setIsUploading(false)
    }
  }

  const handleConnectGoogleDrive = () => {
    if (!orgId) {
      toast.error("Organization context not resolved yet. Please wait.")
      return
    }
    window.location.href = `/api/auth/google?orgId=${orgId}&tenantNamespace=${tenantNamespace}&orgSlug=${orgSlug}`
  }

  const handleSetupWhatsApp = () => {
    if (!whatsappGatewayNumber.trim()) {
      toast.error("Add the WhatsApp gateway number first.")
      whatsappInputRef.current?.focus()
      return
    }

    setWhatsappSetupConfirmed(true)
    toast.success("WhatsApp number will be linked when the project is created.")
  }

  // Handle Project Creation
  const handleCreateProject = async () => {
    if (!projectName.trim()) {
      toast.error("Project name is required.")
      return
    }
    if (!tenantId || !orgId || !user) {
      toast.error("Authentication or tenant context missing.")
      return
    }

    setIsSubmitting(true)
    const toastId = toast.loading("Creating project...")

    try {
      // 1. Construct Dates
      // If no start date is provided, default to creation timestamp on the server
      const finalStartDate = startDate 
        ? Timestamp.fromDate(new Date(startDate)) 
        : serverTimestamp()

      const finalDueDate = dueDate
        ? Timestamp.fromDate(new Date(dueDate))
        : null

      // 2. Save Project Document in Firestore
      const projectRef = doc(db, "projects", projectId)
      let finalIconValue = iconValue
      let finalIconUrl = iconUrl

      if (tempIconPath && tempIconPath.startsWith(`tenants/${tenantId}/orgs/${orgId}/projects/tmp/${draftId}/`)) {
        try {
          const tempRef = ref(storage, tempIconPath)
          const tempDownloadUrl = await getDownloadURL(tempRef)
          const response = await fetch(tempDownloadUrl)
          const blob = await response.blob()
          const ext = tempIconPath.split(".").pop() || "png"
          const finalStoragePath = `tenants/${tenantId}/orgs/${orgId}/projects/${projectId}/icon.${ext}`
          const finalRef = ref(storage, finalStoragePath)
          await uploadBytes(finalRef, blob)
          finalIconValue = finalStoragePath
          finalIconUrl = await getDownloadURL(finalRef)
          await deleteObject(tempRef)
        } catch (copyErr) {
          console.error("Failed to move temp project icon:", copyErr)
        }
      }

      const newProjectData = {
        id: projectId,
        orgId: orgId,
        tenantId: tenantId,
        nodeId: "", // Optional/empty default node
        name: projectName.trim(),
        description: description.trim() || "",
        type: "project",
        status: "planning",
        date: finalStartDate,
        dueDate: finalDueDate,
        icon: finalIconValue || "", // Store emoji or storage reference path
        iconUrl: finalIconUrl || "", // Store direct download URL if uploaded
        driveAccountType: "org",
        driveRootFolderId: driveRootFolderId.trim(),
        whatsappGatewayNumber: whatsappGatewayNumber.trim() || null,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
      }

      await setDoc(projectRef, newProjectData)
      await cleanupTempIcon()
      if (typeof window !== "undefined") {
        window.sessionStorage.removeItem(PROJECT_DRAFT_KEY)
      }

      toast.success("Project created successfully!", { id: toastId })
      router.push(`/org/${tenantNamespace}/${orgSlug}/projects`)
    } catch (err) {
      console.error("Failed to create project:", err)
      toast.error("Failed to create project. Please try again.", { id: toastId })
    } finally {
      setIsSubmitting(false)
    }
  }

  if (resolving) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-background animate-in fade-in-50 duration-300">
      <div className="p-6 flex-grow overflow-auto bg-muted/10">
        <div className="max-w-2xl mx-auto py-4 space-y-14">
          
          {viewMode === "options" ? (
            <div className="space-y-8 animate-in fade-in duration-200">
              {/* Header */}
              <div className="flex gap-3">
                <VscGithubProject className="w-5 h-5 mt-1 text-primary shrink-0" />
                <div>
                  <h2 className="font-heading text-base font-medium">Create a new project</h2>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Choose how you want to configure your new project
                  </p>
                </div>
              </div>

              {/* Options list styled exactly like Org Selector page */}
              <RoundedList className="mt-4">
                <RoundedListItem className="w-full p-0">
                  <button 
                    onClick={() => setViewMode("manual")}
                    className="flex w-full h-auto p-3 hover:bg-muted items-center text-left group/card relative rounded-[inherit] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                  >
                    <RoundedListItemIcon className="w-12 min-w-12 h-12 min-h-12 flex items-center justify-center bg-muted mr-4 text-foreground/70 !rounded-lg group-first/row:!rounded-tl-2xl group-last/row:!rounded-bl-2xl group-hover/card:bg-background group-hover/card:text-primary transition-colors duration-200">
                      <Plus className="size-5" />
                    </RoundedListItemIcon>
                    <div className="flex flex-col items-start flex-1">
                      <span className="font-semibold text-base">Configure manually</span>
                      <span className="text-xs text-muted-foreground mt-0.5">Manually input details, start date, and choose icons</span>
                    </div>
                    <ArrowRight className="size-4 text-muted-foreground opacity-0 group-hover/card:opacity-100 transition-opacity duration-200 mr-2 self-center shrink-0" />
                  </button>
                </RoundedListItem>

                <RoundedListItem className="w-full p-0">
                  <button 
                    onClick={() => router.push(`/org/${tenantNamespace}/${orgSlug}`)}
                    className="flex w-full h-auto p-3 hover:bg-muted items-center text-left group/card relative rounded-[inherit] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                  >
                    <RoundedListItemIcon className="w-12 min-w-12 h-12 min-h-12 flex items-center justify-center bg-muted mr-4 text-foreground/70 !rounded-lg group-first/row:!rounded-tl-2xl group-last/row:!rounded-bl-2xl group-hover/card:bg-background group-hover/card:text-primary transition-colors duration-200">
                      <GeminiSVG className="size-5" />
                    </RoundedListItemIcon>
                    <div className="flex flex-col items-start flex-1">
                      <span className="font-semibold text-base">Create with Fello Agent</span>
                      <span className="text-xs text-muted-foreground mt-0.5">Have Fello Agent configure and schedule everything for you</span>
                    </div>
                    <ArrowRight className="size-4 text-muted-foreground opacity-0 group-hover/card:opacity-100 transition-opacity duration-200 mr-2 self-center shrink-0" />
                  </button>
                </RoundedListItem>
              </RoundedList>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-6">
                <Button
                  variant="ghost"
                  className="rounded-full"
                  onClick={() => router.push(`/org/${tenantNamespace}/${orgSlug}/projects`)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-14 animate-in fade-in duration-200">
              {/* Manual Form Header */}
              <div className="flex gap-3">
                <VscGithubProject className="w-5 h-5 mt-1 text-primary shrink-0" />
                <div>
                  <h2 className="font-heading text-base font-medium">Create a new project</h2>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Fill in the details for your project
                  </p>
                </div>
              </div>

              {/* Section 1: Icon / Visual Picker */}
              <div className="flex items-center gap-6 mt-2">
                {/* Visual Preview Box */}
                <div className="rounded-xl w-16 h-16 flex items-center justify-center bg-muted text-3xl overflow-hidden shrink-0 border select-none">
                  <ProjectIcon icon={iconValue} iconUrl={iconUrl} />
                </div>
                
                <div className="flex flex-col gap-2 flex-1">
                  <Label className="text-sm font-semibold text-foreground">
                    Pick a visual for your project
                  </Label>
                  <div className="flex gap-2 items-center flex-wrap">
                    {/* Emoji input */}
                    <Input
                      placeholder="👀"
                      value={
                        iconValue && /^[\p{Emoji}\p{Symbol}]$/u.test(iconValue)
                          ? iconValue
                          : ""
                      }
                      onChange={(e) => {
                        setIconValue(e.target.value)
                        setIconUrl("") // reset storage URL if using emoji
                      }}
                      className="w-11 text-center rounded-lg h-9 text-lg"
                      maxLength={2}
                      disabled={isSubmitting || isUploading}
                    />
                    
                    {/* Last used 2 uploaded icons list */}
                    <div className="flex gap-2 items-center">
                      {firebaseIcons.slice(0, 2).map((url) => (
                        <Button
                          type="button"
                          key={url}
                          variant="outline"
                          size="icon"
                          className="rounded-lg h-9 w-9 p-1.5 shrink-0"
                          onClick={() => {
                            setIconValue("")
                            setIconUrl(url)
                          }}
                        >
                          <img
                            src={url}
                            alt="icon"
                            className="w-full h-full object-cover rounded-md"
                          />
                        </Button>
                      ))}
                      
                      {/* Upload Trigger Button (plus button) */}
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        accept="image/*"
                        className="hidden"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="rounded-lg h-9 w-9 shrink-0"
                        disabled={isUploading || isSubmitting}
                        onClick={() => fileInputRef.current?.click()}
                        title="Upload new icon"
                      >
                        {isUploading ? (
                          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                        ) : (
                          "+"
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 2: Title & Description Group */}
              <div className="space-y-6">
                {/* Project Title */}
                <div className="space-y-2">
                  <Label htmlFor="project-name" className="text-sm font-semibold text-foreground">
                    Title <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="project-name"
                    placeholder="Project title"
                    className="rounded-full"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    disabled={isSubmitting}
                  />
                </div>

                {/* Description Field */}
                <div className="space-y-2">
                  <Label htmlFor="project-description" className="text-sm font-semibold text-foreground">
                    Description
                  </Label>
                  <Textarea
                    id="project-description"
                    placeholder="Brief description of the project"
                    className="rounded-2xl min-h-[100px]"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              {/* Section 3: Dates (Start Date and Due Date in Grid) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                {/* Start Date */}
                <div className="flex flex-col gap-2">
                  <Label className="text-sm font-semibold text-foreground">Start date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full text-left font-normal rounded-full h-10 px-4 justify-start"
                        disabled={isSubmitting}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                        {startDate ? format(new Date(startDate), "PPP") : "Pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={startDate ? new Date(startDate) : undefined}
                        onSelect={(date) => setStartDate(date ? date.toISOString() : "")}
                      />
                    </PopoverContent>
                  </Popover>
                  <p className="text-xs text-muted-foreground pl-1">
                    If omitted, defaults to the server creation timestamp.
                  </p>
                </div>

                {/* Due Date */}
                <div className="flex flex-col gap-2">
                  <Label className="text-sm font-semibold text-foreground">Due date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full text-left font-normal rounded-full h-10 px-4 justify-start"
                        disabled={isSubmitting}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                        {dueDate ? format(new Date(dueDate), "PPP") : "Pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={dueDate ? new Date(dueDate) : undefined}
                        onSelect={(date) => setDueDate(date ? date.toISOString() : "")}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {/* Section 4: Integrations */}
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Project integrations</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Connect the tools this project will use for files and coordination.
                  </p>
                </div>

                <div className="rounded-xl border bg-card p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground/70">
                      <SiGoogledrive className="size-5" />
                    </div>
                    <div className="min-w-0 flex-1 space-y-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <p className="text-sm font-medium">Google Drive</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {googleDriveAccount?.email
                              ? `Using ${googleDriveAccount.email} for project files.`
                              : "Connect a Google account to store and manage project files."}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="shrink-0 rounded-full"
                          onClick={handleConnectGoogleDrive}
                          disabled={isSubmitting}
                        >
                          {googleDriveAccount?.email ? "Connect another" : "Connect account"}
                        </Button>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="drive-folder" className="text-xs font-medium text-muted-foreground">
                          Drive root folder ID
                        </Label>
                        <div className="relative">
                          <FolderOpen className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            id="drive-folder"
                            placeholder="Optional Google Drive folder ID"
                            className="rounded-full pl-9"
                            value={driveRootFolderId}
                            onChange={(event) => setDriveRootFolderId(event.target.value)}
                            disabled={isSubmitting}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border bg-card p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground/70">
                      <MessageSquare className="size-5" />
                    </div>
                    <div className="min-w-0 flex-1 space-y-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <p className="text-sm font-medium">WhatsApp</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            Add the gateway number this project should use for WhatsApp coordination.
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="shrink-0 rounded-full"
                          onClick={handleSetupWhatsApp}
                          disabled={isSubmitting}
                        >
                          {whatsappSetupConfirmed ? (
                            <>
                              <CheckCircle2 className="mr-2 size-4" />
                              Ready
                            </>
                          ) : (
                            "Set up now"
                          )}
                        </Button>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="whatsapp-number" className="text-xs font-medium text-muted-foreground">
                          WhatsApp gateway number
                        </Label>
                        <Input
                          ref={whatsappInputRef}
                          id="whatsapp-number"
                          type="tel"
                          placeholder="+94 77 000 0000"
                          className="rounded-full"
                          value={whatsappGatewayNumber}
                          onChange={(event) => {
                            setWhatsappGatewayNumber(event.target.value)
                            setWhatsappSetupConfirmed(false)
                          }}
                          disabled={isSubmitting}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-6">
                <Button
                  variant="ghost"
                  className="rounded-full"
                  onClick={() => setViewMode("options")}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  className="rounded-full min-w-[120px]"
                  onClick={handleCreateProject}
                  disabled={isSubmitting || isUploading}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Create Project"
                  )}
                </Button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
