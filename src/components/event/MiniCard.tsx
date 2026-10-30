import { useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Bookmark, BookmarkCheck, Navigation, Star } from "lucide-react";
import { ArtBlock, artInk } from "@/components/ArtBlock";
import { eventPhoto } from "@/components/EventVisual";
import { LocationPreviewDialog } from "@/components/LocationPreviewDialog";
import { Button } from "@/components/ui/button";
import { formatRating, priceMarks, QlooMark } from "@/components/discover/PlaceResults";
import { formatWhenLocalized } from "@/components/guide/guide-format";
import type { SavedPlace } from "@/lib/plans.functions";

const MONO = "font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground";
const FOCUS =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff5b1f]";
const TITLE =
  "font-display text-[22px] font-[800] leading-[0.98] tracking-[-0.01em] [font-stretch:72%] [overflow-wrap:anywhere]";

export type MiniEvent = {
  id: string;
  title: string;
  starts_at: string;
  venue: string | null;
  city: string | null;
  category: string;
  tags: string[] | null;
  org_id: string | null;
  organizations: { name: string; city: string | null } | null;
};

/** Round bookmark over the art (Naz v3 ".save-ic"). Pressed = saved. */
function SaveIcon({
  saved,
  busy,
  label,
  onClick,
}: {
  saved: boolean;
  busy: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={busy}
      aria-pressed={saved}
      aria-label={label}
      onClick={onClick}
      className={`absolute right-2 top-2 z-[5] inline-flex h-11 w-11 items-center justify-center rounded-full backdrop-blur transition-colors disabled:opacity-60 ${FOCUS} ${
        saved ? "bg-[#100f0e] text-[#f7f2ea]" : "bg-[#f7f2ea]/85 text-[#100f0e]"
      }`}
    >
      {saved ? (
        <BookmarkCheck className="h-[18px] w-[18px]" aria-hidden />
      ) : (
        <Bookmark className="h-[18px] w-[18px]" aria-hidden />
      )}
    </button>
  );
}

/** Art (or the organiser's photo) with one oversized number laid over it. */
function MiniMedia({
  seed,
  tags,
  big,
  small,
  children,
}: {
  seed: string;
  tags?: readonly string[] | null;
  big?: string;
  small?: string;
  children?: ReactNode;
}) {
  const [failed, setFailed] = useState(false);
  const photo = eventPhoto(tags);
  const showPhoto = Boolean(photo) && !failed;
  const ink = showPhoto ? "#f7f2ea" : artInk(seed);
  return (
    <div className="relative aspect-[4/5] overflow-hidden rounded-[22px]">
      <div aria-hidden className="absolute inset-0">
        {showPhoto && photo ? (
          <>
            <img
              src={photo.url}
              alt=""
              loading="lazy"
              onError={() => setFailed(true)}
              className="h-full w-full object-cover"
            />
            <span className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
          </>
        ) : (
          <ArtBlock seed={seed} className="h-full" />
        )}
      </div>
      {(big || small) && (
        <span
          aria-hidden
          className="absolute bottom-1.5 left-3 z-[4] grid leading-none"
          style={{ color: ink }}
        >
          {small && (
            <span className="font-mono text-[10.5px] uppercase tracking-[0.08em] opacity-90">
              {small}
            </span>
          )}
          {big && (
            <span className="font-display text-[64px] font-[900] leading-[0.9] [font-stretch:62%]">
              {big}
            </span>
          )}
        </span>
      )}
      {children}
    </div>
  );
}

