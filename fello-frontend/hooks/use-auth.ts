import { useState, useEffect } from 'react'
import { auth } from '@/lib/firebase'
import { User, onAuthStateChanged } from 'firebase/auth'

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user)
      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

  return { user, loading }
}

/**
 * Force-refresh the signed-in user's ID token so newly-baked custom claims
 * (org/project access) take effect immediately, instead of waiting for the
 * token's normal ~1hr expiry. Call this right after any action that could
 * have changed the current user's own claims (e.g. accepting a project
 * invite, being added as a member).
 */
export async function refreshClaims(): Promise<string | null> {
  const user = auth.currentUser
  if (!user) return null
  return user.getIdToken(true)
}
