import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { completeOnboarding } from "@/lib/profile.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Logo } from "@/components/Logo";

export const Route = createFileRoute("/_authenticated/onboarding")({
  component: Onboarding,
});

function Onboarding() {
  const navigate = useNavigate();
  const complete = useServerFn(completeOnboarding);
  const [role, setRole] = useState<"member" | "organizer">("member");
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [bio, setBio] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await complete({ data: { display_name: name, city, bio: bio || null, role } });
      toast.success("You're in.");
      navigate({ to: role === "organizer" ? "/biz" : "/app" });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto max-w-6xl px-6 py-6"><Logo /></header>
      <main className="mx-auto max-w-xl px-6 py-12">
        <h1 className="font-display text-4xl">Welcome to Agora</h1>
        <p className="mt-2 text-muted-foreground">A few details so we can place you in the right room.</p>

        <div className="mt-8 grid grid-cols-2 gap-3">
          {(["member", "organizer"] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRole(r)}
              className={`rounded-xl border p-4 text-left transition ${
                role === r ? "border-primary bg-primary/5" : "hover:border-foreground/30"
              }`}
            >
              <div className="font-display text-xl">
                {r === "member" ? "I'm looking for my people" : "I host gatherings"}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {r === "member"
                  ? "Find events that fit your taste."
                  : "List events, see leads, grow a community."}
              </p>
            </button>
          ))}
        </div>

        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Display name</Label>
            <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="city">City</Label>
            <Input id="city" required placeholder="Istanbul" value={city} onChange={(e) => setCity(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bio">A line about you (optional)</Label>
            <Textarea id="bio" rows={3} value={bio} onChange={(e) => setBio(e.target.value)} />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Saving…" : "Continue"}
          </Button>
        </form>
      </main>
    </div>
  );
}
