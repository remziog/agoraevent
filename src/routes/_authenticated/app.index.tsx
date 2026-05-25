import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Compass,
  Sparkles,
  MapPin,
  Calendar as CalendarIcon,
  ArrowUp,
  Navigation,
  Music,
  Activity,
  Film,
  Wand2,
} from "lucide-react";
import { searchEvents, listUpcomingEvents } from "@/lib/events.functions";
import { getMyStats } from "@/lib/gamification.functions";
import { getRecommendations } from "@/lib/recommendations.functions";
import { AppHeader } from "@/components/AppHeader";
import { CompassLoader } from "@/components/CompassLoader";
import { LocationPreviewDialog } from "@/components/LocationPreviewDialog";

export const Route = createFileRoute("/_authenticated/app/")({
  component: Discover,
});

const SUGGESTIONS = [
  { dir: "N", angle: -90, label: "Quiet & intimate", prompt: "A quiet bar with people who like vinyl and slow conversation" },
  { dir: "E", angle: 0, label: "Loud & alive", prompt: "Something loud and sweaty tonight" },
  { dir: "S", angle: 90, label: "Move my body", prompt: "Saturday morning run with strangers" },
  { dir: "W", angle: 180, label: "Cinema & wine", prompt: "An indie film + wine kind of night" },
];

function mapsHref(e: { latitude?: number | null; longitude?: number | null; venue?: string | null; city?: string | null; title: string }) {
  if (e.latitude && e.longitude) {
    return `https://www.google.com/maps/dir/?api=1&destination=${e.latitude},${e.longitude}`;
  }
  const q = encodeURIComponent([e.venue, e.city, e.title].filter(Boolean).join(", "));
  return `https://www.google.com/maps/dir/?api=1&destination=${q}`;
}

