"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import { useAuth } from "@/hooks/use-auth"
import { auth, db } from "@/lib/firebase"
import { doc, getDoc, updateDoc, collection, query, where, getDocs, limit } from "firebase/firestore"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import { RoundedList, RoundedListItem, RoundedListItemIcon } from "@/components/ui/rounded-list"
import { CheckCircle2, Folder, Loader2, ArrowRight, Info } from "lucide-react"
import { PiSealWarningBold } from "react-icons/pi"
import { GoOrganization } from "react-icons/go"
import { toast } from "sonner"

interface OrganizationInfo {
  id: string
  name: string
  logo: string
  slug: string
  verified?: boolean
}

const GOOGLE_PICKER_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_PICKER_API_KEY

interface GooglePickerDoc {
  id: string
  name: string
  mimeType: string
}
interface GooglePickerCallbackData {
  action: string
  docs?: GooglePickerDoc[]
}

export default function SetupDriveFolderPage() {
  const router = useRouter()
  const { tenantNamespace, orgSlug } = useParams<{ tenantNamespace: string; orgSlug: string }>()
  const { user } = useAuth()

  const [orgId, setOrgId] = React.useState<string | null>(null)
  const [org, setOrg] = React.useState<OrganizationInfo | null>(null)
  const [resolving, setResolving] = React.useState(true)

  const [creatingNewFolder, setCreatingNewFolder] = React.useState(false)
  const [newFolderName, setNewFolderName] = React.useState("")
  const [createdFolderId, setCreatedFolderId] = React.useState<string | null>(null)
  const [createdFolderName, setCreatedFolderName] = React.useState<string>("")
  const [existingFolder, setExistingFolder] = React.useState<{ id: string; name: string } | null>(null)
  const [saving, setSaving] = React.useState(false)

  const [pickerLoading, setPickerLoading] = React.useState(false)
  const googlePickerLoadRef = React.useRef<Promise<void> | null>(null)

  // 1. Resolve orgId from path parameters
  React.useEffect(() => {
    if (!user || !tenantNamespace || !orgSlug) return

    const resolveOrg = async () => {
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
          return
        }
        const tenantId = instSnap.docs[0].id

        // Resolve organization by tenantId and slug
        const orgQuery = query(
          collection(db, "organizations"),
          where("tenantId", "==", tenantId),
          where("slug", "==", orgSlug),
          limit(1)
        )
        const orgSnap = await getDocs(orgQuery)
        if (orgSnap.empty) {
          toast.error("Organization context not found.")
          return
        }
        const resolvedOrgId = orgSnap.docs[0].id

        // Check if Google Workspace is connected. If not, redirect back to /setup/google
        // Non-admin members can't read the integration doc (rules) — treat a
        // permission error the same as "not connected".
        const integrationSnap = await getDoc(doc(db, "google_integrations", resolvedOrgId)).catch(() => null)
        if (!integrationSnap || !integrationSnap.exists() || !integrationSnap.data()?.connected) {
          toast.error("Please connect your Google Workspace account first.")
          router.replace(`/org/${tenantNamespace}/${orgSlug}/setup/google`)
          return
        }

        setOrgId(resolvedOrgId)
      } catch (err) {
        console.error("Failed to resolve organization:", err)
        toast.error("Error loading workspace data.")
      } finally {
        setResolving(false)
      }
    }

    void resolveOrg()
  }, [user, tenantNamespace, orgSlug, router])

  // 2. Load organization info once orgId is resolved
  React.useEffect(() => {
    if (!orgId || !user) return

    const loadData = async () => {
      try {
        const orgSnap = await getDoc(doc(db, "organizations", orgId))
        if (orgSnap.exists()) {
          const d = orgSnap.data()
          setOrg({
            id: orgSnap.id,
            name: d.name || "",
            logo: d.logo || "",
            slug: d.slug || "",
            verified: d.verified || false
          })
          setNewFolderName(`${d.name} Workspace`)
        }
      } catch (err) {
        console.error("Failed to load org data:", err)
      }
    }

    void loadData()
  }, [orgId, user])

  // Loads the Google Picker JS API on demand (only once)
  const loadGooglePicker = React.useCallback((): Promise<void> => {
    if (googlePickerLoadRef.current) return googlePickerLoadRef.current
    const promise = new Promise<void>((resolve, reject) => {
      if (typeof window === "undefined") {
        reject(new Error("Google Picker is only available in the browser."))
        return
      }
      if ((window as any).google?.picker) {
        resolve()
        return
      }
      if ((window as any).gapi) {
        (window as any).gapi.load("picker", { callback: () => resolve() })
        return
      }
      const existing = document.getElementById("google-picker-script") as HTMLScriptElement | null
      if (existing) {
        existing.addEventListener("load", () => {
          (window as any).gapi.load("picker", { callback: () => resolve() })
        })
        return
      }
      const script = document.createElement("script")
      script.src = "https://apis.google.com/js/api.js"
      script.id = "google-picker-script"
      script.async = true
      script.defer = true
      script.onload = () => {
        (window as any).gapi.load("picker", { callback: () => resolve() })
      }
      script.onerror = () => reject(new Error("Failed to load the Google Picker script."))
      document.body.appendChild(script)
    })
    googlePickerLoadRef.current = promise
    return promise
  }, [])

  const openPicker = async () => {
    if (!orgId) return
    setPickerLoading(true)
    try {
      const tokenRes = await fetch(`/api/drive/picker-token?orgId=${orgId}`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${await auth.currentUser?.getIdToken()}`
        }
      })
      if (!tokenRes.ok) {
        throw new Error("Failed to retrieve Picker OAuth token.")
      }
      const tokenData = await tokenRes.json()
      await loadGooglePicker()
      const picker = (window as any).google?.picker
      if (!picker) {
        throw new Error("Google Picker failed to load.")
      }
      const view = new picker.DocsView(picker.ViewId.FOLDERS)
      view.setMimeTypes("application/vnd.google-apps.folder")
      view.setSelectFolderEnabled(true)
      
      let builder = new picker.PickerBuilder().addView(view).setOAuthToken(tokenData.token)
      if (GOOGLE_PICKER_API_KEY) builder = builder.setDeveloperKey(GOOGLE_PICKER_API_KEY)
      
      const pickerInstance = builder
        .setCallback((data: GooglePickerCallbackData) => {
          if (data.action === picker.Action.PICKED && data.docs?.[0]) {
            const folder = data.docs[0]
            setExistingFolder({ id: folder.id, name: folder.name })
            setCreatedFolderId(null)
            setCreatedFolderName("")
            toast.success(`Selected folder: ${folder.name}`)
          }
        })
        .build()
      pickerInstance.setVisible(true)
    } catch (err) {
      console.error("Drive picker failed:", err)
      toast.error("Could not open the Drive folder picker.")
    } finally {
      setPickerLoading(false)
    }
  }

  const handleCreateNewFolderSubmit = async () => {
    if (!orgId || !newFolderName.trim()) return

    setSaving(true)
    const toastId = toast.loading("Creating workspace folder...")

    try {
      // Call backend API to create folder
      const res = await fetch(`/api/org/${orgId}/drive/create-folder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newFolderName.trim() }),
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || "Failed to create folder on Google Drive.")
      }
      const data = await res.json()
      setCreatedFolderId(data.folderId)
      setCreatedFolderName(newFolderName.trim())
      setExistingFolder(null)
      toast.success("Folder created successfully on Google Drive!", { id: toastId })
    } catch (err) {
      console.error(err)
      toast.error(err instanceof Error ? err.message : "Failed to create folder.", { id: toastId })
    } finally {
      setSaving(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!orgId) return

    const folderId = existingFolder ? existingFolder.id : createdFolderId
    const folderName = existingFolder ? existingFolder.name : createdFolderName

    if (!folderId) {
      toast.error("Please create or select a folder to continue.")
      return
    }

    setSaving(true)
    const toastId = toast.loading("Saving configuration...")

    try {
      // Save folderId to the Organization metadata in Firestore
      await updateDoc(doc(db, "organizations", orgId), {
        driveRootFolderId: folderId,
        driveRootFolderName: folderName,
        driveAccountType: "org",
      })

      toast.success("Drive workspace bound successfully!", { id: toastId })
      router.push(`/org/${tenantNamespace}/${orgSlug}/setup/whatsapp`)
    } catch (err) {
      console.error(err)
      toast.error(err instanceof Error ? err.message : "Failed to bind Drive folder.", { id: toastId })
    } finally {
      setSaving(false)
    }
  }

  const handleSkip = () => {
    router.push(`/org/${tenantNamespace}/${orgSlug}/setup/whatsapp`)
  }

  const getInitials = (title: string) => {
    if (!title) return "O"
    const words = title.trim().split(/\s+/)
    if (words.length === 1) return words[0].substring(0, 2).toUpperCase()
    return (words[0][0] + words[words.length - 1][0]).toUpperCase()
  }

  // Realistic page-specific skeleton loader
  if (resolving || !org) {
    return (
      <div className="space-y-8 animate-pulse">
        {/* Top Org card skeleton */}
        <div className="w-full border rounded-xl p-2 bg-card/50 flex items-center">
          <Skeleton className="w-12 min-w-12 h-12 min-h-12 rounded-lg mr-4 bg-muted/70" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4.5 w-32 rounded bg-muted/70" />
            <Skeleton className="h-3 w-40 rounded bg-muted/70" />
          </div>
        </div>

        {/* Title skeleton */}
        <div className="flex gap-3 pt-4">
          <Skeleton className="w-5 h-5 rounded-full shrink-0 bg-muted/70" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4.5 w-48 rounded bg-muted/70" />
            <Skeleton className="h-3.5 w-80 rounded bg-muted/70" />
          </div>
        </div>

        {/* Content body skeleton */}
        <div className="space-y-6">
          {/* Info Alert skeleton */}
          <div className="p-3 border rounded-xl flex gap-3 bg-muted/5 border-muted/50">
            <Skeleton className="size-4 shrink-0 rounded-full bg-muted/70" />
            <Skeleton className="h-7 w-full rounded bg-muted/70" />
          </div>
          <div className="flex items-center gap-3">
            <Skeleton className="h-9 w-28 rounded-full bg-muted/70" />
            <Skeleton className="h-9 w-28 rounded-full bg-muted/70" />
          </div>
        </div>

        {/* Bottom buttons skeleton */}
        <div className="flex items-center justify-between pt-6">
          <Skeleton className="h-9 w-28 rounded-full bg-muted/70" />
          <Skeleton className="h-9 w-28 rounded-full bg-muted/70" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      
      {/* 1. Organization info card on top */}
      {org && (
        <RoundedList id="organization" className="scroll-mt-6 overflow-visible">
          <RoundedListItem className="w-full !overflow-visible p-0 border shadow-none">
            <div className="flex w-full h-auto p-2 items-center relative rounded-[inherit] bg-card">
              <div className="relative mr-4 shrink-0">
                <RoundedListItemIcon className="w-12 min-w-12 h-12 min-h-12 flex items-center justify-center bg-muted/40 text-foreground/75 text-lg font-bold !rounded-2xl overflow-hidden">
                  {org.logo && (org.logo.startsWith("http://") || org.logo.startsWith("https://")) ? (
                    <img src={org.logo} alt={org.name} className="size-full object-contain p-1.5 rounded-2xl" />
                  ) : (
                    getInitials(org.name)
                  )}
                </RoundedListItemIcon>
              </div>
              <div className="flex flex-col items-start flex-1 min-w-0">
                <div className="font-semibold text-base truncate">{org.name}</div>
                <span className="mt-0.5 inline-flex max-w-full items-center gap-1.5 text-xs text-muted-foreground">
                  <GoOrganization className="size-3 shrink-0" />
                  <span className="truncate">{tenantNamespace}/{org.slug}</span>
                </span>
              </div>
              {!org.verified && (
                <span className="absolute -top-2 right-4 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[8px] font-bold bg-yellow-500 text-white uppercase tracking-wider select-none z-10 shadow-sm">
                  <PiSealWarningBold className="size-3" />
                  Unverified
                </span>
              )}
            </div>
          </RoundedListItem>
        </RoundedList>
      )}

      {/* Header Description */}
      <div className="flex gap-3 pt-4">
        <Folder className="w-5 h-5 mt-1 text-primary shrink-0" />
        <div>
          <h2 className="font-heading text-sm font-semibold">Google Drive Workspace Folder</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Designate a specific folder for Fello to use. Fello will only ever read/write inside this folder — never your whole Drive.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        
        {/* Color-Neutral Warning Alert */}
        <Alert className="border-border bg-muted/10 text-muted-foreground rounded-3xl">
          <Info className="size-4 text-muted-foreground shrink-0" />
          <AlertDescription className="text-xs leading-normal ml-2 font-medium">
            Once selected, this root folder cannot be changed. If you connect an existing folder, Fello will index all its existing files automatically so you don&apos;t have to upload them again.
          </AlertDescription>
        </Alert>

        {/* Folder Select/Create block */}
        {!existingFolder && !createdFolderName ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-full text-xs h-9 px-4"
                onClick={() => void openPicker()}
                disabled={saving || pickerLoading}
              >
                {pickerLoading ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin mr-1.5" />
                    Loading Picker...
                  </>
                ) : (
                  <>
                    <Folder className="size-3.5 mr-1.5 text-muted-foreground" />
                    Select a folder
                  </>
                )}
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-full text-xs h-9 px-4 text-muted-foreground"
                onClick={() => setCreatingNewFolder(true)}
                disabled={saving || creatingNewFolder}
              >
                Add a new folder
              </Button>
            </div>

            {creatingNewFolder && (
              <div className="space-y-2 pt-2 animate-in fade-in slide-in-from-top-1 duration-200">
                <Label htmlFor="folder-name" className="text-xs font-semibold text-foreground">
                  New Folder Name
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="folder-name"
                    placeholder="e.g. Fello Workspace"
                    className="rounded-full h-9 text-xs"
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    disabled={saving}
                  />
                  <Button
                    type="button"
                    size="sm"
                    className="rounded-full h-9 px-4"
                    onClick={handleCreateNewFolderSubmit}
                    disabled={saving || !newFolderName.trim()}
                  >
                    Create
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="rounded-full h-9 px-3 text-muted-foreground"
                    onClick={() => {
                      setCreatingNewFolder(false)
                      setNewFolderName("")
                    }}
                    disabled={saving}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2.5 border rounded-3xl bg-card p-3 shadow-sm animate-in fade-in duration-200">
            <div className="size-7 rounded-full bg-muted flex items-center justify-center shrink-0">
              <Folder className="size-3.5 text-foreground/75" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium leading-none">Drive folder connected</p>
              <p className="text-[10px] text-muted-foreground mt-1.5 leading-none truncate font-mono">
                {existingFolder ? existingFolder.name : createdFolderName}
              </p>
            </div>
            <CheckCircle2 className="size-4.5 text-primary shrink-0 ml-auto" />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="rounded-full text-[10px] h-7 px-2.5 text-muted-foreground hover:text-foreground"
              onClick={() => {
                setExistingFolder(null)
                setCreatedFolderId(null)
                setCreatedFolderName("")
                setCreatingNewFolder(false)
              }}
              disabled={saving}
            >
              Reset
            </Button>
          </div>
        )}

        {/* Navigation Buttons - Left: Skip (Secondary), Right: Continue (Primary) */}
        <div className="flex items-center justify-between pt-6">
          <Button
            type="button"
            variant="secondary"
            className="rounded-full text-xs"
            onClick={handleSkip}
            disabled={saving}
          >
            {"I'll do it later"}
          </Button>

          <Button
            type="submit"
            className="rounded-full text-xs min-w-[120px]"
            disabled={saving || (!existingFolder && !createdFolderId)}
          >
            {saving ? (
              <>
                <Loader2 className="size-3.5 animate-spin mr-1.5" />
                Saving...
              </>
            ) : (
              <>
                Continue
                <ArrowRight className="size-3.5 ml-1.5" />
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}
