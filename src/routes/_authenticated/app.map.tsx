import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import {
  Bookmark,
  BookmarkCheck,
  CalendarDays,
  Database,
  Map as MapIcon,
  MapPin,
  Navigation,
  RotateCcw,
  Users,
} from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { EventVisual } from "@/components/EventVisual";
import { LocationPreviewDialog } from "@/components/LocationPreviewDialog";
import { AskBox } from "@/components/discover/AskBox";
import {
  ConstraintChips,
  TurnList,
  intentLabel,
  whenLabel,
} from "@/components/discover/DiscoveryPanel";
import {
  DecisionTrace,
  PlaceResults,
  PlaceSheet,
  QuestionCard,
  SignalChips,
} from "@/components/discover/PlaceResults";
import { DIRECTIONS } from "@/components/compass/CompassFace";
import { DiscoveryDial, type DialPoint } from "@/components/compass/DiscoveryDial";
import { LivingCanvas } from "@/components/LivingCanvas";
import { formatWhenLocalized } from "@/components/guide/guide-format";
import { kindWord, useDiscovery } from "@/lib/discovery-store";
import type { DiscoverPlace } from "@/lib/events.functions";
import {
  DISTRICTS,
  windowFor,
  type ScoredEvent,
  type Unverified,
  type Violation,
} from "@/lib/discovery";
import { useSaveToggle, useSavedIds } from "@/lib/use-saved";

