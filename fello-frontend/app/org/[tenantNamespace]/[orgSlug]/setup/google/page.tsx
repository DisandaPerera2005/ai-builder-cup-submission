"use client"

import * as React from "react"
import { useParams, useSearchParams, useRouter } from "next/navigation"
import Image from "next/image"
import { useAuth } from "@/hooks/use-auth"
import { db } from "@/lib/firebase"
import { doc, getDoc, setDoc, collection, query, where, getDocs, limit } from "firebase/firestore"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { RoundedList, RoundedListItem, RoundedListItemIcon } from "@/components/ui/rounded-list"
import { CheckCircle2, Link2, AlertCircle, Loader2, ArrowRight } from "lucide-react"
import { PiSealWarningBold } from "react-icons/pi"
import { GoOrganization } from "react-icons/go"
import { GOOGLE_WORKSPACE_SERVICES } from "@/lib/google-workspace-scopes"
import { toast } from "sonner"

interface GoogleIntegration {
  connected: boolean
  email: string
  picture: string
  name: string
  scopes: string[]
  connectedAt: string
  expiresAt: number
}

interface OrganizationInfo {
  id: string
  name: string
  logo: string
  slug: string
  verified?: boolean
}

export default function SetupGooglePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { tenantNamespace, orgSlug } = useParams<{ tenantNamespace: string; orgSlug: string }>()
  const { user } = useAuth()

  const oauth = searchParams.get("oauth")

  const [orgId, setOrgId] = React.useState<string | null>(null)
  const [org, setOrg] = React.useState<OrganizationInfo | null>(null)
  const [integration, setIntegration] = React.useState<GoogleIntegration | null>(null)
  const [resolving, setResolving] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [oauthStatus, setOauthStatus] = React.useState<"complete" | "error" | null>(null)

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
        setOrgId(orgSnap.docs[0].id)
      } catch (err) {
        console.error("Failed to resolve organization:", err)
        toast.error("Error loading workspace data.")
      } finally {
        setResolving(false)
      }
    }

    void resolveOrg()
  }, [user, tenantNamespace, orgSlug])

  // 2. Load organization info and Google integration status once orgId is resolved
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
        }

        const integrationSnap = await getDoc(doc(db, "google_integrations", orgId))
        if (integrationSnap.exists()) {
          setIntegration(integrationSnap.data() as GoogleIntegration)
        }
      } catch (err) {
        console.error("Failed to load org/integration data:", err)
      }
    }

    void loadData()
  }, [orgId, user])

  // 3. Handle Google OAuth redirect callback tokens
  React.useEffect(() => {
    if (!oauth || !orgId || !user || !tenantNamespace || !orgSlug) return

    if (oauth === "error") {
      setOauthStatus("error")
      router.replace(`/org/${tenantNamespace}/${orgSlug}/setup/google`)
      return
    }

    if (oauth === "complete") {
      setSaving(true)
      const toastId = toast.loading("Connecting Google Workspace...")
      fetch("/api/auth/google/tokens")
        .then((r) => {
          if (!r.ok) throw new Error("Token fetch failed")
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
          toast.success("Google Workspace connected successfully!", { id: toastId })
        })
        .catch((err) => {
          console.error("Failed to save Google integration:", err)
          setOauthStatus("error")
          toast.error("Failed to connect Google account.", { id: toastId })
        })
        .finally(() => {
          setSaving(false)
          router.replace(`/org/${tenantNamespace}/${orgSlug}/setup/google`)
        })
    }
  }, [oauth, orgId, user, tenantNamespace, orgSlug, router])

  const handleConnect = () => {
    if (!orgId || !tenantNamespace || !orgSlug) return
    window.location.href = `/api/auth/google?orgId=${orgId}&tenantNamespace=${tenantNamespace}&orgSlug=${orgSlug}&flow=setup`
  }

  const handleContinue = () => {
    router.push(`/org/${tenantNamespace}/${orgSlug}/setup/file`)
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

  const isServiceActive = (scope: string) =>
    integration?.scopes?.includes(scope) ?? false

  // Realistic page-specific skeleton loader
  if (resolving) {
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
          <Skeleton className="size-5 rounded-full shrink-0 bg-muted/70" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4.5 w-40 rounded bg-muted/70" />
            <Skeleton className="h-3.5 w-72 rounded bg-muted/70" />
          </div>
        </div>

        {/* Content body skeleton */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Skeleton className="size-10 rounded-xl bg-muted/70" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-32 bg-muted/70" />
                <Skeleton className="h-3 w-48 bg-muted/70" />
              </div>
            </div>
            <Skeleton className="h-8 w-20 rounded-full bg-muted/70" />
          </div>

          <div className="border rounded-xl divide-y">
            {[1, 2, 3].map((i) => (
              <div key={i} className="p-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Skeleton className="size-7 rounded-lg bg-muted/70" />
                  <Skeleton className="h-3.5 w-24 bg-muted/70" />
                </div>
                <Skeleton className="size-4.5 rounded-full bg-muted/70" />
              </div>
            ))}
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

      {oauthStatus === "error" && (
        <Alert variant="destructive" className="rounded-3xl">
          <AlertCircle className="size-4" />
          <AlertDescription>Google Workspace connection failed. Please try again.</AlertDescription>
        </Alert>
      )}

      {/* Google Integration Block */}
      <section className="space-y-4 pt-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-2xl border border-border flex items-center justify-center shrink-0 bg-muted/40">
              <svg viewBox="0 0 24 24" className="size-5" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
            </div>
            <div>
              <h2 className="font-heading text-sm font-semibold">Google Workspace</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {integration
                  ? `Connected as ${integration.email}`
                  : "Connect to enable Docs, Sheets, Drive, and more"}
              </p>
            </div>
          </div>
          
          {!integration && (
            <Button
              size="sm"
              variant="outline"
              className="rounded-full text-xs"
              onClick={handleConnect}
              disabled={saving}
            >
              {saving ? (
                <Loader2 className="size-3.5 animate-spin mr-1.5" />
              ) : (
                <Link2 className="size-3.5 mr-1.5" />
              )}
              Connect
            </Button>
          )}
        </div>

        {integration && (
          <div className="flex items-center gap-3 rounded-3xl border border-border bg-muted/10 px-4 py-3 animate-in fade-in duration-200">
            {integration.picture ? (
              <img
                src={integration.picture}
                alt={integration.name}
                className="size-8 rounded-full shrink-0"
              />
            ) : (
              <div className="size-8 rounded-full bg-muted flex items-center justify-center shrink-0 text-xs font-bold">
                {integration.email[0]?.toUpperCase()}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold leading-tight truncate">{integration.name || integration.email}</p>
              <p className="text-[10px] text-muted-foreground truncate">{integration.email}</p>
            </div>
            <Badge variant="outline" className="border-green-500/30 bg-green-500/5 text-green-700 dark:text-green-400 shrink-0 text-[10px] rounded-full">
              <CheckCircle2 className="size-3 mr-1" />
              Active
            </Badge>
          </div>
        )}

        <RoundedList className="w-full">
          {GOOGLE_WORKSPACE_SERVICES.map((service) => {
            const { label, scope } = service
            const active = isServiceActive(scope)
            return (
              <RoundedListItem
                key={label}
                className="w-full p-2.5 border shadow-none"
              >
                <div className="flex w-full h-auto items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <RoundedListItemIcon className="w-7 min-w-7 h-7 min-h-7 flex items-center justify-center bg-muted/40 text-foreground/75">
                      <Image
                        src={service.image}
                        alt={label}
                        width={18}
                        height={18}
                        className={`size-4.5 object-contain ${!active && "grayscale opacity-60"}`}
                      />
                    </RoundedListItemIcon>
                    <span className="truncate text-xs font-medium">{label}</span>
                  </div>
                  {active ? (
                    <CheckCircle2 className="size-4.5 shrink-0 text-primary" />
                  ) : (
                    <span className="size-4.5 shrink-0 rounded-full border border-muted-foreground/30" />
                  )}
                </div>
              </RoundedListItem>
            )
          })}
        </RoundedList>
      </section>

      {/* Navigation Buttons - Left: Skip (Secondary), Right: Connect/Continue (Primary) */}
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

        {integration ? (
          <Button
            type="button"
            className="rounded-full text-xs min-w-[120px]"
            onClick={handleContinue}
          >
            Continue
            <ArrowRight className="size-3.5 ml-1.5" />
          </Button>
        ) : (
          <Button
            type="button"
            className="rounded-full text-xs min-w-[120px]"
            variant="default"
            onClick={handleConnect}
          >
            Connect to Continue
          </Button>
        )}
      </div>
    </div>
  )
}
