import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
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
import { listUpcomingEvents } from "@/lib/events.functions";
import { getMyStats } from "@/lib/gamification.functions";
import { getRecommendations } from "@/lib/recommendations.functions";
import { useDiscovery } from "@/lib/discovery-store";
import type { DiscoveryStatus } from "@/lib/discovery-store";
import { AppHeader } from "@/components/AppHeader";
import { EventVisual } from "@/components/EventVisual";
import { LocationPreviewDialog } from "@/components/LocationPreviewDialog";
import { formatWhenLocalized } from "@/components/guide/guide-format";

export const Route = createFileRoute("/_authenticated/app/")({
  head: () => ({
    meta: [
      { title: "Discover your night — Agora" },
      {
        name: "description",
        content:
          "Tell the compass what kind of gathering you want. Agora checks real nearby gatherings against your conditions — music, sport, film, and quiet rooms too.",
      },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Discover your night — Agora" },
      {
        property: "og:description",
        content:
          "Your personal compass for nearby gatherings. Music, sport, film, and the quiet rooms in between.",
      },
    ],
  }),
  component: Discover,
});

/**
 * Compass directions: each is a preference added to the same discovery
 * context as typed text — not a separate search engine. The prompts carry no
 * date or district, so they never silently narrow the search.
 */
const SUGGESTIONS = [
  {
    dir: "N",
    angle: -90,
    key: "quiet",
    prompt: "A quiet bar with people who like vinyl and slow conversation, small group",
  },
  {
    dir: "E",
    angle: 0,
    key: "loud",
    prompt: "Something loud and sweaty with a big crowd, live music or dancing",
  },
  {
    dir: "S",
    angle: 90,
    key: "move",
    prompt: "A run, a swim or a workout with strangers, outdoors",
  },
  {
    dir: "W",
    angle: 180,
    key: "cinema",
    prompt: "An indie film and wine kind of night, film club",
  },
] as const;

type Suggestion = (typeof SUGGESTIONS)[number];