export const Route = createFileRoute("/_authenticated/app/map")({
  head: () => ({
    meta: [{ title: "Your results — Agora" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: ResultsView,
});

declare global {
  interface Window {
    google?: any;
    __agoraInitMap?: () => void;
    /** Called by the Maps JS API when the key is rejected (e.g. referrer not allowed). */
    gm_authFailure?: () => void;
  }
}

type MapPoint = {
  id: string;
  title: string;
  latitude: number | null;
  longitude: number | null;
  venue?: string | null;
  city?: string | null;
};

// Keyless Google Maps embed — the fallback when the Maps JS API can't load.
// The browser key is restricted to the website's domains, so it fails inside
// the iOS/Android app (whose origin is capacitor://localhost or https://localhost).
function embedSrc(e: MapPoint | null) {
  const q =
    e && typeof e.latitude === "number" && typeof e.longitude === "number"
      ? `${e.latitude},${e.longitude}`
      : e
        ? [e.venue, e.city, e.title].filter(Boolean).join(", ")
        : "Istanbul";
  return `https://www.google.com/maps?q=${encodeURIComponent(q)}&z=14&output=embed`;
}

function priceLabel(t: TFunction, price: ScoredEvent["price"]) {
  if (price === null || price === undefined) return t("event.priceUnknown", "Price not listed");
  const n = Number(price);
  if (!Number.isFinite(n)) return t("event.priceUnknown", "Price not listed");
  return n === 0 ? t("event.free", "Free") : `${n} TL`;
}

/**
 * Stage 2 of the journey: the answer, on its own screen. The compass arrives
 * as a small pill (view transition), the request stays in view, every
 * condition is a chip, and the conversation continues at the bottom. Old
 * answers stay visible but dimmed while a new one is on its way; they are
 * never replaced by a slower, older response (seq in the store).
 */
function ResultsView() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { state, ask, edit, answer, removeSignal, reset } = useDiscovery();
  const [text, setText] = useState("");
  const [showMap, setShowMap] = useState(false);
  const [selected, setSelected] = useState<MapPoint | null>(null);
  const [openPlace, setOpenPlace] = useState<{ place: DiscoverPlace; rank: number } | null>(null);

  const result = state.result;
  const intent = state.constraints?.intent ?? result?.intent ?? "event";
  const points = useMemo<MapPoint[]>(() => {
    if (!result) return [];
    if (result.intent !== "event" && result.places) {
      return [
        ...result.places.items.map((p) => ({
          id: p.qlooEntityId,
          title: p.name,
          latitude: p.geocode?.latitude ?? null,
          longitude: p.geocode?.longitude ?? null,
          venue: p.address ?? null,
          city: "Istanbul",
        })),
        ...result.matches,
      ];
    }
    return [...result.matches, ...result.alternatives];
  }, [result]);

  // No conversation in this tab → start at the compass.
  useEffect(() => {
    if (state.status === "idle" && !state.result && state.turns.length === 0)
      navigate({ to: "/app" });
  }, [state.status, state.result, state.turns.length, navigate]);

  useEffect(() => {
    if (!selected && points.length > 0) setSelected(points[0]);
  }, [points, selected]);

  const busy = state.status === "searching";
  const needle = DIRECTIONS.find((d) => d.key === state.direction)?.angle ?? -90;
  const nearby = result && result.intent !== "event" ? result.matches : [];

  // The discovery moment: the top answers with coordinates, in rank order.
  const dialPoints = useMemo<DialPoint[]>(() => {
    if (!result) return [];
    const raw =
      result.intent !== "event" && result.places
        ? result.places.items.map((p) => ({
            id: p.qlooEntityId,
            name: p.name,
            lat: p.geocode?.latitude ?? null,
            lng: p.geocode?.longitude ?? null,
          }))
        : result.matches.map((e) => ({
            id: e.id,
            name: e.title,
            lat: e.latitude ?? null,
            lng: e.longitude ?? null,
          }));
    return raw.filter(
      (x): x is DialPoint => typeof x.lat === "number" && typeof x.lng === "number",
    );
  }, [result]);

  function focusCard(id: string) {
    const el = document.getElementById(`card-${id}`);
    if (!el) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
    el.classList.remove("card-flash");
    void el.offsetWidth;
    el.classList.add("card-flash");
    window.setTimeout(() => el.classList.remove("card-flash"), 1600);
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader variant="member" />
      <main className="mx-auto max-w-6xl px-4 pb-36 pt-5 sm:px-6 sm:pb-16">
        {/* Stage header: the compass, shrunk; the request; the exits */}
        <header className="flex items-start gap-3 sm:gap-4">
          <Link
            to="/app"
            viewTransition
            className="agora-compass relative mt-0.5 flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-[1.5px] border-foreground bg-card transition hover:bg-muted"
            aria-label={t("discover.backToCompass", "Back to the compass")}
            data-state={state.status}
          >
            <span
              className={`absolute inset-0 rounded-full border border-primary/20 ${busy ? "motion-safe:animate-[spin_6s_linear_infinite]" : ""}`}
              aria-hidden
            />
            <svg
              viewBox="0 0 200 200"
              className={`h-9 w-9 ${busy ? "motion-safe:animate-[spin_1.4s_cubic-bezier(0.45,0,0.55,1)_infinite]" : "transition-transform duration-700"}`}
              style={busy ? undefined : { transform: `rotate(${needle + 90}deg)` }}
              aria-hidden
            >
              <polygon points="100,22 108,100 92,100" fill="var(--primary)" />
              <polygon
                points="100,178 108,100 92,100"
                fill="color-mix(in oklab, var(--foreground) 30%, transparent)"
              />
            </svg>
          </Link>
          <div className="min-w-0 flex-1">
            <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
              {state.constraints ? intentLabel(t, state.constraints) : "Agora"}
              {state.constraints?.district ? ` · ${state.constraints.district}` : ""}
            </p>
            <h1 className="mt-1 line-clamp-3 text-[1.75rem] font-[800] leading-[1] tracking-[-0.01em] text-balance sm:text-[2.25rem]">
              {state.lastPrompt ? `“${state.lastPrompt}”` : t("discover.results", "Results")}
            </h1>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {points.some((p) => typeof p.latitude === "number") && (
              <Button
                variant={showMap ? "default" : "outline"}
                size="sm"
                className="min-h-11 gap-1"
                aria-pressed={showMap}
                aria-label={
                  showMap ? t("discover.hideMap", "Hide map") : t("discover.showMap", "Show map")
                }
                onClick={() => setShowMap((v) => !v)}
              >
                <MapIcon className="h-4 w-4" aria-hidden />
                <span className="hidden sm:inline">
                  {showMap ? t("discover.hideMap", "Hide map") : t("discover.showMap", "Show map")}
                </span>
              </Button>
            )}
            <Button
              variant="secondary"
              size="sm"
              className="min-h-11 gap-1"
              aria-label={t("discover.newSearch", "New search")}
              onClick={() => {
                reset();
                navigate({ to: "/app", viewTransition: true });
              }}
            >
              <RotateCcw className="h-4 w-4" aria-hidden />
              <span className="hidden sm:inline">{t("discover.newSearch", "New search")}</span>
            </Button>
          </div>
        </header>

        {(dialPoints.length > 0 ||
          (busy && state.turns.length <= 1) ||
          (state.status === "question" && result?.question?.kind === "district")) && (
          <section
            className="night-field -mx-4 mt-4 px-5 pb-5 pt-6 sm:mx-0 sm:rounded-[28px]"
            aria-label={t("dial.section", "Where they are")}
          >
            <LivingCanvas mode={busy ? "seek" : "lock"} />
            <span className="night-grain" aria-hidden />
            <DiscoveryDial
              district={state.constraints?.district ?? null}
              points={dialPoints}
              searching={busy}
              onPick={(id) => focusCard(id)}
              districtOptions={
                state.status === "question" && result?.question?.kind === "district"
                  ? result.question.options
                  : undefined
              }
              onDistrict={(district) => answer({ district, label: district })}
            />
          </section>
        )}

        {state.constraints && (
          <div className="mt-4 space-y-2">
            <ConstraintChips constraints={state.constraints} onEdit={edit} disabled={busy} />
            {intent !== "event" && (
              <SignalChips
                signals={state.signals}
                unknownTerms={result?.places?.unknownTerms}
                onRemove={(id) => {
                  const signal = state.signals.find((x) => x.entityId === id);
                  removeSignal(id);
                  // The term is answered "none" so the re-run doesn't resolve it again.
                  void answer({
                    answers: signal ? [{ term: signal.term, entityId: null }] : undefined,
                    label: t("discover.withoutSignal", {
                      name: signal?.name ?? "",
                      defaultValue: "Rank without {{name}}",
                    }),
                  });
                }}
                disabled={busy}
              />
            )}
          </div>
        )}

        <div
          className={`mt-6 grid gap-8 ${showMap ? "lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]" : ""}`}
        >
          <div className="min-w-0 space-y-8">
            {/* Waiting: the previous answer stays, dimmed, until the new one lands */}
            {busy && (
              <div
                className="stage-rise flex items-center gap-3 rounded-2xl border border-primary/40 bg-card px-4 py-3 text-sm"
                role="status"
                aria-live="polite"
              >
                <span className="relative flex h-3 w-3">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-primary opacity-60 motion-safe:animate-ping" />
                  <span className="relative inline-flex h-3 w-3 rounded-full bg-primary" />
                </span>
                {intent === "event"
                  ? t("discover.searching", "Checking real gatherings against your conditions…")
                  : t("discover.searchingQloo", "Asking Qloo to rank places for your taste…")}
              </div>
            )}

            {state.status === "error" && (
              <div
                className="stage-rise rounded-2xl border border-destructive/50 bg-card p-5"
                role="alert"
              >
                <p className="font-display text-xl">
                  {result?.qlooError
                    ? t("discover.qlooErrorTitle", "Qloo didn't answer")
                    : t("discover.errorTitle", "Something went wrong")}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {result?.qlooError
                    ? t(`guide.error.${result.qlooError}`, {
                        defaultValue: t(
                          "discover.qlooFailed",
                          "Qloo didn't answer just now, so I can't rank places — try again in a moment.",
                        ),
                      })
                    : t("discover.error", "I couldn't search just now. Try again in a moment.")}
                </p>
                <Button
                  className="mt-3 min-h-11"
                  variant="outline"
                  onClick={() => answer({ label: t("discover.retry", "Try again") })}
                >
                  {t("discover.retry", "Try again")}
                </Button>
              </div>
            )}

            {state.status === "question" && result?.question && (
              <QuestionCard
                question={result.question}
                disabled={busy}
                onDistrict={(district) => answer({ district, label: district })}
                onTaste={(answers) =>
                  answer({
                    answers,
                    label: t("discover.confirmedTaste", {
                      names: answers
                        .map((a) => {
                          const item =
                            result.question?.kind === "taste"
                              ? result.question.items.find((i) => i.term === a.term)
                              : null;
                          return (
                            item?.candidates.find((c) => c.entityId === a.entityId)?.name ?? null
                          );
                        })
                        .filter(Boolean)
                        .join(", "),
                      defaultValue: "I mean: {{names}}",
                    }),
                  })
                }
              />
            )}

            {result && (
              <div
                className={busy ? "opacity-50 transition-opacity" : "transition-opacity"}
                aria-busy={busy}
              >
                {result.intent !== "event" ? (
                  <div className="space-y-8">
                    {result.places && result.places.items.length > 0 && (
                      <PlaceResults
                        places={result.places}
                        prompt={state.lastPrompt}
                        onOpen={(place, rank) => setOpenPlace({ place, rank })}
                      />
                    )}
                    {!result.question &&
                      !result.qlooError &&
                      (!result.places || result.places.items.length === 0) && (
                        <div className="stage-rise rounded-2xl border border-dashed border-primary/30 bg-card/60 p-6">
                          <p className="font-display text-lg">
                            {t("discover.noPlacesTitle", {
                              kind: kindWord(t, result),
                              district: result.constraints.district ?? "",
                              defaultValue: "Qloo found no {{kind}} in {{district}}.",
                            })}
                          </p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {t(
                              "discover.noPlacesBody",
                              "Nothing is invented to fill the gap. Try a neighbouring district, or ask for a gathering instead.",
                            )}
                          </p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {DISTRICTS.slice(0, 6)
                              .filter((d) => d.name !== result.constraints.district)
                              .map((d) => (
                                <Button
                                  key={d.name}
                                  size="sm"
                                  variant="outline"
                                  className="min-h-11"
                                  disabled={busy}
                                  onClick={() => edit({ district: d.name }, d.name)}
                                >
                                  {d.name}
                                </Button>
                              ))}
                          </div>
                        </div>
                      )}
                    {nearby.length > 0 && (
                      <section
                        aria-label={t("discover.nearbyGatherings", "Agora gatherings nearby")}
                      >
                        <h2 className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-muted-foreground">
                          <Database className="h-3.5 w-3.5" aria-hidden />
                          {t("discover.nearbyGatheringsTitle", {
                            district: result.constraints.district ?? "",
                            when: whenLabel(t, result.constraints.when),
                            defaultValue: "Also on Agora · {{district}} · {{when}}",
                          })}
                        </h2>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {t(
                            "discover.nearbyGatheringsNote",
                            "Real gatherings listed by organisers (Agora data, not Qloo) — the way to meet the same people again.",
                          )}
                        </p>
                        <div className="stage-stagger mt-3 grid gap-4 md:grid-cols-2">
                          {nearby.map((e, i) => (
                            <ResultCard
                              key={e.id}
                              event={e}
                              kind="match"
                              index={i}
                              selected={selected?.id === e.id}
                              onSelect={() => setSelected(e)}
                            />
                          ))}
                        </div>
                      </section>
                    )}
                  </div>
                ) : (
                  <EventSections
                    result={result}
                    selected={selected}
                    onSelect={setSelected}
                    busy={busy}
                  />
                )}
              </div>
            )}

            {result && <DecisionTrace trace={result.trace} />}

            {/* Conversation + the next message (desktop); phones get the docked box below */}
            <section aria-label={t("discover.conversation", "Conversation")} className="space-y-4">
              <TurnList turns={state.turns} status={state.status} intent={intent} />
              <div className="hidden sm:block">
                <AskBox
                  value={text}
                  onChange={setText}
                  onSend={(m) => void ask(m)}
                  disabled={busy}
                />
              </div>
            </section>
          </div>

          {showMap && (
            <aside className="lg:sticky lg:top-6 lg:self-start">
              <MapPanel points={points} selected={selected} onSelect={setSelected} />
            </aside>
          )}
        </div>
      </main>

      {/* Phones: the box stays reachable above the keyboard and the home indicator. */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-background/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur sm:hidden">
        <AskBox value={text} onChange={setText} onSend={(m) => void ask(m)} disabled={busy} />
      </div>

      <PlaceSheet
        place={openPlace?.place ?? null}
        rank={openPlace?.rank ?? 0}
        signals={result?.places?.signals ?? []}
        kind={result?.places?.kind ?? null}
        prompt={state.lastPrompt}
        onClose={() => setOpenPlace(null)}
      />
    </div>
  );
}

/** The gathering answer: exact matches first, then alternatives that say what they miss. */
function EventSections({
  result,
  selected,
  onSelect,
  busy,
}: {
  result: NonNullable<ReturnType<typeof useDiscovery>["state"]["result"]>;
  selected: MapPoint | null;
  onSelect: (e: MapPoint) => void;
  busy: boolean;
}) {
  const { t } = useTranslation();
  const { edit } = useDiscovery();
  const c = result.constraints;
  return (
    <section aria-label={t("discover.results", "Results")} className="space-y-6">
      {result.matches.length > 0 && (
        <div>
          <h2 className="text-xs uppercase tracking-[0.3em] text-primary">
            {t("discover.exactMatches", {
              count: result.matches.length,
              defaultValue: "Meets every condition ({{count}})",
            })}
          </h2>
          <div className="stage-stagger mt-3 grid gap-4 md:grid-cols-2">
            {result.matches.map((e, i) => (
              <ResultCard
                key={e.id}
                event={e}
                kind="match"
                index={i}
                selected={selected?.id === e.id}
                onSelect={() => onSelect(e)}
              />
            ))}
          </div>
        </div>
      )}
      {result.alternatives.length > 0 && (
        <div>
          <h2 className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
            {result.matches.length > 0
              ? t("discover.alternatives", "Close, but not everything")
              : t("discover.alternativesOnly", "Not exact — each one says what it misses")}
          </h2>
          <div className="stage-stagger mt-3 grid gap-4 md:grid-cols-2">
            {result.alternatives.map((e, i) => (
              <ResultCard
                key={e.id}
                event={e}
                kind="alternative"
                index={i + result.matches.length}
                selected={selected?.id === e.id}
                onSelect={() => onSelect(e)}
              />
            ))}
          </div>
        </div>
      )}
      {result.matches.length === 0 && (
        <div className="flex flex-wrap gap-2" aria-label={t("discover.options", "Options")}>
          {c.when?.label !== "tomorrow" && (
            <Button
              size="sm"
              variant="outline"
              className="min-h-11"
              disabled={busy}
              onClick={() =>
                edit(
                  { when: windowFor("tomorrow", new Date()) },
                  t("discover.tomorrowOk", "Tomorrow works too"),
                )
              }
            >
              {t("discover.tomorrowOk", "Tomorrow works too")}
            </Button>
          )}
          {c.district && (
            <Button
              size="sm"
              variant="outline"
              className="min-h-11"
              disabled={busy}
              onClick={() =>
                edit({ district: null }, t("discover.nearbyDistricts", "Look at nearby districts"))
              }
            >
              {t("discover.nearbyDistricts", "Look at nearby districts")}
            </Button>
          )}
          {c.when?.label !== "this-week" && (
            <Button
              size="sm"
              variant="outline"
              className="min-h-11"
              disabled={busy}
              onClick={() =>
                edit(
                  { when: windowFor("this-week", new Date()) },
                  t("discover.thisWeekOk", "Any day this week"),
                )
              }
            >
              {t("discover.thisWeekOk", "Any day this week")}
            </Button>
          )}
          <Button asChild size="sm" variant="ghost" className="min-h-11">
            <Link to="/app/calendar">{t("discover.browseCalendar", "Browse the calendar")}</Link>
          </Button>
        </div>
      )}
      {result.matches.length === 0 && result.alternatives.length === 0 && (
        <div className="rounded-2xl border border-dashed border-primary/30 bg-card/60 p-6">
          <p className="font-display text-lg">
            {t("discover.nothingTitle", "No gathering fits this yet.")}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("discover.nothingBody", {
              checked: result.checked,
              defaultValue:
                "Agora checked {{checked}} upcoming listings. Change a condition above, or browse the calendar.",
            })}
          </p>
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        {t("discover.checkedNote", {
          checked: result.checked,
          when: whenLabel(t, c.when),
          defaultValue:
            "Checked {{checked}} real Agora listings for {{when}}. Prices and capacities come from the organiser's listing; unknown values are never assumed to fit.",
        })}
      </p>
    </section>
  );
}

const VIOLATION_KEYS: Record<Violation, [string, string]> = {
  date: ["discover.miss.date", "different date"],
  district: ["discover.miss.district", "different district"],
  budget: ["discover.miss.budget", "over budget"],
  interest: ["discover.miss.interest", "different interest"],
  group: ["discover.miss.group", "group size"],
};
const UNVERIFIED_KEYS: Record<Unverified, [string, string]> = {
  price: ["discover.unverified.price", "price not verified"],
  capacity: ["discover.unverified.capacity", "group size not listed"],
};

function ResultCard({
  event: e,
  kind,
  index,
  selected,
  onSelect,
}: {
  event: ScoredEvent;
  kind: "match" | "alternative";
  index: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const { t, i18n } = useTranslation();
  const saved = useSavedIds();
  const toggle = useSaveToggle();
  const isSaved = Boolean(saved.data?.events.includes(e.id));
  return (
    <article
      id={`card-${e.id}`}
      className={`flex scroll-mt-24 flex-col overflow-hidden rounded-[26px] border bg-card transition ${
        selected
          ? "border-primary/60 shadow-[0_20px_60px_-40px_color-mix(in_oklab,var(--primary)_60%,transparent)]"
          : "hover:border-primary/40"
      }`}
      style={{ "--i": index } as React.CSSProperties}
      onMouseEnter={onSelect}
      onFocus={onSelect}
    >
      <Link to="/app/event/$id" params={{ id: e.id }} className="block">
        <EventVisual title={e.title} category={e.category} tags={e.tags} />
      </Link>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.25em]">
            <span className={kind === "match" ? "text-primary" : "text-muted-foreground"}>
              {kind === "match"
                ? t("discover.cardMatch", "Meets your conditions")
                : t("discover.cardAlternative", "Alternative")}
            </span>
            {e.demo && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
                {t("common.demo", "Demo")}
              </span>
            )}
          </div>
          <button
            type="button"
            disabled={toggle.isPending}
            aria-pressed={isSaved}
            onClick={() =>
              toggle.mutate({ target: { kind: "event", refId: e.id }, saved: isSaved })
            }
            className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border transition ${
              isSaved
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border text-muted-foreground hover:border-primary hover:text-primary"
            }`}
            aria-label={
              isSaved
                ? t("save.removeLabel", {
                    name: e.title,
                    defaultValue: "Remove {{name}} from my plans",
                  })
                : t("save.addLabel", { name: e.title, defaultValue: "Save {{name}} to my plans" })
            }
          >
            {isSaved ? (
              <BookmarkCheck className="h-4 w-4" aria-hidden />
            ) : (
              <Bookmark className="h-4 w-4" aria-hidden />
            )}
          </button>
        </div>
        <Link
          to="/app/event/$id"
          params={{ id: e.id }}
          className="font-display text-xl leading-tight hover:underline"
        >
          {e.title}
        </Link>
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <CalendarDays className="h-3.5 w-3.5" aria-hidden />
            {formatWhenLocalized(e.starts_at, i18n.language)}
          </span>
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5" aria-hidden />
            {[e.district, e.venue].filter(Boolean).join(" · ") || e.city || "—"}
          </span>
          <span>{priceLabel(t, e.price)}</span>
          {typeof e.capacity === "number" && (
            <span className="inline-flex items-center gap-1">
              <Users className="h-3.5 w-3.5" aria-hidden />
              {t("event.capacity", { n: e.capacity, defaultValue: "up to {{n}} people" })}
            </span>
          )}
        </p>
        {e.organizations?.name && (
          <p className="text-sm">
            {t("event.hostedBy", "Hosted by")}{" "}
            {e.org_id ? (
              <Link
                to="/app/community/$id"
                params={{ id: e.org_id }}
                className="text-primary underline-offset-4 hover:underline"
              >
                {e.organizations.name}
              </Link>
            ) : (
              <span>{e.organizations.name}</span>
            )}
          </p>
        )}
        {kind === "alternative" ? (
          <p className="flex flex-wrap gap-1.5 text-xs">
            {e.violations.map((v) => (
              <span
                key={v}
                className="rounded-full border border-destructive/40 px-2 py-0.5 text-destructive"
              >
                {t(VIOLATION_KEYS[v][0], VIOLATION_KEYS[v][1])}
              </span>
            ))}
            {e.unverified.map((u) => (
              <span
                key={u}
                className="rounded-full border border-dashed px-2 py-0.5 text-muted-foreground"
              >
                {t(UNVERIFIED_KEYS[u][0], UNVERIFIED_KEYS[u][1])}
              </span>
            ))}
          </p>
        ) : (
          e._score > 0 && (
            <p className="text-xs text-muted-foreground">
              {t("discover.whyFits", "Why it fits")}:{" "}
              {e.tags
                .filter((tag) => tag !== "demo" && !tag.includes(":"))
                .slice(0, 4)
                .map((tag) => `#${tag}`)
                .join(" ")}
            </p>
          )
        )}
        <div className="mt-auto flex gap-2 pt-2">
          <Button asChild size="sm" className="min-h-11 flex-1">
            <Link to="/app/event/$id" params={{ id: e.id }}>
              {t("event.details", "Event details")}
            </Link>
          </Button>
          <LocationPreviewDialog
            place={e}
            trigger={
              <Button
                size="sm"
                variant="outline"
                className="min-h-11 min-w-11"
                aria-label={t("event.takeMeThere", "Take me there")}
              >
                <Navigation className="h-3.5 w-3.5" aria-hidden />
              </Button>
            }
          />
        </div>
      </div>
    </article>
  );
}

