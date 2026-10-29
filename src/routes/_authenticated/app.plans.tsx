import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import {
  Bookmark,
  BookmarkCheck,
  CalendarDays,
  Check,
  MapPin,
  Navigation,
  Star,
} from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { EventVisual } from "@/components/EventVisual";
import { Button } from "@/components/ui/button";
import { LocationPreviewDialog } from "@/components/LocationPreviewDialog";
import { formatWhenLocalized } from "@/components/guide/guide-format";
import { formatRating, priceMarks, QlooMark } from "@/components/discover/PlaceResults";
import { getMyPlans, type SavedPlace } from "@/lib/plans.functions";
import { useSaveToggle } from "@/lib/use-saved";

export const Route = createFileRoute("/_authenticated/app/plans")({
  head: () => ({
    meta: [{ title: "My plans — Agora" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: PlansPage,
});

/**
 * "My plans": what I'm going to (RSVPs) and what I saved (bookmarks), kept
 * apart on purpose. Removing a bookmark never cancels an RSVP; cancelling an
 * RSVP never removes a bookmark.
 */
function PlansPage() {
  const { t, i18n } = useTranslation();
  const fetchPlans = useServerFn(getMyPlans);
  const plans = useQuery({
    queryKey: ["plans"],
    queryFn: () => fetchPlans(),
    refetchOnMount: "always",
  });
  const toggle = useSaveToggle();
  const now = Date.now();

  const going = (plans.data?.going ?? []).filter((e) => e && Date.parse(e.starts_at) >= now);
  const savedEvents = plans.data?.savedEvents ?? [];
  const savedPlaces = plans.data?.savedPlaces ?? [];
  const empty =
    !plans.isLoading && going.length === 0 && savedEvents.length === 0 && savedPlaces.length === 0;

  return (
    <div className="min-h-screen bg-background">
      <AppHeader variant="member" />
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <p className="text-[11px] uppercase tracking-[0.35em] text-primary">
          {t("plans.kicker", "Your plans")}
        </p>
        <h1 className="mt-1 font-display text-3xl sm:text-4xl">{t("plans.title", "My plans")}</h1>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          {t(
            "plans.intro",
            "Gatherings you're going to, and the gatherings and places you saved for later. Saved is not joined — only “I'm going” tells the organiser.",
          )}
        </p>

        {plans.isLoading && (
          <div className="mt-8 grid gap-4 sm:grid-cols-2" aria-busy="true">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-40 animate-pulse rounded-2xl border bg-card/40" />
            ))}
          </div>
        )}
        {plans.isError && (
          <p className="mt-8 rounded-2xl border border-destructive/50 p-5 text-sm" role="alert">
            {t("plans.error", "Couldn't load your plans just now.")}
          </p>
        )}
        {empty && (
          <div className="mt-8 rounded-3xl border border-dashed border-primary/30 bg-card/60 p-8 text-center">
            <p className="font-display text-2xl">{t("plans.emptyTitle", "Nothing planned yet.")}</p>
            <p className="mt-2 text-sm text-muted-foreground">
              {t(
                "plans.emptyBody",
                "Ask the compass for a restaurant, a place or a gathering — then save it here or join it.",
              )}
            </p>
            <Button asChild className="mt-4 min-h-11">
              <Link to="/app">{t("plans.openCompass", "Open the compass")}</Link>
            </Button>
          </div>
        )}

        {going.length > 0 && (
          <section className="mt-10" aria-label={t("plans.going", "I'm going")}>
            <h2 className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-primary">
              <Check className="h-3.5 w-3.5" aria-hidden /> {t("plans.going", "I'm going")}
              <span className="text-muted-foreground">({going.length})</span>
            </h2>
            <div className="stage-stagger mt-3 grid gap-4 sm:grid-cols-2">
              {going.map((e, i) => (
                <EventRow key={e!.id} event={e!} index={i} badge={t("plans.goingBadge", "Going")} />
              ))}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              <Link to="/app/calendar" className="underline-offset-4 hover:underline">
                {t("plans.seeCalendar", "See them in the calendar →")}
              </Link>
            </p>
          </section>
        )}

        {savedEvents.length > 0 && (
          <section className="mt-10" aria-label={t("plans.savedGatherings", "Saved gatherings")}>
            <h2 className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-primary">
              <Bookmark className="h-3.5 w-3.5" aria-hidden />{" "}
              {t("plans.savedGatherings", "Saved gatherings")}
              <span className="text-muted-foreground">({savedEvents.length})</span>
            </h2>
            <div className="stage-stagger mt-3 grid gap-4 sm:grid-cols-2">
              {savedEvents.map((e, i) => (
                <EventRow
                  key={e.id}
                  event={e}
                  index={i}
                  badge={e.going ? t("plans.goingBadge", "Going") : undefined}
                  onUnsave={() =>
                    toggle.mutate({ target: { kind: "event", refId: e.id }, saved: true })
                  }
                  busy={toggle.isPending}
                />
              ))}
            </div>
          </section>
        )}

        {savedPlaces.length > 0 && (
          <section className="mt-10" aria-label={t("plans.savedPlaces", "Saved places")}>
            <h2 className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-primary">
              <QlooMark /> {t("plans.savedPlaces", "Saved places")}
              <span className="text-muted-foreground">({savedPlaces.length})</span>
            </h2>
            <div className="stage-stagger mt-3 grid gap-4 sm:grid-cols-2">
              {savedPlaces.map((s, i) => (
                <PlaceRow
                  key={s.refId}
                  saved={s}
                  index={i}
                  lang={i18n.language}
                  onUnsave={() =>
                    toggle.mutate({
                      target: { kind: "place", refId: s.refId, payload: s.place },
                      saved: true,
                    })
                  }
                  busy={toggle.isPending}
                />
              ))}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {t(
                "plans.placesNote",
                "Places were ranked by Qloo when you saved them; details are a snapshot from that moment. No reservation was made.",
              )}
            </p>
          </section>
        )}
      </main>
    </div>
  );
}

type PlanEvent = {
  id: string;
  title: string;
  starts_at: string;
  venue: string | null;
  city: string | null;
  category: string;
  tags: string[] | null;
  latitude: number | null;
  longitude: number | null;
  org_id: string | null;
  organizations: { name: string; city: string | null } | null;
};

function EventRow({
  event: e,
  index,
  badge,
  onUnsave,
  busy,
}: {
  event: PlanEvent;
  index: number;
  badge?: string;
  onUnsave?: () => void;
  busy?: boolean;
}) {
  const { t, i18n } = useTranslation();
  return (
    <article
      className="flex min-w-0 overflow-hidden rounded-3xl border bg-card transition hover:border-primary/40"
      style={{ "--i": index } as React.CSSProperties}
    >
      <Link to="/app/event/$id" params={{ id: e.id }} className="w-28 shrink-0 sm:w-32">
        <EventVisual
          title={e.title}
          category={e.category}
          tags={e.tags}
          size="sm"
          className="h-full"
        />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col gap-1 p-4">
        <div className="flex items-start justify-between gap-2">
          <Link
            to="/app/event/$id"
            params={{ id: e.id }}
            className="font-display text-lg leading-tight hover:underline"
          >
            {e.title}
          </Link>
          {onUnsave && (
            <button
              type="button"
              disabled={busy}
              onClick={onUnsave}
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-primary bg-primary text-primary-foreground"
              aria-pressed
              aria-label={t("save.removeLabel", {
                name: e.title,
                defaultValue: "Remove {{name}} from my plans",
              })}
            >
              <BookmarkCheck className="h-4 w-4" aria-hidden />
            </button>
          )}
        </div>
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <CalendarDays className="h-3 w-3" aria-hidden />
            {formatWhenLocalized(e.starts_at, i18n.language)}
          </span>
          <span className="inline-flex min-w-0 max-w-full items-center gap-1">
            <MapPin className="h-3 w-3 shrink-0" aria-hidden />
            <span className="min-w-0 truncate">{e.venue ?? e.city ?? "—"}</span>
          </span>
          {badge && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] uppercase tracking-widest text-primary">
              {badge}
            </span>
          )}
        </p>
        {e.organizations?.name && e.org_id && (
          <p className="text-xs">
            <Link
              to="/app/community/$id"
              params={{ id: e.org_id }}
              className="text-primary underline-offset-4 hover:underline"
            >
              {e.organizations.name}
            </Link>
          </p>
        )}
      </div>
    </article>
  );
}