function Discover() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const list = useServerFn(listUpcomingEvents);
  const fetchStats = useServerFn(getMyStats);
  const fetchRecs = useServerFn(getRecommendations);
  const { state, ask } = useDiscovery();

  const [prompt, setPrompt] = useState("");
  const [needle, setNeedle] = useState<number>(-90); // points N initially
  const pendingNav = useRef(false);

  const upcoming = useQuery({ queryKey: ["events", "upcoming"], queryFn: () => list() });
  const stats = useQuery({ queryKey: ["my-stats"], queryFn: () => fetchStats() });
  const recs = useQuery({ queryKey: ["recommendations"], queryFn: () => fetchRecs() });

  // The needle follows the real job: spinning while Agora searches, settling on
  // the result. Navigation happens the moment the answer is in — no staged wait.
  useEffect(() => {
    if (!pendingNav.current) return;
    if (state.status === "ready" || state.status === "empty") {
      pendingNav.current = false;
      navigate({ to: "/app/map" });
    } else if (state.status === "error") {
      pendingNav.current = false;
    }
  }, [state.status, navigate]);

  function submit(text: string, direction?: Suggestion) {
    const clean = text.trim();
    if (!clean || state.status === "searching") return;
    pendingNav.current = true;
    if (direction) setNeedle(direction.angle);
    void ask(clean, {
      direction: direction?.key ?? null,
      display: direction ? t(`discover.direction.${direction.key}`) : clean,
    });
  }

  const events = upcoming.data?.events ?? [];
  const recommendations = recs.data?.recommendations ?? [];
  const userTags = recs.data?.userTags ?? [];
  const searching = state.status === "searching";

  return (
    <div className="min-h-screen bg-background">
      <AppHeader variant="member" />

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <h1 className="sr-only">{t("discover.title", "Discover your night")}</h1>
        <p className="mb-2 text-center text-xs uppercase tracking-[0.3em] text-primary">
          {t("discover.kicker", "Find your crowd")}
        </p>
        <p className="mx-auto mb-6 max-w-xl text-center font-display text-2xl leading-snug sm:text-3xl">
          {t("discover.invitation", "What kind of gathering would do you good today?")}
        </p>

        {/* Compass */}
        <CompassFace
          needleAngle={needle}
          status={state.status}
          matches={state.result?.matches.length ?? 0}
          prompt={prompt}
          setPrompt={setPrompt}
          onSubmit={(p) => submit(p)}
          onPickDirection={(s) => submit(s.prompt, s)}
          disabled={searching}
        />
        {state.status === "error" && state.error && (
          <p className="mt-3 text-center text-sm text-destructive" role="alert">
            {t("discover.error", "I couldn't search just now. Try again in a moment.")}
          </p>
        )}
        {state.turns.length > 0 && !searching && (
          <p className="mt-3 text-center text-sm text-muted-foreground">
            <Link to="/app/map" className="text-primary underline-offset-4 hover:underline">
              {t("discover.continueConversation", "Continue your last conversation →")}
            </Link>
          </p>
        )}

        <Link
          to="/app/guide"
          className="group mt-8 flex flex-col gap-3 rounded-3xl border border-primary/30 bg-[radial-gradient(circle_at_15%_20%,_color-mix(in_oklab,_var(--primary)_14%,_transparent),_transparent_60%)] p-6 transition hover:border-primary sm:flex-row sm:items-center sm:justify-between"
        >
          <span>
            <span className="text-xs uppercase tracking-[0.3em] text-primary">
              {t("landing.guideBadge", "New · powered by Qloo")}
            </span>
            <span className="mt-1 block font-display text-2xl leading-tight sm:text-3xl">
              {t("landing.guideTitle", "Your Istanbul, by taste")}
            </span>
            <span className="mt-1 block text-sm text-muted-foreground">
              {t(
                "discover.guideSub",
                "Three things you love → the landmarks, stories and tables that fit you.",
              )}
            </span>
          </span>
          <span className="inline-flex items-center gap-1.5 self-start rounded-full bg-primary px-4 py-2 text-sm text-primary-foreground sm:self-center">
            {t("discover.openGuide", "Open the taste guide")}{" "}
            <ArrowUp className="h-3.5 w-3.5 rotate-45" aria-hidden />
          </span>
        </Link>

        {/* Quick stats */}
        {stats.data && (
          <div className="mt-8 grid grid-cols-3 gap-3 sm:gap-4">
            <Link
              to="/app/profile"
              className="rounded-2xl border bg-card p-4 transition hover:border-primary/50"
            >
              <p className="text-xs uppercase tracking-widest text-muted-foreground">
                {t("stats.level", "Level")}
              </p>
              <p className="mt-1 font-display text-3xl">{stats.data.progress.level}</p>
              <p className="mt-1 text-xs text-muted-foreground">{stats.data.stats.xp} XP</p>
            </Link>
            <Link
              to="/app/calendar"
              className="rounded-2xl border bg-card p-4 transition hover:border-primary/50"
            >
              <p className="text-xs uppercase tracking-widest text-muted-foreground">
                {t("stats.streak", "Streak")}
              </p>
              <p className="mt-1 font-display text-3xl">🔥 {stats.data.stats.current_streak}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {t("stats.weeksInARow", "weeks in a row")}
              </p>
            </Link>
            <Link
              to="/app/memories"
              className="rounded-2xl border bg-card p-4 transition hover:border-primary/50"
            >
              <p className="text-xs uppercase tracking-widest text-muted-foreground">
                {t("stats.badges", "Badges")}
              </p>
              <p className="mt-1 font-display text-3xl">{stats.data.badges.length}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {t("stats.unlocked", "unlocked")}
              </p>
            </Link>
          </div>
        )}

        {/* AI-powered recommendations */}
        <section className="mt-12">
          <div className="flex items-baseline justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-primary">
                <Wand2 className="h-3.5 w-3.5" aria-hidden />
                {t("discover.forYou", "For you")}
              </div>
              <h2 className="mt-2 font-display text-2xl">
                {t("discover.pickedFromTaste", "Picked from your taste")}
              </h2>
              {userTags.length > 0 ? (
                <p className="mt-1 text-sm text-muted-foreground">
                  {t("discover.basedOn", "Based on")} {userTags.slice(0, 5).join(" · ")}
                  {userTags.length > 5 ? ` +${userTags.length - 5}` : ""}
                </p>
              ) : (
                <p className="mt-1 text-sm text-muted-foreground">
                  <Link
                    to="/app/integrations"
                    className="text-primary underline-offset-4 hover:underline"
                  >
                    {t("discover.connectSocials", "Connect Spotify, Strava or Letterboxd")}
                  </Link>{" "}
                  {t("discover.toUnlock", "to unlock personalised picks.")}
                </p>
              )}
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {recs.isLoading &&
              [0, 1].map((i) => (
                <div key={i} className="h-36 animate-pulse rounded-2xl border bg-card/40" />
              ))}
            {!recs.isLoading && recommendations.length === 0 && userTags.length > 0 && (
              <p className="md:col-span-2 rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">
                {t("discover.nothingOnHorizon", "Nothing on the horizon yet. Check back tonight.")}
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
            <h2 className="font-display text-2xl">
              {t("discover.thisWeek", "Tonight & this week")}
            </h2>
            <Link
              to="/app/calendar"
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              {t("discover.viewCalendar", "View calendar →")}
            </Link>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {upcoming.isLoading &&
              [0, 1, 2].map((i) => (
                <div key={i} className="h-40 animate-pulse rounded-2xl border bg-card/40" />
              ))}
            {!upcoming.isLoading && events.length === 0 && (
              <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground sm:col-span-2">
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
                    <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                      <MapPin className="h-3 w-3" aria-hidden />
                      {e.organizations?.name} · {e.venue ?? e.city ?? "—"}
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
        </section>
      </main>
    </div>
  );
}

function CompassFace({
  needleAngle,
  status,
  matches,
  prompt,
  setPrompt,
  onSubmit,
  onPickDirection,
  disabled,
}: {
  needleAngle: number;
  status: DiscoveryStatus;
  matches: number;
  prompt: string;
  setPrompt: (v: string) => void;
  onSubmit: (p: string) => void;
  onPickDirection: (s: Suggestion) => void;
  disabled: boolean;
}) {
  const { t } = useTranslation();
  const cardinals = useMemo(
    () => [
      { l: "N", a: -90 },
      { l: "E", a: 0 },
      { l: "S", a: 90 },
      { l: "W", a: 180 },
    ],
    [],
  );
  const searching = status === "searching";
  const found = status === "ready" && matches > 0;

  return (
    <div
      className="relative mx-auto aspect-square w-full max-w-[760px]"
      data-state={status}
      role="group"
      aria-label={t(
        "discover.compassLabel",
        "Compass: pick a direction or tell Agora what you want",
      )}
    >
      {/* Outer ring (subtly rotating bezel; still under reduced motion) */}
      <div
        className={`absolute inset-0 rounded-full border bg-[radial-gradient(circle_at_30%_20%,_color-mix(in_oklab,_var(--primary)_18%,_transparent),_transparent_55%),radial-gradient(circle_at_70%_80%,_color-mix(in_oklab,_var(--primary)_10%,_transparent),_transparent_55%)] shadow-[0_30px_80px_-30px_color-mix(in_oklab,var(--primary)_45%,transparent),inset_0_0_60px_color-mix(in_oklab,var(--primary)_8%,transparent)] transition-colors ${
          status === "error"
            ? "border-destructive/60"
            : searching
              ? "border-primary/70"
              : "border-primary/30"
        } ${searching ? "motion-safe:animate-[spin_6s_linear_infinite]" : "motion-safe:animate-[spin_60s_linear_infinite]"}`}
      >
        {/* tick marks */}
        <svg viewBox="0 0 200 200" className="absolute inset-0 h-full w-full" aria-hidden>
          <g stroke="currentColor" className="text-primary/40">
            {Array.from({ length: 72 }).map((_, i) => {
              const long = i % 9 === 0;
              const a = (i / 72) * Math.PI * 2;
              const r1 = 96;
              const r2 = long ? 88 : 92;
              return (
                <line
                  key={i}
                  x1={100 + Math.cos(a) * r1}
                  y1={100 + Math.sin(a) * r1}
                  x2={100 + Math.cos(a) * r2}
                  y2={100 + Math.sin(a) * r2}
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
        const rPct = 41;
        return (
          <div
            key={c.l}
            aria-hidden
            className="absolute -translate-x-1/2 -translate-y-1/2 font-display text-xl tracking-[0.2em] text-primary/70"
            style={{ left: `${50 + Math.cos(rad) * rPct}%`, top: `${50 + Math.sin(rad) * rPct}%` }}
          >
            {c.l}
          </div>
        );
      })}

      {/* Direction preferences placed inward of the cardinals */}
      {SUGGESTIONS.map((s) => {
        const rad = (s.angle * Math.PI) / 180;
        const rPct = 33;
        return (
          <button
            key={s.dir}
            type="button"
            disabled={disabled}
            onClick={() => onPickDirection(s)}
            className="absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full border border-primary/30 bg-background/80 px-3 py-1.5 text-xs text-foreground backdrop-blur transition hover:border-primary hover:bg-primary hover:text-primary-foreground focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50"
            style={{ left: `${50 + Math.cos(rad) * rPct}%`, top: `${50 + Math.sin(rad) * rPct}%` }}
          >
            {t(`discover.direction.${s.key}`)}
          </button>
        );
      })}

      {/* Needle: spins while searching, settles on the chosen direction */}
      <div
        className={`pointer-events-none absolute inset-0 flex items-center justify-center ${
          searching ? "motion-safe:animate-[spin_1.4s_cubic-bezier(0.45,0,0.55,1)_infinite]" : ""
        }`}
        style={
          searching
            ? undefined
            : {
                transform: `rotate(${needleAngle + 90}deg)`,
                transition: "transform 1.1s cubic-bezier(0.22, 1, 0.36, 1)",
              }
        }
        aria-hidden
      >
        <svg viewBox="0 0 200 200" className="h-full w-full">
          <defs>
            <linearGradient id="needleN" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--primary)" />
              <stop
                offset="100%"
                stopColor="color-mix(in oklab, var(--primary) 50%, transparent)"
              />
            </linearGradient>
          </defs>
          <polygon points="100,18 106,100 94,100" fill="url(#needleN)" />
          <polygon
            points="100,182 106,100 94,100"
            fill="color-mix(in oklab, var(--foreground) 30%, transparent)"
          />
          <circle
            cx="100"
            cy="100"
            r="6"
            fill="var(--background)"
            stroke="var(--primary)"
            strokeWidth="2"
          />
        </svg>
      </div>

      {/* Center: the same "tell Agora" input as the results page (compact) */}
      <div className="absolute left-1/2 top-1/2 z-10 w-[46%] -translate-x-1/2 -translate-y-1/2">
        <div className="mb-2 flex items-center justify-center gap-1.5" aria-live="polite">
          {found ? (
            <Sparkles className="h-3 w-3 text-primary" aria-hidden />
          ) : (
            <Compass
              className={`h-3 w-3 text-primary ${searching ? "motion-safe:animate-pulse" : ""}`}
              aria-hidden
            />
          )}
          <span className="text-[9px] uppercase tracking-[0.3em] text-primary">
            {searching
              ? t("discover.stateSearching", "Searching")
              : found
                ? t("discover.stateFound", "Found")
                : status === "empty"
                  ? t("discover.stateEmpty", "No exact match")
                  : status === "error"
                    ? t("discover.stateError", "Error")
                    : "Agora"}
          </span>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit(prompt);
          }}
          className="group rounded-2xl border border-border bg-background/95 p-1.5 shadow-[0_10px_40px_-15px_color-mix(in_oklab,var(--primary)_35%,transparent)] backdrop-blur transition-all focus-within:border-primary/60"
        >
          <label className="sr-only" htmlFor="compass-ask">
            {t("discover.askLabel", "Tell Agora what you're looking for")}
          </label>
          <textarea
            id="compass-ask"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onSubmit(prompt);
              }
            }}
            placeholder={t(
              "discover.compassPlaceholder",
              "Tell Agora… tonight, Kadıköy, under 700 TL",
            )}
            rows={2}
            disabled={disabled}
            enterKeyHint="send"
            className="w-full resize-none bg-transparent px-2 py-1 text-xs leading-snug placeholder:text-muted-foreground focus:outline-none sm:text-sm"
          />
          <div className="flex items-center justify-end px-1 pb-0.5">
            <button
              type="submit"
              disabled={disabled || !prompt.trim()}
              className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground transition hover:opacity-90 disabled:opacity-40"
              aria-label={t("discover.pointMeThere", "Point me there")}
            >
              <ArrowUp className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function RecommendationCard({ rec }: { rec: any }) {
  const { t, i18n } = useTranslation();
  const e = rec.event;
  const Icon =
    e.category === "music"
      ? Music
      : e.category === "sports"
        ? Activity
        : e.category === "film"
          ? Film
          : Sparkles;
  return (
    <div className="group relative overflow-hidden rounded-2xl border bg-card p-5 transition hover:border-primary/50">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Icon className="h-5 w-5" aria-hidden />
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
              {e.organizations?.name} · {e.venue ?? e.city ?? "—"}
            </p>
          </div>
        </div>
        <span className="text-[10px] uppercase tracking-widest text-primary">
          {t("discover.aiPick", "AI pick")}
        </span>
      </div>

      <p className="mt-3 text-sm italic text-muted-foreground">
        "{rec.reason}"{" "}
        <span className="not-italic text-[10px] uppercase tracking-widest">
          {t("guide.aiNote", "Agora's note · AI")}
        </span>
      </p>

      <div className="mt-4 flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">
          {formatWhenLocalized(e.starts_at, i18n.language)}
        </span>
        <LocationPreviewDialog
          place={e}
          trigger={
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-background px-3 py-1.5 text-xs text-foreground transition hover:bg-primary hover:text-primary-foreground"
            >
              <Navigation className="h-3 w-3" aria-hidden />
              {t("event.takeMeThere", "Take me there")}
            </button>
          }
        />
      </div>
    </div>
  );
}
