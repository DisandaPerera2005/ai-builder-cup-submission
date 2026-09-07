"use server"

import { randomUUID } from "crypto"
import { adminAuth, adminDb, adminStorageBucket, resolveOrgScope, verifyActor } from "@/lib/firebase-admin"
import { bakeCustomClaims } from "@/lib/actions/claims"
import type { ActionResult } from "@/lib/types"

const MAX_LOGO_BYTES = 512 * 1024
const ALLOWED_LOGO_TYPES = new Set(["image/webp", "image/png", "image/jpeg"])

export async function createOrganization(
  idToken: string,
  name: string,
  description: string,
  slug: string,
  base64Image?: string,
  contentType?: string
): Promise<ActionResult<{ orgId: string; tenantId: string; tenantNamespace: string; slug: string }>> {
  try {
    if (!idToken || !name || !slug) {
      return { data: null, error: "Missing required fields." }
    }

    const decoded = await adminAuth().verifyIdToken(idToken)
    const email = decoded.email || ""
    if (!email) {
      return { data: null, error: "Email is missing from authentication token." }
    }

    const tenantId = email.split("@")[1]?.toLowerCase()
    if (!tenantId) {
      return { data: null, error: "Could not resolve tenant ID from email." }
    }
    const tenantNamespace = tenantId.replace(/\./g, "-")

    const orgId = randomUUID()
    const shortId = orgId.substring(0, 6)
    const finalSlug = `${slug.trim().toLowerCase()}-unverified-${shortId}`

    const db = adminDb()

    await db.collection("tenants").doc(tenantId).set({
      domain: tenantId,
      urlNamespace: tenantNamespace,
      displayName: tenantId.split(".")[0].toUpperCase(),
      verified: true,
      createdAt: new Date().toISOString(),
      structureVersion: 1
    }, { merge: true })

    let logoUrl = ""
    let storagePath = ""

    if (base64Image && contentType) {
      if (!ALLOWED_LOGO_TYPES.has(contentType)) {
        return { data: null, error: "Please upload a PNG, JPEG, or WebP image." }
      }
      const buffer = Buffer.from(base64Image, "base64")
      if (buffer.byteLength > MAX_LOGO_BYTES) {
        return { data: null, error: "Logo image is too large. Please choose a smaller image." }
      }

      storagePath = `tenants/${tenantId}/orgs/${orgId}/organization/logo.webp`
      const token = randomUUID()
      const file = adminStorageBucket().file(storagePath)
      await file.save(buffer, {
        contentType,
        resumable: false,
        metadata: {
          cacheControl: "public, max-age=31536000",
          metadata: {
            firebaseStorageDownloadTokens: token,
          },
        },
      })
      const bucketName = adminStorageBucket().name
      logoUrl = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(storagePath)}?alt=media&token=${token}`
    }

    await db.collection("organizations").doc(orgId).set({
      id: orgId,
      tenantId: tenantId,
      slug: finalSlug,
      name: name.trim(),
      logo: logoUrl || "",
      description: description.trim(),
      parentId: null,
      ancestors: [],
      verified: false,
      verificationStatus: "pending",
      createdBy: decoded.uid,
      createdAt: new Date().toISOString(),
      structureVersion: 1
    })

    await db.collection("memberships").doc(`${decoded.uid}_${orgId}`).set({
      userId: decoded.uid,
      orgId: orgId,
      tenantId: tenantId,
      nodeId: "node_root",
      role: "owner",
      access: "owner",
      capabilities: ["*"],
      addedBy: "system",
      addedAt: new Date().toISOString()
    })

    const userRef = db.collection("users").doc(decoded.uid)
    const userSnap = await userRef.get()
    const userOrgs = userSnap.data()?.organizations || []
    if (!userOrgs.includes(orgId)) {
      userOrgs.push(orgId)
    }
    await userRef.set({
      uid: decoded.uid,
      email: decoded.email,
      tenantId: tenantId,
      name: decoded.name || decoded.email?.split("@")[0] || "User",
      photo: decoded.picture || "",
      lastOpenedOrg: orgId,
      organizations: userOrgs
    }, { merge: true })

    await bakeCustomClaims(decoded.uid)

    return {
      data: {
        orgId,
        tenantId,
        tenantNamespace,
        slug: finalSlug
      },
      error: null
    }
  } catch (err) {
    console.error("[createOrganization]", err)
    return { data: null, error: "Could not create the organization. Please try again." }
  }
}

export async function uploadOrganizationLogo(
  idToken: string,
  orgId: string,
  contentType: string,
  base64Image: string
): Promise<ActionResult<{ logoUrl: string; storagePath: string }>> {
  try {
    if (!idToken || !orgId || !contentType || !base64Image) {
      return { data: null, error: "Missing required fields." }
    }

    if (!ALLOWED_LOGO_TYPES.has(contentType)) {
      return { data: null, error: "Please upload a PNG, JPEG, or WebP image." }
    }

    const actor = await verifyActor(idToken)
    const scope = await resolveOrgScope(actor, orgId)
    if (!scope) return { data: null, error: "You do not have access to this organization." }

    const buffer = Buffer.from(base64Image, "base64")
    if (buffer.byteLength > MAX_LOGO_BYTES) {
      return { data: null, error: "Logo image is too large. Please choose a smaller image." }
    }

    const orgRef = adminDb().collection("organizations").doc(scope.orgId)
    const orgSnap = await orgRef.get()
    const orgData = orgSnap.data() as { tenantId?: string } | undefined
    if (!orgSnap.exists || orgData?.tenantId !== scope.tenantId) {
      return { data: null, error: "Organization not found." }
    }

    const storagePath = `tenants/${scope.tenantId}/orgs/${scope.orgId}/organization/logo.webp`
    const token = randomUUID()
    const file = adminStorageBucket().file(storagePath)
    await file.save(buffer, {
      contentType,
      resumable: false,
      metadata: {
        cacheControl: "public, max-age=31536000",
        metadata: {
          firebaseStorageDownloadTokens: token,
        },
      },
    })

    const bucketName = adminStorageBucket().name
    const logoUrl = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(storagePath)}?alt=media&token=${token}`

    await orgRef.update({
      logo: logoUrl,
      logoStoragePath: storagePath,
      updatedAt: new Date().toISOString(),
    })

    return { data: { logoUrl, storagePath }, error: null }
  } catch (err) {
    console.error("[uploadOrganizationLogo]", err)
    return { data: null, error: "Could not update the organization photo. Please try again." }
  }
}