function PlaceRow({
  saved,
  index,
  lang,
  onUnsave,
  busy,
}: {
  saved: SavedPlace;
  index: number;
  lang: string;
  onUnsave: () => void;
  busy: boolean;
}) {
  const { t } = useTranslation();
  const p = saved.place;
  const rating = formatRating(p.rating, lang);
  const price = priceMarks(p.priceLevel);
  return (
    <article
      className="flex min-w-0 flex-col gap-2 overflow-hidden rounded-3xl border bg-card p-4 transition hover:border-primary/40"
      style={{ "--i": index } as React.CSSProperties}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.25em] text-primary">
            {p.kind
              ? t(`discover.kind.${p.kind.replace(/\s+/g, "-")}`, { defaultValue: p.kind })
              : t("discover.kind.place", "places")}{" "}
            · {p.district}
          </p>
          <h3 className="mt-1 font-display text-xl leading-tight">{p.name}</h3>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={onUnsave}
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-primary bg-primary text-primary-foreground"
          aria-pressed
          aria-label={t("save.removeLabel", {
            name: p.name,
            defaultValue: "Remove {{name}} from my plans",
          })}
        >
          <BookmarkCheck className="h-4 w-4" aria-hidden />
        </button>
      </div>
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        {rating && (
          <span className="inline-flex items-center gap-1">
            <Star className="h-3 w-3 fill-current text-primary" aria-hidden /> {rating}
          </span>
        )}
        {price && <span>{price}</span>}
        {p.address && (
          <span className="inline-flex min-w-0 max-w-full items-center gap-1">
            <MapPin className="h-3 w-3 shrink-0" aria-hidden />
            <span className="min-w-0 truncate">{p.address}</span>
          </span>
        )}
      </p>
      {p.drivers && p.drivers.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {t("discover.whyYou", "Why it fits you")}:{" "}
          <span className="text-foreground">{p.drivers.join(" · ")}</span>
        </p>
      )}
      {p.prompt && <p className="text-xs italic text-muted-foreground">“{p.prompt}”</p>}
      <div className="mt-auto pt-1">
        <LocationPreviewDialog
          place={{
            title: p.name,
            venue: p.address ?? null,
            city: "Istanbul",
            latitude: p.geocode?.latitude ?? null,
            longitude: p.geocode?.longitude ?? null,
          }}
          trigger={
            <Button size="sm" variant="outline" className="min-h-11">
              <Navigation className="h-3.5 w-3.5" aria-hidden />{" "}
              {t("event.takeMeThere", "Take me there")}
            </Button>
          }
        />
      </div>
    </article>
  );
}