function Discover() {
  const navigate = useNavigate();
  const search = useServerFn(searchEvents);
  const list = useServerFn(listUpcomingEvents);
  const fetchStats = useServerFn(getMyStats);
  const fetchRecs = useServerFn(getRecommendations);

  const [prompt, setPrompt] = useState("");
  const [needle, setNeedle] = useState<number>(-90); // points N initially

  const upcoming = useQuery({ queryKey: ["events", "upcoming"], queryFn: () => list() });
  const stats = useQuery({ queryKey: ["my-stats"], queryFn: () => fetchStats() });
  const recs = useQuery({ queryKey: ["recommendations"], queryFn: () => fetchRecs() });

  const mutate = useMutation({
    mutationFn: async (p: string) => search({ data: { prompt: p } }),
    onSuccess: (d) => {
      sessionStorage.setItem(
        "agora:lastSearch",
        JSON.stringify({ events: d.events, tags: d.tags, prompt }),
      );
      // Spin needle dramatically then navigate
      setNeedle((n) => n + 1080 + Math.floor(Math.random() * 360));
      setTimeout(() => navigate({ to: "/app/map" }), 1100);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function submit(p: string) {
    const text = p.trim();
    if (!text) return;
    setPrompt(text);
    mutate.mutate(text);
  }

  const events = upcoming.data?.events ?? [];
  const recommendations = recs.data?.recommendations ?? [];
  const userTags = recs.data?.userTags ?? [];

  return (
    <div className="min-h-screen bg-background">
      <AppHeader variant="member" />
      {mutate.isPending && <CompassLoader message="Reading your night…" />}

      <main className="mx-auto max-w-5xl px-6 py-8">
        {/* Compass */}
        <CompassFace
          needleAngle={needle}
          prompt={prompt}
          setPrompt={setPrompt}
          onSubmit={submit}
          onPickDirection={(s) => {
            setNeedle(s.angle);
            submit(s.prompt);
          }}
          disabled={mutate.isPending}
        />

        {/* Quick stats */}
        {stats.data && (
          <div className="mt-8 grid grid-cols-3 gap-3 sm:gap-4">
            <Link to="/app/profile" className="rounded-2xl border bg-card p-4 transition hover:border-primary/50">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Level</p>
              <p className="mt-1 font-display text-3xl">{stats.data.progress.level}</p>
              <p className="mt-1 text-xs text-muted-foreground">{stats.data.stats.xp} XP</p>
            </Link>
            <Link to="/app/calendar" className="rounded-2xl border bg-card p-4 transition hover:border-primary/50">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Streak</p>
              <p className="mt-1 font-display text-3xl">🔥 {stats.data.stats.current_streak}</p>
              <p className="mt-1 text-xs text-muted-foreground">weeks in a row</p>
            </Link>
            <Link to="/app/memories" className="rounded-2xl border bg-card p-4 transition hover:border-primary/50">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Badges</p>
              <p className="mt-1 font-display text-3xl">{stats.data.badges.length}</p>
              <p className="mt-1 text-xs text-muted-foreground">unlocked</p>
            </Link>
          </div>
        )}

        {/* AI-powered recommendations */}
        <section className="mt-12">
          <div className="flex items-baseline justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-primary">
                <Wand2 className="h-3.5 w-3.5" />
                For you
              </div>
              <h2 className="mt-2 font-display text-2xl">Picked from your taste</h2>
              {userTags.length > 0 ? (
                <p className="mt-1 text-sm text-muted-foreground">
                  Based on {userTags.slice(0, 5).join(" · ")}
                  {userTags.length > 5 ? ` +${userTags.length - 5}` : ""}
                </p>
              ) : (
                <p className="mt-1 text-sm text-muted-foreground">
                  <Link to="/app/integrations" className="text-primary underline-offset-4 hover:underline">
                    Connect Spotify, Strava or Letterboxd
                  </Link>{" "}
                  to unlock personalised picks.
                </p>
              )}
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {recs.isLoading && [0, 1].map((i) => (
              <div key={i} className="h-36 animate-pulse rounded-2xl border bg-card/40" />
            ))}
            {!recs.isLoading && recommendations.length === 0 && userTags.length > 0 && (
              <p className="md:col-span-2 rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">
                Nothing on the horizon yet. Check back tonight.
              </p>
            )}
            {recommendations.map((r: any) => (
              <RecommendationCard key={r.event.id} rec={r} />
            ))}
          </div>
        </section>

        {/* Upcoming */}
        <section className="mt-12">
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-2xl">Tonight & this week</h2>
            <Link to="/app/calendar" className="text-xs text-muted-foreground hover:text-foreground">
              View calendar →
            </Link>
          </div>
          <div className="mt-4 space-y-3">
            {upcoming.isLoading && [0, 1, 2].map((i) => (
              <div key={i} className="h-28 animate-pulse rounded-xl border bg-card/40" />
            ))}
            {!upcoming.isLoading && events.length === 0 && (
              <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                No events yet. Be the first — or check back tonight.
              </p>
            )}
            {events.slice(0, 6).map((e: any) => (
              <Link
                key={e.id}
                to="/app/event/$id"
                params={{ id: e.id }}
                className="block rounded-xl border bg-card p-5 transition hover:border-primary/50"
              >
                <div className="flex items-baseline justify-between gap-4">
                  <h3 className="font-display text-xl">{e.title}</h3>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <CalendarIcon className="h-3 w-3" />
                    {new Date(e.starts_at).toLocaleString([], {
                      weekday: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </div>
                <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                  <MapPin className="h-3 w-3" />
                  {e.organizations?.name} · {e.city ?? "—"} · {e.category}
                </p>
              </Link>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

function CompassFace({
  needleAngle,
  prompt,
  setPrompt,
  onSubmit,
  onPickDirection,
  disabled,
}: {
  needleAngle: number;
  prompt: string;
  setPrompt: (v: string) => void;
  onSubmit: (p: string) => void;
  onPickDirection: (s: (typeof SUGGESTIONS)[number]) => void;
  disabled: boolean;
}) {
  // Cardinal letter positions (visual labels around the rim)
  const cardinals = useMemo(
    () => [
      { l: "N", a: -90 },
      { l: "E", a: 0 },
      { l: "S", a: 90 },
      { l: "W", a: 180 },
    ],
    [],
  );

  return (
    <div className="relative mx-auto aspect-square w-full max-w-[760px]">
      {/* Outer ring (subtly rotating bezel) */}
      <div
        className="absolute inset-0 rounded-full border border-primary/30 bg-[radial-gradient(circle_at_30%_20%,_color-mix(in_oklab,_var(--primary)_18%,_transparent),_transparent_55%),radial-gradient(circle_at_70%_80%,_color-mix(in_oklab,_var(--primary)_10%,_transparent),_transparent_55%)] shadow-[0_30px_80px_-30px_color-mix(in_oklab,var(--primary)_45%,transparent),inset_0_0_60px_color-mix(in_oklab,var(--primary)_8%,transparent)]"
        style={{ animation: "spin 60s linear infinite" }}
      >
        {/* tick marks */}
        <svg viewBox="0 0 200 200" className="absolute inset-0 h-full w-full">
          <g stroke="currentColor" className="text-primary/40">
            {Array.from({ length: 72 }).map((_, i) => {
              const long = i % 9 === 0;
              const a = (i / 72) * Math.PI * 2;
              const r1 = 96;
              const r2 = long ? 88 : 92;
              const x1 = 100 + Math.cos(a) * r1;
              const y1 = 100 + Math.sin(a) * r1;
              const x2 = 100 + Math.cos(a) * r2;
              const y2 = 100 + Math.sin(a) * r2;
              return (
                <line
                  key={i}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  strokeWidth={long ? 0.8 : 0.4}
                  opacity={long ? 1 : 0.55}
                />
              );
            })}
          </g>
        </svg>
      </div>

      {/* Inner dial (static face) */}
      <div className="absolute inset-[8%] rounded-full border border-border/60 bg-card/80 backdrop-blur-sm shadow-[inset_0_0_80px_color-mix(in_oklab,var(--primary)_6%,transparent)]" />

      {/* Cardinal letters */}
      {cardinals.map((c) => {
        const rad = (c.a * Math.PI) / 180;
        const rPct = 41; // distance from center as percent
        const x = 50 + Math.cos(rad) * rPct;
        const y = 50 + Math.sin(rad) * rPct;
        return (
          <div
            key={c.l}
            className="absolute -translate-x-1/2 -translate-y-1/2 font-display text-xl text-primary/70 tracking-[0.2em]"
            style={{ left: `${x}%`, top: `${y}%` }}
          >
            {c.l}
          </div>
        );
      })}

      {/* Direction suggestion buttons placed inward of the cardinals */}
      {SUGGESTIONS.map((s) => {
        const rad = (s.angle * Math.PI) / 180;
        const rPct = 33;
        const x = 50 + Math.cos(rad) * rPct;
        const y = 50 + Math.sin(rad) * rPct;
        return (
          <button
            key={s.dir}
            type="button"
            disabled={disabled}
            onClick={() => onPickDirection(s)}
            className="absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full border border-primary/30 bg-background/80 px-3 py-1.5 text-xs text-foreground backdrop-blur transition hover:border-primary hover:bg-primary hover:text-primary-foreground disabled:opacity-50"
            style={{ left: `${x}%`, top: `${y}%` }}
          >
            {s.label}
          </button>
        );
      })}

      {/* Needle */}
      <div
        className="pointer-events-none absolute inset-0 flex items-center justify-center"
        style={{
          transform: `rotate(${needleAngle + 90}deg)`,
          transition: "transform 1.1s cubic-bezier(0.22, 1, 0.36, 1)",
        }}
      >
        <svg viewBox="0 0 200 200" className="h-full w-full">
          <defs>
            <linearGradient id="needleN" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--primary)" />
              <stop offset="100%" stopColor="color-mix(in oklab, var(--primary) 50%, transparent)" />
            </linearGradient>
          </defs>
          <polygon points="100,18 106,100 94,100" fill="url(#needleN)" />
          <polygon points="100,182 106,100 94,100" fill="color-mix(in oklab, var(--foreground) 30%, transparent)" />
          <circle cx="100" cy="100" r="6" fill="var(--background)" stroke="var(--primary)" strokeWidth="2" />
        </svg>
      </div>

      {/* Center: chat-style input (compact to not cover direction chips) */}
      <div className="absolute left-1/2 top-1/2 z-10 w-[44%] -translate-x-1/2 -translate-y-1/2">
        <div className="flex items-center gap-1.5 justify-center mb-2">
          <Compass className="h-3 w-3 text-primary" />
          <span className="text-[9px] uppercase tracking-[0.3em] text-primary">AI</span>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit(prompt);
          }}
          className="group rounded-2xl border border-border bg-background/95 p-1.5 shadow-[0_10px_40px_-15px_color-mix(in_oklab,var(--primary)_35%,transparent)] backdrop-blur transition-all focus-within:border-primary/60 focus-within:shadow-[0_15px_50px_-15px_color-mix(in_oklab,var(--primary)_55%,transparent)]"
        >
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onSubmit(prompt);
              }
            }}
            placeholder="Your night?"
            rows={1}
            disabled={disabled}
            className="w-full resize-none bg-transparent px-2 py-1 text-xs leading-snug placeholder:text-muted-foreground focus:outline-none"
          />
          <div className="flex items-center justify-end px-1 pb-0.5">
            <button
              type="submit"
              disabled={disabled || !prompt.trim()}
              className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground transition hover:opacity-90 disabled:opacity-40"
              aria-label="Point me there"
            >
              <ArrowUp className="h-3 w-3" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function RecommendationCard({ rec }: { rec: any }) {
  const e = rec.event;
  const Icon = e.category === "music" ? Music : e.category === "sports" ? Activity : e.category === "film" ? Film : Sparkles;
  return (
    <div className="group relative overflow-hidden rounded-2xl border bg-card p-5 transition hover:border-primary/50">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <Link
              to="/app/event/$id"
              params={{ id: e.id }}
              className="font-display text-lg leading-tight hover:underline"
            >
              {e.title}
            </Link>
            <p className="text-xs text-muted-foreground">
              {e.organizations?.name} · {e.city ?? "—"}
            </p>
          </div>
        </div>
        <span className="text-[10px] uppercase tracking-widest text-primary">
          {Math.round((rec.score ?? 5) * 10)}% match
        </span>
      </div>

      <p className="mt-3 text-sm italic text-muted-foreground">"{rec.reason}"</p>

      <div className="mt-4 flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">
          {new Date(e.starts_at).toLocaleString([], {
            weekday: "short",
            hour: "2-digit",
            minute: "2-digit",
            month: "short",
            day: "numeric",
          })}
        </span>
        <LocationPreviewDialog
          place={e}
          trigger={
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-background px-3 py-1.5 text-xs text-foreground transition hover:bg-primary hover:text-primary-foreground"
            >
              <Navigation className="h-3 w-3" />
              Take me there
            </button>
          }
        />
      </div>
    </div>
  );
}
