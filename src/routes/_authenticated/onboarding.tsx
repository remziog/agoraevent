import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Music, Film, Activity, Sparkles, Check } from "lucide-react";
import { completeOnboarding, updateTaste, upsertSocial } from "@/lib/profile.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Logo } from "@/components/Logo";

export const Route = createFileRoute("/_authenticated/onboarding")({
  component: Onboarding,
});

const MUSIC = ["indie", "techno", "jazz", "hip-hop", "classical", "vinyl", "acoustic", "ambient"];
const SPORTS = ["running", "climbing", "cycling", "yoga", "football", "tennis", "swimming", "hiking"];
const FILMS = ["arthouse", "documentary", "horror", "sci-fi", "indie", "noir", "comedy", "anime"];
const INTERESTS = ["coffee", "wine", "books", "pottery", "boardgames", "photography", "cooking", "design"];

const INTEGRATIONS: { id: string; label: string; tags: string[]; icon: any }[] = [
  { id: "spotify", label: "Spotify", tags: ["indie", "vinyl", "acoustic"], icon: Music },
  { id: "letterboxd", label: "Letterboxd", tags: ["arthouse", "indie", "documentary"], icon: Film },
  { id: "strava", label: "Strava", tags: ["running", "cycling"], icon: Activity },
  { id: "lastfm", label: "Last.fm", tags: ["jazz", "ambient"], icon: Sparkles },
];

