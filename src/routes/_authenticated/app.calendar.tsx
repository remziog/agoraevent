import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { listMyRsvps } from "@/lib/events.functions";
import { AppHeader } from "@/components/AppHeader";
import { formatWhenLocalized } from "@/components/guide/guide-format";

export const Route = createFileRoute("/_authenticated/app/calendar")({
  component: CalendarPage,
});

function CalendarPage() {
  const { t, i18n } = useTranslation();
  const fetchRsvps = useServerFn(listMyRsvps);
  // Always re-read on mount: an RSVP made on another screen must show here at
  // once, and "loading" is kept apart from "empty" (F-05).
  const q = useQuery({
    queryKey: ["rsvps", "mine"],
    queryFn: () => fetchRsvps(),
    staleTime: 0,
    refetchOnMount: "always",
  });
  const locale = i18n.language.startsWith("tr")
    ? "tr-TR"
    : i18n.language.startsWith("de")
      ? "de-DE"
      : i18n.language.startsWith("ru")
        ? "ru-RU"
        : "en-GB";

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

  const monthLabel = cursor.toLocaleString(locale, { month: "long", year: "numeric" });
  const weekdays = useMemo(() => {
    // Monday-first labels in the selected language.
    const base = new Date(Date.UTC(2024, 0, 1)); // a Monday
    return Array.from({ length: 7 }, (_, i) =>
      new Date(base.getTime() + i * 86400e3).toLocaleDateString(locale, {
        weekday: "short",
        timeZone: "UTC",
      }),
    );
  }, [locale]);
  const loading = q.isLoading;
  const refreshing = q.isFetching && !q.isLoading;
  const firstDow = (new Date(cursor.getFullYear(), cursor.getMonth(), 1).getDay() + 6) % 7; // Monday = 0
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
    .sort((a, b) => +new Date(a.events.starts_at) - +new Date(b.events.starts_at));
  const past = events
    .filter((r) => new Date(r.events.starts_at).getTime() < now)
    .sort((a, b) => +new Date(b.events.starts_at) - +new Date(a.events.starts_at));

  return (
    <div className="min-h-screen bg-background">
      <AppHeader variant="member" />
      <main className="mx-auto max-w-5xl px-6 py-10">
        <div className="flex items-baseline justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-primary">
              <CalendarIcon className="mr-1 inline h-3 w-3" aria-hidden />
              {t("calendar.kicker", "Your calendar")}
              {refreshing && (
                <span
                  className="ml-2 inline-flex items-center gap-1 normal-case tracking-normal text-muted-foreground"
                  role="status"
                >
                  <RefreshCw className="h-3 w-3 motion-safe:animate-spin" aria-hidden />{" "}
                  {t("calendar.refreshing", "refreshing")}
                </span>
              )}
            </p>
            <h1 className="mt-1 font-display text-4xl">{monthLabel}</h1>
          </div>
          <div className="flex gap-1">
            <button
              onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
              className="rounded-md border p-2 hover:bg-muted"
              aria-label={t("calendar.prevMonth", "Previous month")}
            >
              <ChevronLeft className="h-4 w-4" aria-hidden />
            </button>
            <button
              onClick={() => {
                const d = new Date();
                setCursor(new Date(d.getFullYear(), d.getMonth(), 1));
              }}
              className="rounded-md border px-3 py-2 text-xs hover:bg-muted"
            >
              {t("calendar.today", "Today")}
            </button>
            <button
              onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
              className="rounded-md border p-2 hover:bg-muted"
              aria-label={t("calendar.nextMonth", "Next month")}
            >
              <ChevronRight className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </div>

        {/* Month grid */}
        <div className="mt-6 overflow-hidden rounded-2xl border bg-card">
          <div className="grid grid-cols-7 border-b text-xs uppercase tracking-wider text-muted-foreground">
            {weekdays.map((d) => (
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
              const isToday = cell.date.toDateString() === today.toDateString();
              return (
                <div
                  key={idx}
                  className={`aspect-square border-b border-r p-1.5 transition ${
                    isToday ? "bg-primary/5" : ""
                  }`}
                >
                  <div
                    className={`text-xs ${
                      isToday ? "font-display font-bold text-primary" : "text-muted-foreground"
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
                      <p className="text-[10px] text-muted-foreground">+{dayEvents.length - 2}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Lists */}
        <div className="mt-10 grid gap-6 md:grid-cols-2">
          <section aria-busy={loading}>
            <h2 className="font-display text-2xl">{t("calendar.upcoming", "Upcoming")}</h2>
            <div className="mt-3 space-y-2">
              {loading && (
                <div className="space-y-2" aria-live="polite">
                  <div className="h-16 animate-pulse rounded-xl border bg-card/40" />
                  <p className="text-center text-xs text-muted-foreground">
                    {t("common.loading", "Loading…")}
                  </p>
                </div>
              )}
              {!loading && q.isError && (
                <p
                  className="rounded-xl border border-destructive/40 p-6 text-center text-sm text-destructive"
                  role="alert"
                >
                  {t("calendar.loadError", "Couldn't load your calendar.")}{" "}
                  <button className="underline" onClick={() => q.refetch()}>
                    {t("common.tryAgain", "Try again")}
                  </button>
                </p>
              )}
              {!loading && !q.isError && upcoming.length === 0 && (
                <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                  {t("calendar.empty", "Nothing on the books.")}{" "}
                  <Link to="/app" className="text-primary underline-offset-4 hover:underline">
                    {t("calendar.findNext", "Find your next gathering.")}
                  </Link>
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
                    {formatWhenLocalized(r.events.starts_at, i18n.language)} ·{" "}
                    {r.events.organizations?.name ?? r.events.city}
                  </p>
                </Link>
              ))}
            </div>
          </section>
          <section>
            <h2 className="font-display text-2xl">{t("calendar.past", "Already lived")}</h2>
            <div className="mt-3 space-y-2">
              {!loading && past.length === 0 && (
                <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                  {t("calendar.pastEmpty", "Your story starts with your first gathering.")}
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
                      {new Date(r.events.starts_at).toLocaleDateString(locale, {
                        timeZone: "Europe/Istanbul",
                      })}
                    </p>
                  </div>
                  <span className="text-xs text-primary">
                    {t("calendar.addMemory", "Add memory →")}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
