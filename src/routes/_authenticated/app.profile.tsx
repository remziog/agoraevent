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
  const q = useQuery({ queryKey: ["me"], queryFn: () => get() });

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
