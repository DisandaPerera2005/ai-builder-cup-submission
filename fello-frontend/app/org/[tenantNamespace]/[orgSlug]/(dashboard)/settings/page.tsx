"use client"

import * as React from "react"
import Image from "next/image"
import { useParams, useSearchParams, useRouter } from "next/navigation"
import { useAuth } from "@/hooks/use-auth"
import { db } from "@/lib/firebase"
import {
  collection,
  query,
  where,
  limit,
  getDocs,
  doc,
  setDoc,
  updateDoc,
  getDoc,
  deleteDoc,
} from "firebase/firestore"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  CheckCircle2,
  Link2,
  Unlink2,
  AlertCircle,
  Loader2,
  MoreHorizontal,
  Pencil,
  RefreshCw,
  FolderOpen,
} from "lucide-react"
import { PiSealWarningBold } from "react-icons/pi"
import { FaWhatsapp } from "react-icons/fa"
import { GoOrganization } from "react-icons/go"
import { RoundedList, RoundedListItem, RoundedListItemIcon } from "@/components/ui/rounded-list"
import {
  connectOrgWhatsapp,
  getOrgWhatsappQr,
  getOrgWhatsappStatus,
  type WhatsappLinkState,
} from "@/lib/actions/whatsapp"
import { uploadOrganizationLogo } from "@/lib/actions/organizations"
import { setOrgDriveRoot, triggerOrgDriveSync } from "@/lib/actions/drive-root"
import { GOOGLE_WORKSPACE_SERVICES } from "@/lib/google-workspace-scopes"

const GOOGLE_PICKER_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_PICKER_API_KEY

// Minimal shape of the bits of the Google Picker API this page uses — there's
// no official @types package for it, so we declare just enough here rather
// than reaching for `any` everywhere below.
interface GooglePickerDoc {
  id: string
  name?: string
}
interface GooglePickerCallbackData {
  action: string
  docs?: GooglePickerDoc[]
}
interface GooglePickerInstance {
  setVisible: (visible: boolean) => void
}
interface GooglePickerBuilder {
  addView: (view: unknown) => GooglePickerBuilder
  setOAuthToken: (token: string) => GooglePickerBuilder
  setDeveloperKey: (key: string) => GooglePickerBuilder
  setCallback: (cb: (data: GooglePickerCallbackData) => void) => GooglePickerBuilder
  build: () => GooglePickerInstance
}
interface GooglePickerNamespace {
  PickerBuilder: new () => GooglePickerBuilder
  DocsView: new (viewId: string) => { setSelectFolderEnabled: (enabled: boolean) => unknown; setIncludeFolders: (include: boolean) => unknown }
  ViewId: { FOLDERS: string }
  Action: { PICKED: string }
}

declare global {
  interface Window {
    gapi?: { load: (api: string, options: { callback: () => void }) => void }
    google?: { picker: GooglePickerNamespace }
  }
}

interface GoogleIntegration {
  connected: boolean
  email: string
  picture: string
  name: string
  scopes: string[]
  connectedAt: string
  expiresAt: number
  refreshToken?: string
}

interface OrganizationInfo {
  id: string
  name: string
  logo: string
  slug: string
  verified?: boolean
  driveRootFolderId?: string | null
  driveRootFolderName?: string | null
  driveSyncStatus?: string | null
  driveSyncedAt?: string | null
}

const MAX_WHATSAPP_QR_RETRIES = 2

