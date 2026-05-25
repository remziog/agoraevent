import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Compass, Sparkles, MapPin, Calendar as CalendarIcon, Shuffle } from "lucide-react";
import { searchEvents, listUpcomingEvents } from "@/lib/events.functions";
import { getMyStats } from "@/lib/gamification.functions";
import { AppHeader } from "@/components/AppHeader";
import { CompassLoader } from "@/components/CompassLoader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/app/")({
  component: Discover,
});

const SUGGESTIONS = [
  "A quiet bar with people who like vinyl",
  "Something loud and sweaty tonight",
  "Saturday morning run with strangers",
  "An indie film + wine kind of night",
];

function Discover() {
  const navigate = useNavigate();
  const search = useServerFn(searchEvents);
  const list = useServerFn(listUpcomingEvents);
  const fetchStats = useServerFn(getMyStats);

  const [prompt, setPrompt] = useState(
    () => SUGGESTIONS[Math.floor(Math.random() * SUGGESTIONS.length)],
  );
  const upcoming = useQuery({ queryKey: ["events", "upcoming"], queryFn: () => list() });
  const stats = useQuery({ queryKey: ["my-stats"], queryFn: () => fetchStats() });

  const mutate = useMutation({
    mutationFn: async (p: string) => search({ data: { prompt: p } }),
    onSuccess: (d) => {
      // Stash results in sessionStorage so /app/map can read them without re-querying
      sessionStorage.setItem(
        "agora:lastSearch",
        JSON.stringify({ events: d.events, tags: d.tags, prompt }),
      );
      // Brief delay so the compass animation feels intentional
      setTimeout(() => navigate({ to: "/app/map" }), 900);
    },
    onError: (e: Error) => {
      toast.error(e.message);
    },
  });

  const events = upcoming.data?.events ?? [];

  return (
    <div className="min-h-screen bg-background">
      <AppHeader variant="member" />
      {mutate.isPending && <CompassLoader message="Reading your night…" />}

      <main className="mx-auto max-w-4xl px-6 py-10">
        {/* Hero */}
        <div className="rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/5 via-card to-card p-8 sm:p-12">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-primary">
            <Sparkles className="h-3.5 w-3.5" />
            Compass
          </div>
          <h1 className="mt-3 font-display text-4xl leading-tight sm:text-5xl">
            What kind of night?
          </h1>
          <p className="mt-2 max-w-xl text-muted-foreground">
            Tell us in plain words. The compass will point you to the room.
          </p>

          <form
            className="mt-6 flex flex-col gap-2 sm:flex-row"
            onSubmit={(e) => {
              e.preventDefault();
              if (prompt.trim()) mutate.mutate(prompt.trim());
            }}
          >
            <Input
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="A quiet bar with people who like vinyl and slow conversation"
              className="h-12 text-base"
            />
            <Button
              type="submit"
              size="lg"
              disabled={mutate.isPending || !prompt.trim()}
              className="gap-2"
            >
              <Compass className="h-4 w-4" />
              {mutate.isPending ? "Finding…" : "Point me there"}
            </Button>
          </form>

          <div className="mt-4 flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => setPrompt(s)}
                className="rounded-full border border-border/60 bg-background/40 px-3 py-1 text-xs text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Quick stats grid */}
        {stats.data && (
          <div className="mt-6 grid grid-cols-3 gap-3 sm:gap-4">
            <Link
              to="/app/profile"
              className="rounded-2xl border bg-card p-4 transition hover:border-primary/50"
            >
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Level</p>
              <p className="mt-1 font-display text-3xl">{stats.data.progress.level}</p>
              <p className="mt-1 text-xs text-muted-foreground">{stats.data.stats.xp} XP</p>
            </Link>
            <Link
              to="/app/calendar"
              className="rounded-2xl border bg-card p-4 transition hover:border-primary/50"
            >
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Streak</p>
              <p className="mt-1 font-display text-3xl">🔥 {stats.data.stats.current_streak}</p>
              <p className="mt-1 text-xs text-muted-foreground">weeks in a row</p>
            </Link>
            <Link
              to="/app/memories"
              className="rounded-2xl border bg-card p-4 transition hover:border-primary/50"
            >
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Badges</p>
              <p className="mt-1 font-display text-3xl">{stats.data.badges.length}</p>
              <p className="mt-1 text-xs text-muted-foreground">unlocked</p>
            </Link>
          </div>
        )}

        {/* Upcoming */}
        <div className="mt-10 flex items-baseline justify-between">
          <h2 className="font-display text-2xl">Tonight & this week</h2>
          <Link to="/app/calendar" className="text-xs text-muted-foreground hover:text-foreground">
            View calendar →
          </Link>
        </div>
        <div className="mt-4 space-y-3">
          {upcoming.isLoading && (
            <>
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-28 animate-pulse rounded-xl border bg-card/40" />
              ))}
            </>
          )}
          {!upcoming.isLoading && events.length === 0 && (
            <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
              No events yet. Be the first — or check back tonight.
            </p>
          )}
          {events.slice(0, 8).map((e: any) => (
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
              {e.tags?.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {e.tags.slice(0, 6).map((t: string) => (
                    <span key={t} className="rounded-full border px-2 py-0.5 text-xs">
                      {t}
                    </span>
                  ))}
                </div>
              )}
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
