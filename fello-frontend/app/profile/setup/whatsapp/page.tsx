"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/hooks/use-auth"
import { db } from "@/lib/firebase"
import { doc, getDoc, setDoc } from "firebase/firestore"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import { RoundedList, RoundedListItem, RoundedListItemIcon } from "@/components/ui/rounded-list"
import {
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Loader2,
  Sparkles,
  MessageCircle,
} from "lucide-react"
import { FaWhatsapp } from "react-icons/fa"

const WhatsAppIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.746.953 3.71 1.455 5.703 1.455h.008c6.56 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
)

export default function ProfileSetupPage() {
  const router = useRouter()
  const { user, loading } = useAuth()

  const [whatsapp, setWhatsapp] = React.useState("+94")
  const [saving, setSaving] = React.useState(false)
  const [saved, setSaved] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [profileLoading, setProfileLoading] = React.useState(true)

  // Redirect to sign-in if not logged in
  React.useEffect(() => {
    if (!loading && !user) {
      router.push("/sign-in")
    }
  }, [user, loading, router])

  // Load existing number if present, skip this page if already set
  React.useEffect(() => {
    if (!user) return
    const load = async () => {
      try {
        const snap = await getDoc(doc(db, "users", user.uid))
        if (snap.exists()) {
          const data = snap.data()
          if (data.whatsappNumber) {
            // Already has a number — skip setup
            router.push("/")
            return
          }
        }
      } catch (e) {
        console.error("Failed to load user data", e)
      } finally {
        setProfileLoading(false)
      }
    }
    void load()
  }, [user, router])

  const isValid = /^\+94[0-9]{9}$/.test(whatsapp.trim())

  const handleSave = async () => {
    if (!user || !isValid) return
    setSaving(true)
    setError(null)
    try {
      await setDoc(doc(db, "users", user.uid), { whatsappNumber: whatsapp.trim() }, { merge: true })
      setSaved(true)
    } catch (e) {
      console.error(e)
      setError(e instanceof Error ? e.message : "Failed to save WhatsApp number")
    } finally {
      setSaving(false)
    }
  }

  const handleSkip = () => {
    router.push("/")
  }

  const handleContinue = () => {
    router.push("/")
  }

  if (loading || profileLoading || !user) {
    return (
      <div className="flex flex-col min-h-screen bg-background relative">
        <div className="p-6 flex-grow overflow-auto bg-muted/10 flex justify-center">
          <div className="w-full max-w-xl py-12 space-y-8 animate-pulse">
            {/* User card skeleton */}
            <div className="w-full border rounded-3xl p-2 bg-card/50 flex items-center">
              <Skeleton className="w-12 min-w-12 h-12 min-h-12 rounded-2xl mr-4 bg-muted/70" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4.5 w-32 rounded bg-muted/70" />
                <Skeleton className="h-3 w-48 rounded bg-muted/70" />
              </div>
            </div>

            {/* Title skeleton */}
            <div className="flex gap-3 pt-4">
              <Skeleton className="size-5 rounded-full shrink-0 bg-muted/70" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4.5 w-44 rounded bg-muted/70" />
                <Skeleton className="h-3.5 w-80 rounded bg-muted/70" />
              </div>
            </div>

            {/* Agent suggestion skeleton */}
            <div className="border rounded-3xl divide-y">
              {[1, 2, 3].map((i) => (
                <div key={i} className="p-3 flex items-center gap-3">
                  <Skeleton className="size-7 rounded-lg bg-muted/70" />
                  <Skeleton className="h-3.5 w-48 bg-muted/70" />
                </div>
              ))}
            </div>

            {/* Input skeleton */}
            <Skeleton className="h-10 w-full rounded-xl bg-muted/70" />

            {/* Bottom buttons skeleton */}
            <div className="flex items-center justify-between pt-6">
              <Skeleton className="h-9 w-28 rounded-full bg-muted/70" />
              <Skeleton className="h-9 w-36 rounded-full bg-muted/70" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen bg-background animate-in fade-in-50 duration-300 relative">
      <div className="p-6 flex-grow overflow-auto bg-muted/10 flex justify-center">
        <div className="w-full max-w-xl py-12 relative space-y-8">

          {/* 1. User identity card */}
          <RoundedList className="overflow-visible">
            <RoundedListItem className="w-full !overflow-visible p-0 border shadow-none">
              <div className="flex w-full h-auto p-2 items-center relative rounded-[inherit] bg-card">
                <RoundedListItemIcon className="w-12 min-w-12 h-12 min-h-12 flex items-center justify-center bg-muted/40 text-foreground/75 text-lg font-bold !rounded-2xl overflow-hidden mr-4">
                  {user.photoURL ? (
                    <img src={user.photoURL} alt={user.displayName ?? ""} className="size-full object-cover rounded-2xl" />
                  ) : (
                    <span>{(user.displayName ?? user.email ?? "U")[0].toUpperCase()}</span>
                  )}
                </RoundedListItemIcon>
                <div className="flex flex-col items-start flex-1 min-w-0">
                  <div className="font-semibold text-base truncate">{user.displayName || "Your Account"}</div>
                  <span className="mt-0.5 text-xs text-muted-foreground truncate">{user.email}</span>
                </div>
              </div>
            </RoundedListItem>
          </RoundedList>

          {/* 2. Section header */}
          <div className="flex gap-3 pt-2">
            <WhatsAppIcon className="w-5 h-5 mt-0.5 text-green-500 shrink-0" />
            <div>
              <h1 className="font-heading text-sm font-semibold">Connect Your WhatsApp</h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                Fello coordinates everything through WhatsApp. Add your number so the Fello agent can reach you directly.
              </p>
            </div>
          </div>

          {/* 3. Fello agent suggestions */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wider">
              Why the Fello agent needs this
            </p>
            <RoundedList className="overflow-visible">
              {[
                { icon: <MessageCircle className="size-4 text-primary" />, text: "Send you event reminders and updates directly on WhatsApp" },
                { icon: <Sparkles className="size-4 text-primary" />, text: "Let the AI agent tag you in tasks and coordinate with your team" },
                { icon: <FaWhatsapp className="size-4 text-green-500" />, text: "Deliver meeting summaries and action items after sessions" },
              ].map((item, i) => (
                <RoundedListItem key={i} className="w-full p-0 border-0 shadow-none">
                  <div className="flex items-center gap-3 px-3 py-2.5">
                    <div className="size-7 rounded-lg bg-muted/50 flex items-center justify-center shrink-0">
                      {item.icon}
                    </div>
                    <span className="text-xs text-foreground/80">{item.text}</span>
                  </div>
                </RoundedListItem>
              ))}
            </RoundedList>
          </div>

          {/* 4. Input or success state */}
          {saved ? (
            <div className="flex flex-col items-center justify-center py-6 space-y-3 border rounded-3xl bg-muted/10 animate-in fade-in duration-200">
              <div className="size-12 rounded-full bg-green-500/10 text-green-500 flex items-center justify-center">
                <CheckCircle2 className="size-6" />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold">WhatsApp Connected!</p>
                <p className="text-xs text-muted-foreground mt-0.5">The Fello agent will now reach you at {whatsapp}</p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {error && (
                <Alert variant="destructive" className="rounded-2xl">
                  <AlertCircle className="size-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <div className="border rounded-3xl bg-card overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-3.5">
                  <FaWhatsapp className="size-5 text-green-500 shrink-0" />
                  <input
                    type="tel"
                    className="flex-1 bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none"
                    value={whatsapp}
                    onChange={(e) => {
                      setError(null)
                      setWhatsapp(e.target.value)
                    }}
                    placeholder="+94xxxxxxxxx"
                    autoFocus
                  />
                  {isValid && (
                    <CheckCircle2 className="size-4 text-green-500 shrink-0 animate-in fade-in" />
                  )}
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground px-1">
                Enter your Sri Lankan mobile number in the format <span className="font-mono">+94XXXXXXXXX</span>
              </p>
            </div>
          )}

          {/* 5. Navigation buttons */}
          <div className="flex items-center justify-between pt-2">
            <Button
              type="button"
              variant="secondary"
              className="rounded-full text-xs"
              onClick={handleSkip}
            >
              {saved ? "Done" : "Skip for now"}
            </Button>

            {saved ? (
              <Button
                type="button"
                className="rounded-full text-xs min-w-[140px]"
                onClick={handleContinue}
              >
                Go to Dashboard
                <Sparkles className="size-3.5 ml-1.5" />
              </Button>
            ) : (
              <Button
                type="button"
                className="rounded-full text-xs min-w-[140px]"
                disabled={saving || !isValid}
                onClick={handleSave}
              >
                {saving ? (
                  <><Loader2 className="size-3.5 animate-spin mr-1.5" />Saving…</>
                ) : (
                  <>Save &amp; Continue <ArrowRight className="size-3.5 ml-1.5" /></>
                )}
              </Button>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}
