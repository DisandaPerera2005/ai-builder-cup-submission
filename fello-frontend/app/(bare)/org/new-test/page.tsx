"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/hooks/use-auth"
import { db } from "@/lib/firebase"
import { doc, setDoc, arrayUnion } from "firebase/firestore"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Building2, Sparkles, AlertCircle, CheckCircle2, ArrowRight, Image as ImageIcon } from "lucide-react"

export default function NewTestOrgPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()

  const [name, setName] = React.useState("")
  const [slug, setSlug] = React.useState("")
  const [logo, setLogo] = React.useState("")
  const [description, setDescription] = React.useState("")
  const [verifyCheckbox, setVerifyCheckbox] = React.useState(false)
  
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [successData, setSuccessData] = React.useState<{
    orgId: string
    namespace: string
    slug: string
  } | null>(null)

  const email = user?.email || ""
  const tenantId = email.split("@")[1]?.toLowerCase() || "my.sliit.lk"
  const namespace = tenantId.replace(/\./g, "-")

  // Auto-generate slug as user types
  React.useEffect(() => {
    if (name) {
      const generatedSlug = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "")
      setSlug(generatedSlug)
    }
  }, [name])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) {
      setError("You must be signed in to create an organization.")
      return
    }

    if (!name.trim()) {
      setError("Organization name is required.")
      return
    }

    if (!slug.trim()) {
      setError("Slug is required.")
      return
    }

    setLoading(true)
    setError(null)

    try {
      const internalId = "org_" + Math.random().toString(36).substring(2, 10)

      const isVerified = verifyCheckbox
      const status = verifyCheckbox ? "approved" : "pending"
      const shortId = Math.random().toString(36).substring(2, 6)
      const finalSlug = isVerified 
        ? slug.trim().toLowerCase() 
        : `${slug.trim().toLowerCase()}-unverified-${shortId}`

      // 1. Set tenants/{domain}
      await setDoc(doc(db, "tenants", tenantId), {
        domain: tenantId,
        urlNamespace: namespace,
        displayName: tenantId.split(".")[0].toUpperCase(),
        verified: true,
        createdAt: new Date().toISOString(),
        structureVersion: 1
      }, { merge: true })

      // 2. Set organizations/{internalId}
      await setDoc(doc(db, "organizations", internalId), {
        id: internalId,
        tenantId: tenantId,
        slug: finalSlug,
        name: name.trim(),
        logo: logo.trim() || "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=100&h=100&fit=crop",
        description: description.trim(),
        parentId: null,
        ancestors: [],
        verified: isVerified,
        verificationStatus: status,
        createdBy: user.uid,
        createdAt: new Date().toISOString(),
        structureVersion: 1
      })

      // 3. Set memberships/{userId}_{orgId}
      await setDoc(doc(db, "memberships", `${user.uid}_${internalId}`), {
        userId: user.uid,
        orgId: internalId,
        tenantId: tenantId,
        nodeId: "node_root",
        role: "chair",
        access: "full",
        capabilities: [
          "drive.read", "drive.write",
          "whatsapp.send", "whatsapp.manage",
          "members.manage", "tasks.manage",
          "events.manage", "analytics.view"
        ],
        addedBy: "system",
        addedAt: new Date().toISOString()
      })

      // 4. Update users/{uid}
      await setDoc(doc(db, "users", user.uid), {
        uid: user.uid,
        email: user.email,
        tenantId: tenantId,
        name: user.displayName || "Test User",
        photo: user.photoURL || "",
        lastOpenedOrg: internalId,
        organizations: arrayUnion(internalId)
      }, { merge: true })

      setSuccessData({
        orgId: internalId,
        namespace: namespace,
        slug: finalSlug
      })
    } catch (err) {
      console.error(err)
      setError("Failed to create organization: " + (err instanceof Error ? err.message : String(err)))
    } finally {
      setLoading(false)
    }
  }

  if (authLoading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <div className="text-center flex flex-col gap-3">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground text-sm">Verifying session...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex h-[80vh] items-center justify-center p-4">
        <div className="max-w-md w-full bg-card border border-border rounded-2xl p-6 shadow-lg text-center flex flex-col gap-4">
          <div className="size-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mx-auto">
            <AlertCircle className="size-6" />
          </div>
          <h2 className="text-xl font-bold">Authentication Required</h2>
          <p className="text-muted-foreground text-sm">
            You must be signed in to access the organization test creation tool.
          </p>
          <Button onClick={() => router.push("/sign-in")} className="w-full">
            Go to Sign In
          </Button>
        </div>
      </div>
    )
  }

  if (user.email !== "kavindu.20250078@iit.ac.lk") {
    return (
      <div className="flex h-[80vh] items-center justify-center p-4">
        <div className="max-w-md w-full bg-card border border-border rounded-2xl p-6 shadow-lg text-center flex flex-col gap-4">
          <div className="size-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mx-auto">
            <AlertCircle className="size-6" />
          </div>
          <h2 className="text-xl font-bold">Access Denied</h2>
          <p className="text-muted-foreground text-sm">
            You do not have administrative permissions to access the organization test creation tool.
          </p>
          <Button onClick={() => router.push("/")} className="w-full">
            Back to Home
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center px-4 py-12 relative overflow-hidden bg-background">
      {/* Background aesthetics */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full bg-primary/10 blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-96 h-96 rounded-full bg-blue-500/5 blur-3xl" />

      <div className="max-w-xl w-full bg-card/60 backdrop-blur-md border border-border/80 shadow-2xl rounded-2xl p-8 relative z-10">
        <div className="flex items-center gap-3 mb-6">
          <div className="size-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <Building2 className="size-5" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight">Create Test Org</h1>
            <p className="text-muted-foreground text-xs mt-0.5">
              Quickly seed a custom tenant-isolated workspace.
            </p>
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-3 bg-destructive/10 text-destructive border border-destructive/20 rounded-xl p-4 mb-6 text-sm">
            <AlertCircle className="size-5 shrink-0 mt-0.5" />
            <div className="flex-1">{error}</div>
          </div>
        )}

        {successData ? (
          <div className="flex flex-col gap-6 text-center py-4">
            <div className="size-14 rounded-full bg-green-500/10 text-green-500 flex items-center justify-center mx-auto">
              <CheckCircle2 className="size-8 animate-bounce" />
            </div>
            <div className="flex flex-col gap-2">
              <h2 className="text-xl font-bold text-foreground">Organization Created!</h2>
              <p className="text-muted-foreground text-sm max-w-sm mx-auto">
                Documents created successfully in <span className="font-semibold">{tenantId}</span> tenant namespace.
              </p>
            </div>

            <div className="bg-muted/40 border border-border/60 rounded-xl p-4 text-left flex flex-col gap-2 font-mono text-xs">
              <div><span className="text-muted-foreground">ID:</span> {successData.orgId}</div>
              <div><span className="text-muted-foreground">URL Slug:</span> {successData.slug}</div>
              <div><span className="text-muted-foreground">Namespace:</span> {successData.namespace}</div>
              <div><span className="text-muted-foreground">Resolved path:</span> /org/{successData.namespace}/{successData.slug}</div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <Button 
                onClick={() => router.push(`/org/${successData.namespace}/${successData.slug}`)} 
                className="flex-1 gap-2"
              >
                Go to Dashboard <ArrowRight className="size-4" />
              </Button>
              <Button 
                variant="outline" 
                onClick={() => {
                  setName("")
                  setSlug("")
                  setDescription("")
                  setLogo("")
                  setSuccessData(null)
                }}
              >
                Create Another
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div className="grid gap-2">
              <Label htmlFor="name" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Organization Name
              </Label>
              <Input
                id="name"
                placeholder="e.g. SLIIT IEEE, Mozilla Branch"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="bg-muted/20 border-border/80 rounded-xl px-4 h-11"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="slug" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Url Slug
              </Label>
              <Input
                id="slug"
                placeholder="e.g. ieee"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                className="bg-muted/20 border-border/80 rounded-xl px-4 h-11"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="logo" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                <ImageIcon className="size-3.5" /> Logo Image URL (Optional)
              </Label>
              <Input
                id="logo"
                placeholder="https://example.com/logo.png"
                value={logo}
                onChange={(e) => setLogo(e.target.value)}
                className="bg-muted/20 border-border/80 rounded-xl px-4 h-11"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="description" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Description
              </Label>
              <textarea
                id="description"
                placeholder="Enter a short summary about the organization..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="flex min-h-[90px] w-full rounded-xl border border-border/80 bg-muted/20 px-4 py-3 text-sm placeholder:text-muted-foreground/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>

            <div className="flex items-center gap-2 py-1 select-none">
              <input
                id="verifyCheckbox"
                type="checkbox"
                checked={verifyCheckbox}
                onChange={(e) => setVerifyCheckbox(e.target.checked)}
                className="rounded border-border bg-muted/20 text-primary focus:ring-ring cursor-pointer"
              />
              <Label htmlFor="verifyCheckbox" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer">
                Auto-Verify Workspace (Admin Option)
              </Label>
            </div>

            <div className="bg-muted/30 border border-border/50 rounded-xl p-4 text-xs flex flex-col gap-1.5 text-muted-foreground">
              <div><span className="font-semibold">Tenant ID (Computed):</span> {tenantId}</div>
              <div><span className="font-semibold">URL Namespace (Computed):</span> {namespace}</div>
              <div>
                <span className="font-semibold">Calculated URL Path:</span>{" "}
                <span className="font-mono text-primary">
                  /org/{namespace}/{verifyCheckbox ? (slug.trim().toLowerCase() || "slug") : `${slug.trim().toLowerCase() || "slug"}-unverified-[uuid]`}
                </span>
              </div>
            </div>

            <Button type="submit" disabled={loading} className="w-full rounded-xl h-11 gap-2 font-semibold">
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-background border-t-transparent rounded-full animate-spin" />
                  Creating Workspace...
                </>
              ) : (
                <>
                  <Sparkles className="size-4" /> Create & Connect Workspace
                </>
              )}
            </Button>
          </form>
        )}
      </div>
    </div>
  )
}
