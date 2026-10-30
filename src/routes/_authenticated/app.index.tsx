import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Calendar as CalendarIcon, MapPin } from "lucide-react";
import { listUpcomingEvents } from "@/lib/events.functions";
import { useDiscovery } from "@/lib/discovery-store";
import { AppHeader } from "@/components/AppHeader";
import { BingoEntry } from "@/components/bingo/BingoEntry";
import { EventVisual } from "@/components/EventVisual";
import { CompassFace } from "@/components/compass/CompassFace";
import { LivingCanvas } from "@/components/LivingCanvas";
import { CinematicIntro } from "@/components/CinematicIntro";
import { formatWhenLocalized } from "@/components/guide/guide-format";
import { whenLabel } from "@/components/discover/DiscoveryPanel";
import { CATEGORIES, categoryOf, composeRequest, type CategoryKey } from "@/lib/categories";
import { extractConstraints } from "@/lib/discovery";
import {
  LocationChooser,
  useDiscoveryLocation,
  withLocation,
} from "@/components/discover/LocationChooser";

export const Route = createFileRoute("/_authenticated/app/")({
  head: () => ({
    meta: [
      { title: "Where to tonight? — Agora" },
      {
        name: "description",
        content:
          "Type or speak to the compass. Qloo ranks restaurants and places for your taste; Agora shows real gatherings and the communities behind them.",
      },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Where to tonight? — Agora" },
      {
        property: "og:description",
        content:
          "Your compass for Istanbul: restaurants, places and gatherings that fit your taste.",
      },
    ],
  }),
  // `?q=` pre-fills the field (Bingo challenges link here); nothing is sent until the person sends it.
  validateSearch: (search: Record<string, unknown>): { q?: string } =>
    typeof search.q === "string" && search.q.trim() ? { q: search.q.slice(0, 280) } : {},
  component: Discover,
});

/**
 * Stage 1 of the journey: one compass, one field. Typing, speaking or picking
 * a direction all feed the same discovery context; the answer opens on its
 * own stage (/app/map) with a view transition that carries the compass over.
 */
