"use client"

import * as React from "react"
import { PlusIcon, SearchIcon, ArrowRightIcon } from "lucide-react"
import { RoundedList, RoundedListItem, RoundedListItemIcon } from "@/components/ui/rounded-list"
import { Skeleton } from "@/components/ui/skeleton"
import Link from "next/link"
import { useAuth } from "@/hooks/use-auth"
import { useRouter } from "next/navigation"
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { getAllowedDomains } from "@/lib/actions/auth"
import { acceptPendingOrgInvites } from "@/lib/actions/org-invites"
import { PERSONAL_EMAIL_DOMAINS } from "@/lib/restricted-domains"
import { PiSealWarningBold } from "react-icons/pi"
import { MailIcon } from "lucide-react"

export default function OrgSelectorPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [checking, setChecking] = React.useState(true)
  const [hasOrgs, setHasOrgs] = React.useState(false)
  const [tenantHasOrgs, setTenantHasOrgs] = React.useState(false)
  const [lastOpenedOrgData, setLastOpenedOrgData] = React.useState<{ id: string, name: string, slug: string } | null>(null)
  const [userOrgs, setUserOrgs] = React.useState<Array<{ id: string, name: string, logo: string, slug: string, verified?: boolean, invited?: boolean }>>([])
  const [acceptingInviteId, setAcceptingInviteId] = React.useState<string | null>(null)

  const userDomain = user?.email?.split('@')[1]?.toLowerCase() || ""
  const tenantNamespace = userDomain.replace(/\./g, '-')

  const currentHour = new Date().getHours()
  let greeting = "Good evening"
  if (currentHour < 12) greeting = "Good morning"
  else if (currentHour < 18) greeting = "Good afternoon"

  React.useEffect(() => {
    if (!loading && !user) {
      router.push("/sign-in")
    } else if (user) {
      // Check lastOpenedOrg and domain
      const checkOrg = async () => {
        const userDomain = user.email?.split('@')[1]?.toLowerCase() || ""

        // Domain gate — kept separate so an error here doesn't silently pass the user through
        try {
          if (PERSONAL_EMAIL_DOMAINS.includes(userDomain)) {
            window.location.href = `/waitlist?domain=${userDomain}`
            return
          }
          const allowedDomains = await getAllowedDomains()
          if (!allowedDomains.includes(userDomain)) {
            window.location.href = `/waitlist?domain=${userDomain}`
            return
          }
        } catch (e) {
          console.error("Error checking domain access", e)
          router.push('/sign-in')
          return
        }

        // Domain is allowed — load user state
        try {
          const userDoc = await getDoc(doc(db, "users", user.uid))
          if (userDoc.exists()) {
            const data = userDoc.data()
            if (data.lastOpenedOrg) {
              const orgDoc = await getDoc(doc(db, "organizations", data.lastOpenedOrg))
              if (orgDoc.exists()) {
                setLastOpenedOrgData({
                  id: orgDoc.id,
                  name: orgDoc.data().name,
                  slug: orgDoc.data().slug
                })
              }
            }
            if (data.organizations && data.organizations.length > 0) {
              const orgsQuery = query(
                collection(db, "organizations"),
                where("id", "in", data.organizations)
              )
              const orgsSnap = await getDocs(orgsQuery)
              if (!orgsSnap.empty) {
                const list = orgsSnap.docs
                  .map(d => ({
                    id: d.id,
                    name: d.data().name,
                    logo: d.data().logo || "",
                    slug: d.data().slug,
                    verified: d.data().verified || false,
                    createdBy: d.data().createdBy || ""
                  }))
                  .filter(org => org.verified || org.createdBy === user.uid)
                
                if (list.length > 0) {
                  setUserOrgs(list)
                  setHasOrgs(true)
                }
              }
            }
          }

          if (userDomain) {
            const orgsRef = collection(db, "organizations")
            const q = query(orgsRef, where("tenantId", "==", userDomain))
            const querySnapshot = await getDocs(q)
            if (!querySnapshot.empty) {
              setTenantHasOrgs(true)
            }
          }

          // Pending invites — show the org even if it's unverified and even
          // before acceptPendingOrgInvites has run for this session (that only
          // fires on a fresh sign-in; a user already signed in when the invite
          // was created would otherwise never see it here).
          if (user.email) {
            const invitesQuery = query(
              collection(db, "org_invites"),
              where("inviteValue", "==", user.email.trim().toLowerCase()),
              where("status", "==", "invited")
            )
            const invitesSnap = await getDocs(invitesQuery)
            if (!invitesSnap.empty) {
              const invitedOrgs = await Promise.all(
                invitesSnap.docs.map(async (inviteDoc) => {
                  const orgId = inviteDoc.data().orgId as string
                  const orgDoc = await getDoc(doc(db, "organizations", orgId))
                  if (!orgDoc.exists()) return null
                  return {
                    id: orgDoc.id,
                    name: orgDoc.data().name,
                    logo: orgDoc.data().logo || "",
                    slug: orgDoc.data().slug,
                    verified: orgDoc.data().verified || false,
                    invited: true,
                  }
                })
              )
              const validInvitedOrgs = invitedOrgs.filter((org): org is NonNullable<typeof org> => org !== null)
              if (validInvitedOrgs.length > 0) {
                setUserOrgs((prev) => {
                  const merged = new Map(prev.map((org) => [org.id, org]))
                  validInvitedOrgs.forEach((org) => merged.set(org.id, org))
                  return Array.from(merged.values())
                })
                setHasOrgs(true)
              }
            }
          }
        } catch (e) {
          console.error("Error fetching user data", e)
        }

        setChecking(false)
      }
      checkOrg()
    }
  }, [user, loading, router])

  if (loading || checking) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex flex-row items-center gap-3 text-left">
          <Skeleton className="size-10 rounded-full shrink-0" />
          <div className="flex flex-col gap-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>

        <div className="pb-8">
          <RoundedList className="mt-4">
            <RoundedListItem className="w-full p-0">
              <div className="flex w-full h-auto p-2 items-center">
                <Skeleton className="w-12 min-w-12 h-12 min-h-12 rounded-md group-first/row:rounded-tl-2xl group-last/row:rounded-bl-2xl mr-4" />
                <div className="flex flex-col flex-1 gap-2 py-1">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
            </RoundedListItem>
            <RoundedListItem className="w-full p-0">
              <div className="flex w-full h-auto p-2 items-center">
                <Skeleton className="w-12 min-w-12 h-12 min-h-12 rounded-md group-first/row:rounded-tl-2xl group-last/row:rounded-bl-2xl mr-4" />
                <div className="flex flex-col flex-1 gap-2 py-1">
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
            </RoundedListItem>
          </RoundedList>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 relative">
      <div className="flex flex-row items-center gap-3 text-left">
        {user?.photoURL ? (
          <img src={user.photoURL} alt={user.displayName || "User"} className="size-10 rounded-full object-cover shrink-0" />
        ) : (
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-lg font-bold uppercase">
            {user?.displayName?.charAt(0) || "U"}
          </div>
        )}
        <div className="flex flex-col">
          <h1 className="text-xl font-bold">{greeting}, {user?.displayName?.split(" ")[0] || "User"}!</h1>
          <p className="text-sm text-muted-foreground">
            {tenantHasOrgs ? "What organization are we working on today?" : "No organization at the moment, start by creating a one"}
          </p>
        </div>
      </div>

      <div className="pb-8">
        {hasOrgs && (
          <RoundedList className="mt-4">
            {userOrgs.map((org) => {
              const cardContent = (
                <>
                  <div className="relative mr-4 shrink-0">
                    <RoundedListItemIcon className="w-12 min-w-12 h-12 min-h-12 flex items-center justify-center bg-muted/40 text-foreground/75 text-lg font-bold rounded-lg overflow-hidden group-hover/card:bg-background group-hover/card:text-primary transition-colors duration-200">
                      {org.logo && (org.logo.startsWith("http://") || org.logo.startsWith("https://")) ? (
                        <img src={org.logo} alt={org.name} className="size-full object-contain p-1.5 rounded-lg" />
                      ) : (
                        org.name.charAt(0).toUpperCase()
                      )}
                    </RoundedListItemIcon>
                    {org.invited ? (
                      <span
                        className="absolute bottom-0 right-0 flex items-center justify-center size-3.5 bg-primary rounded-full p-0.5 select-none"
                        title="Pending invite"
                      >
                        <MailIcon className="size-full text-white" />
                      </span>
                    ) : !org.verified ? (
                      <PiSealWarningBold
                        color="white"
                        style={{ color: 'white', fill: 'white' }}
                        className="absolute bottom-0 right-0 size-3.5 !text-white bg-yellow-500 rounded-full p-0.5 select-none"
                        title="Unverified Workspace"
                      />
                    ) : null}
                  </div>
                  <div className="flex flex-col items-start flex-1">
                    <span className="font-semibold text-base">{org.name}</span>
                    <span className="text-xs text-muted-foreground mt-0.5">
                      {org.invited ? "Invited — tap to join" : "Workspace"}
                    </span>
                  </div>
                  {org.id === lastOpenedOrgData?.id && (
                    <span className="absolute -top-2 right-8 inline-flex items-center px-2 py-0.5 rounded-full text-[8px] font-bold bg-primary text-primary-foreground uppercase tracking-wider select-none z-10">
                      Last active
                    </span>
                  )}
                  <ArrowRightIcon className="size-4 text-muted-foreground mr-2 self-center shrink-0" />
                </>
              )

              return (
                <RoundedListItem key={org.id} className={`w-full p-0 ${org.id === lastOpenedOrgData?.id ? "!overflow-visible" : ""}`}>
                  {org.invited ? (
                    <button
                      type="button"
                      disabled={acceptingInviteId === org.id}
                      onClick={async () => {
                        if (!user) return
                        setAcceptingInviteId(org.id)
                        try {
                          await acceptPendingOrgInvites(user.uid, user.email || "")
                        } finally {
                          router.push(`/org/${tenantNamespace}/${org.slug}`)
                        }
                      }}
                      className="flex w-full h-auto p-2 hover:bg-muted items-center relative group/card rounded-[inherit] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset disabled:opacity-60"
                    >
                      {cardContent}
                    </button>
                  ) : (
                    <Link
                      href={`/org/${tenantNamespace}/${org.slug}`}
                      className="flex w-full h-auto p-2 hover:bg-muted items-center relative group/card rounded-[inherit] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                    >
                      {cardContent}
                    </Link>
                  )}
                </RoundedListItem>
              )
            })}
          </RoundedList>
        )}

        {hasOrgs && (
          <div className="relative flex py-5 items-center select-none">
            <div className="flex-grow border-t border-border/80"></div>
            <span className="flex-shrink mx-4 text-xs text-muted-foreground font-normal lowercase">or</span>
            <div className="flex-grow border-t border-border/80"></div>
          </div>
        )}

        <RoundedList className={hasOrgs ? "" : "mt-4"}>
          <RoundedListItem className="w-full p-0">
            <Link 
              href="/org/new" 
              className="flex w-full h-auto p-2 hover:bg-muted items-center group/card relative rounded-[inherit] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
            >
              <RoundedListItemIcon className="w-12 min-w-12 h-12 min-h-12 flex items-center justify-center bg-muted mr-4 text-foreground/70 rounded-lg group-hover/card:bg-background group-hover/card:text-primary transition-colors duration-200">
                <PlusIcon className="size-5" />
              </RoundedListItemIcon>
              <div className="flex flex-col items-start flex-1">
                <span className="font-semibold text-base">Create organization</span>
                <span className="text-xs text-muted-foreground mt-0.5">Start a new workspace</span>
              </div>
            </Link>
          </RoundedListItem>
          {tenantHasOrgs && (
            <RoundedListItem className="w-full p-0">
              <Link 
                href="/org/join"
                className="flex w-full h-auto p-2 hover:bg-muted items-center group/card relative rounded-[inherit] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
              >
                <RoundedListItemIcon className="w-12 min-w-12 h-12 min-h-12 flex items-center justify-center bg-muted mr-4 text-foreground/70 rounded-lg group-hover/card:bg-background group-hover/card:text-primary transition-colors duration-200">
                  <SearchIcon className="size-5" />
                </RoundedListItemIcon>
                <div className="flex flex-col items-start flex-1">
                  <span className="font-semibold text-base">Join organization</span>
                  <span className="text-xs text-muted-foreground mt-0.5">Find an existing workspace</span>
                </div>
              </Link>
            </RoundedListItem>
          )}
        </RoundedList>
      </div>
    </div>
  )
}
