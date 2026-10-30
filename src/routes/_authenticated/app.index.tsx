import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Calendar as CalendarIcon, MapPin } from "lucide-react";
import { listUpcomingEvents } from "@/lib/events.functions";
import { useDiscovery } from "@/lib/discovery-store";
import { AppHeader } from "@/components/AppHeader";
import { EventVisual } from "@/components/EventVisual";
import { CompassFace, DIRECTIONS, type Direction } from "@/components/compass/CompassFace";
import { formatWhenLocalized } from "@/components/guide/guide-format";

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
  const { state, ask } = useDiscovery();

  const [prompt, setPrompt] = useState("");
  const [needle, setNeedle] = useState<number>(() => {
    const d = DIRECTIONS.find((x) => x.key === state.direction);
    return d ? d.angle : -90;
  });
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

  function submit(text: string, direction?: Direction) {
    const clean = text.trim();
    if (!clean || state.status === "searching") return;
    pendingNav.current = true;
    if (direction) setNeedle(direction.angle);
    void ask(clean, {
      direction: direction?.key ?? null,
      display: direction ? t(`discover.direction.${direction.key}`) : clean,
    });
  }

  // "Friday · 30 October · Istanbul" — the Istanbul date, in the reader's language.
  const dateLine = useMemo(() => {
    const parts = new Intl.DateTimeFormat(i18n.language, {
      weekday: "long",
      day: "numeric",
      month: "long",
      timeZone: "Europe/Istanbul",
    }).formatToParts(new Date());
    const get = (type: Intl.DateTimeFormatPartTypes) =>
      parts.find((p) => p.type === type)?.value ?? "";
    return [get("weekday"), `${get("day")} ${get("month")}`, t("discover.city", "Istanbul")].join(
      " · ",
    );
  }, [i18n.language, t]);

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
      <div className="night-field">
        <span className="night-grain" aria-hidden />
        <AppHeader variant="member" tone="night" />

        <main className="mx-auto max-w-5xl px-5 sm:px-6">
          <section className="mx-auto flex min-h-[calc(100dvh-4.5rem)] max-w-md flex-col justify-center pb-10 pt-5 sm:max-w-xl sm:py-10">
            <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-[color:var(--nt-2)]">
              {dateLine}
            </p>
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
                onPickDirection={(d) => submit(d.prompt, d)}
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
