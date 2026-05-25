import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getMyProfile, updateTaste } from "@/lib/profile.functions";
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

  return (
    <div className="min-h-screen bg-background">
      <AppHeader variant="member" />
      <main className="mx-auto max-w-2xl px-6 py-10">
        <h1 className="font-display text-3xl">Your taste</h1>
        <p className="mt-2 text-muted-foreground">The more honest, the better the matches.</p>
        <div className="mt-8 space-y-6">
          <TagInput label="Music" value={music} onChange={setMusic} />
          <TagInput label="Sports & movement" value={sports} onChange={setSports} />
          <TagInput label="Films & shows" value={films} onChange={setFilms} />
          <TagInput label="Interests" value={interests} onChange={setInterests} />
          <div className="space-y-2">
            <Label>Anything else?</Label>
            <Textarea rows={3} value={freeText} onChange={(e) => setFreeText(e.target.value)} />
          </div>
          <Button onClick={onSave} disabled={loading}>{loading ? "Saving…" : "Save"}</Button>
        </div>
      </main>
    </div>
  );
}
