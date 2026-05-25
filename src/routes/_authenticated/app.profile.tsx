import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Flame, Sparkles, Trophy } from "lucide-react";
import { getMyProfile, updateTaste } from "@/lib/profile.functions";
import { getMyStats, BADGES } from "@/lib/gamification.functions";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/profile")({
  component: ProfilePage,
});

function TagInput({ label, value, onChange }: { label: string; value: string[]; onChange: (v: string[]) => void }) {
  const [draft, setDraft] = useState("");
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex flex-wrap gap-2">
        {value.map((t, i) => (
          <span key={i} className="flex items-center gap-1 rounded-full bg-secondary px-3 py-1 text-sm">
            {t}
            <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))} className="opacity-60 hover:opacity-100">×</button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Add and press Enter"
          onKeyDown={(e) => {
            if (e.key === "Enter" && draft.trim()) {
              e.preventDefault();
              onChange([...value, draft.trim().toLowerCase()]);
              setDraft("");
            }
          }}
        />
      </div>
    </div>
  );
}

function ProfilePage() {
  const get = useServerFn(getMyProfile);
  const save = useServerFn(updateTaste);
  const fetchStats = useServerFn(getMyStats);
  const q = useQuery({ queryKey: ["me"], queryFn: () => get() });
  const stats = useQuery({ queryKey: ["my-stats"], queryFn: () => fetchStats() });

  const [music, setMusic] = useState<string[]>([]);
  const [sports, setSports] = useState<string[]>([]);
  const [films, setFilms] = useState<string[]>([]);
  const [interests, setInterests] = useState<string[]>([]);
  const [freeText, setFreeText] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (q.data?.taste) {
      setMusic(q.data.taste.music ?? []);
      setSports(q.data.taste.sports ?? []);
      setFilms(q.data.taste.films ?? []);
      setInterests(q.data.taste.interests ?? []);
      setFreeText(q.data.taste.free_text ?? "");
    }
  }, [q.data]);

  async function onSave() {
    setLoading(true);
    try {
      await save({ data: { music, sports, films, interests, free_text: freeText || null } });
      toast.success("Taste saved");
    } catch (e) { toast.error((e as Error).message); }
    finally { setLoading(false); }
  }

  const hasAnyTaste = music.length + sports.length + films.length + interests.length > 0 || freeText.length > 0;

  return (
    <div className="min-h-screen bg-background">
      <AppHeader variant="member" />
      <main className="mx-auto max-w-2xl px-6 py-10">
        {/* Gamification panel */}
        {stats.data && (
          <section className="mb-10 rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/10 via-card to-card p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-primary">Level</p>
                <p className="mt-1 font-display text-5xl">{stats.data.progress.level}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {stats.data.stats.xp} XP total
                </p>
              </div>
              <div className="flex gap-4 text-center">
                <div>
                  <Flame className="mx-auto h-5 w-5 text-orange-400" />
                  <p className="mt-1 font-display text-2xl">{stats.data.stats.current_streak}</p>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Streak
                  </p>
                </div>
                <div>
                  <Trophy className="mx-auto h-5 w-5 text-yellow-400" />
                  <p className="mt-1 font-display text-2xl">{stats.data.badges.length}</p>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Badges
                  </p>
                </div>
                <div>
                  <Sparkles className="mx-auto h-5 w-5 text-primary" />
                  <p className="mt-1 font-display text-2xl">{stats.data.stats.longest_streak}</p>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Best
                  </p>
                </div>
              </div>
            </div>

            {/* XP bar */}
            <div className="mt-5">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>L{stats.data.progress.level}</span>
                <span className="tabular-nums">
                  {stats.data.progress.xpInLevel} / {stats.data.progress.xpToNext} XP
                </span>
                <span>L{stats.data.progress.level + 1}</span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-gradient-to-r from-primary to-primary/60 transition-all"
                  style={{
                    width: `${Math.min(100, Math.round((stats.data.progress.xpInLevel / stats.data.progress.xpToNext) * 100))}%`,
                  }}
                />
              </div>
            </div>

            {/* Badges */}
            <div className="mt-6">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Badges</p>
              <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
                {Object.entries(BADGES).map(([code, b]) => {
                  const earned = stats.data!.badges.some((x: any) => x.badge_code === code);
                  return (
                    <div
                      key={code}
                      className={`rounded-xl border p-3 text-center transition ${
                        earned
                          ? "border-primary/50 bg-primary/10"
                          : "border-dashed opacity-40 grayscale"
                      }`}
                      title={b.description}
                    >
                      <div className="text-2xl">{b.icon}</div>
                      <p className="mt-1 text-[10px] font-medium leading-tight">{b.name}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        <h1 className="font-display text-3xl">Your taste</h1>
        <p className="mt-2 text-muted-foreground">The more honest, the better the matches.</p>


        {q.isLoading ? (
          <div className="mt-8 space-y-6">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="space-y-2">
                <div className="h-4 w-24 animate-pulse rounded bg-muted" />
                <div className="flex flex-wrap gap-2">
                  <div className="h-7 w-20 animate-pulse rounded-full bg-muted" />
                  <div className="h-7 w-16 animate-pulse rounded-full bg-muted" />
                  <div className="h-7 w-24 animate-pulse rounded-full bg-muted" />
                </div>
                <div className="h-10 w-full animate-pulse rounded-md bg-muted/60" />
              </div>
            ))}
          </div>
        ) : (
          <>
            {!hasAnyTaste && (
              <div className="mt-6 rounded-xl border border-dashed p-5 text-sm text-muted-foreground">
                <p className="font-medium text-foreground">Blank slate.</p>
                <p className="mt-1">Add a few tags below — even three is enough to start matching you to real rooms.</p>
              </div>
            )}
            <div className="mt-8 space-y-6">
              <TagInput label="Music" value={music} onChange={setMusic} />
              <TagInput label="Sports & movement" value={sports} onChange={setSports} />
              <TagInput label="Films & shows" value={films} onChange={setFilms} />
              <TagInput label="Interests" value={interests} onChange={setInterests} />
              <div className="space-y-2">
                <Label>Anything else?</Label>
                <Textarea rows={3} value={freeText} onChange={(e) => setFreeText(e.target.value)} placeholder="Sunday morning person. Allergic to small talk." />
              </div>
              <Button onClick={onSave} disabled={loading}>{loading ? "Saving…" : "Save"}</Button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
