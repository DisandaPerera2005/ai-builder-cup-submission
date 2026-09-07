"use client"

import * as React from "react"
import { useAuth } from "@/hooks/use-auth"
import { auth, db } from "@/lib/firebase"
import { collection, query, where, getDocs } from "firebase/firestore"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Loader2, CheckCircle2, XCircle, ExternalLink } from "lucide-react"

export default function TestGoogleFormPage() {
  const { user, loading } = useAuth()
  const [orgId, setOrgId] = React.useState("")
  const [title, setTitle] = React.useState("Fello Test Form")
  const [busy, setBusy] = React.useState(false)
  const [result, setResult] = React.useState<any>(null)

  // Best-effort: prefill the first org the user is a member of.
  React.useEffect(() => {
    if (!user) return
    void (async () => {
      const snap = await getDocs(
        query(collection(db, "memberships"), where("userId", "==", user.uid))
      )
      const first = snap.docs[0]?.data()?.orgId
      if (first) setOrgId((cur) => cur || first)
    })()
  }, [user])

  const run = async () => {
    if (!auth.currentUser) return
    setBusy(true)
    setResult(null)
    try {
      const idToken = await auth.currentUser.getIdToken()
      const res = await fetch("/api/test-google-form", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({
          orgId,
          title,
          description: "Created from the Fello test page.",
          questions: ["Full name", "Email", "Phone number"],
        }),
      })
      setResult(await res.json())
    } catch (err) {
      setResult({ ok: false, step: "fetch", error: String(err) })
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <Centered>Loading…</Centered>
  if (!user) return <Centered>Please sign in first.</Centered>

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col gap-5 p-6">
      <div>
        <h1 className="text-xl font-bold">Google Forms API Test</h1>
        <p className="text-sm text-muted-foreground">
          One-click check that Fello can create a Google Form in your org's connected account.
        </p>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="org">Org ID (internal UUID)</Label>
          <Input id="org" value={orgId} onChange={(e) => setOrgId(e.target.value)} placeholder="org_xxxxx" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="title">Form title</Label>
          <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <Button onClick={run} disabled={busy || !orgId} className="mt-1">
          {busy ? <Loader2 className="size-4 animate-spin" /> : null}
          {busy ? "Creating…" : "Create test form"}
        </Button>
      </div>

      {result && (
        <Alert variant={result.ok ? "default" : "destructive"}>
          {result.ok ? <CheckCircle2 className="size-4" /> : <XCircle className="size-4" />}
          <AlertTitle>{result.ok ? "Form created" : `Failed at: ${result.step}`}</AlertTitle>
          <AlertDescription className="flex flex-col gap-2">
            {result.account && <span className="text-xs">Account: {result.account}</span>}
            {result.ok && result.responderUri && (
              <a
                href={result.responderUri}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-primary underline"
              >
                Open form <ExternalLink className="size-3.5" />
              </a>
            )}
            {result.error && (
              <pre className="whitespace-pre-wrap break-words rounded bg-muted/50 p-2 text-xs">
                {result.error}
              </pre>
            )}
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">{children}</div>
}
