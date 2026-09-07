"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/hooks/use-auth"
import { auth } from "@/lib/firebase"
import { createOrganization } from "@/lib/actions/organizations"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Building2, Loader2, Info, X, Trash2 } from "lucide-react"
import { toast } from "sonner"

export default function NewOrgPage() {
  const { user } = useAuth()
  const router = useRouter()

  const [name, setName] = React.useState("")
  const [slug, setSlug] = React.useState("")
  const [description, setDescription] = React.useState("")
  const [loading, setLoading] = React.useState(false)

  // Logo states
  const [logoFile, setLogoFile] = React.useState<File | null>(null)
  const [logoPreview, setLogoPreview] = React.useState<string | null>(null)
  const fileInputRef = React.useRef<HTMLInputElement | null>(null)

  // Generate a client-side random ID for the preview slug
  const [randomId] = React.useState(() => {
    if (typeof window !== "undefined" && window.crypto?.randomUUID) {
      return window.crypto.randomUUID().substring(0, 6)
    }
    return Math.random().toString(36).substring(2, 8)
  })

  // Derive tenant information
  const email = user?.email || ""
  const tenantId = email.split("@")[1]?.toLowerCase() || "sliit.lk"
  const tenantNamespace = tenantId.replace(/\./g, "-")

  // Auto-generate slug as user types name
  React.useEffect(() => {
    if (name) {
      const generatedSlug = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "")
      setSlug(generatedSlug)
    } else {
      setSlug("")
    }
  }, [name])

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file.")
      return
    }

    const MAX_SIZE = 2 * 1024 * 1024 // 2MB
    if (file.size > MAX_SIZE) {
      toast.error("Logo image is too large. Limit is 2MB.")
      return
    }

    setLogoFile(file)
    const url = URL.createObjectURL(file)
    setLogoPreview(url)
  }

  const removeLogo = () => {
    if (logoPreview) {
      URL.revokeObjectURL(logoPreview)
    }
    setLogoFile(null)
    setLogoPreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ""
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      toast.error("Organization name is required.")
      return
    }
    if (!slug.trim()) {
      toast.error("Organization URL slug is required.")
      return
    }

    setLoading(true)
    const toastId = toast.loading("Creating organization...")

    try {
      let base64Image: string | undefined
      let contentType: string | undefined

      if (logoFile) {
        const resized = await resizeLogo(logoFile)
        base64Image = resized.base64Image
        contentType = resized.contentType
      }

      const idToken = auth.currentUser ? await auth.currentUser.getIdToken() : null
      if (!idToken) {
        throw new Error("User session not found. Please log in again.")
      }

      const result = await createOrganization(
        idToken,
        name,
        description,
        slug,
        base64Image,
        contentType
      )

      if (result.error) {
        throw new Error(result.error)
      }

      await auth.currentUser?.getIdToken(true)

      toast.success("Organization created successfully!", { id: toastId })

      const created = result.data!
      router.push(`/org/${created.tenantNamespace}/${created.slug}/setup/google`)
    } catch (err) {
      console.error(err)
      toast.error(err instanceof Error ? err.message : "Failed to create organization.", { id: toastId })
    } finally {
      setLoading(false)
    }
  }

  const displayedSlug = slug ? `${slug}-unverified-${randomId}` : "slug"

  return (
    <div className="space-y-10 animate-in fade-in duration-200">
      
      {/* Header - Styled like Manual Form Header in /projects/new */}
      <div className="flex gap-3">
        <Building2 className="w-5 h-5 mt-1 text-primary shrink-0" />
        <div>
          <h2 className="font-heading text-base font-medium">Create a new organization</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Fill in the details for your new organization workspace
          </p>
        </div>
      </div>

      {/* Section 1: Icon Picker - Styled like Section 1: Icon/Visual Picker in /projects/new */}
      <div className="flex items-center gap-6 mt-2">
        <div className="relative group shrink-0">
          <div className="rounded-3xl w-16 h-16 flex items-center justify-center bg-muted overflow-hidden border select-none p-2">
            {logoPreview ? (
              <img src={logoPreview} alt="Logo preview" className="size-full object-contain" />
            ) : (
              <Building2 className="size-8 text-muted-foreground/60" />
            )}
          </div>
          {logoPreview && (
            <button
              type="button"
              onClick={removeLogo}
              className="absolute -top-1.5 -right-1.5 size-5 bg-background text-muted-foreground hover:text-foreground border border-border rounded-full flex items-center justify-center shadow transition-colors"
              title="Remove logo"
            >
              <X className="size-3" />
            </button>
          )}
        </div>

        <div className="flex flex-col gap-2 flex-1">
          <Label className="text-sm font-semibold text-foreground">
            Pick a visual for your organization
          </Label>
          <div className="flex gap-2 items-center flex-wrap">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleLogoChange}
              accept="image/*"
              className="hidden"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-full text-xs h-9 px-4"
              onClick={() => fileInputRef.current?.click()}
            >
              <svg className="size-3.5 mr-1.5 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              Upload Icon
            </Button>
            {logoPreview && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-full text-xs h-9 px-4 text-muted-foreground animate-in fade-in duration-200"
                onClick={removeLogo}
              >
                <Trash2 className="size-3.5 mr-1.5" />
                Remove Icon
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Section 2: Title & Description - Styled like /projects/new */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="org-name" className="text-sm font-semibold text-foreground">
              Title <span className="text-destructive">*</span>
            </Label>
            <Input
              id="org-name"
              placeholder="Organization title"
              className="rounded-full"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={loading}
              required
            />
            
            {/* Slug right below the title, with org icon */}
            <div className="flex items-center gap-2 mt-2 pl-1 text-[11px] text-muted-foreground animate-in fade-in duration-200">
              <div className="size-5 rounded-lg bg-muted flex items-center justify-center overflow-hidden border border-border/80 shrink-0 select-none p-0.5">
                {logoPreview ? (
                  <img src={logoPreview} alt="Logo preview" className="size-full object-contain" />
                ) : (
                  <Building2 className="size-3.5 text-muted-foreground/60" />
                )}
              </div>
              <span className="font-mono text-primary font-semibold truncate">
                /{tenantNamespace}/{displayedSlug}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="org-description" className="text-sm font-semibold text-foreground">
              Description
            </Label>
            <Textarea
              id="org-description"
              placeholder="Brief description of the organization"
              className="rounded-3xl min-h-[100px]"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={loading}
            />
          </div>
        </div>

        {/* Color-neutral Alert */}
        <Alert className="border-border bg-muted/10 text-muted-foreground rounded-3xl">
          <Info className="size-4 text-muted-foreground shrink-0" />
          <AlertDescription className="text-xs leading-normal ml-2">
            Unverified organizations are not public until they get verified by an administrator.
          </AlertDescription>
        </Alert>

        {/* Action Buttons - No border line, reduced top space */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button
            type="button"
            variant="ghost"
            className="rounded-full"
            onClick={() => router.push("/")}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            className="rounded-full min-w-[120px]"
            disabled={loading || !name.trim()}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Loading...
              </>
            ) : (
              "Continue"
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}
