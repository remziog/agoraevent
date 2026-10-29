import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import {
  Bookmark,
  BookmarkCheck,
  ChevronDown,
  Database,
  MapPin,
  Navigation,
  Sparkles,
  Star,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { LocationPreviewDialog } from "@/components/LocationPreviewDialog";
import type {
  DiscoverPlace,
  DiscoverQuestion,
  DiscoverTraceStep,
  PlacesResult,
  TasteSignal,
} from "@/lib/events.functions";
import type { QlooCall } from "@/lib/qloo.schemas";
import { useSaveToggle, useSavedIds } from "@/lib/use-saved";

/** Business rating with one decimal, localized (UI-29-01). Never confused with Qloo affinity. */
export function formatRating(rating: number | undefined, lang: string): string | null {
  if (typeof rating !== "number" || !Number.isFinite(rating)) return null;
  return rating.toLocaleString(lang, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

export function priceMarks(level: number | undefined): string | null {
  if (typeof level !== "number" || !Number.isFinite(level) || level <= 0) return null;
  return "₺".repeat(Math.min(4, Math.max(1, Math.round(level))));
}

/** The favourites Qloo is ranking for, as chips; each can be dropped from the conversation. */
export function SignalChips({
  signals,
  unknownTerms,
  onRemove,
  disabled,
}: {
  signals: TasteSignal[];
  unknownTerms?: string[];
  onRemove: (entityId: string) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  if (signals.length === 0 && (!unknownTerms || unknownTerms.length === 0)) return null;
  return (
    <div
      className="flex flex-wrap items-center gap-2"
      aria-label={t("discover.signals", "Your taste")}
    >
      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.25em] text-primary">
        <QlooMark /> {t("discover.rankedFor", "Qloo ranks for")}
      </span>
      {signals.map((s) => (
        <button
          key={s.entityId}
          type="button"
          disabled={disabled}
          onClick={() => onRemove(s.entityId)}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-primary/40 bg-primary/5 px-3 py-1 text-xs text-foreground disabled:opacity-50 sm:min-h-9"
          aria-label={t("discover.removeSignal", {
            name: s.name,
            defaultValue: "Stop ranking for {{name}}",
          })}
          title={
            s.source === "profile"
              ? t("discover.signalFromProfile", "From your taste profile")
              : t("discover.signalFromRequest", "From your request")
          }
        >
          {s.name}
          {s.type && (
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {typeWord(t, s.type)}
            </span>
          )}
          {s.source === "profile" && (
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {t("discover.profileShort", "profile")}
            </span>
          )}
          <X className="h-3 w-3 text-muted-foreground" aria-hidden />
        </button>
      ))}
      {unknownTerms && unknownTerms.length > 0 && (
        <span className="text-xs text-muted-foreground">
          {t("discover.unknownTerms", {
            terms: unknownTerms.join(", "),
            defaultValue: "Qloo doesn't know: {{terms}}",
          })}
        </span>
      )}
    </div>
  );
}

function typeWord(t: TFunction, type: string): string {
  const key = type.replace(/^urn:entity:/, "");
  return t(`discover.entityType.${key}`, {
    defaultValue: key.replace(/_/g, " "),
  });
}

export function QlooMark({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] font-semibold text-primary-foreground ${className}`}
      aria-hidden
    >
      Q
    </span>
  );
}

/** Agora's one question before it can run: a district, or which favourite was meant. */
export function QuestionCard({
  question,
  onDistrict,
  onTaste,
  disabled,
}: {
  question: DiscoverQuestion;
  onDistrict: (district: string) => void;
  onTaste: (answers: { term: string; entityId: string | null }[]) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const [choice, setChoice] = useState<Record<string, string | null>>({});
  if (question.kind === "district") {
    return (
      <div className="stage-rise rounded-3xl border border-primary/40 bg-card p-5 shadow-[0_20px_60px_-40px_color-mix(in_oklab,var(--primary)_60%,transparent)]">
        <p className="text-[10px] uppercase tracking-[0.3em] text-primary">
          {t("discover.oneQuestion", "One question")}
        </p>
        <p className="mt-1 font-display text-2xl leading-tight">
          {t("discover.whichDistrict", "Which district?")}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {t(
            "discover.whichDistrictHint",
            "Qloo ranks places by neighbourhood. Pick one, or type another in the box below.",
          )}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {question.options.map((d) => (
            <button
              key={d}
              type="button"
              disabled={disabled}
              onClick={() => onDistrict(d)}
              className="min-h-11 rounded-full border border-primary/30 bg-background px-4 py-2 text-sm transition hover:border-primary hover:bg-primary hover:text-primary-foreground disabled:opacity-50"
            >
              {d}
            </button>
          ))}
        </div>
      </div>
    );
  }
  const complete = question.items.every((i) => i.term in choice);
  return (
    <div className="stage-rise rounded-3xl border border-primary/40 bg-card p-5 shadow-[0_20px_60px_-40px_color-mix(in_oklab,var(--primary)_60%,transparent)]">
      <p className="text-[10px] uppercase tracking-[0.3em] text-primary">
        {t("discover.oneQuestion", "One question")}
      </p>
      <p className="mt-1 font-display text-2xl leading-tight">
        {t("discover.whichOne", "Which one did you mean?")}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        {t(
          "discover.whichOneHint",
          "Qloo found more than one. Agora only ranks for what you confirm.",
        )}
      </p>
      <div className="mt-4 space-y-4">
        {question.items.map((item) => (
          <fieldset key={item.term} className="space-y-1.5">
            <legend className="text-sm font-medium">“{item.term}”</legend>
            {item.candidates.map((c) => (
              <label
                key={c.entityId}
                className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary/5"
              >
                <input
                  type="radio"
                  name={`taste-${item.term}`}
                  value={c.entityId}
                  checked={choice[item.term] === c.entityId}
                  onChange={() => setChoice((s) => ({ ...s, [item.term]: c.entityId }))}
                  className="accent-[var(--primary)]"
                />
                <span className="min-w-0">
                  <span className="block">{c.name}</span>
                  <span className="block text-xs text-muted-foreground">
                    {[c.type ? typeWord(t, c.type) : null, c.disambiguation]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
              </label>
            ))}
            <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-dashed px-3 py-2 text-sm text-muted-foreground has-[:checked]:border-primary">
              <input
                type="radio"
                name={`taste-${item.term}`}
                value=""
                checked={item.term in choice && choice[item.term] === null}
                onChange={() => setChoice((s) => ({ ...s, [item.term]: null }))}
                className="accent-[var(--primary)]"
              />
              {t("discover.skipTerm", "None of these — leave it out")}
            </label>
          </fieldset>
        ))}
      </div>
      <Button
        className="mt-4 min-h-11"
        disabled={disabled || !complete}
        onClick={() =>
          onTaste(question.items.map((i) => ({ term: i.term, entityId: choice[i.term] ?? null })))
        }
      >
        {t("discover.confirmAndRank", "Confirm and rank")}
      </Button>
    </div>
  );
}

function savedPayload(p: DiscoverPlace, kind: string | null, prompt: string | null) {
  return {
    name: p.name,
    district: p.district,
    kind,
    address: p.address,
    rating: p.rating,
    priceLevel: p.priceLevel,
    geocode: p.geocode,
    drivers: p.drivers.slice(0, 6),
    cuisineTags: p.cuisineTags,
    prompt: prompt?.slice(0, 200),
  };
}

/** Qloo-ranked places: the answer to a restaurant / place request. */
export function PlaceResults({
  places,
  prompt,
  onOpen,
}: {
  places: PlacesResult;
  prompt: string | null;
  onOpen: (p: DiscoverPlace, rank: number) => void;
}) {
  const { t, i18n } = useTranslation();
  const saved = useSavedIds();
  const toggle = useSaveToggle();
  const savedPlaces = new Set(saved.data?.places ?? []);
  const personal = places.signals.length > 0;
  return (
    <section
      aria-label={t("discover.placesSection", "Places ranked by Qloo")}
      className="space-y-3"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-primary">
          <QlooMark />
          {personal
            ? t("discover.placesForYou", {
                district: places.district,
                defaultValue: "Ranked for your taste · {{district}}",
              })
            : t("discover.placesPopular", {
                district: places.district,
                defaultValue: "Popular on Qloo · {{district}}",
              })}
        </h2>
        <span className="text-xs text-muted-foreground">
          {t("discover.placesCount", {
            count: places.items.length,
            defaultValue: "{{count}} places",
          })}
        </span>
      </div>
      <div className="stage-stagger grid gap-4 md:grid-cols-2">
        {places.items.map((p, i) => {
          const rating = formatRating(p.rating, i18n.language);
          const price = priceMarks(p.priceLevel);
          const isSaved = savedPlaces.has(p.qlooEntityId);
          return (
            <article
              key={p.qlooEntityId}
              className="flex min-w-0 flex-col gap-3 overflow-hidden rounded-3xl border bg-card p-4 transition hover:border-primary/40"
              style={{ "--i": i } as React.CSSProperties}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-[0.25em] text-primary">
                    {personal
                      ? t("discover.qlooRank", { n: i + 1, defaultValue: "Qloo #{{n}} for you" })
                      : t("discover.qlooPopularRank", {
                          n: i + 1,
                          defaultValue: "Qloo #{{n}} · popular",
                        })}
                  </p>
                  <button
                    type="button"
                    onClick={() => onOpen(p, i + 1)}
                    className="mt-1 text-left font-display text-2xl leading-tight hover:underline"
                  >
                    {p.name}
                  </button>
                </div>
                <button
                  type="button"
                  disabled={toggle.isPending}
                  aria-pressed={isSaved}
                  onClick={() =>
                    toggle.mutate({
                      target: {
                        kind: "place",
                        refId: p.qlooEntityId,
                        payload: savedPayload(p, places.kind, prompt),
                      },
                      saved: isSaved,
                    })
                  }
                  className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border transition ${
                    isSaved
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border text-muted-foreground hover:border-primary hover:text-primary"
                  }`}
                  aria-label={
                    isSaved
                      ? t("save.removeLabel", {
                          name: p.name,
                          defaultValue: "Remove {{name}} from my plans",
                        })
                      : t("save.addLabel", {
                          name: p.name,
                          defaultValue: "Save {{name}} to my plans",
                        })
                  }
                >
                  {isSaved ? (
                    <BookmarkCheck className="h-4 w-4" aria-hidden />
                  ) : (
                    <Bookmark className="h-4 w-4" aria-hidden />
                  )}
                </button>
              </div>

              <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                {rating && (
                  <span
                    className="inline-flex items-center gap-1"
                    title={t(
                      "discover.ratingNote",
                      "Business rating (Qloo data) — not your taste match",
                    )}
                  >
                    <Star className="h-3.5 w-3.5 fill-current text-primary" aria-hidden /> {rating}
                  </span>
                )}
                {price && <span aria-label={t("discover.priceLevel", "Price level")}>{price}</span>}
                <span className="inline-flex min-w-0 max-w-full items-center gap-1">
                  <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  <span className="min-w-0 truncate">{p.address ?? p.district}</span>
                </span>
              </p>
              {p.cuisineTags.length > 0 && (
                <p className="flex flex-wrap gap-1.5 text-xs">
                  {p.cuisineTags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground"
                    >
                      {tag}
                    </span>
                  ))}
                </p>
              )}
              {personal && (
                <p className="text-xs text-muted-foreground">
                  {p.drivers.length > 0 ? (
                    <>
                      <Sparkles className="mr-1 inline h-3 w-3 text-primary" aria-hidden />
                      {t("discover.whyYou", "Why it fits you")}:{" "}
                      <span className="text-foreground">{p.drivers.join(" · ")}</span>
                    </>
                  ) : (
                    t(
                      "discover.whyYouGeneral",
                      "Ranked by Qloo for your favourites together — no single one stands out.",
                    )
                  )}
                </p>
              )}
              <div className="mt-auto flex gap-2 pt-1">
                <Button size="sm" className="min-h-11 flex-1" onClick={() => onOpen(p, i + 1)}>
                  {t("discover.placeDetails", "Why this place")}
                </Button>
                <LocationPreviewDialog
                  place={{
                    title: p.name,
                    venue: p.address ?? null,
                    city: "Istanbul",
                    latitude: p.geocode?.latitude ?? null,
                    longitude: p.geocode?.longitude ?? null,
                  }}
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
            </article>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        {personal
          ? t(
              "discover.placesNote",
              "Order = Qloo's taste affinity for the favourites above. ★ = the business's own rating in Qloo's data. Agora makes no reservations.",
            )
          : t(
              "discover.placesNotePopular",
              "Order = Qloo's popularity for this district (no favourite named). ★ = the business's own rating in Qloo's data. Agora makes no reservations.",
            )}
      </p>
    </section>
  );
}

