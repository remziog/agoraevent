import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { listMyRsvps } from "@/lib/events.functions";
import { AppHeader } from "@/components/AppHeader";

export const Route = createFileRoute("/_authenticated/app/calendar")({
  component: CalendarPage,
});

function CalendarPage() {
  const fetchRsvps = useServerFn(listMyRsvps);
  const q = useQuery({ queryKey: ["rsvps", "mine"], queryFn: () => fetchRsvps() });

  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const events = (q.data?.rsvps ?? []).filter((r: any) => r.events?.starts_at) as any[];
  const eventsByDay = useMemo(() => {
    const map = new Map<string, any[]>();
    events.forEach((r) => {
      const d = new Date(r.events.starts_at);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    });
    return map;
  }, [events]);

  const monthLabel = cursor.toLocaleString([], { month: "long", year: "numeric" });
  const firstDow = new Date(cursor.getFullYear(), cursor.getMonth(), 1).getDay();
  const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();

  const cells: Array<{ date: Date | null }> = [];
  for (let i = 0; i < firstDow; i++) cells.push({ date: null });
  for (let d = 1; d <= daysInMonth; d++)
    cells.push({ date: new Date(cursor.getFullYear(), cursor.getMonth(), d) });
  while (cells.length % 7 !== 0) cells.push({ date: null });

  const today = new Date();
  const now = today.getTime();
  const upcoming = events
    .filter((r) => new Date(r.events.starts_at).getTime() >= now)
    .sort(
      (a, b) => +new Date(a.events.starts_at) - +new Date(b.events.starts_at),
    );
  const past = events
    .filter((r) => new Date(r.events.starts_at).getTime() < now)
    .sort(
      (a, b) => +new Date(b.events.starts_at) - +new Date(a.events.starts_at),
    );

  return (
    <div className="min-h-screen bg-background">
      <AppHeader variant="member" />
      <main className="mx-auto max-w-5xl px-6 py-10">
        <div className="flex items-baseline justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-primary">
              <CalendarIcon className="mr-1 inline h-3 w-3" />
              Your calendar
            </p>
            <h1 className="mt-1 font-display text-4xl">{monthLabel}</h1>
          </div>
          <div className="flex gap-1">
            <button
              onClick={() =>
                setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))
              }
              className="rounded-md border p-2 hover:bg-muted"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => {
                const d = new Date();
                setCursor(new Date(d.getFullYear(), d.getMonth(), 1));
              }}
              className="rounded-md border px-3 py-2 text-xs hover:bg-muted"
            >
              Today
            </button>
            <button
              onClick={() =>
                setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))
              }
              className="rounded-md border p-2 hover:bg-muted"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Month grid */}
        <div className="mt-6 overflow-hidden rounded-2xl border bg-card">
          <div className="grid grid-cols-7 border-b text-xs uppercase tracking-wider text-muted-foreground">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d} className="px-2 py-2 text-center">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {cells.map((cell, idx) => {
              if (!cell.date)
                return <div key={idx} className="aspect-square border-b border-r bg-muted/20" />;
              const key = `${cell.date.getFullYear()}-${cell.date.getMonth()}-${cell.date.getDate()}`;
              const dayEvents = eventsByDay.get(key) ?? [];
              const isToday =
                cell.date.toDateString() === today.toDateString();
              return (
                <div
                  key={idx}
                  className={`aspect-square border-b border-r p-1.5 transition ${
                    isToday ? "bg-primary/5" : ""
                  }`}
                >
                  <div
                    className={`text-xs ${
                      isToday
                        ? "font-display font-bold text-primary"
                        : "text-muted-foreground"
                    }`}
                  >
                    {cell.date.getDate()}
                  </div>
                  <div className="mt-1 space-y-0.5">
                    {dayEvents.slice(0, 2).map((r) => (
                      <Link
                        key={r.event_id}
                        to="/app/event/$id"
                        params={{ id: r.event_id }}
                        className="block truncate rounded bg-primary/15 px-1 py-0.5 text-[10px] text-foreground hover:bg-primary/30"
                      >
                        {r.events.title}
                      </Link>
                    ))}
                    {dayEvents.length > 2 && (
                      <p className="text-[10px] text-muted-foreground">
                        +{dayEvents.length - 2}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Lists */}
        <div className="mt-10 grid gap-6 md:grid-cols-2">
          <section>
            <h2 className="font-display text-2xl">Upcoming</h2>
            <div className="mt-3 space-y-2">
              {upcoming.length === 0 && (
                <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                  Nothing on the books. Find your next night out.
                </p>
              )}
              {upcoming.map((r) => (
                <Link
                  key={r.event_id}
                  to="/app/event/$id"
                  params={{ id: r.event_id }}
                  className="block rounded-xl border bg-card p-4 transition hover:border-primary/50"
                >
                  <p className="font-medium">{r.events.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(r.events.starts_at).toLocaleString([], {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}{" "}
                    · {r.events.organizations?.name ?? r.events.city}
                  </p>
                </Link>
              ))}
            </div>
          </section>
          <section>
            <h2 className="font-display text-2xl">Already lived</h2>
            <div className="mt-3 space-y-2">
              {past.length === 0 && (
                <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                  Your story starts with your first event.
                </p>
              )}
              {past.slice(0, 12).map((r) => (
                <Link
                  key={r.event_id}
                  to="/app/event/$id"
                  params={{ id: r.event_id }}
                  className="flex items-center justify-between rounded-xl border bg-card/50 p-4 transition hover:border-primary/50"
                >
                  <div>
                    <p className="font-medium">{r.events.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {new Date(r.events.starts_at).toLocaleDateString()}
                    </p>
                  </div>
                  <span className="text-xs text-primary">Add memory →</span>
                </Link>
              ))}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
