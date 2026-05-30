import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { MapPin, Navigation, Train, Car, Footprints, LocateFixed } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Reusable "Getting there" component used by every venue / landmark.
 *
 * Supports both Google Maps and Yandex Maps. Default provider is chosen by
 * UI language (RU → Yandex, otherwise Google) and remembered per session.
 *
 * IMPORTANT — Yandex coordinate ordering:
 *   - rtext (route): "LAT,LON~LAT,LON"
 *   - ll / pt (point on map): "LON,LAT" (reversed)
 * Mixing these up sends people to a mirrored location on the wrong continent.
 */

type Coords = { lat: number; lng: number };
type Provider = "google" | "yandex";
type Mode = "transit" | "driving" | "walking";

const SESSION_KEY = "agora:gettingThereProvider";

const RTT_BY_MODE: Record<Mode, "mt" | "auto" | "pd"> = {
  transit: "mt",
  driving: "auto",
  walking: "pd",
};

function defaultProvider(language: string): Provider {
  return language?.toLowerCase().startsWith("ru") ? "yandex" : "google";
}

function readSessionProvider(): Provider | null {
  if (typeof window === "undefined") return null;
  try {
    const v = window.sessionStorage.getItem(SESSION_KEY);
    return v === "google" || v === "yandex" ? v : null;
  } catch {
    return null;
  }
}

function writeSessionProvider(p: Provider) {
  try {
    window.sessionStorage.setItem(SESSION_KEY, p);
  } catch {
    /* ignore */
  }
}

function buildGoogleUrl(dest: Coords, mode: Mode, origin: Coords | null): string {
  const params = new URLSearchParams({
    api: "1",
    destination: `${dest.lat},${dest.lng}`,
    travelmode: mode,
  });
  if (origin) params.set("origin", `${origin.lat},${origin.lng}`);
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

function buildYandexRouteUrl(dest: Coords, mode: Mode, origin: Coords | null): string {
  // rtext uses LAT,LON pairs joined by `~` — DO NOT swap the order here.
  const destPart = `${dest.lat},${dest.lng}`;
  const originPart = origin ? `${origin.lat},${origin.lng}` : "";
  const params = new URLSearchParams({
    rtext: `${originPart}~${destPart}`,
    rtt: RTT_BY_MODE[mode],
  });
  return `https://yandex.com/maps/?${params.toString()}`;
}

/**
 * Yandex "drop a pin" URL (used as a fallback when we want to show the place
 * without computing a route). `ll` and `pt` are LON,LAT — the opposite of rtext.
 */
export function buildYandexPointUrl(dest: Coords): string {
  const lonLat = `${dest.lng},${dest.lat}`;
  return `https://yandex.com/maps/?ll=${lonLat}&z=16&pt=${lonLat}`;
}

function buildUrl(provider: Provider, dest: Coords, mode: Mode, origin: Coords | null): string {
  return provider === "yandex"
    ? buildYandexRouteUrl(dest, mode, origin)
    : buildGoogleUrl(dest, mode, origin);
}

type Props = {
  /** Destination coordinates. Required — all links are built from lat/lng. */
  destination: Coords;
  /** Human-readable label used for aria + tip context. */
  destinationLabel?: string;
  /** Optional 1-line plain-language tip (e.g. "Closest tram stop: Sultanahmet"). */
  tip?: string;
  /** Optional offline summary shown when navigator.onLine is false. */
  offlineSummary?: string;
};

export function GettingThere({ destination, destinationLabel, tip, offlineSummary }: Props) {
  const { t, i18n } = useTranslation();
  const [provider, setProvider] = useState<Provider>(() => {
    return readSessionProvider() ?? defaultProvider(i18n.language);
  });
  // If the user hasn't picked a provider yet, follow language changes.
  useEffect(() => {
    if (readSessionProvider()) return;
    setProvider(defaultProvider(i18n.language));
  }, [i18n.language]);

  const [coords, setCoords] = useState<Coords | null>(null);
  const [denied, setDenied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isOnline, setIsOnline] = useState(
    typeof navigator === "undefined" ? true : navigator.onLine,
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  const choose = (p: Provider) => {
    setProvider(p);
    writeSessionProvider(p);
  };

  const primaryHref = useMemo(
    () => buildUrl(provider, destination, "transit", coords),
    [provider, destination, coords],
  );

  function useMyLocation() {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setDenied(true);
      return;
    }
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const c = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setCoords(c);
        setDenied(false);
        setLoading(false);
        // Auto-open the selected provider with the freshly-acquired origin.
        window.open(
          buildUrl(provider, destination, "transit", c),
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

  const modes: { key: Mode; label: string; Icon: typeof Train }[] = [
    { key: "transit", label: t("gettingThere.metro"), Icon: Train },
    { key: "driving", label: t("gettingThere.taxi"), Icon: Car },
    { key: "walking", label: t("gettingThere.walking"), Icon: Footprints },
  ];

  return (
    <section
      aria-labelledby="getting-there-heading"
      aria-label={destinationLabel ? `${t("gettingThere.title")} — ${destinationLabel}` : undefined}
      className="mt-8 rounded-2xl border bg-card p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-muted-foreground" />
          <h2 id="getting-there-heading" className="font-display text-2xl">
            {t("gettingThere.title")}
          </h2>
        </div>
        {/* Provider toggle */}
        <div
          role="group"
          aria-label={t("gettingThere.openIn")}
          className="inline-flex items-center gap-1 rounded-full border bg-muted/40 p-0.5 text-xs"
        >
          <span className="px-2 text-muted-foreground">{t("gettingThere.openIn")}:</span>
          <button
            type="button"
            onClick={() => choose("google")}
            aria-pressed={provider === "google"}
            className={`rounded-full px-3 py-1 font-medium transition ${
              provider === "google"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t("gettingThere.googleMaps")}
          </button>
          <button
            type="button"
            onClick={() => choose("yandex")}
            aria-pressed={provider === "yandex"}
            className={`rounded-full px-3 py-1 font-medium transition ${
              provider === "yandex"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t("gettingThere.yandexMaps")}
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <Button asChild size="lg" className="flex-1" disabled={!isOnline}>
          <a href={primaryHref} target="_blank" rel="noopener noreferrer">
            <Navigation className="mr-2 h-4 w-4" />
            {provider === "yandex"
              ? t("gettingThere.openInYandex")
              : t("gettingThere.openInGoogle")}
          </a>
        </Button>
        <Button
          size="lg"
          variant="outline"
          className="flex-1"
          onClick={useMyLocation}
          disabled={loading || !isOnline}
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
            href={buildUrl(provider, destination, key, coords)}
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

      {!isOnline && offlineSummary && (
        <div className="mt-4 rounded-xl border border-dashed bg-muted/40 p-3 text-sm">
          <p className="mb-1 text-xs font-medium uppercase tracking-widest text-muted-foreground">
            {t("gettingThere.offlineTitle")}
          </p>
          <p className="whitespace-pre-line text-foreground">{offlineSummary}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            {t("gettingThere.offlineHint")}
          </p>
        </div>
      )}
    </section>
  );
}
