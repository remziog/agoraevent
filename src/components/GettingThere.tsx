import { useState } from "react";
import { useTranslation } from "react-i18next";
import { MapPin, Navigation, Train, Car, Footprints, LocateFixed } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  /** Free-form destination (e.g. "Hagia Sophia, Istanbul") used to build a Maps query. */
  destinationQuery: string;
  /** Optional pre-built Google Maps URL (e.g. a share.google link). Used for the primary "Open directions" button when present. */
  destinationUrl?: string;
  /** Optional 1-line plain-language tip (e.g. "Closest tram stop: Sultanahmet, ~3 min walk"). */
  tip?: string;
};

function buildDirUrl(
  destination: string,
  travelmode: "transit" | "driving" | "walking",
  origin?: { lat: number; lng: number },
) {
  const params = new URLSearchParams({
    api: "1",
    destination,
    travelmode,
  });
  if (origin) params.set("origin", `${origin.lat},${origin.lng}`);
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

export function GettingThere({ destinationQuery, destinationUrl, tip }: Props) {
  const { t } = useTranslation();
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [denied, setDenied] = useState(false);
  const [loading, setLoading] = useState(false);

  const primaryHref =
    destinationUrl ?? buildDirUrl(destinationQuery, "transit", coords ?? undefined);

  function useMyLocation() {
    if (!("geolocation" in navigator)) {
      setDenied(true);
      return;
    }
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setDenied(false);
        setLoading(false);
        window.open(
          buildDirUrl(destinationQuery, "transit", {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          }),
          "_blank",
          "noopener,noreferrer",
        );
      },
      () => {
        setDenied(true);
        setLoading(false);
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60_000 },
    );
  }

  const modes = [
    { key: "transit" as const, label: t("gettingThere.metro"), Icon: Train },
    { key: "driving" as const, label: t("gettingThere.taxi"), Icon: Car },
    { key: "walking" as const, label: t("gettingThere.walking"), Icon: Footprints },
  ];

  return (
    <section
      aria-labelledby="getting-there-heading"
      className="mt-8 rounded-2xl border bg-card p-6"
    >
      <div className="flex items-center gap-2">
        <MapPin className="h-4 w-4 text-muted-foreground" />
        <h2 id="getting-there-heading" className="font-display text-2xl">
          {t("gettingThere.title")}
        </h2>
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <Button asChild size="lg" className="flex-1">
          <a href={primaryHref} target="_blank" rel="noopener noreferrer">
            <Navigation className="mr-2 h-4 w-4" />
            {t("gettingThere.openInMaps")}
          </a>
        </Button>
        <Button
          size="lg"
          variant="outline"
          className="flex-1"
          onClick={useMyLocation}
          disabled={loading}
        >
          <LocateFixed className="mr-2 h-4 w-4" />
          {loading ? t("common.loading") : t("gettingThere.useMyLocation")}
        </Button>
      </div>

      {denied && (
        <p className="mt-3 text-xs text-muted-foreground">{t("gettingThere.deniedNote")}</p>
      )}

      <div className="mt-4 grid grid-cols-3 gap-2">
        {modes.map(({ key, label, Icon }) => (
          <a
            key={key}
            href={buildDirUrl(destinationQuery, key, coords ?? undefined)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col items-center gap-1.5 rounded-xl border bg-background p-3 text-center text-xs font-medium text-foreground transition hover:bg-muted"
          >
            <Icon className="h-5 w-5" />
            {label}
          </a>
        ))}
      </div>

      {tip && (
        <p className="mt-4 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{t("gettingThere.tipLabel")}: </span>
          {tip}
        </p>
      )}
    </section>
  );
}