export default function SettingsPage() {
  const { tenantNamespace, orgSlug } = useParams<{ tenantNamespace: string; orgSlug: string }>()
  const searchParams = useSearchParams()
  const router = useRouter()
  const { user } = useAuth()

  const [orgId, setOrgId] = React.useState<string | null>(null)
  const [organization, setOrganization] = React.useState<OrganizationInfo | null>(null)
  const [integration, setIntegration] = React.useState<GoogleIntegration | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [disconnecting, setDisconnecting] = React.useState(false)
  const [oauthStatus, setOauthStatus] = React.useState<"complete" | "error" | null>(null)
  const [editingOrgName, setEditingOrgName] = React.useState(false)
  const [orgNameDraft, setOrgNameDraft] = React.useState("")
  const [pendingOrgName, setPendingOrgName] = React.useState<string | null>(null)
  const [savingOrgName, setSavingOrgName] = React.useState(false)
  const [uploadingLogo, setUploadingLogo] = React.useState(false)
  const [logoError, setLogoError] = React.useState<string | null>(null)
  const orgNameTextRef = React.useRef<HTMLSpanElement | null>(null)
  const logoInputRef = React.useRef<HTMLInputElement | null>(null)

  const [driveError, setDriveError] = React.useState<string | null>(null)
  const [pickerLoading, setPickerLoading] = React.useState(false)
  const [savingDriveRoot, setSavingDriveRoot] = React.useState(false)
  const [newFolderDialogOpen, setNewFolderDialogOpen] = React.useState(false)
  const [newFolderNameDraft, setNewFolderNameDraft] = React.useState("")
  const [creatingFolder, setCreatingFolder] = React.useState(false)
  const googlePickerLoadRef = React.useRef<Promise<void> | null>(null)

  const [whatsappStatus, setWhatsappStatus] = React.useState<string | undefined>(undefined)
  const [whatsappNumber, setWhatsappNumber] = React.useState<string | null>(null)
  const [whatsappLink, setWhatsappLink] = React.useState<WhatsappLinkState | null>(null)
  const [whatsappError, setWhatsappError] = React.useState<string | null>(null)
  const [whatsappQrRetries, setWhatsappQrRetries] = React.useState(0)
  const [whatsappQrExhausted, setWhatsappQrExhausted] = React.useState(false)
  const whatsappPollRef = React.useRef<ReturnType<typeof setInterval> | null>(null)
  const whatsappLinkRef = React.useRef<WhatsappLinkState | null>(null)
  const whatsappQrRetriesRef = React.useRef(0)

  const updateWhatsappLink = React.useCallback((next: WhatsappLinkState | null) => {
    whatsappLinkRef.current = next
    setWhatsappLink(next)
  }, [])

  const updateWhatsappQrRetries = React.useCallback((next: number) => {
    whatsappQrRetriesRef.current = next
    setWhatsappQrRetries(next)
  }, [])

  const stopWhatsappPolling = React.useCallback(() => {
    if (whatsappPollRef.current) {
      clearInterval(whatsappPollRef.current)
      whatsappPollRef.current = null
    }
  }, [])

  const startWhatsappPolling = React.useCallback(
    (targetOrgId: string) => {
      stopWhatsappPolling()
      const started = Date.now()
      whatsappPollRef.current = setInterval(async () => {
        if (!user || Date.now() - started > 90_000) {
          stopWhatsappPolling()
          return
        }
        const idToken = await user.getIdToken()
        const statusResult = await getOrgWhatsappStatus(idToken, targetOrgId)
        if (statusResult.error !== null) return
        if (statusResult.data.status === "connected") {
          updateWhatsappLink(statusResult.data)
          setWhatsappStatus("connected")
          setWhatsappNumber(statusResult.data.phoneNumber ?? null)
          stopWhatsappPolling()
          return
        }
        if (whatsappLinkRef.current?.qr) return

        const nextRetry = whatsappQrRetriesRef.current + 1
        updateWhatsappQrRetries(nextRetry)
        const qrResult = await getOrgWhatsappQr(idToken, targetOrgId)
        if (qrResult.error === null && qrResult.data.qr) {
          setWhatsappQrExhausted(false)
          updateWhatsappLink(qrResult.data)
          return
        }
        if (nextRetry >= MAX_WHATSAPP_QR_RETRIES) {
          setWhatsappQrExhausted(true)
          stopWhatsappPolling()
        }
      }, 2000)
    },
    [user, stopWhatsappPolling, updateWhatsappLink, updateWhatsappQrRetries]
  )

  React.useEffect(() => stopWhatsappPolling, [stopWhatsappPolling])

  React.useEffect(() => {
    if (!editingOrgName) return
    orgNameTextRef.current?.focus()
    const selection = window.getSelection()
    const range = document.createRange()
    if (orgNameTextRef.current && selection) {
      range.selectNodeContents(orgNameTextRef.current)
      selection.removeAllRanges()
      selection.addRange(range)
    }
  }, [editingOrgName])

  const handleConnectOrgWhatsapp = async () => {
    if (!orgId || !user) return
    setWhatsappError(null)
    updateWhatsappLink(null)
    setWhatsappQrExhausted(false)
    updateWhatsappQrRetries(0)
    const idToken = await user.getIdToken()
    const result = await connectOrgWhatsapp(idToken, orgId)
    if (result.error !== null) {
      setWhatsappError(result.error)
      return
    }
    updateWhatsappLink(result.data)
    if (result.data.status !== "connected") startWhatsappPolling(orgId)
  }

  // Refresh the live gateway status once orgId resolves — a phone-side unlink
  // (WhatsApp app -> Linked devices -> Log out) can happen while nobody has
  // this dialog open, so the cached Firestore field alone could still say
  // "connected" when it's actually gone.
  React.useEffect(() => {
    if (!orgId || whatsappStatus !== "connected" || !user) return
    let cancelled = false
    ;(async () => {
      const idToken = await user.getIdToken()
      const result = await getOrgWhatsappStatus(idToken, orgId)
      if (cancelled || result.error !== null) return
      if (result.data.status !== "connected") setWhatsappStatus(result.data.status)
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, user])

  // Resolve orgId once on mount
  React.useEffect(() => {
    if (!user) return

    const resolve = async () => {
      try {
        const instSnap = await getDocs(
          query(collection(db, "tenants"), where("urlNamespace", "==", tenantNamespace), limit(1))
        )
        if (instSnap.empty) return

        const tenantId = instSnap.docs[0].id

        const orgSnap = await getDocs(
          query(
            collection(db, "organizations"),
            where("tenantId", "==", tenantId),
            where("slug", "==", orgSlug),
            limit(1)
          )
        )
        if (orgSnap.empty) return

        const resolvedOrgId = orgSnap.docs[0].id
        const orgData = orgSnap.docs[0].data()
        setOrgId(resolvedOrgId)
        setOrganization({
          id: resolvedOrgId,
          name: (orgData.name as string | undefined) ?? "",
          logo: (orgData.logo as string | undefined) ?? "",
          slug: (orgData.slug as string | undefined) ?? orgSlug,
          verified: (orgData.verified as boolean | undefined) ?? false,
          driveRootFolderId: (orgData.driveRootFolderId as string | undefined) ?? null,
          driveRootFolderName: (orgData.driveRootFolderName as string | undefined) ?? null,
          driveSyncStatus: (orgData.driveSyncStatus as string | undefined) ?? null,
          driveSyncedAt: (orgData.driveSyncedAt as string | undefined) ?? null,
        })
        setWhatsappStatus(orgData.whatsappStatus as string | undefined)
        setWhatsappNumber((orgData.whatsappGroupNumber as string | undefined) ?? null)

        // Load existing Google integration
        const integrationDoc = await getDoc(doc(db, "google_integrations", resolvedOrgId))
        if (integrationDoc.exists()) {
          setIntegration(integrationDoc.data() as GoogleIntegration)
        }
      } catch (err) {
        console.error("Settings: failed to resolve org", err)
      } finally {
        setLoading(false)
      }
    }

    void resolve()
  }, [user, tenantNamespace, orgSlug])

  // After Google OAuth redirect back: pick up tokens from the one-time route
  React.useEffect(() => {
    const oauth = searchParams.get("oauth")
    if (!oauth || !orgId || !user) return

    if (oauth === "error") {
      setOauthStatus("error")
      router.replace(`/org/${tenantNamespace}/${orgSlug}/settings`)
      return
    }

    if (oauth === "complete") {
      setSaving(true)
      fetch("/api/auth/google/tokens")
        .then((r) => {
          if (!r.ok) throw new Error("token fetch failed")
          return r.json()
        })
        .then(async (data) => {
          const record: GoogleIntegration & { orgId: string; connectedBy: string } = {
            orgId,
            connected: true,
            email: data.email,
            picture: data.picture,
            name: data.name,
            accessToken: data.accessToken,
            refreshToken: data.refreshToken,
            expiresAt: data.expiresAt,
            scopes: data.scopes,
            connectedBy: user.uid,
            connectedAt: new Date().toISOString(),
          } as any
          await setDoc(doc(db, "google_integrations", orgId), record)
          setIntegration(record)
          setOauthStatus("complete")
        })
        .catch((err) => {
          console.error("Failed to save Google integration:", err)
          setOauthStatus("error")
        })
        .finally(() => {
          setSaving(false)
          router.replace(`/org/${tenantNamespace}/${orgSlug}/settings`)
        })
    }
  }, [searchParams, orgId, user, tenantNamespace, orgSlug, router])

  const handleConnect = () => {
    if (!orgId) return
    window.location.href = `/api/auth/google?orgId=${orgId}&tenantNamespace=${tenantNamespace}&orgSlug=${orgSlug}`
  }

  const handleDisconnect = async () => {
    if (!orgId) return
    setDisconnecting(true)
    try {
      await deleteDoc(doc(db, "google_integrations", orgId))
      setIntegration(null)
    } catch (err) {
      console.error("Failed to disconnect Google:", err)
    } finally {
      setDisconnecting(false)
    }
  }

  const startEditingOrgName = () => {
    if (!organization) return
    setOrgNameDraft(organization.name)
    setEditingOrgName(true)
  }

  const requestOrgNameChange = () => {
    if (!organization) return
    const nextName = (orgNameTextRef.current?.textContent ?? orgNameDraft).trim()
    if (!nextName || nextName === organization.name) {
      setEditingOrgName(false)
      setOrgNameDraft(organization.name)
      return
    }
    setEditingOrgName(false)
    setPendingOrgName(nextName)
  }

  const confirmOrgNameChange = async () => {
    if (!organization || !pendingOrgName) return
    setSavingOrgName(true)
    try {
      await updateDoc(doc(db, "organizations", organization.id), {
        name: pendingOrgName,
        updatedAt: new Date().toISOString(),
      })
      setOrganization({ ...organization, name: pendingOrgName })
      setPendingOrgName(null)
    } catch (err) {
      console.error("Failed to update organization name:", err)
    } finally {
      setSavingOrgName(false)
    }
  }

  const resizeLogo = async (file: File) => {
    const imageUrl = URL.createObjectURL(file)
    try {
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new window.Image()
        img.onload = () => resolve(img)
        img.onerror = reject
        img.src = imageUrl
      })

      const width = 300
      const height = Math.max(1, Math.round((image.height / image.width) * width))
      const canvas = document.createElement("canvas")
      canvas.width = width
      canvas.height = height
      const context = canvas.getContext("2d")
      if (!context) throw new Error("Could not resize image.")
      context.drawImage(image, 0, 0, width, height)

      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.86))
      if (!blob) throw new Error("Could not resize image.")
      const buffer = await blob.arrayBuffer()
      let binary = ""
      const bytes = new Uint8Array(buffer)
      for (const byte of bytes) binary += String.fromCharCode(byte)
      return {
        contentType: blob.type || "image/webp",
        base64Image: window.btoa(binary),
      }
    } finally {
      URL.revokeObjectURL(imageUrl)
    }
  }

  const handleLogoFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file || !organization || !user) return
    setLogoError(null)
    setUploadingLogo(true)
    try {
      const resized = await resizeLogo(file)
      const idToken = await user.getIdToken()
      const result = await uploadOrganizationLogo(idToken, organization.id, resized.contentType, resized.base64Image)
      if (result.error !== null) {
        setLogoError(result.error)
        return
      }
      setOrganization({ ...organization, logo: result.data.logoUrl })
    } catch (err) {
      console.error("Failed to update organization photo:", err)
      setLogoError("Could not update the organization photo. Please try again.")
    } finally {
      setUploadingLogo(false)
    }
  }

  // Loads the Google Picker JS API on demand (only once) and resolves when
  // window.google.picker is ready to use.
  const loadGooglePicker = React.useCallback((): Promise<void> => {
    if (googlePickerLoadRef.current) return googlePickerLoadRef.current
    const promise = new Promise<void>((resolve, reject) => {
      if (typeof window === "undefined") {
        reject(new Error("Google Picker is only available in the browser."))
        return
      }
      if (window.google?.picker) {
        resolve()
        return
      }
      const onGapiReady = () => {
        window.gapi?.load("picker", { callback: () => resolve() })
      }
      const existing = document.getElementById("google-picker-script") as HTMLScriptElement | null
      if (existing) {
        if (window.gapi) onGapiReady()
        else existing.addEventListener("load", onGapiReady, { once: true })
        return
      }
      const script = document.createElement("script")
      script.id = "google-picker-script"
      script.src = "https://apis.google.com/js/api.js"
      script.async = true
      script.onload = onGapiReady
      script.onerror = () => reject(new Error("Failed to load the Google Picker script."))
      document.body.appendChild(script)
    })
    googlePickerLoadRef.current = promise
    return promise
  }, [])

  // Re-reads the org doc so the "Syncing…" status reflects the backend's
  // progress after a folder is picked/created — mirrors the one-time
  // re-fetch pattern used elsewhere on this page rather than a full poller.
  const refreshDriveSyncStatus = React.useCallback(async () => {
    if (!orgId) return
    try {
      const snap = await getDoc(doc(db, "organizations", orgId))
      if (!snap.exists()) return
      const data = snap.data()
      setOrganization((prev) =>
        prev
          ? {
              ...prev,
              driveRootFolderId: (data.driveRootFolderId as string | undefined) ?? prev.driveRootFolderId,
              driveSyncStatus: (data.driveSyncStatus as string | undefined) ?? prev.driveSyncStatus,
              driveSyncedAt: (data.driveSyncedAt as string | undefined) ?? prev.driveSyncedAt,
            }
          : prev
      )
    } catch (err) {
      console.error("Failed to refresh Drive sync status:", err)
    }
  }, [orgId])

  const applyDriveRootPicked = React.useCallback(
    (idToken: string, folderId: string) => {
      setOrganization((prev) => (prev ? { ...prev, driveRootFolderId: folderId, driveSyncStatus: "syncing" } : prev))
      if (!orgId) return
      void triggerOrgDriveSync(idToken, orgId)
      window.setTimeout(() => void refreshDriveSyncStatus(), 3000)
    },
    [orgId, refreshDriveSyncStatus]
  )

  const openDrivePicker = async () => {
    if (!orgId || !user) return
    setDriveError(null)
    setPickerLoading(true)
    try {
      const idToken = await user.getIdToken()
      const tokenRes = await fetch(`/api/drive/picker-token?orgId=${orgId}`, {
        headers: { Authorization: `Bearer ${idToken}` },
      })
      const tokenData = await tokenRes.json()
      if (!tokenRes.ok || !tokenData.token) {
        setDriveError(tokenData.error || "Could not get a Drive access token. Connect Google Workspace first.")
        return
      }

      await loadGooglePicker()
      const picker = window.google?.picker
      if (!picker) {
        setDriveError("Google Picker failed to load.")
        return
      }

      const view = new picker.DocsView(picker.ViewId.FOLDERS)
      view.setSelectFolderEnabled(true)
      view.setIncludeFolders(true)

      let builder = new picker.PickerBuilder().addView(view).setOAuthToken(tokenData.token)
      if (GOOGLE_PICKER_API_KEY) builder = builder.setDeveloperKey(GOOGLE_PICKER_API_KEY)

      builder
        .setCallback((data: GooglePickerCallbackData) => {
          if (data.action === picker.Action.PICKED && data.docs?.[0]) {
            setSavingDriveRoot(true)
            setOrgDriveRoot(idToken, orgId, { folderId: data.docs[0].id })
              .then((result) => {
                if (result.error !== null) {
                  setDriveError(result.error)
                  return
                }
                applyDriveRootPicked(idToken, result.data.folderId)
              })
              .finally(() => setSavingDriveRoot(false))
          }
        })
        .build()
        .setVisible(true)
    } catch (err) {
      console.error("Drive picker failed:", err)
      setDriveError("Could not open the Drive folder picker.")
    } finally {
      setPickerLoading(false)
    }
  }

  const confirmCreateNewFolder = async () => {
    if (!orgId || !user || !newFolderNameDraft.trim()) return
    setCreatingFolder(true)
    setDriveError(null)
    try {
      const idToken = await user.getIdToken()
      const result = await setOrgDriveRoot(idToken, orgId, { newFolderName: newFolderNameDraft.trim() })
      if (result.error !== null) {
        setDriveError(result.error)
        return
      }
      applyDriveRootPicked(idToken, result.data.folderId)
      setNewFolderDialogOpen(false)
      setNewFolderNameDraft("")
    } catch (err) {
      console.error("Failed to create Drive folder:", err)
      setDriveError("Could not create the Drive folder. Please try again.")
    } finally {
      setCreatingFolder(false)
    }
  }

  const isServiceActive = (scope: string) =>
    integration?.scopes?.includes(scope) ?? false

  if (loading) {
    return (
      <div className="flex flex-col h-full bg-background animate-in fade-in-50 duration-300">
        <div className="p-6 flex-grow overflow-auto bg-muted/10">
          <div className="max-w-xl mx-auto py-4 space-y-14">
            <Skeleton className="h-16 w-full rounded-md" />
            <Skeleton className="h-56 w-full rounded-xl" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="p-6 flex-grow overflow-auto bg-muted/10">
        <div className="max-w-xl mx-auto py-4 space-y-14">
          {/* OAuth status alerts */}
          {oauthStatus === "complete" && (
            <Alert className="border-green-500/30 bg-green-500/5 text-green-700 dark:text-green-400">
              <CheckCircle2 className="size-4" />
              <AlertDescription>Google Workspace connected successfully.</AlertDescription>
            </Alert>
          )}
          {oauthStatus === "error" && (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertDescription>Google connection failed. Please try again.</AlertDescription>
            </Alert>
          )}

          {/* Organization info */}
          {organization && (
            <RoundedList id="organization" className="scroll-mt-6 overflow-visible">
              <RoundedListItem className="w-full !overflow-visible p-0 border shadow-none">
                <div className="flex w-full h-auto p-2 items-center relative rounded-[inherit] bg-card">
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={(event) => void handleLogoFileChange(event)}
                  />
                  <div className="relative mr-4 shrink-0">
                    <RoundedListItemIcon className="w-12 min-w-12 h-12 min-h-12 flex items-center justify-center bg-muted/40 text-foreground/75 text-lg font-bold !rounded-lg overflow-hidden">
                      {organization.logo && (organization.logo.startsWith("http://") || organization.logo.startsWith("https://")) ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={organization.logo} alt={organization.name} className="size-full object-contain p-1.5 rounded-lg" />
                      ) : (
                        organization.name.charAt(0).toUpperCase()
                      )}
                    </RoundedListItemIcon>
                    <button
                      type="button"
                      onClick={() => logoInputRef.current?.click()}
                      className="absolute bottom-0 right-0 flex size-4 items-center justify-center rounded-full bg-background text-muted-foreground ring-1 ring-border transition-colors hover:text-primary"
                      title="Change organization photo"
                      disabled={uploadingLogo}
                    >
                      {uploadingLogo ? (
                        <Loader2 className="size-2.5 animate-spin" />
                      ) : (
                        <Pencil className="size-2.5" />
                      )}
                    </button>
                  </div>
                  <div className="flex flex-col items-start flex-1 min-w-0">
                    {editingOrgName ? (
                      <div className="relative flex max-w-full items-center gap-2">
                        <span
                          ref={orgNameTextRef}
                          role="textbox"
                          tabIndex={0}
                          contentEditable
                          suppressContentEditableWarning
                          onBlur={requestOrgNameChange}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault()
                              requestOrgNameChange()
                            }
                            if (event.key === "Escape") {
                              setEditingOrgName(false)
                              setOrgNameDraft(organization.name)
                            }
                          }}
                          className="min-h-6 max-w-full truncate text-base font-semibold outline-none focus-visible:ring-0"
                        >
                          {orgNameDraft}
                        </span>
                        <span className="absolute left-full top-1/2 ml-2 hidden -translate-y-1/2 whitespace-nowrap text-[11px] text-muted-foreground sm:inline">
                          Hit <kbd className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium">Enter</kbd> to save
                        </span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={startEditingOrgName}
                        className="group/name flex max-w-full items-center gap-2 text-left font-semibold text-base cursor-text"
                      >
                        <span className="truncate">{organization.name}</span>
                        <Pencil className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover/name:opacity-100 group-focus-visible/name:opacity-100" />
                      </button>
                    )}
                    <span className="mt-0.5 inline-flex max-w-full items-center gap-1.5 text-xs text-muted-foreground">
                      <GoOrganization className="size-3 shrink-0" />
                      <span className="truncate">{tenantNamespace}/{organization.slug}</span>
                    </span>
                  </div>
                  {!organization.verified && (
                    <span className="absolute -top-2 right-8 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[8px] font-bold bg-yellow-500 text-white uppercase tracking-wider select-none z-10">
                      <PiSealWarningBold className="size-3" />
                      Unverified
                    </span>
                  )}
                </div>
              </RoundedListItem>
            </RoundedList>
          )}
          {logoError && (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertDescription>{logoError}</AlertDescription>
            </Alert>
          )}

      {/* Google Workspace integration */}
      <section id="google-workspace" className="scroll-mt-6 flex flex-col gap-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {/* Google colourful G logo */}
              <div className="size-9 rounded-md border border-border flex items-center justify-center shrink-0">
                <svg viewBox="0 0 24 24" className="size-5" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
              </div>
              <div>
                <h2 className="font-heading text-base font-medium">Google Workspace</h2>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {integration
                    ? `Connected as ${integration.email}`
                    : "Connect to enable Docs, Sheets, Drive, and more"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0 ml-4">
              {saving ? (
                <Button size="sm" disabled variant="outline">
                  <Loader2 className="size-4 animate-spin mr-1.5" />
                  Saving…
                </Button>
              ) : integration ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      size="icon-sm"
                      variant="outline"
                      aria-label="Google Workspace options"
                    >
                      {disconnecting ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <MoreHorizontal className="size-4" />
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-auto min-w-max">
                    <DropdownMenuItem className="whitespace-nowrap" onSelect={handleConnect}>
                      <Link2 className="size-4" />
                      Connect more apps
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="whitespace-nowrap"
                      disabled={disconnecting}
                      onSelect={() => void handleDisconnect()}
                    >
                      {disconnecting ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Unlink2 className="size-4" />
                      )}
                      Disconnect
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleConnect}
                >
                  <Link2 className="size-4 mr-1.5" />
                  Connect
                </Button>
              )}
            </div>
          </div>

          {/* Connected account row */}
          {integration && (
            <div className="flex items-center gap-3 rounded-full border border-border bg-transparent px-3 py-2">
              {integration.picture ? (
                <img
                  src={integration.picture}
                  alt={integration.name}
                  className="size-7 rounded-full shrink-0"
                />
              ) : (
                <div className="size-7 rounded-full bg-muted flex items-center justify-center shrink-0 text-xs font-bold">
                  {integration.email[0]?.toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium leading-tight truncate">{integration.name || integration.email}</p>
                <p className="text-xs text-muted-foreground truncate">{integration.email}</p>
              </div>
              <Badge variant="outline" className="border-foreground/40 bg-transparent text-foreground shrink-0 text-[11px]">
                <CheckCircle2 className="size-3 mr-1" />
                Active
              </Badge>
            </div>
          )}

          <RoundedList className="w-full">
              {GOOGLE_WORKSPACE_SERVICES.map((service) => {
                const { label, scope } = service
                const active = isServiceActive(scope)
                const isDriveService = label === "Google Drive"
                return (
                  <RoundedListItem
                    key={label}
                    className="w-full p-0 border shadow-none"
                  >
                    <div className="flex w-full h-auto p-3 items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <RoundedListItemIcon className="w-8 min-w-8 h-8 min-h-8 flex items-center justify-center bg-muted/40 text-foreground/75">
                          <Image
                            src={service.image}
                            alt={label}
                            width={20}
                            height={20}
                            className={`size-5 object-contain ${!active && "grayscale opacity-60"}`}
                          />
                        </RoundedListItemIcon>
                        <span className="truncate text-sm font-medium">{label}</span>
                      </div>
                      {active ? (
                        <CheckCircle2 className="size-5 shrink-0 text-primary" />
                      ) : (
                        <span className="size-5 shrink-0 rounded-full border border-muted-foreground/30" aria-label="Not connected" />
                      )}
                    </div>

                    {isDriveService && active && (
                      <div className="border-t border-border/50 bg-muted/5 p-3 flex flex-col gap-3">
                        {driveError && (
                          <Alert variant="destructive" className="py-2 px-3 text-xs">
                            <AlertCircle className="size-3.5 shrink-0" />
                            <AlertDescription className="text-xs leading-normal">{driveError}</AlertDescription>
                          </Alert>
                        )}
                        {!organization?.driveRootFolderId ? (
                          <div className="flex flex-col gap-2 p-1.5">
                            <p className="text-xs text-muted-foreground leading-normal">
                              Designate a specific folder for Fello to use. Fello will only ever read/write inside this folder — never your whole Drive.
                            </p>
                            <div className="flex flex-wrap items-center gap-2 mt-1">
                              <Button
                                size="xs"
                                variant="outline"
                                className="h-7 text-xs font-normal"
                                disabled={pickerLoading || savingDriveRoot}
                                onClick={() => void openDrivePicker()}
                              >
                                {(pickerLoading || savingDriveRoot) && <Loader2 className="size-3 animate-spin mr-1" />}
                                Pick an existing folder
                              </Button>
                              <Button
                                size="xs"
                                variant="outline"
                                className="h-7 text-xs font-normal"
                                onClick={() => setNewFolderDialogOpen(true)}
                              >
                                Create a new folder
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between gap-3 rounded-lg bg-card p-2.5">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="size-7 rounded-full bg-muted flex items-center justify-center shrink-0">
                                <FolderOpen className="size-3.5 text-foreground/75" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-medium leading-none truncate">{organization.driveRootFolderName ?? "Drive folder connected"}</p>
                                <p className="text-[10px] text-muted-foreground mt-1 leading-none">
                                  {organization.driveSyncStatus === "syncing"
                                    ? "Syncing…"
                                    : organization.driveSyncStatus === "error"
                                      ? "Sync failed"
                                      : "Up to date"}
                                </p>
                              </div>
                            </div>
                            <Button
                              size="xs"
                              variant="outline"
                              className="h-7 text-xs font-normal shrink-0"
                              disabled={pickerLoading || savingDriveRoot}
                              onClick={() => void openDrivePicker()}
                            >
                              {pickerLoading || savingDriveRoot ? (
                                <Loader2 className="size-3 animate-spin mr-1" />
                              ) : (
                                <RefreshCw className="size-3 mr-1" />
                              )}
                              Change
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </RoundedListItem>
                )
              })}
          </RoundedList>

          {/* A short-lived access token expiring soon is normal and handled
              transparently server-side via the refresh token (getOrgAccessToken
              in lib/google.ts) — no user action needed, so we don't warn about
              it. The only case that genuinely needs a reconnect is a missing
              refresh token, e.g. a grant made before offline access was
              requested, or one Google has since revoked. */}
          {integration && !integration.refreshToken && (
            <div className="flex items-center justify-between rounded-md bg-amber-500/5 px-3 py-2">
              <p className="text-xs text-amber-600">This connection can&apos;t auto-refresh. Reconnect to fix it.</p>
              <Button size="sm" variant="outline" className="text-xs h-7" onClick={handleConnect}>
                Reconnect
              </Button>
            </div>
          )}
      </section>

      {/* WhatsApp */}
      <section id="whatsapp" className="scroll-mt-6 flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-md border border-border flex items-center justify-center shrink-0">
              <FaWhatsapp className="size-5 text-[#25D366]" />
            </div>
            <div>
              <h2 className="font-heading text-base font-medium">WhatsApp</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                {whatsappStatus === "connected" && whatsappNumber
                  ? `Connected as ${whatsappNumber}`
                  : whatsappStatus === "disconnected"
                    ? `Disconnected${whatsappNumber ? ` — was ${whatsappNumber}` : ""}`
                    : "Connect one shared number for organization coordination."}
              </p>
            </div>
          </div>
          <Button size="sm" variant="outline" className="shrink-0 ml-4" onClick={() => void handleConnectOrgWhatsapp()}>
            {whatsappStatus === "connected"
              ? "Reconnect"
              : whatsappStatus === "disconnected"
                ? "Connect again"
                : "Connect WhatsApp"}
          </Button>
        </div>

          {whatsappError ? (
            <Alert variant="destructive">
              <AlertTitle>Couldn&apos;t connect</AlertTitle>
              <AlertDescription>{whatsappError}</AlertDescription>
            </Alert>
          ) : whatsappLink?.status === "connected" ? (
            <div className="flex flex-col items-center gap-2 rounded-md border border-border bg-green-500/5 px-4 py-5 text-center">
              <CheckCircle2 className="h-8 w-8 text-primary" />
              <p className="font-medium">Connected</p>
              <p className="text-sm text-muted-foreground">{whatsappLink.phoneNumber}</p>
            </div>
          ) : whatsappQrExhausted ? (
            <button
              type="button"
              onClick={() => void handleConnectOrgWhatsapp()}
              className="flex min-h-[340px] w-full flex-col items-center justify-center gap-3 rounded-md border border-border bg-muted/20 px-4 py-5 text-center transition-colors hover:bg-muted/30"
            >
              <RefreshCw className="size-7 text-muted-foreground" />
              <div>
                <p className="font-medium">Reload WhatsApp QR</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  We tried {whatsappQrRetries} times and couldn&apos;t load a QR code.
                </p>
              </div>
            </button>
          ) : whatsappLink?.qr ? (
            <div className="flex flex-col items-center gap-3 rounded-md border border-border bg-muted/20 px-4 py-5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={whatsappLink.qr} alt="Scan with WhatsApp" className="h-56 w-56 rounded-lg border" />
              <p className="text-sm text-muted-foreground">
                Open WhatsApp on the number the whole org should share → Linked devices → Link a device, and
                scan this code.
              </p>
            </div>
          ) : whatsappLink ? (
            <div className="flex flex-col items-center gap-3 rounded-md border border-border bg-muted/20 px-4 py-5">
              <Skeleton className="h-56 w-56 rounded-lg" />
              <p className="text-sm text-muted-foreground">Waiting for the gateway to generate a QR code…</p>
            </div>
          ) : null}
      </section>

      {/* Danger zone */}
      <section id="danger-zone" className="scroll-mt-6 flex flex-col gap-3">
        <h2 className="font-heading text-base font-medium text-destructive">
          Danger zone
        </h2>
        <div className="border border-destructive/30 rounded-lg bg-destructive/5 px-4 py-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Delete organization</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Permanently delete this workspace. This cannot be undone.
            </p>
          </div>
          <Button
            size="sm"
            variant="destructive"
            className="shrink-0 ml-4"
            disabled
          >
            Delete
          </Button>
        </div>
      </section>

      <Dialog open={pendingOrgName !== null} onOpenChange={(open) => {
        if (!open && !savingOrgName) setPendingOrgName(null)
      }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Change organization name?</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Are you sure you want to change the organization name to{" "}
              <span className="font-medium text-foreground">{pendingOrgName}</span>?
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setPendingOrgName(null)} disabled={savingOrgName}>
                Cancel
              </Button>
              <Button onClick={() => void confirmOrgNameChange()} disabled={savingOrgName}>
                {savingOrgName && <Loader2 className="size-4 animate-spin mr-1.5" />}
                I&apos;m sure
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={newFolderDialogOpen}
        onOpenChange={(open) => {
          if (!open && !creatingFolder) {
            setNewFolderDialogOpen(false)
            setNewFolderNameDraft("")
          }
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Create a new Drive folder</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Fello will create this folder in your connected Google account and use it as the one root
              everything else lives under.
            </p>
            <Input
              value={newFolderNameDraft}
              onChange={(event) => setNewFolderNameDraft(event.target.value)}
              placeholder="e.g. Fello — SLIIT IEEE IAS"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setNewFolderDialogOpen(false)
                  setNewFolderNameDraft("")
                }}
                disabled={creatingFolder}
              >
                Cancel
              </Button>
              <Button onClick={() => void confirmCreateNewFolder()} disabled={creatingFolder || !newFolderNameDraft.trim()}>
                {creatingFolder && <Loader2 className="size-4 animate-spin mr-1.5" />}
                Create
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

        </div>
      </div>
    </div>
  )
}
