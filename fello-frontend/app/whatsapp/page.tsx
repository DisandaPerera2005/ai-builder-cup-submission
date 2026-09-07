"use client"

import * as React from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2 } from "lucide-react";
import { FaWhatsapp } from "react-icons/fa";
import { toast } from "sonner";

export default function AddWhatsappPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  const [whatsapp, setWhatsapp] = React.useState("+94");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Load existing number if present
  React.useEffect(() => {
    if (!user) return;
    const load = async () => {
      try {
        const snap = await getDoc(doc(db, "users", user.uid));
        if (snap.exists()) {
          const data = snap.data();
          if (data.whatsappNumber) {
            setWhatsapp(data.whatsappNumber);
          }
        }
      } catch (e) {
        console.error("Failed to load WhatsApp number", e);
      }
    };
    void load();
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    setError(null);
    try {
      await setDoc(doc(db, "users", user.uid), { whatsappNumber: whatsapp.trim() }, { merge: true });
      toast.success("WhatsApp number saved!");
      router.push("/profile");
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : "Failed to save WhatsApp number");
    } finally {
      setSaving(false);
    }
  };

  if (loading || !user) {
    return null;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md rounded-xl border bg-card p-6 shadow-sm">
        <div className="flex items-center gap-4 mb-4">
          <FaWhatsapp className="size-8 text-green-500" />
          <h2 className="font-heading text-lg">Add Your WhatsApp Number</h2>
        </div>
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-foreground">WhatsApp Number</label>
          <input
            type="tel"
            className="rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
            placeholder="+94xxxxxxxxx"
          />
        </div>
        <Button
          className="mt-4 w-full"
          disabled={saving}
          onClick={handleSave}
        >
          {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
          Save
        </Button>
      </div>
    </div>
  );
}