export function EventMiniCard({
  event: e,
  locale,
  saved,
  going,
  busy,
  onToggleSave,
}: {
  event: MiniEvent;
  locale: string;
  saved: boolean;
  going: boolean;
  busy: boolean;
  onToggleSave: () => void;
}) {
  const { t, i18n } = useTranslation();
  const day = new Date(e.starts_at).toLocaleDateString(locale, {
    day: "numeric",
    timeZone: "Europe/Istanbul",
  });
  const month = new Date(e.starts_at).toLocaleDateString(locale, {
    month: "short",
    timeZone: "Europe/Istanbul",
  });
  const demo = (e.tags ?? []).includes("demo");
  return (
    <article className="relative grid min-w-0 content-start gap-1.5">
      <Link
        to="/app/event/$id"
        params={{ id: e.id }}
        aria-label={e.title}
        className={`block rounded-[22px] ${FOCUS}`}
      >
        <MiniMedia seed={e.title} tags={e.tags} big={day} small={month} />
      </Link>
      <SaveIcon
        saved={saved}
        busy={busy}
        onClick={onToggleSave}
        label={
          saved
            ? t("save.removeLabel", {
                name: e.title,
                defaultValue: "Remove {{name}} from my plans",
              })
            : t("save.addLabel", { name: e.title, defaultValue: "Save {{name}} to my plans" })
        }
      />
      <p className={`${MONO} mt-1`}>
        <span lang="en">{e.category}</span>
        {demo && ` · ${t("common.demo", "Demo")}`}
      </p>
      <h3 className={TITLE}>
        <Link
          to="/app/event/$id"
          params={{ id: e.id }}
          className={`rounded-sm hover:underline ${FOCUS}`}
        >
          {e.title}
        </Link>
      </h3>
      <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
        <span>{formatWhenLocalized(e.starts_at, i18n.language)}</span>
        {(e.venue || e.city) && (
          <span className="min-w-0 [overflow-wrap:anywhere]">{e.venue ?? e.city}</span>
        )}
        {going && (
          <span className="inline-flex items-center gap-1 font-semibold text-foreground">
            <i aria-hidden className="h-[7px] w-[7px] rounded-full bg-[#ff5b1f]" />
            {t("plans.goingBadge", "Going")}
          </span>
        )}
      </p>
      {e.organizations?.name && e.org_id && (
        <p className="text-xs">
          <Link
            to="/app/community/$id"
            params={{ id: e.org_id }}
            className={`-my-3.5 inline-block py-3.5 underline decoration-[#ff5b1f] underline-offset-4 ${FOCUS}`}
          >
            {e.organizations.name}
          </Link>
        </p>
      )}
    </article>
  );
}

export function PlaceMiniCard({
  saved: s,
  lang,
  busy,
  onUnsave,
}: {
  saved: SavedPlace;
  lang: string;
  busy: boolean;
  onUnsave: () => void;
}) {
  const { t } = useTranslation();
  const p = s.place;
  const rating = formatRating(p.rating, lang);
  const price = priceMarks(p.priceLevel);
  return (
    <article className="relative grid min-w-0 content-start gap-1.5">
      <MiniMedia seed={p.name}>
        <span className="absolute left-2.5 top-2.5 z-[4] inline-flex items-center gap-1 rounded-full bg-[#f7f2ea]/85 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.08em] text-[#100f0e] backdrop-blur">
          <QlooMark /> Qloo
        </span>
      </MiniMedia>
      <SaveIcon
        saved
        busy={busy}
        onClick={onUnsave}
        label={t("save.removeLabel", {
          name: p.name,
          defaultValue: "Remove {{name}} from my plans",
        })}
      />
      <p className={`${MONO} mt-1`}>
        {p.kind
          ? t(`discover.kind.${p.kind.replace(/\s+/g, "-")}`, { defaultValue: p.kind })
          : t("discover.kind.place", "places")}
        {p.district ? ` · ${p.district}` : ""}
      </p>
      <h3 className={TITLE}>{p.name}</h3>
      <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
        {rating && (
          <span className="inline-flex items-center gap-1">
            <Star className="h-3 w-3 fill-current" aria-hidden /> {rating}
          </span>
        )}
        {price && <span>{price}</span>}
        {p.address && <span className="min-w-0 [overflow-wrap:anywhere]">{p.address}</span>}
      </p>
      {p.drivers && p.drivers.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {t("discover.whyYou", "Why it fits you")}:{" "}
          <span className="text-foreground">{p.drivers.join(" · ")}</span>
        </p>
      )}
      {p.prompt && <p className="text-xs italic text-muted-foreground">“{p.prompt}”</p>}
      <LocationPreviewDialog
        place={{
          title: p.name,
          venue: p.address ?? null,
          city: "Istanbul",
          latitude: p.geocode?.latitude ?? null,
          longitude: p.geocode?.longitude ?? null,
        }}
        trigger={
          <Button size="sm" variant="outline" className="mt-1 min-h-11 w-full px-3">
            <Navigation className="h-3.5 w-3.5" aria-hidden />
            <span className="truncate">{t("event.takeMeThere", "Take me there")}</span>
          </Button>
        }
      />
    </article>
  );
}