type Step = 1 | 2;

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-sm transition ${
        active
          ? "border-primary bg-primary/10 text-foreground"
          : "border-border/60 bg-background/40 text-muted-foreground hover:border-primary/40 hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function Onboarding() {
  const navigate = useNavigate();
  const complete = useServerFn(completeOnboarding);
  const saveTaste = useServerFn(updateTaste);
  const saveSocial = useServerFn(upsertSocial);

  const [step, setStep] = useState<Step>(1);
  const [role, setRole] = useState<"member" | "organizer">("member");
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [bio, setBio] = useState("");
  const [loading, setLoading] = useState(false);

  const [music, setMusic] = useState<string[]>([]);
  const [sports, setSports] = useState<string[]>([]);
  const [films, setFilms] = useState<string[]>([]);
  const [interests, setInterests] = useState<string[]>([]);
  const [freeText, setFreeText] = useState("");
  const [connected, setConnected] = useState<string[]>([]);

  function toggle(list: string[], setter: (v: string[]) => void, value: string) {
    setter(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  }

  function toggleIntegration(id: string) {
    const integration = INTEGRATIONS.find((i) => i.id === id)!;
    if (connected.includes(id)) {
      setConnected(connected.filter((c) => c !== id));
      // Strip its tags from music/films/sports/interests if no other source has them
      setMusic((m) => m.filter((t) => !integration.tags.includes(t) || isManual(t, [sports, films, interests])));
    } else {
      setConnected([...connected, id]);
      // Seed tags into the matching bucket
      integration.tags.forEach((tag) => {
        if (MUSIC.includes(tag) && !music.includes(tag)) setMusic((m) => [...m, tag]);
        if (SPORTS.includes(tag) && !sports.includes(tag)) setSports((s) => [...s, tag]);
        if (FILMS.includes(tag) && !films.includes(tag)) setFilms((f) => [...f, tag]);
        if (INTERESTS.includes(tag) && !interests.includes(tag)) setInterests((i) => [...i, tag]);
      });
    }
  }

  function isManual(_tag: string, _others: string[][]) {
    return false; // best-effort; keep seeded tags around even on disconnect to avoid surprise removals
  }

  async function submitStep1(e: React.FormEvent) {
    e.preventDefault();
    if (role === "organizer") {
      // Organizers skip taste — finalize immediately
      setLoading(true);
      try {
        await complete({ data: { display_name: name, city, bio: bio || null, role } });
        toast.success("You're in.");
        navigate({ to: "/biz" });
      } catch (err) {
        toast.error((err as Error).message);
      } finally {
        setLoading(false);
      }
      return;
    }
    setStep(2);
  }

  async function submitStep2() {
    setLoading(true);
    try {
      await complete({ data: { display_name: name, city, bio: bio || null, role } });
      await saveTaste({
        data: { music, sports, films, interests, free_text: freeText || null },
      });
      // Persist each "integration" so we can cluster on it later
      await Promise.all(
        connected.map((provider) => {
          const tags = INTEGRATIONS.find((i) => i.id === provider)!.tags;
          return saveSocial({ data: { provider, tags } });
        }),
      );
      toast.success("Your compass is calibrated.");
      navigate({ to: "/app" });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function skipStep2() {
    setLoading(true);
    try {
      await complete({ data: { display_name: name, city, bio: bio || null, role } });
      toast.success("You're in. You can add taste later from your profile.");
      navigate({ to: "/app" });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <Logo />
        <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
          Step {step} of {role === "organizer" ? 1 : 2}
        </p>
      </header>

      <main className="mx-auto max-w-xl px-6 py-12">
        {step === 1 && (
          <>
            <h1 className="font-display text-4xl">Welcome to Agora</h1>
            <p className="mt-2 text-muted-foreground">
              A few details so we can place you in the right room.
            </p>

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

            <form onSubmit={submitStep1} className="mt-8 space-y-4">
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
                {loading ? "Saving…" : role === "member" ? "Next: your taste" : "Finish"}
              </Button>
            </form>
          </>
        )}

        {step === 2 && (
          <>
            <p className="text-xs uppercase tracking-[0.3em] text-primary">Calibrate the compass</p>
            <h1 className="mt-2 font-display text-4xl">What moves you?</h1>
            <p className="mt-2 text-muted-foreground">
              Pick a few tags or connect a service. We use this to cluster you with similar people
              and surface events you'd actually show up to.
            </p>

            <section className="mt-8">
              <p className="text-sm font-medium">Quick connect</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Tap to seed your taste with a starter set of tags.
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {INTEGRATIONS.map(({ id, label, icon: Icon }) => {
                  const active = connected.includes(id);
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => toggleIntegration(id)}
                      className={`flex items-center justify-between rounded-xl border p-3 text-left transition ${
                        active ? "border-primary bg-primary/5" : "hover:border-foreground/30"
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-primary" />
                        <span className="text-sm">{label}</span>
                      </span>
                      {active && <Check className="h-4 w-4 text-primary" />}
                    </button>
                  );
                })}
              </div>
            </section>

            {[
              { title: "Music", list: MUSIC, value: music, set: setMusic },
              { title: "Sport & movement", list: SPORTS, value: sports, set: setSports },
              { title: "Film", list: FILMS, value: films, set: setFilms },
              { title: "Interests", list: INTERESTS, value: interests, set: setInterests },
            ].map((g) => (
              <section key={g.title} className="mt-6">
                <p className="text-sm font-medium">{g.title}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {g.list.map((tag) => (
                    <Chip
                      key={tag}
                      active={g.value.includes(tag)}
                      onClick={() => toggle(g.value, g.set, tag)}
                    >
                      {tag}
                    </Chip>
                  ))}
                </div>
              </section>
            ))}

            <section className="mt-6 space-y-2">
              <Label htmlFor="free">Anything else? (optional)</Label>
              <Textarea
                id="free"
                rows={2}
                placeholder="e.g. quiet bars, Sunday morning runs, Murakami book clubs"
                value={freeText}
                onChange={(e) => setFreeText(e.target.value)}
              />
            </section>

            <div className="mt-8 flex flex-col gap-2 sm:flex-row">
              <Button onClick={submitStep2} disabled={loading} className="flex-1">
                {loading ? "Saving…" : "Finish & open my compass"}
              </Button>
              <Button variant="ghost" onClick={skipStep2} disabled={loading}>
                Skip for now
              </Button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
