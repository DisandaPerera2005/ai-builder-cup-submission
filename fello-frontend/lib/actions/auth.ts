"use server"

import { adminDb } from "@/lib/firebase-admin"
import { FieldValue } from "firebase-admin/firestore"

export async function getAllowedDomains(): Promise<string[]> {
  try {
    const configDoc = await adminDb().collection("config").doc("domains").get()
    if (configDoc.exists) {
      return configDoc.data()?.allowed || []
    }
    return []
  } catch (error) {
    console.error("Failed to fetch allowed domains:", error)
    return []
  }
}

export async function incrementWaitlist(domain: string, email: string) {
  try {
    const db = adminDb()
    const userWaitlistRef = db.collection("waitlist_users").doc(email)
    const userWaitlistDoc = await userWaitlistRef.get()
    
    if (userWaitlistDoc.exists) {
      return true // Already requested
    }
    
    await userWaitlistRef.set({
      email,
      domain,
      requestedAt: new Date().toISOString()
    })

    const waitlistRef = db.collection("waitlists").doc(domain)
    const waitlistDoc = await waitlistRef.get()
    
    if (waitlistDoc.exists) {
      await waitlistRef.update({
        count: FieldValue.increment(1),
        lastRequestedAt: new Date().toISOString()
      })
    } else {
      await waitlistRef.set({
        domain,
        count: 1,
        lastRequestedAt: new Date().toISOString()
      })
    }
    return true
  } catch (error) {
    console.error("Failed to increment waitlist:", error)
    return false
  }
}

export async function getDomainWaitlistCount(domain: string): Promise<number> {
  try {
    const db = adminDb()
    const waitlistDoc = await db.collection("waitlists").doc(domain).get()
    if (waitlistDoc.exists) {
      return waitlistDoc.data()?.count || 0
    }
    return 0
  } catch (error) {
    console.error("Failed to get domain waitlist count:", error)
    return 0
  }
}

export async function getTopWaitlistDomains(): Promise<{ domain: string; count: number }[]> {
  try {
    const db = adminDb()
    const snapshot = await db
      .collection("waitlists")
      .orderBy("count", "desc")
      .limit(10)
      .get()
    
    const results = snapshot.docs.map(doc => {
      const data = doc.data()
      return {
        domain: data.domain || "",
        count: data.count || 0
      }
    })
    
    // Filter out "general" and return top 5
    return results.filter(item => item.domain !== "general").slice(0, 5)
  } catch (error) {
    console.error("Failed to fetch top waitlist domains:", error)
    return []
  }
}

export async function createUserRecord(user: {
  uid: string;
  name: string;
  email: string;
  photo: string;
  domain: string;
}) {
  try {
    const db = adminDb()
    const userRef = db.collection("users").doc(user.uid)
    const userDoc = await userRef.get()
    if (!userDoc.exists) {
      await userRef.set({
        uid: user.uid,
        name: user.name,
        email: user.email,
        photo: user.photo,
        tenantId: user.domain,
        domain: user.domain,
        whatsappVerified: false,
        createdAt: new Date().toISOString()
      })
    }

    // Automatically create tenant if it doesn't exist
    const instRef = db.collection("tenants").doc(user.domain)
    const instDoc = await instRef.get()
    if (!instDoc.exists) {
      await instRef.set({
        domain: user.domain,
        urlNamespace: user.domain.replace(/\./g, '-'),
        displayName: user.domain.split('.')[0].toUpperCase(),
        verified: true,
        createdAt: new Date().toISOString(),
        structureVersion: 1
      })
    }

    return true
  } catch (error) {
    console.error("Failed to create user record/institution:", error)
    return false
  }
}
