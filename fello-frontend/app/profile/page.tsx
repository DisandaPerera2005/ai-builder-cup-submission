"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { updateProfile, type User } from "firebase/auth"
import { collection, doc, getDocs, getDoc, limit, query, setDoc, where } from "firebase/firestore"
import { getDownloadURL, ref, uploadBytes } from "firebase/storage"
import { CheckCircle2, ChevronRight, Loader2, Pencil } from "lucide-react"

import { useAuth } from "@/hooks/use-auth"
import { useOrgStore } from "@/hooks/use-org-store"
import { auth, db, storage } from "@/lib/firebase"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { FaWhatsapp } from "react-icons/fa"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { RoundedList, RoundedListItem } from "@/components/ui/rounded-list"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { Separator } from "@/components/ui/separator"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"

interface ProfileOrg {
  id: string
  name: string
  logo: string
  slug: string
  verified?: boolean
}

function initials(name: string, email: string) {
  const source = name.trim() || email.trim() || "User"
  return source
    .split(/[\s@.]+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

function domainFromEmail(email: string | null | undefined) {
  return email?.split("@")[1]?.toLowerCase() || ""
}

export default function ProfilePage() {
  const router = useRouter()
  const { user, loading } = useAuth()

  React.useEffect(() => {
    if (loading) return
    if (!user) {
      router.replace("/sign-in")
    }
  }, [loading, router, user])

  if (loading || !user) {
    return null
  }

  return (
    <ProfileShell user={user} />
  )
}

function ProfileShell({ user }: { user: User }) {
  const activeOrg = useOrgStore((s) => s.activeOrg)
  const [userOrgs, setUserOrgs] = React.useState<ProfileOrg[]>([])

  React.useEffect(() => {
    let cancelled = false

    const loadUserOrgs = async () => {
      const tenantId = domainFromEmail(user.email)
      if (!tenantId) return

      try {
        const membershipsSnap = await getDocs(
          query(
            collection(db, "memberships"),
            where("userId", "==", user.uid),
            where("tenantId", "==", tenantId)
          )
        )
        const orgIds = membershipsSnap.docs.map((membershipDoc) => membershipDoc.data().orgId as string).filter(Boolean)
        if (orgIds.length === 0) {
          if (!cancelled) setUserOrgs([])
          return
        }

        const orgsSnap = await getDocs(
          query(collection(db, "organizations"), where("id", "in", orgIds.slice(0, 10)), limit(10))
        )
        const fetchedOrgs = orgsSnap.docs.map((orgDoc) => {
          const data = orgDoc.data()
          return {
            id: orgDoc.id,
            name: String(data.name ?? "Workspace"),
            logo: String(data.logo ?? ""),
            slug: String(data.slug ?? ""),
            verified: Boolean(data.verified),
          }
        })

        if (!cancelled) setUserOrgs(fetchedOrgs)
      } catch (error) {
        console.error("Profile: failed to load sidebar organizations", error)
        if (!cancelled) setUserOrgs([])
      }
    }

    void loadUserOrgs()

    return () => {
      cancelled = true
    }
  }, [user.email, user.uid])

  const currentOrg = React.useMemo(() => {
    return userOrgs.find((org) => org.id === activeOrg?.id) ?? userOrgs[0]
  }, [activeOrg?.id, userOrgs])

  return (
    <SidebarProvider>
      <AppSidebar currentOrg={currentOrg} userOrgs={userOrgs} />
      <div className="flex h-screen w-full flex-col py-0 pr-0 duration-300 md:py-2 md:pr-2">
        <SidebarInset className="h-full overflow-hidden rounded-xl border border-border/80">
          <div className="flex h-full w-full flex-col overflow-hidden bg-background">
            <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-2 bg-background/70 backdrop-blur-md">
              <div className="flex w-full items-center justify-between px-4">
                <div className="flex items-center gap-2">
                  <SidebarTrigger className="-ml-1" />
                  <Separator orientation="vertical" className="mr-2 h-4 self-center" />
                  <span className="text-sm font-normal text-foreground">Profile</span>
                </div>
              </div>
            </header>
            <div className="relative flex min-h-0 flex-grow flex-col overflow-y-auto">
              <ProfileEditor key={user.uid} user={user} userOrgs={userOrgs} />
            </div>
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  )
}

function ProfileEditor({ user, userOrgs }: { user: User; userOrgs: ProfileOrg[] }) {
  const fileInputRef = React.useRef<HTMLInputElement | null>(null)
  const nameTextRef = React.useRef<HTMLSpanElement | null>(null)
  const [nameDraft, setNameDraft] = React.useState(user.displayName || "")
  const [photoDraft, setPhotoDraft] = React.useState(user.photoURL || "")
  const [editingName, setEditingName] = React.useState(false)
  const [savingName, setSavingName] = React.useState(false)
  const [whatsappDraft, setWhatsappDraft] = React.useState("+94")
  const [savingWhatsapp, setSavingWhatsapp] = React.useState(false);
const [showWhatsappInput, setShowWhatsappInput] = React.useState(false);
  const [uploading, setUploading] = React.useState(false)
  const [status, setStatus] = React.useState<"saved" | "uploaded" | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const tenantNamespace = domainFromEmail(user.email).replace(/\./g, "-")

  const persistProfile = React.useCallback(
    async (next: { displayName: string; photoURL: string }) => {
      const currentUser = auth.currentUser
      if (!currentUser) throw new Error("You need to sign in again before updating your profile.")

      await updateProfile(currentUser, {
        displayName: next.displayName,
        photoURL: next.photoURL,
      })

      await setDoc(
          doc(db, "users", currentUser.uid),
          {
            uid: currentUser.uid,
            name: next.displayName,
            email: currentUser.email || "",
            photo: next.photoURL,
            tenantId: domainFromEmail(currentUser.email),
            domain: domainFromEmail(currentUser.email),
            updatedAt: new Date().toISOString(),
            // Preserve existing whatsappNumber if any
          },
          { merge: true }
        )
    },
    []
  )

  React.useEffect(() => {
      if (!editingName) return
      nameTextRef.current?.focus()
      const selection = window.getSelection()
      const range = document.createRange()
      if (nameTextRef.current && selection) {
        range.selectNodeContents(nameTextRef.current)
        selection.removeAllRanges()
        selection.addRange(range)
      }
    }, [editingName])

    // Load existing WhatsApp number from Firestore
    React.useEffect(() => {
      const loadWhatsapp = async () => {
        try {
          const snap = await getDoc(doc(db, "users", user.uid))
          if (snap.exists()) {
            const data = snap.data()
            if (data.whatsappNumber) setWhatsappDraft(data.whatsappNumber)
          }
        } catch (e) {
          console.error("Failed to load WhatsApp number", e)
        }
      }
      void loadWhatsapp()
    }, [user.uid])

  const requestNameChange = async () => {
    const trimmedName = (nameTextRef.current?.textContent || nameDraft).trim()
    if (!trimmedName) {
      setError("Name cannot be empty.")
      if (nameTextRef.current) nameTextRef.current.textContent = nameDraft
      setEditingName(false)
      return
    }

    if (trimmedName === nameDraft.trim()) {
      setEditingName(false)
      return
    }

    setSavingName(true)
    setError(null)
    setStatus(null)
    try {
      await persistProfile({ displayName: trimmedName, photoURL: photoDraft })
      setNameDraft(trimmedName)
      setStatus("saved")
    } catch (saveError) {
      console.error("Profile save failed:", saveError)
      setError(saveError instanceof Error ? saveError.message : "Could not save your profile.")
      if (nameTextRef.current) nameTextRef.current.textContent = nameDraft
    } finally {
      setSavingName(false)
      setEditingName(false)
    }
  }

  const uploadProfilePicture = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return

    if (!file.type.startsWith("image/")) {
      setError("Upload an image file for your profile picture.")
      return
    }

    const maxSize = 2 * 1024 * 1024
    if (file.size > maxSize) {
      setError("Profile picture must be smaller than 2MB.")
      return
    }

    const currentUser = auth.currentUser
    if (!currentUser) {
      setError("You need to sign in again before uploading a profile picture.")
      return
    }

    setUploading(true)
    setError(null)
    setStatus(null)
    try {
      const ext = file.name.split(".").pop() || "png"
      const storageRef = ref(storage, `users/${currentUser.uid}/profile/avatar.${ext}`)
      await uploadBytes(storageRef, file)
      const downloadUrl = await getDownloadURL(storageRef)
      const nextName = nameDraft.trim() || currentUser.displayName || currentUser.email || "User"

      setPhotoDraft(downloadUrl)
      await persistProfile({ displayName: nextName, photoURL: downloadUrl })
      setStatus("uploaded")
    } catch (uploadError) {
      console.error("Profile picture upload failed:", uploadError)
      setError(uploadError instanceof Error ? uploadError.message : "Could not upload your profile picture.")
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="flex h-full flex-col bg-background">
      <main className="flex-grow overflow-auto bg-muted/10 p-6">
        <div className="mx-auto w-full max-w-xl space-y-8 py-4">
          {error ? (
            <Alert variant="destructive">
              <AlertTitle>Profile update failed</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          {status ? (
            <Alert>
              <CheckCircle2 className="size-4" />
              <AlertDescription>
                {status === "uploaded" ? "Profile picture updated." : "Profile changes saved."}
              </AlertDescription>
            </Alert>
          ) : null}

          <RoundedList className="overflow-visible">
            <RoundedListItem className="w-full !overflow-visible border p-0 shadow-none">
              <div className="flex w-full items-center rounded-[inherit] bg-card p-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(event) => void uploadProfilePicture(event)}
                />
                <div className="relative mr-4 shrink-0">
                  <Avatar className="size-12 rounded-full">
                    <AvatarImage src={photoDraft} alt={nameDraft || user.email || "Profile"} className="rounded-full" />
                    <AvatarFallback className="rounded-full">{initials(nameDraft, user.email || "")}</AvatarFallback>
                  </Avatar>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading || savingName}
                    className="absolute bottom-0 right-0 flex size-4 items-center justify-center rounded-full bg-background text-muted-foreground ring-1 ring-border transition-colors hover:text-primary disabled:pointer-events-none disabled:opacity-50"
                    title="Change profile photo"
                  >
                    {uploading ? <Loader2 className="size-2.5 animate-spin" /> : <Pencil className="size-2.5" />}
                  </button>
                </div>
                <div className="flex min-w-0 flex-1 flex-col items-start">
                  {editingName ? (
                    <span
                      ref={nameTextRef}
                      role="textbox"
                      tabIndex={0}
                      contentEditable
                      suppressContentEditableWarning
                      onBlur={() => void requestNameChange()}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault()
                          void requestNameChange()
                        }
                        if (event.key === "Escape") {
                          setEditingName(false)
                          if (nameTextRef.current) nameTextRef.current.textContent = nameDraft
                        }
                      }}
                      className="min-h-6 max-w-full truncate text-base font-semibold outline-none focus-visible:ring-0"
                    >
                      {nameDraft || user.email || "User"}
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setEditingName(true)}
                      className="group/name flex max-w-full cursor-text items-center gap-2 text-left text-base font-semibold"
                    >
                      <span className="truncate">{nameDraft || user.email || "User"}</span>
                      {savingName ? (
                        <Loader2 className="size-3.5 shrink-0 animate-spin text-muted-foreground" />
                      ) : (
                        <Pencil className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover/name:opacity-100 group-focus-visible/name:opacity-100" />
                      )}
                    </button>
                  )}
                  <span className="mt-0.5 max-w-full truncate text-xs text-muted-foreground">{user.email}</span>
                </div>
                {savingName && editingName ? (
                  <Loader2 className="ml-3 size-4 shrink-0 animate-spin text-muted-foreground" />
                ) : null}
              </div>
            </RoundedListItem>
          </RoundedList>

          <section className="space-y-3">
            <h2 className="font-heading text-base font-medium">Contact Information</h2>
            <RoundedList className="overflow-visible">
              <RoundedListItem className="w-full !overflow-visible border p-0 shadow-none mt-2">
                <div className="flex items-center rounded-[inherit] bg-card p-2">
                  {showWhatsappInput ? (
                    <div className="flex items-center justify-between w-full p-2 bg-card rounded-[inherit] group">
                      <div className="flex items-center space-x-2">
                        <FaWhatsapp className="size-5 text-green-500" />
                        <span className="text-sm font-medium text-foreground">WhatsApp</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <input
                          type="tel"
                          className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          value={whatsappDraft}
                          onChange={(e) => setWhatsappDraft(e.target.value)}
                          placeholder="+94xxxxxxxxx"
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={savingWhatsapp || !/^\+94[0-9]{9}$/.test(whatsappDraft.trim())}
                          onClick={async () => {
                            // Validate phone number format (Sri Lankan +94 followed by 9 digits)
                            const isValid = /^\+94[0-9]{9}$/.test(whatsappDraft.trim());
                            if (!isValid) {
                              setError("Please enter a valid Sri Lankan phone number (e.g., +94123456789)");
                              return;
                            }
                            setSavingWhatsapp(true);
                            try {
                              await setDoc(doc(db, "users", user.uid), { whatsappNumber: whatsappDraft.trim() }, { merge: true });
                              setStatus("saved");
                              setShowWhatsappInput(false);
                            } catch (e) {
                              console.error(e);
                              setError(e instanceof Error ? e.message : "Failed to save WhatsApp number");
                            } finally {
                              setSavingWhatsapp(false);
                            }
                          }}
                        >
                          {savingWhatsapp ? <Loader2 className="size-3 animate-spin mr-2" /> : null}Save
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between w-full p-2 bg-card rounded-[inherit] group">
                      <div className="flex items-center space-x-2">
                        <FaWhatsapp className="size-5 text-green-500" />
                        <span className="text-sm font-medium text-foreground">WhatsApp</span>
                      </div>
                      {whatsappDraft && whatsappDraft !== "+94" ? (
                        <div className="flex items-center space-x-2">
                          <span className="text-sm text-foreground">{whatsappDraft}</span>
                          <Pencil className="size-4 opacity-0 group-hover:opacity-100 cursor-pointer text-muted-foreground" onClick={() => setShowWhatsappInput(true)} />
                        </div>
                      ) : (
                        <Button variant="outline" size="sm" onClick={() => setShowWhatsappInput(true)}>
                          Add WhatsApp
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </RoundedListItem>
            </RoundedList>
          </section>

          <section className="space-y-3">
            <h2 className="font-heading text-base font-medium">Organizations</h2>
            {userOrgs.length > 0 ? (
              <RoundedList className="w-full space-y-0">
                {userOrgs.map((org, index) => {
                  const radius =
                    userOrgs.length === 1
                      ? "rounded-lg"
                      : index === 0
                        ? "rounded-t-lg rounded-b-none border-b-0"
                        : index === userOrgs.length - 1
                          ? "rounded-t-none rounded-b-lg"
                          : "rounded-none border-b-0"

                  return (
                    <RoundedListItem key={org.id} className={`w-full border p-0 shadow-none ${radius}`}>
                      <Link
                        href={tenantNamespace && org.slug ? `/org/${tenantNamespace}/${org.slug}` : "#"}
                        className="flex w-full min-w-0 items-center gap-3 p-3 text-left transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
                      >
                        <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted/40 text-sm font-semibold uppercase text-foreground/75">
                          {org.logo && (org.logo.startsWith("http://") || org.logo.startsWith("https://")) ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={org.logo} alt={org.name} className="size-full rounded-lg object-contain p-1.5" />
                          ) : (
                            org.name.charAt(0)
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">{org.name}</p>
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">
                            {org.verified ? "Verified workspace" : "Unverified workspace"}
                          </p>
                        </div>
                        <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                      </Link>
                    </RoundedListItem>
                  )
                })}
              </RoundedList>
            ) : (
              <div className="rounded-lg border border-dashed bg-card p-6 text-center">
                <p className="text-sm font-medium">No organizations yet</p>
                <p className="mt-1 text-sm text-muted-foreground">Organizations you join will appear here.</p>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  )
}
