import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { listMyRsvps, listUpcomingEvents } from "@/lib/events.functions";
import { useSaveToggle, useSavedIds } from "@/lib/use-saved";
import { AppHeader } from "@/components/AppHeader";
import {
  CalendarRow,
  DayHeader,
  FOCUS,
  NextPlanCard,
  Segmented,
  WeekStrip,
  type CalEvent,
} from "@/components/calendar/CalendarParts";
import { fmtDay, istanbulDay, localeFor } from "@/components/calendar/cal-dates";

export const Route = createFileRoute("/_authenticated/app/calendar")({
  component: CalendarPage,
});

type Tab = "events" | "plans";
type RsvpRow = { event_id: string; events: CalEvent | null };
const MONO = "font-mono text-[10.5px] uppercase tracking-[0.08em] text-muted-foreground";

/**
 * Calendar (design: Naz Paşalı, v3 "Takvim"): every listed gathering by day on
 * the first tab, the gatherings I'm going to (RSVPs) on the second. Days are
 * Istanbul days. Saving from a row is a private bookmark, never an RSVP.
 */
function CalendarPage() {
  const { t, i18n } = useTranslation();
  const locale = localeFor(i18n.language);
  const fetchRsvps = useServerFn(listMyRsvps);
  const fetchUpcoming = useServerFn(listUpcomingEvents);
  // Always re-read on mount: an RSVP made on another screen must show here at
  // once, and "loading" is kept apart from "empty" (F-05).
  const q = useQuery({
    queryKey: ["rsvps", "mine"],
    queryFn: () => fetchRsvps(),
    staleTime: 0,
    refetchOnMount: "always",
  });
  const upcomingQ = useQuery({
    queryKey: ["events", "upcoming"],
    queryFn: () => fetchUpcoming(),
  });
  const savedIds = useSavedIds();
  const saveToggle = useSaveToggle();

  const [tab, setTab] = useState<Tab>("events");
  const [week, setWeek] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);

  const now = Date.now();
  const today = istanbulDay(new Date(now));

  const rsvps = ((q.data?.rsvps ?? []) as unknown as RsvpRow[]).filter(
    (r): r is RsvpRow & { events: CalEvent } => Boolean(r.events?.starts_at),
  );
  const goingIds = useMemo(() => new Set(rsvps.map((r) => r.event_id as string)), [rsvps]);
  const myUpcoming = useMemo(
    () =>
      rsvps
        .map((r) => r.events as CalEvent)
        .filter((e) => Date.parse(e.starts_at) >= now)
        .sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [q.data],
  );
  const past = useMemo(
    () =>
      rsvps
        .filter((r) => Date.parse(r.events.starts_at) < now)
        .sort((a, b) => Date.parse(b.events.starts_at) - Date.parse(a.events.starts_at)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [q.data],
  );
  const listed = useMemo(
    () =>
      ((upcomingQ.data?.events ?? []) as unknown as CalEvent[])
        .filter((e) => e?.starts_at && Date.parse(e.starts_at) >= now)
        .sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [upcomingQ.data],
  );
  const listLimitHit = (upcomingQ.data?.events?.length ?? 0) >= 50;
  const savedSet = new Set(savedIds.data?.events ?? []);

  const dayOf = (e: CalEvent) => istanbulDay(new Date(e.starts_at));
  const countBy = (list: CalEvent[]) => {
    const m = new Map<number, number>();
    for (const e of list) m.set(dayOf(e), (m.get(dayOf(e)) ?? 0) + 1);
    return m;
  };
  const listedByDay = useMemo(() => countBy(listed), [listed]); // eslint-disable-line react-hooks/exhaustive-deps
  const mineByDay = useMemo(() => countBy(myUpcoming), [myUpcoming]); // eslint-disable-line react-hooks/exhaustive-deps

  const lastDay = Math.max(today, ...listed.map(dayOf), ...myUpcoming.map(dayOf));
  const maxWeek = Math.max(0, Math.floor((lastDay - today) / 7));
  const w = Math.min(week, maxWeek);
  const days = Array.from({ length: 7 }, (_, i) => today + w * 7 + i);
  // Events: the shown week (or the picked day). My plans: every upcoming plan,
  // unless a day is picked (as in Naz's prototype and the old upcoming list).
  const inView = (e: CalEvent) => {
    const d = dayOf(e);
    if (selected !== null) return d === selected;
    return tab === "plans" || (d >= days[0] && d <= days[6]);
  };

  const source = tab === "events" ? listed : myUpcoming;
  const rows = source.filter(inView);
  const groups: { day: number; items: CalEvent[] }[] = [];
  for (const e of rows) {
    const d = dayOf(e);
    const last = groups[groups.length - 1];
    if (last && last.day === d) last.items.push(e);
    else groups.push({ day: d, items: [e] });
  }

  const activeQ = tab === "events" ? upcomingQ : q;
  const loading = activeQ.isLoading;
  const refreshing =
    (q.isFetching && !q.isLoading) || (upcomingQ.isFetching && !upcomingQ.isLoading);
  const kicker =
    w === 0
      ? t("v3paper.cal.next7", "The next 7 days")
      : `${fmtDay(days[0], locale, { day: "numeric", month: "short" })} – ${fmtDay(days[6], locale, { day: "numeric", month: "short" })}`;
  const dayTitle = (d: number) =>
    d === today
      ? t("calendar.today", "Today")
      : d === today + 1
        ? t("v3paper.cal.tomorrow", "Tomorrow")
        : fmtDay(d, locale, { weekday: "long" });
  const goTo = (n: number) => {
    setWeek(Math.max(0, Math.min(maxWeek, n)));
    setSelected(null);
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader variant="member" />
      <main className="mx-auto max-w-2xl px-4 pb-16 pt-6 sm:px-6">
        <p className={`${MONO} flex min-h-5 items-center gap-2`}>
          <span className="truncate">{kicker}</span>
          {refreshing && (
            <span
              className="inline-flex items-center gap-1 normal-case tracking-normal"
              role="status"
            >
              <RefreshCw className="h-3 w-3 motion-safe:animate-spin" aria-hidden />
              {t("calendar.refreshing", "refreshing")}
            </span>
          )}
        </p>
        <h1 className="mt-1.5 font-display text-[clamp(3.5rem,18vw,4.75rem)] font-[900] leading-[0.84] tracking-[-0.025em] [font-stretch:62%]">
          {t("nav.calendar", "Calendar")}
        </h1>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2.5">
          <Segmented<Tab>
            label={t("v3paper.cal.view", "Calendar view")}
            value={tab}
            onChange={(v) => {
              setTab(v);
              setSelected(null);
            }}
            options={[
              { value: "events", label: t("v3paper.cal.tabEvents", "Events") },
              { value: "plans", label: t("v3paper.cal.tabPlans", "My plans") },
            ]}
          />
          <div className="flex items-center gap-1.5">
            {(w > 0 || selected !== null) && (
              <button
                type="button"
                onClick={() => goTo(0)}
                className={`min-h-11 rounded-full px-3 text-[13px] underline-offset-4 hover:underline ${FOCUS}`}
              >
                {t("calendar.today", "Today")}
              </button>
            )}
            <button
              type="button"
              disabled={w <= 0}
              onClick={() => goTo(w - 1)}
              aria-label={t("v3paper.cal.prevWeek", "Previous week")}
              className={`inline-flex h-11 w-11 items-center justify-center rounded-full border transition-colors hover:bg-muted disabled:opacity-30 disabled:hover:bg-transparent ${FOCUS}`}
            >
              <ChevronLeft className="h-[18px] w-[18px] rtl:-scale-x-100" aria-hidden />
            </button>
            <button
              type="button"
              disabled={w >= maxWeek}
              onClick={() => goTo(w + 1)}
              aria-label={t("v3paper.cal.nextWeek", "Next week")}
              className={`inline-flex h-11 w-11 items-center justify-center rounded-full border transition-colors hover:bg-muted disabled:opacity-30 disabled:hover:bg-transparent ${FOCUS}`}
            >
              <ChevronRight className="h-[18px] w-[18px] rtl:-scale-x-100" aria-hidden />
            </button>
          </div>
        </div>

        <WeekStrip
          days={days}
          today={today}
          selected={selected}
          locale={locale}
          eventCount={(d) => listedByDay.get(d) ?? 0}
          planCount={(d) => mineByDay.get(d) ?? 0}
          onSelect={setSelected}
        />

        {tab === "plans" && myUpcoming[0] && (
          <NextPlanCard event={myUpcoming[0]} lang={i18n.language} />
        )}

        <section aria-busy={loading} aria-live="polite">
          {!loading && !activeQ.isError && (
            <p className={`${MONO} mt-4`}>
              {tab === "events"
                ? t("v3paper.cal.eventsCount", {
                    count: rows.length,
                    defaultValue: "{{count}} gatherings · Istanbul time",
                  })
                : t("v3paper.cal.plansCount", {
                    count: rows.length,
                    defaultValue: "{{count}} plans · Istanbul time",
                  })}
              {tab === "events" &&
                listLimitHit &&
                ` · ${t("v3paper.cal.first50", "first 50 listed")}`}
            </p>
          )}

          {loading && (
            <div className="mt-6 space-y-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-14 motion-safe:animate-pulse rounded-xl bg-muted/60" />
              ))}
              <p className="sr-only">{t("common.loading", "Loading…")}</p>
            </div>
          )}

          {!loading && activeQ.isError && (
            <p
              className="mt-6 rounded-[22px] border border-destructive/40 p-5 text-sm text-destructive"
              role="alert"
            >
              {tab === "events"
                ? t("v3paper.cal.eventsError", "Couldn't load the gatherings.")
                : t("calendar.loadError", "Couldn't load your calendar.")}{" "}
              <button
                type="button"
                className={`min-h-11 underline ${FOCUS}`}
                onClick={() => activeQ.refetch()}
              >
                {t("common.tryAgain", "Try again")}
              </button>
            </p>
          )}

          {!loading && !activeQ.isError && rows.length === 0 && (
            <div className="mt-6 grid gap-2.5 rounded-[22px] border-2 border-dashed p-5">
              {tab === "plans" && myUpcoming.length === 0 ? (
                <>
                  <h3 className="font-display text-[26px] font-[850] leading-none [font-stretch:72%]">
                    {t("calendar.empty", "Nothing on the books.")}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    <Link to="/app" className={`underline-offset-4 hover:underline ${FOCUS}`}>
                      {t("calendar.findNext", "Find your next gathering.")}
                    </Link>
                  </p>
                </>
              ) : (
                <>
                  <h3 className="font-display text-[26px] font-[850] leading-none [font-stretch:72%]">
                    {tab === "events"
                      ? selected !== null
                        ? t("v3paper.cal.emptyDay", "No gatherings on this day")
                        : t("v3paper.cal.emptyWeek", "No gatherings this week")
                      : selected !== null
                        ? t("v3paper.cal.noPlansDay", "No plans on this day")
                        : t("v3paper.cal.noPlansWeek", "No plans this week")}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {t(
                      "v3paper.cal.emptyHint",
                      "Pick another day or week. Only gatherings listed on Agora by their organisers appear here.",
                    )}
                  </p>
                </>
              )}
            </div>
          )}

          {!loading &&
            groups.map((g) => (
              <div key={g.day}>
                <DayHeader
                  title={dayTitle(g.day)}
                  date={fmtDay(g.day, locale, { day: "numeric", month: "long" })}
                />
                {g.items.map((e) => (
                  <CalendarRow
                    key={e.id}
                    event={e}
                    locale={locale}
                    going={goingIds.has(e.id)}
                    saved={savedSet.has(e.id)}
                    saveBusy={saveToggle.isPending}
                    onToggleSave={() =>
                      saveToggle.mutate({
                        target: { kind: "event", refId: e.id },
                        saved: savedSet.has(e.id),
                      })
                    }
                  />
                ))}
              </div>
            ))}
        </section>

        {tab === "plans" && !q.isLoading && !q.isError && (
          <section className="mt-12" aria-labelledby="cal-past">
            <div className="flex items-baseline justify-between gap-3 border-t-2 border-foreground pt-2">
              <h2
                id="cal-past"
                className="font-display text-2xl font-[850] leading-none [font-stretch:72%]"
              >
                {t("calendar.past", "Already lived")}
              </h2>
            </div>
            {past.length === 0 && (
              <p className="mt-3 text-sm text-muted-foreground">
                {t("calendar.pastEmpty", "Your story starts with your first gathering.")}
              </p>
            )}
            {past.slice(0, 12).map((r) => (
              <Link
                key={r.event_id}
                to="/app/event/$id"
                params={{ id: r.event_id }}
                className={`grid min-h-14 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b py-2 ${FOCUS}`}
              >
                <span className="min-w-0">
                  <span className="block text-[15px] font-semibold leading-tight [overflow-wrap:anywhere]">
                    {r.events.title}
                  </span>
                  <span className="mt-0.5 block font-mono text-[11px] text-muted-foreground">
                    {new Date(r.events.starts_at).toLocaleDateString(locale, {
                      timeZone: "Europe/Istanbul",
                    })}
                  </span>
                </span>
                <span className="text-xs font-semibold">
                  {t("calendar.addMemory", "Add memory →")}
                </span>
              </Link>
            ))}
          </section>
        )}

        <p className="mt-10 text-xs text-muted-foreground">
          {t(
            "v3paper.cal.footer",
            "Times are Istanbul time (Europe/Istanbul). Only gatherings listed on Agora by their organisers appear here; demo listings are marked. Qloo taste data is never used as a date.",
          )}
        </p>
      </main>
    </div>
  );
}