/** Detail sheet for a place: what Qloo credited, where it is, save. */
export function PlaceSheet({
  place,
  rank,
  signals,
  kind,
  prompt,
  onClose,
}: {
  place: DiscoverPlace | null;
  rank: number;
  signals: TasteSignal[];
  kind: string | null;
  prompt: string | null;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation();
  const saved = useSavedIds();
  const toggle = useSaveToggle();
  const isSaved = Boolean(place && saved.data?.places.includes(place.qlooEntityId));
  const rating = formatRating(place?.rating, i18n.language);
  const price = priceMarks(place?.priceLevel);
  return (
    <Sheet open={place !== null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        {place && (
          <>
            <SheetHeader className="text-left">
              <p className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-primary">
                <QlooMark />
                {signals.length > 0
                  ? t("discover.qlooRank", { n: rank, defaultValue: "Qloo #{{n}} for you" })
                  : t("discover.qlooPopularRank", {
                      n: rank,
                      defaultValue: "Qloo #{{n}} · popular",
                    })}
              </p>
              <SheetTitle className="font-display text-3xl leading-tight">{place.name}</SheetTitle>
              <SheetDescription>
                {[place.address ?? place.district, rating ? `★ ${rating}` : null, price]
                  .filter(Boolean)
                  .join(" · ")}
              </SheetDescription>
            </SheetHeader>
            <div className="mt-6 space-y-5 text-sm">
              {place.imageUrl && (
                <img
                  src={place.imageUrl}
                  alt=""
                  className="h-44 w-full rounded-2xl object-cover"
                  loading="lazy"
                />
              )}
              <div>
                <p className="text-[10px] uppercase tracking-[0.25em] text-primary">
                  {t("discover.whyYou", "Why it fits you")}
                </p>
                {signals.length === 0 ? (
                  <p className="mt-1 text-muted-foreground">
                    {t(
                      "discover.whyPopular",
                      "No favourite was named, so this is Qloo's popularity ranking for the district. Name an artist, film or book to make it yours.",
                    )}
                  </p>
                ) : place.drivers.length > 0 ? (
                  <p className="mt-1">
                    {t("discover.creditedTo", {
                      names: place.drivers.join(", "),
                      defaultValue: "Qloo's explainability credits this pick to: {{names}}.",
                    })}
                  </p>
                ) : (
                  <p className="mt-1 text-muted-foreground">
                    {t(
                      "discover.whyYouGeneral",
                      "Ranked by Qloo for your favourites together — no single one stands out.",
                    )}
                  </p>
                )}
                {typeof place.affinity === "number" && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t("discover.affinity", {
                      value: Math.round(place.affinity * 100),
                      defaultValue: "Qloo affinity {{value}}/100 (taste match, not a rating)",
                    })}
                  </p>
                )}
              </div>
              {place.cuisineTags.length > 0 && (
                <div>
                  <p className="text-[10px] uppercase tracking-[0.25em] text-primary">
                    {t("discover.placeTags", "Qloo tags")}
                  </p>
                  <p className="mt-1 flex flex-wrap gap-1.5">
                    {place.cuisineTags.map((tag) => (
                      <span key={tag} className="rounded-full bg-muted px-2 py-0.5 text-xs">
                        {tag}
                      </span>
                    ))}
                  </p>
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                {t(
                  "discover.placeSource",
                  "Place, address, rating and price level come from Qloo's data. Agora makes no reservation — check opening hours with the venue.",
                )}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  className="min-h-11"
                  variant={isSaved ? "outline" : "default"}
                  disabled={toggle.isPending}
                  aria-pressed={isSaved}
                  onClick={() =>
                    toggle.mutate({
                      target: {
                        kind: "place",
                        refId: place.qlooEntityId,
                        payload: savedPayload(place, kind, prompt),
                      },
                      saved: isSaved,
                    })
                  }
                >
                  {isSaved ? (
                    <>
                      <BookmarkCheck className="h-4 w-4" aria-hidden />{" "}
                      {t("save.saved", "Saved to my plans")}
                    </>
                  ) : (
                    <>
                      <Bookmark className="h-4 w-4" aria-hidden />{" "}
                      {t("save.save", "Save to my plans")}
                    </>
                  )}
                </Button>
                <LocationPreviewDialog
                  place={{
                    title: place.name,
                    venue: place.address ?? null,
                    city: "Istanbul",
                    latitude: place.geocode?.latitude ?? null,
                    longitude: place.geocode?.longitude ?? null,
                  }}
                  trigger={
                    <Button variant="outline" className="min-h-11">
                      <Navigation className="h-4 w-4" aria-hidden />{" "}
                      {t("event.takeMeThere", "Take me there")}
                    </Button>
                  }
                />
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

/** "How Agora decided" — every step with its source; Qloo lines carry the redacted call trace. */
export function DecisionTrace({ trace }: { trace: DiscoverTraceStep[] }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  if (trace.length === 0) return null;
  return (
    <div className="rounded-2xl border bg-card/60">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex min-h-11 w-full items-center justify-between gap-2 px-4 py-2 text-left text-sm"
      >
        <span>{t("discover.howDecided", "How Agora decided")}</span>
        <ChevronDown className={`h-4 w-4 transition ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>
      {open && (
        <ol className="space-y-2 border-t px-4 py-3 text-xs">
          {trace.map((step, i) => (
            <li key={i} className="flex gap-2">
              {step.source === "qloo" ? (
                <QlooMark className="mt-0.5" />
              ) : step.source === "ai" ? (
                <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
              ) : (
                <Database className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              )}
              <div className="min-w-0">
                <p>
                  {step.label}
                  {typeof step.ms === "number" && (
                    <span className="text-muted-foreground"> · {step.ms} ms</span>
                  )}
                </p>
                {step.qloo?.map((c, j) => (
                  <p key={j} className="font-mono text-[11px] text-muted-foreground">
                    {callLine(c)}
                  </p>
                ))}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function callLine(c: QlooCall): string {
  const counts: string[] = [];
  if (typeof c.upstreamCount === "number") counts.push(`${c.upstreamCount} upstream`);
  if (typeof c.resultCount === "number") counts.push(`${c.resultCount} parsed`);
  if (typeof c.rejectedCount === "number" && c.rejectedCount > 0)
    counts.push(`${c.rejectedCount} unreadable`);
  if (typeof c.matchedCount === "number") counts.push(`${c.matchedCount} in shortlist`);
  const params = Object.entries(c.params)
    .filter(([k]) => !/signal|entities/.test(k))
    .map(([k, v]) => `${k}=${String(v).slice(0, 40)}`)
    .join(" ");
  return `${c.endpoint} ${params} → HTTP ${c.status}${counts.length ? ` · ${counts.join(" · ")}` : ""}${c.error ? ` · ${c.error}` : ""} (${c.ms} ms)`;
}
