import { useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import {
  BookOpen,
  CalendarDays,
  Compass,
  Info,
  MapPin,
  Navigation,
  RotateCcw,
  Sparkles,
  Star,
  UtensilsCrossed,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { LandmarkDetailsDrawer } from "@/components/LandmarkDetailsDrawer";
import { LocationPreviewDialog } from "@/components/LocationPreviewDialog";
import type { GuidePick, GuidePlan } from "@/lib/guide.types";
import { ISTANBUL_LANDMARKS, type Landmark } from "@/lib/istanbul-landmarks";
import { getLandmarkStory } from "@/lib/landmark-stories";
import { formatWhenLocalized, joinNames, mapsSearchUrl } from "./guide-format";
import { GuideTrace } from "./GuideTrace";
import { useDiscovery } from "@/lib/discovery-store";
import { DISTRICTS, windowFor } from "@/lib/discovery";

const landmarkById = new Map(ISTANBUL_LANDMARKS.map((l) => [l.id, l]));

export function GuideResults({ plan, onRestart }: { plan: GuidePlan; onRestart: () => void }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const discovery = useDiscovery();
  const [openLandmark, setOpenLandmark] = useState<{
    landmark: Landmark;
    startWith?: string;
  } | null>(null);
  const diningLandmark = plan.dining ? landmarkById.get(plan.dining.landmarkId) : undefined;
  const gatheringLandmark = plan.gatherings?.landmarkId
    ? landmarkById.get(plan.gatherings.landmarkId)
    : undefined;
  const qlooRanked =
    plan.execution.ranking === "ranked" && plan.picks.some((p) => p.source === "qloo");
  const editorialOnly = plan.picks.length > 0 && plan.picks.every((p) => p.source === "editorial");

  return (
    <div className="space-y-12">
      <header className="space-y-4">
        <p className="text-xs uppercase tracking-[0.3em] text-primary">
          {qlooRanked
            ? t("guide.rankedKicker", "Taste guide · ranked with Qloo")
            : t("guide.unrankedKicker", "Taste guide · Qloo returned no ranking")}
        </p>
        <h1 className="font-display text-4xl leading-tight sm:text-5xl">
          {qlooRanked
            ? t("guide.title", "Your Istanbul, by taste.")
            : t("guide.unrankedTitle", "Istanbul, while Qloo finds its footing.")}
        </h1>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">{t("guide.from", "From")}</span>
          {plan.taste.map((e) => (
            <span
              key={e.entityId}
              className="rounded-full border border-primary/30 bg-primary/5 px-3 py-1"
            >
              {e.name}
            </span>
          ))}
          {plan.mood && <span className="text-muted-foreground">· “{plan.mood}”</span>}
        </div>
        {plan.summary && (
          <p className="max-w-2xl text-lg leading-relaxed text-foreground/90">
            {plan.summary}{" "}
            <span className="whitespace-nowrap text-[10px] uppercase tracking-widest text-muted-foreground">
              {t("guide.agentNote", "Agora's agent · AI")}
            </span>
          </p>
        )}
        {plan.notice && (
          <p
            className="flex max-w-2xl items-start gap-2 rounded-xl border border-dashed p-3 text-sm text-muted-foreground"
            role="status"
          >
            <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            {plan.notice}
          </p>
        )}
      </header>

      {plan.picks.length > 0 ? (
        <section aria-label={t("guide.picksLabel", "Landmark picks")}>
          {editorialOnly && (
            <p className="mb-4 text-xs uppercase tracking-[0.3em] text-muted-foreground">
              {t("guide.editorialHeading", "Agora's editorial landmarks · not personalised")}
            </p>
          )}
          <div className="grid gap-5 lg:grid-cols-3">
            {plan.picks.map((pick) => {
              const landmark = landmarkById.get(pick.landmarkId);
              if (!landmark) return null;
              return (
                <PickCard
                  key={pick.landmarkId}
                  pick={pick}
                  landmark={landmark}
                  onOpen={() => setOpenLandmark({ landmark, startWith: pick.storySectionTitle })}
                />
              );
            })}
          </div>
        </section>
      ) : (
        <p className="rounded-2xl border border-dashed p-8 text-center text-muted-foreground">
          {t("guide.noPicks", "Nothing to show for these favourites yet.")}
        </p>
      )}

      {plan.dining && diningLandmark && (
        <section>
          <SectionTitle
            icon={<UtensilsCrossed className="h-3.5 w-3.5" aria-hidden />}
            eyebrow={t("guide.near", { name: diningLandmark.title, defaultValue: "Near {{name}}" })}
            title={
              plan.dining.scope === "places"
                ? t("guide.placesNearby", "Places nearby, matched to you")
                : t("guide.eatNearby", "Eat nearby, matched to you")
            }
          />
          {plan.dining.restaurants.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">
              {t("guide.noRestaurants", {
                district: plan.dining.district,
                defaultValue:
                  "Qloo has no restaurants it can rank for you in {{district}} right now.",
              })}
            </p>
          ) : (
            <div className="mt-5 grid gap-4 md:grid-cols-3">
              {plan.dining.restaurants.map((r, i) => {
                const drivers = plan.dining?.drivers[r.qlooEntityId] ?? [];
                return (
                  <article
                    key={r.qlooEntityId}
                    className="flex flex-col rounded-2xl border bg-card p-5"
                  >
                    <p className="text-[10px] uppercase tracking-widest text-primary">
                      {t("guide.qlooRankIn", {
                        n: i + 1,
                        district: r.district,
                        defaultValue: "Qloo #{{n}} in {{district}}",
                      })}
                    </p>
                    <h3 className="mt-1 font-display text-xl leading-snug">{r.name}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {[
                        r.cuisineTags.join(", "),
                        r.priceLevel
                          ? "$".repeat(Math.min(4, Math.max(1, Math.round(r.priceLevel))))
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                      {r.rating ? (
                        <span className="ml-1 inline-flex items-center gap-0.5">
                          · <Star className="h-3 w-3 fill-current" aria-hidden /> {r.rating}
                        </span>
                      ) : null}
                    </p>
                    {r.address && <p className="mt-2 text-xs text-muted-foreground">{r.address}</p>}
                    <p className="mt-3 text-sm">
                      {drivers.length > 0 ? (
                        <>
                          {t("guide.qlooCredits", "Qloo credits")}{" "}
                          <strong>{joinNames(drivers)}</strong>
                        </>
                      ) : (
                        <span className="text-muted-foreground">
                          {t("guide.rankedForYou", "Ranked by Qloo for your favourites")}
                        </span>
                      )}
                    </p>
                    <a
                      href={mapsSearchUrl(r.name, r.address)}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-auto inline-flex items-center gap-1.5 pt-4 text-sm text-primary underline-offset-4 hover:underline"
                    >
                      <Navigation className="h-3.5 w-3.5" aria-hidden />{" "}
                      {t("guide.directions", "Directions")}
                    </a>
                  </article>
                );
              })}
            </div>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            {t("guide.diningFootnote", {
              district: plan.dining.district,
              defaultValue:
                "Ranked by Qloo's taste graph for your favourites, within {{district}}. Qloo reads taste in aggregate; it knows nothing about you personally.",
            })}
          </p>
        </section>
      )}

      {plan.gatherings && (
        <section>
          <SectionTitle
            icon={<CalendarDays className="h-3.5 w-3.5" aria-hidden />}
            eyebrow={
              gatheringLandmark
                ? t("guide.withinKm", {
                    name: gatheringLandmark.title,
                    defaultValue: "Within 3 km of {{name}}",
                  })
                : t("guide.acrossCity", "Across Istanbul")
            }
            title={t("guide.gatheringsTitle", "Gatherings this week")}
          />
          {plan.gatherings.events.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">
              {gatheringLandmark
                ? t("guide.noGatheringsNear", "No Agora gatherings near here in the next 7 days.")
                : t("guide.noGatherings", "No Agora gatherings in the next 7 days.")}
            </p>
          ) : (
            <ul className="mt-5 space-y-3">
              {plan.gatherings.events.map((e) => (
                <li key={e.id}>
                  <Link
                    to="/app/event/$id"
                    params={{ id: e.id }}
                    className="flex items-start justify-between gap-4 rounded-2xl border bg-card p-4 transition hover:border-primary/50"
                  >
                    <span>
                      <span className="font-display text-lg">{e.title}</span>
                      {e.sample && (
                        <span className="ml-2 rounded-full bg-muted px-2 py-0.5 align-middle text-[10px] uppercase tracking-widest text-muted-foreground">
                          {t("common.demo", "Demo")}
                        </span>
                      )}
                      <span className="mt-0.5 block text-sm text-muted-foreground">
                        {[e.organizer, e.venue].filter(Boolean).join(" · ")}
                        {gatheringLandmark ? ` · ${e.distanceKm} km` : ""}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatWhenLocalized(e.startsAt, i18n.language)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            {t(
              "guide.gatheringsFootnote",
              "Agora community gatherings — Agora's own listings, not Qloo data. “Demo” marks sample listings created for the hackathon.",
            )}
          </p>
        </section>
      )}

      {plan.unmatchedLandmarkIds.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {t("guide.unmatched", {
            n: plan.unmatchedLandmarkIds.length,
            total: ISTANBUL_LANDMARKS.length,
            names: plan.unmatchedLandmarkIds
              .map((id) => landmarkById.get(id)?.title)
              .filter(Boolean)
              .join(", "),
            defaultValue:
              "{{n}} of Agora's {{total}} landmarks aren't in Qloo's graph yet ({{names}}), so they aren't ranked here.",
          })}
        </p>
      )}

      <GuideTrace plan={plan} />

      <div className="flex flex-wrap justify-center gap-3">
        <Button variant="outline" className="gap-2 rounded-full" onClick={onRestart}>
          <RotateCcw className="h-4 w-4" aria-hidden />{" "}
          {t("guide.tryOthers", "Try other favourites")}
        </Button>
        {/* The guide's implicit window (next 7 days, near the first pick) becomes explicit,
            editable compass conditions instead of a silent query. */}
        <Button
          variant="ghost"
          className="gap-2 rounded-full"
          disabled={discovery.state.status === "searching"}
          onClick={() => {
            const first = plan.picks[0] ? landmarkById.get(plan.picks[0].landmarkId) : undefined;
            const district = first
              ? (DISTRICTS.find((d) => d.name === first.district)?.name ?? null)
              : null;
            void discovery.edit(
              {
                intent: "event",
                placeKind: null,
                district,
                when: windowFor("this-week", new Date()),
              },
              district
                ? t("guide.exploreNear", {
                    district,
                    defaultValue: "Gatherings near {{district}} this week",
                  })
                : t("guide.exploreThisWeek", "Gatherings this week"),
            );
            navigate({ to: "/app/map", viewTransition: true });
          }}
        >
          <Compass className="h-4 w-4" aria-hidden />{" "}
          {t("guide.exploreGatherings", "Explore gatherings")}
        </Button>
      </div>

      <LandmarkDetailsDrawer
        landmark={openLandmark?.landmark ?? null}
        startWith={openLandmark?.startWith}
        open={openLandmark !== null}
        onOpenChange={(o) => !o && setOpenLandmark(null)}
      />
    </div>
  );
}

function SectionTitle({
  icon,
  eyebrow,
  title,
}: {
  icon: React.ReactNode;
  eyebrow: string;
  title: string;
}) {
  return (
    <div>
      <p className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-primary">
        {icon}
        {eyebrow}
      </p>
      <h2 className="mt-2 font-display text-3xl">{title}</h2>
    </div>
  );
}

function PickCard({
  pick,
  landmark,
  onOpen,
}: {
  pick: GuidePick;
  landmark: Landmark;
  onOpen: () => void;
}) {
  const { t } = useTranslation();
  const [imgFailed, setImgFailed] = useState(false);
  const section = useMemo(
    () => getLandmarkStory(landmark).sections.find((s) => s.title === pick.storySectionTitle),
    [landmark, pick.storySectionTitle],
  );
  const photo = landmark.photos[0];
  return (
    <article className="flex flex-col overflow-hidden rounded-3xl border bg-card shadow-[0_20px_60px_-40px_color-mix(in_oklab,var(--primary)_60%,transparent)]">
      <div className="relative h-48 bg-muted">
        {photo && !imgFailed ? (
          <img
            src={photo}
            alt={landmark.title}
            loading="lazy"
            onError={() => setImgFailed(true)}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <MapPin className="h-6 w-6" aria-hidden />
          </div>
        )}
        <span
          className={`absolute left-3 top-3 rounded-full px-3 py-1 text-[11px] font-medium uppercase tracking-widest backdrop-blur ${
            pick.source === "qloo"
              ? "bg-background/90 text-primary"
              : "bg-background/90 text-muted-foreground"
          }`}
        >
          {pick.source === "qloo"
            ? t("guide.qlooBadge", { n: pick.qlooRank, defaultValue: "Qloo #{{n}} for your taste" })
            : t("guide.editorialBadge", "Editorial pick · not ranked by Qloo")}
        </span>
        {photo && !imgFailed && (
          <span className="absolute bottom-2 right-3 rounded-full bg-background/70 px-2 py-0.5 text-[10px] text-muted-foreground backdrop-blur">
            {t("common.photoCredit", "Photo: Wikimedia Commons")}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-5">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          {landmark.district}
        </p>
        <h3 className="mt-1 font-display text-2xl leading-tight">{landmark.title}</h3>
        <p className="mt-2 text-sm">
          {pick.source === "editorial" ? (
            <span className="text-muted-foreground">{landmark.blurb}</span>
          ) : pick.drivers.length > 0 ? (
            <>
              {t("guide.qlooCredits", "Qloo credits")} <strong>{joinNames(pick.drivers)}</strong>
            </>
          ) : (
            <span className="text-muted-foreground">
              {t("guide.rankedTogether", "Ranked by Qloo for your favourites together")}
            </span>
          )}
          {pick.source === "qloo" && pick.affinity !== undefined && (
            <span
              className="ml-1 text-xs text-muted-foreground"
              title={t(
                "guide.affinityTitle",
                "Qloo affinity between your favourites and this place (0–1)",
              )}
            >
              · {t("guide.affinity", "affinity")} {pick.affinity.toFixed(2)}
            </span>
          )}
        </p>

        {pick.hook && (
          <blockquote className="mt-4 border-l-2 border-primary/50 pl-3 text-[15px] italic leading-relaxed text-foreground/90">
            {pick.hook}
            <span className="mt-1 block text-[10px] not-italic uppercase tracking-widest text-muted-foreground">
              {t("guide.aiNote", "Agora's note · AI")}
            </span>
          </blockquote>
        )}

        {section && (
          <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
            {section.kind === "legend" ? (
              <Sparkles className="h-3.5 w-3.5 text-accent" aria-hidden />
            ) : (
              <BookOpen className="h-3.5 w-3.5 text-primary" aria-hidden />
            )}
            {t("guide.startWith", { title: section.title, defaultValue: "Start with “{{title}}”" })}{" "}
            ·{" "}
            {section.kind === "legend"
              ? t("story.legend", "Legend")
              : t("story.history", "History")}
          </p>
        )}

        <div className="mt-auto flex gap-2 pt-5">
          <Button className="flex-1 gap-1.5" onClick={onOpen}>
            <BookOpen className="h-4 w-4" aria-hidden /> {t("guide.hearStory", "Hear the story")}
          </Button>
          <LocationPreviewDialog
            place={landmark}
            trigger={
              <Button
                variant="outline"
                size="icon"
                aria-label={t("guide.gettingTo", {
                  name: landmark.title,
                  defaultValue: "Getting to {{name}}",
                })}
              >
                <Navigation className="h-4 w-4" aria-hidden />
              </Button>
            }
          />
        </div>
      </div>
    </article>
  );
}
