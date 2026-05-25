import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listSocials, upsertSocial } from "@/lib/profile.functions";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

const PROVIDERS = [
  { id: "spotify", label: "Spotify", hint: "Top artists, genres" },
  { id: "instagram", label: "Instagram", hint: "Vibes you post about" },
  { id: "tiktok", label: "TikTok", hint: "Sounds & themes" },
  { id: "youtube", label: "YouTube", hint: "Channels you watch" },
  { id: "letterboxd", label: "Letterboxd", hint: "Favorite directors" },
  { id: "strava", label: "Strava", hint: "Pace, sports" },
  { id: "hevy", label: "Hevy", hint: "Lifting style" },
];

export const Route = createFileRoute("/_authenticated/app/integrations")({
  component: Integrations,
});

function Integrations() {
  const list = useServerFn(listSocials);
  const save = useServerFn(upsertSocial);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["socials"], queryFn: () => list() });
  const connected = new Map((q.data?.socials ?? []).map((s: any) => [s.provider, s]));

  return (
    <div className="min-h-screen bg-background">
      <AppHeader variant="member" />
      <main className="mx-auto max-w-2xl px-6 py-10">
        <h1 className="font-display text-3xl">Bring your taste with you</h1>
        <p className="mt-2 text-muted-foreground">
          Real OAuth is coming. For now, tell us the tags that describe each side of you.
        </p>
        <div className="mt-8 space-y-4">
          {PROVIDERS.map((p) => (
            <ProviderRow
              key={p.id}
              provider={p}
              initial={(connected.get(p.id)?.tags ?? []) as string[]}
              onSave={async (tags) => {
                await save({ data: { provider: p.id, tags } });
                qc.invalidateQueries({ queryKey: ["socials"] });
                toast.success(`${p.label} updated`);
              }}
            />
          ))}
        </div>
      </main>
    </div>
  );
}

function ProviderRow({ provider, initial, onSave }: { provider: { id: string; label: string; hint: string }; initial: string[]; onSave: (tags: string[]) => Promise<void> }) {
  const [draft, setDraft] = useState(initial.join(", "));
  const [saving, setSaving] = useState(false);
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-baseline justify-between">
        <h3 className="font-display text-lg">{provider.label}</h3>
        <span className="text-xs text-muted-foreground">{provider.hint}</span>
      </div>
      <div className="mt-3 flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="comma, separated, tags"
        />
        <Button
          size="sm"
          disabled={saving}
          onClick={async () => {
            setSaving(true);
            try {
              await onSave(draft.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean).slice(0, 20));
            } finally { setSaving(false); }
          }}
        >
          Save
        </Button>
      </div>
    </div>
  );
}
