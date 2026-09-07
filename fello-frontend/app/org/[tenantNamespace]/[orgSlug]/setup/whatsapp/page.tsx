"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import { useAuth } from "@/hooks/use-auth"
import { db } from "@/lib/firebase"
import { doc, getDoc, collection, query, where, getDocs, limit } from "firebase/firestore"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import { RoundedList, RoundedListItem, RoundedListItemIcon } from "@/components/ui/rounded-list"
import { CheckCircle2, AlertTriangle, Loader2, Sparkles, RefreshCw } from "lucide-react"
import { PiSealWarningBold } from "react-icons/pi"
import { GoOrganization } from "react-icons/go"
import { toast } from "sonner"
import {
  connectOrgWhatsapp,
  getOrgWhatsappQr,
  getOrgWhatsappStatus,
  type WhatsappLinkState,
} from "@/lib/actions/whatsapp"

interface OrganizationInfo {
  id: string
  name: string
  logo: string
  slug: string
  verified?: boolean
}

const WhatsAppIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.746.953 3.71 1.455 5.703 1.455h.008c6.56 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
)

export default function SetupWhatsappPage() {
  const router = useRouter()
  const { tenantNamespace, orgSlug } = useParams<{ tenantNamespace: string; orgSlug: string }>()
  const { user } = useAuth()

  const [orgId, setOrgId] = React.useState<string | null>(null)
  const [org, setOrg] = React.useState<OrganizationInfo | null>(null)
  const [resolving, setResolving] = React.useState(true)

  const [whatsappStatus, setWhatsappStatus] = React.useState<string | undefined>(undefined)
  const [whatsappNumber, setWhatsappNumber] = React.useState<string | null>(null)
  const [whatsappLink, setWhatsappLink] = React.useState<WhatsappLinkState | null>(null)
  const [whatsappError, setWhatsappError] = React.useState<string | null>(null)
  const [whatsappQrRetries, setWhatsappQrRetries] = React.useState(0)
  const [whatsappQrExhausted, setWhatsappQrExhausted] = React.useState(false)

  const whatsappPollRef = React.useRef<ReturnType<typeof setInterval> | null>(null)
  const whatsappLinkRef = React.useRef<WhatsappLinkState | null>(null)
  const whatsappQrRetriesRef = React.useRef(0)

  const MAX_WHATSAPP_QR_RETRIES = 2

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
          toast.success("WhatsApp Gateway paired successfully!")
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

  const handleConnectOrgWhatsapp = React.useCallback(async () => {
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
    if (result.data.status !== "connected") {
      startWhatsappPolling(orgId)
    } else {
      setWhatsappStatus("connected")
      setWhatsappNumber(result.data.phoneNumber ?? null)
    }
  }, [orgId, user, startWhatsappPolling, updateWhatsappLink, updateWhatsappQrRetries])

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
          if (d.whatsappGatewayNumber) {
            setWhatsappStatus("connected")
            setWhatsappNumber(d.whatsappGatewayNumber)
            updateWhatsappLink({ status: "connected", qr: null, phoneNumber: d.whatsappGatewayNumber })
          } else {
            // Auto connect on mount/load
            void handleConnectOrgWhatsapp()
          }
        }
      } catch (err) {
        console.error("Failed to load org data:", err)
      }
    }

    void loadData()
  }, [orgId, user, handleConnectOrgWhatsapp, updateWhatsappLink])

  const handleFinish = () => {
    // Go to organization home dashboard!
    router.push(`/org/${tenantNamespace}/${orgSlug}`)
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
            <Skeleton className="h-4.5 w-44 rounded bg-muted/70" />
            <Skeleton className="h-3.5 w-80 rounded bg-muted/70" />
          </div>
        </div>

        {/* Warning alert skeleton */}
        <div className="p-3 border rounded-xl flex gap-3 bg-muted/5 border-muted/50">
          <Skeleton className="size-4 shrink-0 rounded-full bg-muted/70" />
          <Skeleton className="h-7 w-full rounded bg-muted/70" />
        </div>

        {/* Content body skeleton */}
        <div className="border rounded-xl p-6 flex flex-col items-center justify-center min-h-[260px] space-y-4">
          <Skeleton className="size-[150px] rounded-lg bg-muted/70" />
          <Skeleton className="h-4 w-40 bg-muted/70" />
          <Skeleton className="h-3.5 w-60 bg-muted/70" />
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
        <WhatsAppIcon className="w-5 h-5 mt-1 text-primary shrink-0" />
        <div>
          <h2 className="font-heading text-sm font-semibold">WhatsApp Bot Gateway</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Connect a WhatsApp account to let the Fello AI agent listen to WhatsApp groups and coordinate events
          </p>
        </div>
      </div>

      {/* Color-Neutral Warning Alert */}
      <Alert className="border-border bg-muted/10 text-muted-foreground rounded-3xl">
        <AlertTriangle className="size-4 text-muted-foreground shrink-0" />
        <AlertDescription className="text-xs leading-normal ml-2 font-medium">
          Do NOT pair your personal WhatsApp account. We recommend setting up a dedicated number for Fello agent functions.
        </AlertDescription>
      </Alert>

      {/* QR Code and Pairing block */}
      <div className="flex flex-col items-center justify-center p-6 border rounded-3xl bg-muted/10 min-h-[260px] relative">
        {whatsappStatus === "connected" && whatsappNumber ? (
          <div className="text-center space-y-3 animate-in fade-in duration-200">
            <div className="size-12 rounded-full bg-green-500/10 text-green-500 flex items-center justify-center mx-auto">
              <CheckCircle2 className="size-6" />
            </div>
            <div>
              <p className="text-xs font-semibold">WhatsApp Connected!</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Gateway Active: {whatsappNumber}</p>
            </div>
          </div>
        ) : whatsappError ? (
          <div className="text-center space-y-2 animate-in fade-in duration-200">
            <p className="text-xs font-semibold text-destructive">Couldn&apos;t connect</p>
            <p className="text-[10px] text-muted-foreground max-w-[280px] mx-auto">{whatsappError}</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-full text-[10px] h-7 px-3 gap-1.5 mt-2"
              onClick={() => void handleConnectOrgWhatsapp()}
            >
              <RefreshCw className="size-3" />
              Retry Connection
            </Button>
          </div>
        ) : whatsappQrExhausted ? (
          <div className="text-center space-y-3 animate-in fade-in duration-200">
            <p className="text-xs font-semibold">QR Code Timeout</p>
            <p className="text-[10px] text-muted-foreground max-w-[280px] mx-auto">
              We tried loading the QR code, but the session timed out. Click below to reload.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-full text-[10px] h-7 px-3 gap-1.5 mt-2"
              onClick={() => void handleConnectOrgWhatsapp()}
            >
              <RefreshCw className="size-3" />
              Reload QR Code
            </Button>
          </div>
        ) : whatsappLink?.qr ? (
          <div className="space-y-4 text-center animate-in fade-in duration-200">
            <div className="bg-white p-3 rounded-lg border inline-block shadow-sm">
              <img src={whatsappLink.qr} alt="Scan with WhatsApp" className="size-[150px] object-contain" />
            </div>
            <div className="space-y-1">
              <p className="text-[11px] font-semibold animate-in fade-in">Scan QR Code from WhatsApp</p>
              <p className="text-[9px] text-muted-foreground max-w-[280px] animate-in fade-in">
                Go to WhatsApp &gt; Linked Devices &gt; Link a Device to scan the pairing QR code
              </p>
            </div>
          </div>
        ) : (
          <div className="text-center space-y-2">
            <Loader2 className="size-5 animate-spin text-primary mx-auto" />
            <p className="text-[10px] text-muted-foreground animate-in fade-in">Waiting for the gateway to generate a QR code…</p>
          </div>
        )}
      </div>

      {/* Navigation Buttons - Left: Skip (Secondary), Right: Connect/Finish (Primary) */}
      <div className="flex items-center justify-between pt-6">
        <Button
          type="button"
          variant="secondary"
          className="rounded-full text-xs"
          onClick={handleFinish}
        >
          {whatsappNumber ? "Finish Setup" : "I'll do it later"}
        </Button>

        <Button
          type="button"
          className="rounded-full text-xs min-w-[120px]"
          onClick={handleFinish}
        >
          {whatsappNumber ? (
            <>
              Enter Dashboard
              <Sparkles className="size-3.5 ml-1.5" />
            </>
          ) : (
            "Complete Flow"
          )}
        </Button>
      </div>
    </div>
  )
}
