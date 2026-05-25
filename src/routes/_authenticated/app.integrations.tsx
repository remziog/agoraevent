import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listSocials, upsertSocial } from "@/lib/profile.functions";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Check, Music, Camera, Film, Activity, Dumbbell, Youtube, Sparkles } from "lucide-react";

type Provider = {
  id: string;
  label: string;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
  suggestions: string[];
};

const PROVIDERS: Provider[] = [
  {
    id: "spotify",
    label: "Spotify",
    hint: "Top artists & genres",
    icon: Music,
    suggestions: ["indie", "ambient", "techno", "jazz", "hip-hop", "folk", "shoegaze", "classical"],
  },
  {
    id: "instagram",
    label: "Instagram",
    hint: "The vibes you post",
    icon: Camera,
    suggestions: ["film photography", "coffee", "street style", "travel", "design", "food"],
  },
  {
    id: "tiktok",
    label: "TikTok",
    hint: "Sounds & themes",
    icon: Sparkles,
    suggestions: ["booktok", "foodtok", "thrifting", "diy", "comedy", "fitness"],
  },
  {
    id: "youtube",
    label: "YouTube",
    hint: "Channels you watch",
    icon: Youtube,
    suggestions: ["video essays", "tech reviews", "cooking", "philosophy", "music production"],
  },
  {
    id: "letterboxd",
    label: "Letterboxd",
    hint: "Favorite directors",
    icon: Film,
    suggestions: ["wong kar-wai", "a24", "studio ghibli", "kubrick", "lynch", "tarkovsky"],
  },
  {
    id: "strava",
    label: "Strava",
    hint: "Pace & sports",
    icon: Activity,
    suggestions: ["running", "cycling", "trail", "long-distance", "morning runs", "5k"],
  },
  {
    id: "hevy",
    label: "Hevy",
    hint: "Lifting style",
    icon: Dumbbell,
    suggestions: ["powerlifting", "hypertrophy", "calisthenics", "crossfit", "olympic"],
  },
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

  const connectedCount = connected.size;

  return (
    <div className="min-h-screen bg-background">
      <AppHeader variant="member" />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <div className="flex items-baseline justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl">Bring your taste with you</h1>
            <p className="mt-2 text-muted-foreground">
              Connect the accounts that describe you. We use the tags to find events you'll actually love.
            </p>
          </div>
          <Badge variant="secondary" className="shrink-0">
            {connectedCount} / {PROVIDERS.length} connected
          </Badge>
        </div>

        <p className="mt-3 text-xs text-muted-foreground">
          Real OAuth is coming. For now, pick the tags that match — they go straight into your taste profile.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {PROVIDERS.map((p) => (
            <ProviderCard
              key={p.id}
              provider={p}
              isConnected={connected.has(p.id)}
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

function ProviderCard({
  provider,
  isConnected,
  initial,
  onSave,
}: {
  provider: Provider;
  isConnected: boolean;
  initial: string[];
  onSave: (tags: string[]) => Promise<void>;
}) {
  const [tags, setTags] = useState<string[]>(initial);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState(isConnected);
  const Icon = provider.icon;

  useEffect(() => {
    setTags(initial);
  }, [initial.join("|")]);

  function toggleTag(t: string) {
    setTags((cur) =>
      cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t].slice(0, 20),
    );
  }

  function addDraft() {
    const cleaned = draft.trim().toLowerCase();
    if (!cleaned || tags.includes(cleaned)) return;
    setTags((cur) => [...cur, cleaned].slice(0, 20));
    setDraft("");
  }

  async function handleSave() {
    setSaving(true);
    try {
      await onSave(tags);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border bg-card p-5 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-display text-lg leading-tight">{provider.label}</h3>
            <p className="text-xs text-muted-foreground">{provider.hint}</p>
          </div>
        </div>
        {isConnected ? (
          <Badge variant="default" className="gap-1">
            <Check className="h-3 w-3" />
            Connected
          </Badge>
        ) : (
          <Button size="sm" variant="outline" onClick={() => setExpanded(true)}>
            Connect
          </Button>
        )}
      </div>

      {expanded && (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {provider.suggestions.map((s) => {
              const active = tags.includes(s);
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggleTag(s)}
                  className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background hover:bg-muted"
                  }`}
                >
                  {s}
                </button>
              );
            })}
          </div>

          {tags.filter((t) => !provider.suggestions.includes(t)).length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {tags
                .filter((t) => !provider.suggestions.includes(t))
                .map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => toggleTag(t)}
                    className="rounded-full border border-primary bg-primary px-2.5 py-1 text-xs text-primary-foreground"
                  >
                    {t} ×
                  </button>
                ))}
            </div>
          )}

          <div className="flex gap-2">
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addDraft();
                }
              }}
              placeholder="Add your own…"
              className="h-9"
            />
            <Button size="sm" variant="ghost" onClick={addDraft} disabled={!draft.trim()}>
              Add
            </Button>
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="text-xs text-muted-foreground">
              {tags.length} tag{tags.length === 1 ? "" : "s"}
            </span>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : isConnected ? "Update" : "Save"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