function Discover() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const list = useServerFn(listUpcomingEvents);
  const { state, ask, reset } = useDiscovery();
  const { q } = Route.useSearch();

  const [prompt, setPrompt] = useState(q ?? "");
  const [selected, setSelected] = useState<CategoryKey | null>(null);
  const [loc, setLoc] = useDiscoveryLocation();
  const [needle, setNeedle] = useState<number>(() => categoryOf(state.direction)?.angle ?? -90);

  useEffect(() => {
    if (q) setPrompt(q);
  }, [q]);
  const pendingNav = useRef(false);

  const upcoming = useQuery({ queryKey: ["events", "upcoming"], queryFn: () => list() });

  // The needle follows the real job: spinning while Agora searches, settling on
  // the answer. The results stage opens the moment the answer (or Agora's one
  // question) is in — no staged wait, and never on an error.
  useEffect(() => {
    if (!pendingNav.current) return;
    if (state.status === "ready" || state.status === "empty" || state.status === "question") {
      pendingNav.current = false;
      navigate({ to: "/app/map", viewTransition: true });
    } else if (state.status === "error") {
      pendingNav.current = false;
    }
  }, [state.status, navigate]);

  /** A search from the home is a new discovery (the last one stays one tap away). */
  function submit(text: string) {
    if (state.status === "searching") return;
    const base = composeRequest(text, selected, t);
    if (!base) return;
    const request = withLocation(base, loc, Boolean(extractConstraints(base, new Date()).district));
    pendingNav.current = true;
    const cat = categoryOf(selected);
    if (cat) setNeedle(cat.angle);
    reset();
    void ask(request, {
      direction: selected,
      display: text.trim() || (selected ? t(`cat.${selected}.label`) : request),
    });
    setPrompt("");
  }

  function tapCategory(key: CategoryKey) {
    if (state.status === "searching") return;
    if (selected !== key) {
      setSelected(key);
      setNeedle(categoryOf(key)?.angle ?? -90);
      return;
    }
    submit(prompt);
  }

  // What the rule layer understands from the text so far — the same extraction the server runs first.
  const heard = useMemo(() => {
    const text = prompt.trim();
    if (!text) return null;
    const base = composeRequest(text, selected, t);
    const c = extractConstraints(
      withLocation(base, loc, Boolean(extractConstraints(base, new Date()).district)),
      new Date(),
    );
    const chips: string[] = [];
    if (c.intent)
      chips.push(
        c.intent === "event"
          ? t("cat.heardIntent.event", "Gathering")
          : c.intent === "restaurant"
            ? t("cat.heardIntent.restaurant", "Restaurant")
            : t("cat.heardIntent.place", "Place") +
              (c.placeKind && c.placeKind !== "place" ? ` · ${c.placeKind}` : ""),
      );
    if (c.district) chips.push(c.district);
    if (c.when) chips.push(whenLabel(t, c.when));
    if (typeof c.budgetMax === "number") chips.push(`≤ ${c.budgetMax} TL`);
    if (c.groupSize)
      chips.push(
        c.groupSize === "small"
          ? t("discover.smallGroup", "Small group")
          : t("discover.largeGroup", "Big crowd"),
      );
    if (c.social) chips.push(t("discover.social", "Meet new people"));
    return chips;
  }, [prompt, selected, loc, t]);

  // "Friday · 30 October · Istanbul" — the Istanbul date, in the reader's language.
  const date = useMemo(() => {
    const parts = new Intl.DateTimeFormat(i18n.language, {
      weekday: "long",
      day: "numeric",
      month: "long",
      timeZone: "Europe/Istanbul",
    }).formatToParts(new Date());
    const get = (type: Intl.DateTimeFormatPartTypes) =>
      parts.find((p) => p.type === type)?.value ?? "";
    return { weekday: get("weekday"), day: `${get("day")} ${get("month")}` };
  }, [i18n.language]);

  const events = upcoming.data?.events ?? [];
  const searching = state.status === "searching";
  const found =
    state.status === "ready" ||
    (state.result?.intent === "event"
      ? (state.result?.matches.length ?? 0) > 0
      : (state.result?.places?.items.length ?? 0) > 0);

  return (
    <div className="min-h-screen bg-background">
      {/* Stage 1 — the compass, on the night field (design: Naz) */}
      <CinematicIntro />
      <div className="night-field">
        <LivingCanvas mode={searching ? "seek" : "home"} />
        <span className="night-grain" aria-hidden />
        <AppHeader variant="member" tone="night" extra={<BingoEntry />} />

        <main className="mx-auto max-w-5xl px-5 sm:px-6">
          <section className="mx-auto flex min-h-[calc(100dvh-4.5rem)] max-w-md flex-col justify-center pb-10 pt-5 sm:max-w-xl sm:py-10">
            <div className="flex items-center justify-between gap-3">
              <p className="min-w-0 truncate font-mono text-[11px] uppercase tracking-[0.08em] text-[color:var(--nt-2)]">
                <span className="hidden min-[420px]:inline">{date.weekday} · </span>
                {date.day} · {t("discover.city", "Istanbul")}
              </p>
              <LocationChooser value={loc} onChange={setLoc} />
            </div>
            <h1 className="mt-1.5 text-[3.375rem] font-[850] leading-[0.86] tracking-[-0.025em] text-balance [font-stretch:64%] [word-spacing:0.12em] sm:text-[4.5rem]">
              {t("discover.heroTitle", "What do you feel like doing today")}
              <span className="hero-q">?</span>
            </h1>

            <div className="mt-6">
              <CompassFace
                needleAngle={needle}
                status={state.status}
                found={found}
                prompt={prompt}
                setPrompt={setPrompt}
                onSubmit={(p) => submit(p)}
                selected={selected}
                onCategoryTap={tapCategory}
                onCategoryClear={() => setSelected(null)}
                heard={
                  heard && heard.length > 0 ? (
                    <div
                      className="mx-auto mt-2 flex max-w-md flex-wrap gap-1"
                      aria-label={t("cat.heard", "What Agora understood so far")}
                      aria-live="polite"
                    >
                      {heard.map((h) => (
                        <span
                          key={h}
                          className="inline-flex h-6 items-center rounded-full bg-[var(--nt-glass)] px-2.5 text-[12px] text-[color:var(--nt)] shadow-[inset_0_0_0_1px_var(--nt-line)]"
                        >
                          {h}
                        </span>
                      ))}
                    </div>
                  ) : null
                }
                disabled={searching}
              />
            </div>

            <p className="mx-auto mt-6 max-w-sm text-center text-[13px] text-[color:var(--nt-2)]">
              {t(
                "discover.howItWorks",
                "Ask for a restaurant, a place or a gathering. Qloo ranks places for your taste; Agora shows real gatherings and the communities behind them.",
              )}
            </p>

            {state.status === "error" && state.error && (
              <p className="mt-3 text-center text-sm text-destructive" role="alert">
                {t("discover.error", "I couldn't search just now. Try again in a moment.")}
              </p>
            )}
            {state.turns.length > 0 && !searching && (
              <p className="mt-3 text-center text-sm">
                <Link
                  to="/app/map"
                  viewTransition
                  className="text-primary underline-offset-4 hover:underline"
                >
                  {state.status === "question"
                    ? t("discover.answerQuestion", "Agora has one question for you →")
                    : t("discover.continueConversation", "Continue your last conversation →")}
                </Link>
              </p>
            )}
          </section>
        </main>
      </div>

      <main className="mx-auto max-w-5xl px-4 sm:px-6">
        {/* Stage 0 — what's on this week, for those who'd rather browse */}
        <section className="pb-16 pt-10">
          <div className="flex items-baseline justify-between border-t-2 border-foreground pt-3">
            <h2 className="font-display text-3xl leading-none">
              {t("discover.thisWeek", "Tonight & this week")}
            </h2>
            <Link
              to="/app/calendar"
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              {t("discover.viewCalendar", "View calendar →")}
            </Link>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {upcoming.isLoading &&
              [0, 1, 2].map((i) => (
                <div key={i} className="h-40 animate-pulse rounded-2xl border bg-card/40" />
              ))}
            {!upcoming.isLoading && events.length === 0 && (
              <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground sm:col-span-2 lg:col-span-3">
                {t("discover.noEvents", "No gatherings yet. Be the first — or check back tonight.")}
              </p>
            )}
            {events
              .filter((e: any) => e.category !== "landmark")
              .slice(0, 6)
              .map((e: any) => (
                <Link
                  key={e.id}
                  to="/app/event/$id"
                  params={{ id: e.id }}
                  className="block overflow-hidden rounded-2xl border bg-card transition hover:border-primary/50"
                >
                  <EventVisual title={e.title} category={e.category} tags={e.tags} size="sm" />
                  <div className="p-4">
                    <div className="flex items-baseline justify-between gap-4">
                      <h3 className="font-display text-lg leading-tight">{e.title}</h3>
                      <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                        <CalendarIcon className="h-3 w-3" aria-hidden />
                        {formatWhenLocalized(e.starts_at, i18n.language)}
                      </span>
                    </div>
                    <p className="mt-1 flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
                      <MapPin className="h-3 w-3 shrink-0" aria-hidden />
                      <span className="min-w-0 truncate">
                        {e.organizations?.name} · {e.venue ?? e.city ?? "—"}
                      </span>
                      {(e.tags ?? []).includes("demo") && (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-widest">
                          {t("common.demo", "Demo")}
                        </span>
                      )}
                    </p>
                  </div>
                </Link>
              ))}
          </div>
          <p className="mt-6 text-center text-xs text-muted-foreground">
            <Link
              to="/app/guide"
              className="underline-offset-4 hover:text-foreground hover:underline"
            >
              {t("discover.guideLink", "Prefer a landmark tour by taste? Open the guide →")}
            </Link>
          </p>
        </section>
      </main>
    </div>
  );
}
