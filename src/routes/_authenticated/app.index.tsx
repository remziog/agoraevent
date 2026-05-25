import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { searchEvents, listUpcomingEvents, listMyRsvps } from "@/lib/events.functions";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/app/")({
  component: Discover,
});

function Discover() {
  const search = useServerFn(searchEvents);
  const list = useServerFn(listUpcomingEvents);
  const rsvps = useServerFn(listMyRsvps);
  const qc = useQueryClient();

  const [prompt, setPrompt] = useState("");
  const [results, setResults] = useState<{ events: any[]; tags: string[] } | null>(null);

  const upcoming = useQuery({ queryKey: ["events", "upcoming"], queryFn: () => list() });
  const myRsvps = useQuery({ queryKey: ["rsvps", "mine"], queryFn: () => rsvps() });

  const mutate = useMutation({
    mutationFn: async (p: string) => search({ data: { prompt: p } }),
    onSuccess: (d) => {
      setResults(d);
      qc.invalidateQueries({ queryKey: ["events"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const events = results?.events ?? upcoming.data?.events ?? [];
  const allRsvps = (myRsvps.data?.rsvps ?? []) as any[];
  const now = Date.now();
  const goingUpcoming = allRsvps
    .filter((r) => r.events?.starts_at && new Date(r.events.starts_at).getTime() >= now)
    .sort((a, b) => +new Date(a.events.starts_at) - +new Date(b.events.starts_at));
  const goingPast = allRsvps.filter(
    (r) => r.events?.starts_at && new Date(r.events.starts_at).getTime() < now,
  );

  return (
    <div className="min-h-screen bg-background">
      <AppHeader variant="member" />
      <main className="mx-auto max-w-4xl px-6 py-10">
        <h1 className="font-display text-4xl">What kind of night?</h1>
        <p className="mt-2 text-muted-foreground">
          Tell us in plain words. We'll find the room.
        </p>
        <form
          className="mt-6 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (prompt.trim()) mutate.mutate(prompt.trim());
          }}
        >
          <Input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="A quiet bar with people who like vinyl and slow conversation"
            className="text-base"
          />
          <Button type="submit" disabled={mutate.isPending}>
            {mutate.isPending ? "Finding…" : "Find"}
          </Button>
        </form>

        {results && (
          <div className="mt-4 flex flex-wrap gap-2">
            {results.tags.map((t) => (
              <span key={t} className="rounded-full bg-secondary px-3 py-1 text-xs text-secondary-foreground">
                {t}
              </span>
            ))}
          </div>
        )}

        {goingUpcoming.length > 0 && (
          <section className="mt-10">
            <div className="flex items-baseline justify-between">
              <h2 className="font-display text-2xl">You're going</h2>
              <span className="text-xs text-muted-foreground">{goingUpcoming.length} upcoming</span>
            </div>
            <div className="mt-3 -mx-6 flex gap-3 overflow-x-auto px-6 pb-2">
              {goingUpcoming.map((r) => {
                const d = new Date(r.events.starts_at);
                return (
                  <Link
                    key={r.event_id}
                    to="/app/event/$id"
                    params={{ id: r.event_id }}
                    className="group min-w-[240px] max-w-[260px] shrink-0 rounded-xl border bg-card p-4 transition hover:border-primary/50"
                  >
                    <div className="flex items-baseline gap-2">
                      <span className="font-display text-2xl leading-none">{d.getDate()}</span>
                      <span className="text-xs uppercase tracking-wider text-muted-foreground">
                        {d.toLocaleString([], { month: "short" })}
                      </span>
                      <span className="ml-auto text-xs text-muted-foreground">
                        {d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <h3 className="mt-2 line-clamp-2 font-medium group-hover:text-primary">
                      {r.events?.title}
                    </h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {r.events?.organizations?.name ?? "—"} · {r.events?.city ?? ""}
                    </p>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        <h2 className="mt-12 font-display text-2xl">
          {results ? "Best matches" : "Upcoming near you"}
        </h2>
        <div className="mt-4 space-y-3">
          {upcoming.isLoading && !results && (
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
          {events.map((e: any) => (
            <Link
              key={e.id}
              to="/app/event/$id"
              params={{ id: e.id }}
              className="block rounded-xl border bg-card p-5 transition hover:border-primary/50"
            >
              <div className="flex items-baseline justify-between gap-4">
                <h3 className="font-display text-xl">{e.title}</h3>
                <span className="text-xs text-muted-foreground">
                  {new Date(e.starts_at).toLocaleString([], { weekday: "short", hour: "2-digit", minute: "2-digit", month: "short", day: "numeric" })}
                </span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
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

        {goingPast.length > 0 && (
          <details className="group mt-12">
            <summary className="cursor-pointer font-display text-lg text-muted-foreground hover:text-foreground">
              Past · {goingPast.length}
            </summary>
            <ul className="mt-3 space-y-2 text-sm">
              {goingPast.map((r) => (
                <li key={r.event_id} className="rounded-lg border bg-card/50 p-3 text-muted-foreground">
                  <Link to="/app/event/$id" params={{ id: r.event_id }} className="hover:text-foreground">
                    {r.events?.title}
                    <span className="ml-2 text-xs">
                      {r.events?.starts_at && new Date(r.events.starts_at).toLocaleDateString()}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </details>
        )}
      </main>
    </div>
  );
}
