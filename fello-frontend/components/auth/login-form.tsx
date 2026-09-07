"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { signInWithPopup, GoogleAuthProvider, OAuthProvider, signOut } from "firebase/auth"
import { auth, db } from "@/lib/firebase"
import { doc, getDoc } from "firebase/firestore"
import { getAllowedDomains, incrementWaitlist, createUserRecord } from "@/lib/actions/auth"
import { bakeCustomClaims } from "@/lib/actions/claims"
import { acceptPendingProjectInvites, hasPendingProjectInvite } from "@/lib/actions/project-memberships"
import { acceptPendingOrgInvites, hasPendingOrgInvite } from "@/lib/actions/org-invites"
import { PERSONAL_EMAIL_DOMAINS } from "@/lib/restricted-domains"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { FieldDescription } from "@/components/ui/field"
import { RoundedList, RoundedListItem, RoundedListItemIcon } from "@/components/ui/rounded-list"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

import { Info, AlertCircle, Loader2 } from "lucide-react"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card"

import { useAuth } from "@/hooks/use-auth"
import { Skeleton } from "@/components/ui/skeleton"

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const router = useRouter()
  const { user, loading } = useAuth()
  const [activeProvider, setActiveProvider] = useState<'google' | 'microsoft' | null>(null)
  const [status, setStatus] = useState<'idle' | 'signing-in' | 'waitlist' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Redirect to home if already logged in
  useEffect(() => {
    if (!loading && user) {
      router.push("/")
    }
  }, [user, loading, router])

  const setCookieAndRedirect = async (idToken: string) => {
    // In a real production app this would call an API route to set a secure HttpOnly cookie
    document.cookie = `fello_auth_token=${idToken}; path=/; max-age=604800; samesite=lax; secure`;
    router.push("/")
  }

  const handleSignIn = async (providerName: 'google' | 'microsoft') => {
    try {
      setActiveProvider(providerName)
      setStatus('signing-in')
      setErrorMessage(null)
      
      const provider = providerName === 'google' ? new GoogleAuthProvider() : new OAuthProvider('microsoft.com')
      const result = await signInWithPopup(auth, provider)
      const email = result.user.email || ""
      const domain = email.split('@')[1]?.toLowerCase() || ""
      
      const allowedDomains = await getAllowedDomains()

      // An outside contributor invited to a single project signs in with
      // whatever email they were invited on — never gated by org domain,
      // since they're never joining the org itself (event_only access).
      const invited = await hasPendingProjectInvite(email)
      // A directory-sourced org invite (agent found this person in an org's
      // member directory doc) DOES grant real org membership, unlike the
      // project-scoped invite above — but it's still gated the same way at
      // sign-in time, before claims are baked.
      const orgInvited = await hasPendingOrgInvite(email)

      if (allowedDomains.includes(domain) || invited || orgInvited) {
        await createUserRecord({
          uid: result.user.uid,
          name: result.user.displayName || "",
          email: result.user.email || "",
          photo: result.user.photoURL || "",
          domain
        })
        if (invited) await acceptPendingProjectInvites(result.user.uid, email)
        if (orgInvited) await acceptPendingOrgInvites(result.user.uid, email)
        await bakeCustomClaims(result.user.uid)
        // Custom claims only land on the ID token after a forced refresh.
        const token = await result.user.getIdToken(true)
        // Set auth cookie
        document.cookie = `fello_auth_token=${token}; path=/; max-age=604800; samesite=lax; secure`;
        // Check if the user has a WhatsApp number — if not, send them to profile setup.
        const userSnap = await getDoc(doc(db, "users", result.user.uid));
        const hasWhatsapp = userSnap.exists() && !!userSnap.data().whatsappNumber;
        if (!hasWhatsapp) {
          router.push('/profile/setup/whatsapp');
        } else {
          router.push('/');
        }
        return;
      }

      if (PERSONAL_EMAIL_DOMAINS.includes(domain)) {
        console.log("Personal domain detected. Incrementing waitlist and showing error...")
        // For personal domains, we do sign them out because they need to sign in with a work account
        await signOut(auth)
        await incrementWaitlist("general", email)
        setStatus('error')
        setErrorMessage("You have signed in with a personal email. Please use a school or company email.")
        setActiveProvider(null)
        return
      }

      // Restricted domain -> Waitlist flow. We keep their session active so the waitlist page can greet them!
      console.log("Restricted domain detected:", domain)
      setStatus('waitlist')
      
      console.log("Executing incrementWaitlist server action...")
      // We use Promise.race because the Firebase Client SDK inside a Next.js Server Action
      // occasionally leaves the Node.js HTTP response hanging open.
      // This guarantees we redirect within 1.5 seconds while still letting the POST request fire.
      await Promise.race([
        incrementWaitlist(domain, email),
        new Promise(resolve => setTimeout(resolve, 1500))
      ])
      
      // Store the domain in a short-lived cookie so the /waitlist page can read it
      // without exposing it in the URL (prevents anyone from viewing other domains by editing the param)
      document.cookie = `waitlist_domain=${encodeURIComponent(domain)}; path=/waitlist; max-age=14400; samesite=lax`
      window.location.href = '/waitlist'
      
    } catch (error) {
      console.error(`${providerName} sign in error`, error)
      setStatus('error')
      setErrorMessage("Sign in was cancelled or failed. Please try again.")
      setActiveProvider(null)
    }
  }

  if (loading) {
    return (
      <div className={cn("flex flex-col gap-6 w-full", className)} {...props}>
        <div className="flex flex-col items-center gap-2 text-center">
          <Skeleton className="size-10 rounded-md" />
          <Skeleton className="h-8 w-48 mt-2" />
          <Skeleton className="h-4 w-64" />
        </div>

        <RoundedList className="w-full">
          <RoundedListItem className="w-full p-0">
            <div className="flex w-full h-auto p-2 items-center">
              <Skeleton className="w-12 min-w-12 h-12 min-h-12 rounded-md group-first/row:rounded-tl-2xl group-last/row:rounded-bl-2xl mr-4" />
              <Skeleton className="h-5 w-36" />
            </div>
          </RoundedListItem>
          <RoundedListItem className="w-full p-0">
            <div className="flex w-full h-auto p-2 items-center">
              <Skeleton className="w-12 min-w-12 h-12 min-h-12 rounded-md group-first/row:rounded-tl-2xl group-last/row:rounded-bl-2xl mr-4" />
              <Skeleton className="h-5 w-40" />
            </div>
          </RoundedListItem>
        </RoundedList>

        <div className="flex flex-col gap-4 mt-2 items-center">
          <Skeleton className="h-3 w-5/6" />
          <Skeleton className="h-3 w-4/6" />
        </div>
      </div>
    )
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <div className="flex flex-col items-center gap-2 text-center">
        <a
          href="#"
          className="flex flex-col items-center gap-2 font-medium"
        >
          <div className="flex size-10 items-center justify-center rounded-md">
            <img src="/google-new-icons/fello-logo.svg" alt="Fello Logo" className="size-8 object-contain dark:brightness-0 dark:invert" />
          </div>
          <span className="sr-only">Fello</span>
        </a>
        <h1 className="text-2xl font-bold">Sign in to Fello</h1>
        <FieldDescription>
          Sign in with your school or company email.
        </FieldDescription>
      </div>

      {errorMessage && (
        <Alert variant="destructive" className="animate-in fade-in zoom-in-95 duration-300">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Access Denied</AlertTitle>
          <AlertDescription>
            {errorMessage}
          </AlertDescription>
        </Alert>
      )}
      
      <form>
        <RoundedList className="w-full">
          {(!activeProvider || activeProvider === 'google') && (
            <RoundedListItem className="w-full p-0">
              <button 
                type="button" 
                onClick={() => handleSignIn('google')}
                disabled={status !== 'idle'}
                className="flex w-full h-auto p-2 hover:bg-muted items-center cursor-pointer disabled:opacity-80"
              >
                <RoundedListItemIcon className="w-12 min-w-12 h-12 min-h-12 flex items-center justify-center bg-slate-100 mr-4 text-foreground">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="size-6">
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.7 17.74 9.5 24 9.5z"/>
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                  </svg>
                </RoundedListItemIcon>
                <div className="flex flex-col items-start flex-1">
                  <span className="font-semibold text-base">
                    {status === 'signing-in' ? 'Signing you in...' : status === 'waitlist' ? 'Adding you to waitlist...' : 'Sign in with Google'}
                  </span>
                </div>
                {(status === 'signing-in' || status === 'waitlist') && (
                  <Loader2 className="size-5 animate-spin text-muted-foreground mr-3 shrink-0" />
                )}
              </button>
            </RoundedListItem>
          )}

          {(!activeProvider || activeProvider === 'microsoft') && (
            <RoundedListItem className="w-full p-0">
              <button 
                type="button" 
                onClick={() => handleSignIn('microsoft')}
                disabled={status !== 'idle'}
                className="flex w-full h-auto p-2 hover:bg-muted items-center cursor-pointer disabled:opacity-80"
              >
                <RoundedListItemIcon className="w-12 min-w-12 h-12 min-h-12 flex items-center justify-center bg-slate-100 mr-4 text-foreground">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 21 21" className="size-6">
                    <rect x="1" y="1" width="9" height="9" fill="#f25022"/>
                    <rect x="1" y="11" width="9" height="9" fill="#00a4ef"/>
                    <rect x="11" y="1" width="9" height="9" fill="#7fba00"/>
                    <rect x="11" y="11" width="9" height="9" fill="#ffb900"/>
                  </svg>
                </RoundedListItemIcon>
                <div className="flex flex-col items-start flex-1">
                  <span className="font-semibold text-base">
                    {status === 'signing-in' ? 'Signing you in...' : status === 'waitlist' ? 'Adding you to waitlist...' : 'Sign in with Microsoft'}
                  </span>
                </div>
                {(status === 'signing-in' || status === 'waitlist') && (
                  <Loader2 className="size-5 animate-spin text-muted-foreground mr-3 shrink-0" />
                )}
              </button>
            </RoundedListItem>
          )}
        </RoundedList>
      </form>
      <div className="flex flex-col gap-4 mt-2">
        <FieldDescription className="px-6 text-center text-xs flex items-center justify-center gap-1.5 text-muted-foreground/80">
          Only limited domains have access to Fello right now.
          <HoverCard>
            <HoverCardTrigger asChild>
              <button type="button" className="inline-flex cursor-help">
                <Info className="size-3.5" />
                <span className="sr-only">More information</span>
              </button>
            </HoverCardTrigger>
            <HoverCardContent className="w-64 text-left text-xs p-3 font-normal">
              If your domain does not have access, you will be added to our waiting list and we'll notify you once we roll out.
            </HoverCardContent>
          </HoverCard>
        </FieldDescription>
        <FieldDescription className="px-6 text-center text-xs">
          By clicking continue, you agree to our <a href="#" className="underline underline-offset-4 hover:text-primary">Terms of Service</a>{" "}
          and <a href="#" className="underline underline-offset-4 hover:text-primary">Privacy Policy</a>.
        </FieldDescription>
      </div>
    </div>
  )
}
