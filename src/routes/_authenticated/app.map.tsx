import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import {
  ArrowLeft,
  CalendarDays,
  Compass,
  Map as MapIcon,
  MapPin,
  Navigation,
  Users,
} from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { EventVisual } from "@/components/EventVisual";
import { LocationPreviewDialog } from "@/components/LocationPreviewDialog";
import {
  AskInput,
  ConstraintChips,
  TurnList,
  whenLabel,
} from "@/components/discover/DiscoveryPanel";
import { formatWhenLocalized } from "@/components/guide/guide-format";
import { useDiscovery } from "@/lib/discovery-store";
import { windowFor, type ScoredEvent, type Unverified, type Violation } from "@/lib/discovery";

export const Route = createFileRoute("/_authenticated/app/map")({
  head: () => ({
    meta: [{ title: "Your gatherings — Agora" }, { name: "robots", content: "noindex, nofollow" }],
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

// Keyless Google Maps embed — the fallback when the Maps JS API can't load.
// The browser key is restricted to the website's domains, so it fails inside
// the iOS/Android app (whose origin is capacitor://localhost or https://localhost).
function embedSrc(
  e: Pick<ScoredEvent, "latitude" | "longitude" | "venue" | "city" | "title"> | null,
) {
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

function ResultsView() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { state, ask, edit, reset } = useDiscovery();
  const [showMap, setShowMap] = useState(false);
  const [selected, setSelected] = useState<ScoredEvent | null>(null);

  const result = state.result;
  const all = useMemo(() => (result ? [...result.matches, ...result.alternatives] : []), [result]);

  // No conversation in this tab → start at the compass.
  useEffect(() => {
    if (state.status === "idle" && !state.result && state.turns.length === 0)
      navigate({ to: "/app" });
  }, [state.status, state.result, state.turns.length, navigate]);

  useEffect(() => {
    if (!selected && all.length > 0) setSelected(all[0]);
  }, [all, selected]);

  const busy = state.status === "searching";

  return (
    <div className="min-h-screen bg-background">
      <AppHeader variant="member" />
      <main className="mx-auto max-w-6xl px-4 pb-32 pt-6 sm:px-6 sm:pb-12">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button
            variant="secondary"
            size="sm"
            className="gap-1"
            onClick={() => {
              reset();
              navigate({ to: "/app" });
            }}
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            {t("discover.newSearch", "New search")}
          </Button>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm" className="gap-1">
              <Link to="/app">
                <Compass className="h-4 w-4" aria-hidden /> {t("discover.backToCompass", "Compass")}
              </Link>
            </Button>
            <Button
              variant={showMap ? "default" : "outline"}
              size="sm"
              className="gap-1"
              aria-pressed={showMap}
              onClick={() => setShowMap((v) => !v)}
            >
              <MapIcon className="h-4 w-4" aria-hidden />
              {showMap ? t("discover.hideMap", "Hide map") : t("discover.showMap", "Show map")}
            </Button>
          </div>
        </div>

        <div
          className={`mt-6 grid gap-8 ${showMap ? "lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]" : ""}`}
        >
          <div className="min-w-0 space-y-8">
            {/* Conversation + conditions */}
            <section aria-label={t("discover.conversation", "Conversation")} className="space-y-4">
              {state.constraints && (
                <ConstraintChips constraints={state.constraints} onEdit={edit} disabled={busy} />
              )}
              <TurnList turns={state.turns} status={state.status} />
              {state.status === "empty" && state.constraints && (
                <div className="flex flex-wrap gap-2" aria-label={t("discover.options", "Options")}>
                  {state.constraints.when?.label !== "tomorrow" && (
                    <Button
                      size="sm"
                      variant="outline"
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
                  {state.constraints.district && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() =>
                        edit(
                          { district: null },
                          t("discover.nearbyDistricts", "Look at nearby districts"),
                        )
                      }
                    >
                      {t("discover.nearbyDistricts", "Look at nearby districts")}
                    </Button>
                  )}
                  {state.constraints.when?.label !== "this-week" && (
                    <Button
                      size="sm"
                      variant="outline"
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
                  <Button asChild size="sm" variant="ghost">
                    <Link to="/app/calendar">
                      {t("discover.browseCalendar", "Browse the calendar")}
                    </Link>
                  </Button>
                </div>
              )}
              <div className="hidden sm:block">
                <AskInput onSend={(text) => ask(text)} disabled={busy} />
              </div>
            </section>

            {/* Results */}
            {result && (
              <section aria-label={t("discover.results", "Results")} className="space-y-6">
                {result.matches.length > 0 && (
                  <div>
                    <h2 className="text-xs uppercase tracking-[0.3em] text-primary">
                      {t("discover.exactMatches", {
                        count: result.matches.length,
                        defaultValue: "Meets every condition ({{count}})",
                      })}
                    </h2>
                    <div className="mt-3 grid gap-4 md:grid-cols-2">
                      {result.matches.map((e) => (
                        <ResultCard
                          key={e.id}
                          event={e}
                          kind="match"
                          selected={selected?.id === e.id}
                          onSelect={() => setSelected(e)}
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
                        : t(
                            "discover.alternativesOnly",
                            "Not exact — each one says what it misses",
                          )}
                    </h2>
                    <div className="mt-3 grid gap-4 md:grid-cols-2">
                      {result.alternatives.map((e) => (
                        <ResultCard
                          key={e.id}
                          event={e}
                          kind="alternative"
                          selected={selected?.id === e.id}
                          onSelect={() => setSelected(e)}
                        />
                      ))}
                    </div>
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
                    when: whenLabel(t, result.constraints.when),
                    defaultValue:
                      "Checked {{checked}} real Agora listings for {{when}}. Prices and capacities come from the organiser's listing; unknown values are never assumed to fit.",
                  })}
                </p>
              </section>
            )}
          </div>

          {showMap && (
            <aside className="lg:sticky lg:top-6 lg:self-start">
              <MapPanel events={all} selected={selected} onSelect={setSelected} />
            </aside>
          )}
        </div>
      </main>

      {/* Mobile: the input stays reachable above the keyboard and the home indicator. */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-background/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur sm:hidden">
        <AskInput onSend={(text) => ask(text)} disabled={busy} />
      </div>
    </div>
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
  selected,
  onSelect,
}: {
  event: ScoredEvent;
  kind: "match" | "alternative";
  selected: boolean;
  onSelect: () => void;
}) {
  const { t, i18n } = useTranslation();
  return (
    <article
      className={`flex flex-col overflow-hidden rounded-3xl border bg-card transition ${
        selected
          ? "border-primary/60 shadow-[0_20px_60px_-40px_color-mix(in_oklab,var(--primary)_60%,transparent)]"
          : "hover:border-primary/40"
      }`}
      onMouseEnter={onSelect}
      onFocus={onSelect}
    >
      <Link to="/app/event/$id" params={{ id: e.id }} className="block">
        <EventVisual title={e.title} category={e.category} tags={e.tags} />
      </Link>
      <div className="flex flex-1 flex-col gap-2 p-4">
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
          <Button asChild size="sm" className="flex-1">
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
  events,
  selected,
  onSelect,
}: {
  events: ScoredEvent[];
  selected: ScoredEvent | null;
  onSelect: (e: ScoredEvent) => void;
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
    const withCoords = events.filter(
      (e) => typeof e.latitude === "number" && typeof e.longitude === "number",
    );
    const first = selected && typeof selected.latitude === "number" ? selected : withCoords[0];
    const center =
      first && typeof first.latitude === "number" && typeof first.longitude === "number"
        ? { lat: first.latitude, lng: first.longitude }
        : { lat: 41.0082, lng: 28.9784 };
    const map = new window.google.maps.Map(mapRef.current, {
      center,
      zoom: withCoords.length > 0 ? 12 : 10,
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
  }, [mapReady, events, selected, onSelect]);

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