/** Google Maps panel (JS API with a keyless embed fallback); a helper view, never the only way through. */
function MapPanel({
  points,
  selected,
  onSelect,
}: {
  points: MapPoint[];
  selected: MapPoint | null;
  onSelect: (e: MapPoint) => void;
}) {
  const { t } = useTranslation();
  const mapRef = useRef<HTMLDivElement>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapFailed, setMapFailed] = useState(false);

  useEffect(() => {
    if (window.google?.maps) {
      setMapReady(true);
      return;
    }
    const key = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY;
    const tracking = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID;
    if (!key) {
      setMapFailed(true);
      return;
    }
    window.__agoraInitMap = () => setMapReady(true);
    window.gm_authFailure = () => setMapFailed(true);
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${key}&loading=async&callback=__agoraInitMap${tracking ? `&channel=${tracking}` : ""}`;
    s.async = true;
    s.onerror = () => setMapFailed(true);
    document.head.appendChild(s);
    const timeout = window.setTimeout(() => {
      if (!window.google?.maps) setMapFailed(true);
    }, 10_000);
    return () => {
      window.__agoraInitMap = undefined;
      window.clearTimeout(timeout);
    };
  }, []);

  useEffect(() => {
    if (!mapReady || !mapRef.current || !window.google?.maps) return;
    const withCoords = points.filter(
      (e) => typeof e.latitude === "number" && typeof e.longitude === "number",
    );
    const first = selected && typeof selected.latitude === "number" ? selected : withCoords[0];
    const center =
      first && typeof first.latitude === "number" && typeof first.longitude === "number"
        ? { lat: first.latitude, lng: first.longitude }
        : { lat: 41.0082, lng: 28.9784 };
    const map = new window.google.maps.Map(mapRef.current, {
      center,
      zoom: withCoords.length > 0 ? 13 : 10,
      disableDefaultUI: true,
      zoomControl: true,
    });
    withCoords.forEach((e) => {
      const marker = new window.google.maps.Marker({
        position: { lat: e.latitude!, lng: e.longitude! },
        map,
        title: e.title,
        label: selected?.id === e.id ? { text: "★", color: "#fff", fontSize: "16px" } : undefined,
      });
      marker.addListener("click", () => onSelect(e));
    });
  }, [mapReady, points, selected, onSelect]);

  return (
    <div className="relative h-[50vh] overflow-hidden rounded-3xl border bg-muted lg:h-[70vh]">
      <div ref={mapRef} className={`absolute inset-0 ${mapFailed ? "invisible" : ""}`}>
        {!mapReady && !mapFailed && (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            {t("discover.loadingMap", "Loading map…")}
          </div>
        )}
      </div>
      {mapFailed && (
        <iframe
          key={selected?.id ?? "default"}
          title={selected ? `Map of ${selected.title}` : "Map"}
          src={embedSrc(selected)}
          className="absolute inset-0 h-full w-full border-0"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
      )}
    </div>
  );
}
