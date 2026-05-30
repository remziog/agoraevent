import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Navigation, MapPin, Clock, Copy, Check, ExternalLink, LocateFixed, Loader2, WifiOff, Pencil, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import { autocompletePlaces } from "@/lib/places.functions";

type Coords = { lat: number; lng: number };

type Provider = "google" | "yandex";
const PROVIDER_KEY = "agora:preferredMapProvider";
const MANUAL_ORIGIN_KEY = "agora:manualStartingAddress";

function getPreferredProvider(): Provider | null {
  if (typeof window === "undefined") return null;
  const v = window.localStorage.getItem(PROVIDER_KEY);
  return v === "google" || v === "yandex" ? v : null;
}

function setPreferredProvider(p: Provider) {
  try {
    window.localStorage.setItem(PROVIDER_KEY, p);
  } catch {
    /* ignore */
  }
}

function getRememberedManualOrigin(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(MANUAL_ORIGIN_KEY) ?? "";
  } catch {
    return "";
  }
}

function rememberManualOrigin(value: string) {
  try {
    const trimmed = value.trim();
    if (trimmed) window.localStorage.setItem(MANUAL_ORIGIN_KEY, trimmed);
    else window.localStorage.removeItem(MANUAL_ORIGIN_KEY);
  } catch {
    /* ignore */
  }
}

function openTop(href: string) {
  try {
    if (window.top) window.top.location.href = href;
    else window.location.href = href;
  } catch {
    window.location.href = href;
  }
}

type Place = {
  title: string;
  venue?: string | null;
  city?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  starts_at?: string | null;
  address?: string | null;
  category?: string | null;
};

function destinationQuery(p: Place) {
  if (p.latitude != null && p.longitude != null) return `${p.latitude},${p.longitude}`;
  return [p.venue, p.city, p.title].filter(Boolean).join(", ");
}

// Convert a local datetime string ("YYYY-MM-DDTHH:mm") to unix seconds.
function toUnixSeconds(local: string): number | null {
  if (!local) return null;
  const t = new Date(local).getTime();
  return Number.isFinite(t) ? Math.floor(t / 1000) : null;
}

function googleMapsHref(
  p: Place,
  departISO: string,
  origin: Coords | null,
  manualOrigin: string,
) {
  const params = new URLSearchParams({
    api: "1",
    destination: destinationQuery(p),
    travelmode: "driving",
    // dir_action=navigate launches turn-by-turn directly in the Google Maps app
    // (and the closest equivalent in the web client).
    dir_action: "navigate",
  });
  const manual = manualOrigin.trim();
  if (manual) params.set("origin", manual);
  else if (origin) params.set("origin", `${origin.lat},${origin.lng}`);
  // Google Maps web URL doesn't officially honor departure_time, but we
  // include it so deep-linking into the Google Maps app can pick it up.
  const unix = toUnixSeconds(departISO);
  if (unix) params.set("departure_time", String(unix));
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

function yandexMapsHref(
  p: Place,
  departISO: string,
  origin: Coords | null,
  manualOrigin: string,
) {
  const destPart =
    p.latitude != null && p.longitude != null
      ? `${p.latitude},${p.longitude}`
      : "";
  const params = new URLSearchParams({ rtt: "auto" });
  const manual = manualOrigin.trim();
  if (manual && destPart) {
    // Yandex's rtext is lat,lng-only. With a typed address we have to fall
    // back to a text search prefilled "from <address> to <destination>".
    params.set("text", `${manual} → ${[p.venue, p.city, p.title].filter(Boolean).join(", ")}`);
  } else if (destPart) {
    // Yandex rtext format: "fromLat,fromLng~toLat,toLng". A leading "~"
    // (no origin) means "from my location" once the user grants permission
    // in Yandex Maps itself.
    const originPart = origin ? `${origin.lat},${origin.lng}` : "";
    params.set("rtext", `${originPart}~${destPart}`);
  } else {
    params.set("text", [p.venue, p.city, p.title].filter(Boolean).join(", "));
  }
  const unix = toUnixSeconds(departISO);
  // Yandex supports departure time on transit via `departure_time` (unix s).
  if (unix) params.set("departure_time", String(unix));
  return `https://yandex.com/maps/?${params.toString()}`;
}

function embedSrc(p: Place) {
  return `https://www.google.com/maps?q=${encodeURIComponent(destinationQuery(p))}&output=embed`;
}

function defaultDepart(p: Place): string {
  // Prefer event start time; otherwise "now" rounded to next 15 min.
  const base = p.starts_at ? new Date(p.starts_at) : new Date(Date.now() + 15 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  const y = base.getFullYear();
  const m = pad(base.getMonth() + 1);
  const d = pad(base.getDate());
  const hh = pad(base.getHours());
  const mm = pad(base.getMinutes());
  return `${y}-${m}-${d}T${hh}:${mm}`;
}

export function LocationPreviewDialog({ place, trigger }: { place: Place; trigger: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [depart, setDepart] = useState<string>(() => defaultDepart(place));
  const [preferred, setPreferred] = useState<Provider | null>(() => getPreferredProvider());
  const [embedFailed, setEmbedFailed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState<Coords | null>(null);
  const [geoState, setGeoState] = useState<"idle" | "locating" | "denied" | "unavailable" | "ready">("idle");
  const [manualOrigin, setManualOrigin] = useState<string>(() => getRememberedManualOrigin());
  const [showManual, setShowManual] = useState<boolean>(() => getRememberedManualOrigin().length > 0);
  const [isOnline, setIsOnline] = useState(
    typeof navigator === "undefined" ? true : navigator.onLine,
  );

  // Address autocomplete (Google Places API via gateway).
  type Suggestion = { placeId: string; primary: string; secondary: string; text: string };
  const fetchSuggestions = useServerFn(autocompletePlaces);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  // Suppress fetching right after the user picks a suggestion (the resulting
  // setManualOrigin would otherwise trigger another round-trip).
  const skipNextFetchRef = useRef(false);
  // One session token per "typing session" — Places API (New) bills
  // autocomplete + details under a single token.
  const sessionTokenRef = useRef<string>(
    typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
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

  // Debounced autocomplete fetch — only fires after the user pauses typing
  // for DEBOUNCE_MS, so each keystroke cancels the pending request instead
  // of hitting Google Places on every character.
  const DEBOUNCE_MS = 400;
  useEffect(() => {
    if (!showManual) return;
    if (skipNextFetchRef.current) {
      skipNextFetchRef.current = false;
      return;
    }
    const q = manualOrigin.trim();
    if (q.length < 3) {
      setSuggestions([]);
      setSuggestOpen(false);
      setSuggestLoading(false);
      return;
    }
    if (!isOnline) return;

    // Show the "waiting to search" state immediately, but DON'T call the API
    // until the debounce timer fires uninterrupted.
    let cancelled = false;
    const controller = new AbortController();
    setSuggestLoading(true);
    const handle = window.setTimeout(async () => {
      try {
        const { suggestions: next } = await fetchSuggestions({
          data: { input: q, sessionToken: sessionTokenRef.current },
          signal: controller.signal,
        });
        if (cancelled) return;
        setSuggestions(next);
        setSuggestOpen(next.length > 0);
        setActiveIndex(-1);
      } catch (err) {
        // Ignore aborts — they're the expected outcome when the user keeps
        // typing. Only clear results on real failures.
        if (cancelled || (err as { name?: string } | null)?.name === "AbortError") return;
        setSuggestions([]);
        setSuggestOpen(false);
      } finally {
        if (!cancelled) setSuggestLoading(false);
      }
    }, DEBOUNCE_MS);
    return () => {
      // Cleanup runs on every keystroke. Cancel the pending timer AND abort
      // any request that already fired so the in-flight fetch is canceled
      // end-to-end (browser fetch + server function).
      cancelled = true;
      window.clearTimeout(handle);
      controller.abort();
    };
  }, [manualOrigin, showManual, isOnline, fetchSuggestions]);

  const pickSuggestion = useCallback((s: Suggestion) => {
    skipNextFetchRef.current = true;
    setManualOrigin(s.text);
    rememberManualOrigin(s.text);
    setSuggestOpen(false);
    setSuggestions([]);
    setActiveIndex(-1);
    // Start a fresh session token for the next typing session.
    sessionTokenRef.current =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`;
  }, []);
  const autoLaunchedRef = useRef(false);
  const embedLoadedRef = useRef(false);
  const label = [place.venue, place.city].filter(Boolean).join(" · ") || place.title;
  const addressLine = [place.venue, place.city].filter(Boolean).join(", ") || place.title;
  const coordsLine =
    place.latitude != null && place.longitude != null
      ? `${place.latitude.toFixed(5)}, ${place.longitude.toFixed(5)}`
      : null;

  const requestLocation = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGeoState("unavailable");
      return;
    }
    setGeoState("locating");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setOrigin({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGeoState("ready");
      },
      (err) => {
        setGeoState(err.code === err.PERMISSION_DENIED ? "denied" : "unavailable");
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60_000 },
    );
  }, []);

  // Try to grab the user's location as soon as the dialog opens so the
  // "Take me there" buttons launch turn-by-turn from where they are.
  useEffect(() => {
    if (open && geoState === "idle") requestLocation();
  }, [open, geoState, requestLocation]);

  const gHref = useMemo(() => googleMapsHref(place, depart, origin, manualOrigin), [place, depart, origin, manualOrigin]);
  const yHref = useMemo(() => yandexMapsHref(place, depart, origin, manualOrigin), [place, depart, origin, manualOrigin]);

  // Auto-open the preferred provider on first open of this dialog instance.
  // Wait until the geolocation request has settled (granted, denied, or
  // unavailable) so the deep link can include the user's origin when we
  // have it — otherwise turn-by-turn would launch without a starting point.
  useEffect(() => {
    if (!open || autoLaunchedRef.current) return;
    const pref = getPreferredProvider();
    if (!pref) return;
    if (geoState === "idle" || geoState === "locating") return;
    // Don't launch a map provider while offline — the deep link would just
    // load an error page. We keep the dialog open and let the offline banner
    // explain what to do. As soon as the connection returns the user can tap
    // the button again.
    if (!isOnline) return;
    autoLaunchedRef.current = true;
    setOpen(false);
    openTop(pref === "google" ? gHref : yHref);
  }, [open, gHref, yHref, geoState, isOnline]);

  // Detect when the embedded map fails to load (CSP/X-Frame-Options, blocked
  // by an extension, or offline). If onLoad doesn't fire within ~4s, fall
  // back to a static panel that still shows the destination and lets the
  // user copy the address or jump to a full map provider.
  useEffect(() => {
    if (!open) {
      embedLoadedRef.current = false;
      setEmbedFailed(false);
      setCopied(false);
      return;
    }
    const t = window.setTimeout(() => {
      if (!embedLoadedRef.current) setEmbedFailed(true);
    }, 4000);
    return () => window.clearTimeout(t);
  }, [open, place.title, place.latitude, place.longitude]);

  const copyAddress = async () => {
    const text = coordsLine ? `${addressLine} (${coordsLine})` : addressLine;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  const choose = (p: Provider) => {
    setPreferredProvider(p);
    setPreferred(p);
    // Persist the typed starting address at the same moment the user actually
    // launches a directions provider, so we don't wait for an onBlur that may
    // never fire (e.g. mobile tap straight from input → button).
    rememberManualOrigin(manualOrigin);
  };

  const forget = () => {
    try {
      window.localStorage.removeItem(PROVIDER_KEY);
    } catch {
      /* ignore */
    }
    setPreferred(null);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-2xl p-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5">
          <DialogTitle className="font-display text-xl">{place.title}</DialogTitle>
          <p className="flex items-center gap-1 text-sm text-muted-foreground">
            <MapPin className="h-3.5 w-3.5" />
            {label}
          </p>
        </DialogHeader>

        <div className="mt-3 aspect-video w-full bg-muted relative">
          {!embedFailed ? (
            <iframe
              title={`Map of ${place.title}`}
              src={embedSrc(place)}
              className="h-full w-full border-0"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              allowFullScreen
              onLoad={() => {
                embedLoadedRef.current = true;
              }}
              onError={() => setEmbedFailed(true)}
            />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-muted p-5 text-center">
              <MapPin className="h-8 w-8 text-muted-foreground" />
              <div>
                <p className="font-display text-base">Preview unavailable here</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Your browser blocked the embedded map. The destination is still set —
                  copy the address or open it in a full map below.
                </p>
              </div>
              <div className="rounded-lg border bg-background/60 px-3 py-2 text-left">
                <p className="text-sm font-medium">{addressLine}</p>
                {coordsLine && (
                  <p className="text-[11px] text-muted-foreground">{coordsLine}</p>
                )}
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Button size="sm" variant="secondary" onClick={copyAddress} className="gap-1.5">
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? "Copied" : "Copy address"}
                </Button>
                <Button asChild size="sm" variant="outline" className="gap-1.5">
                  <a href={gHref} target="_top" rel="noopener noreferrer">
                    <ExternalLink className="h-3.5 w-3.5" />
                    Open full map
                  </a>
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-3 p-5">
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 rounded-lg border bg-muted/30 px-3 py-2.5 text-xs">
            {place.venue && (
              <>
                <dt className="uppercase tracking-widest text-muted-foreground">Venue</dt>
                <dd className="font-medium text-foreground">{place.venue}</dd>
              </>
            )}
            <dt className="uppercase tracking-widest text-muted-foreground">Address</dt>
            <dd className="font-medium text-foreground">
              {[place.address, place.city].filter(Boolean).join(", ") ||
                place.city ||
                "Address not provided"}
            </dd>
            {coordsLine && (
              <>
                <dt className="uppercase tracking-widest text-muted-foreground">Coords</dt>
                <dd className="font-mono text-[11px] text-muted-foreground">{coordsLine}</dd>
              </>
            )}
            {place.category && (
              <>
                <dt className="uppercase tracking-widest text-muted-foreground">Category</dt>
                <dd>
                  <span className="inline-flex rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium capitalize text-primary">
                    {place.category}
                  </span>
                </dd>
              </>
            )}
          </dl>

          <div className="space-y-1.5">
            <Label htmlFor="depart-time" className="flex items-center gap-1.5 text-xs uppercase tracking-widest text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              Depart / arrive by
            </Label>
            <Input
              id="depart-time"
              type="datetime-local"
              value={depart}
              onChange={(e) => setDepart(e.target.value)}
            />
            <p className="text-[11px] text-muted-foreground">
              We pass this time to the map so directions reflect traffic at that moment.
            </p>
          </div>

          <div className="space-y-2 rounded-lg border bg-muted/30 px-3 py-2 text-xs">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {geoState === "locating" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                ) : (
                  <LocateFixed className={`h-3.5 w-3.5 ${geoState === "ready" || manualOrigin.trim() ? "text-primary" : "text-muted-foreground"}`} />
                )}
                <span className="text-muted-foreground">
                  {manualOrigin.trim()
                    ? `Starting from "${manualOrigin.trim()}"`
                    : geoState === "ready" && origin
                      ? `Starting from your location (${origin.lat.toFixed(3)}, ${origin.lng.toFixed(3)})`
                      : geoState === "locating"
                        ? "Finding your location…"
                        : geoState === "denied"
                          ? "Location blocked — enter a starting address or open the map without one."
                          : geoState === "unavailable"
                            ? "Location unavailable — enter a starting address below."
                            : "Use your current location for turn-by-turn"}
                </span>
              </div>
              <div className="flex items-center gap-1">
                {geoState !== "ready" && geoState !== "locating" && !manualOrigin.trim() && (
                  <Button type="button" size="sm" variant="ghost" className="h-7 gap-1.5 px-2" onClick={requestLocation}>
                    <LocateFixed className="h-3.5 w-3.5" />
                    {geoState === "denied" ? "Retry" : "Use my location"}
                  </Button>
                )}
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 gap-1.5 px-2"
                  onClick={() => setShowManual((v) => !v)}
                >
                  <Pencil className="h-3.5 w-3.5" />
                  {showManual ? "Hide" : "Enter address"}
                </Button>
              </div>
            </div>
            {showManual && (
              <div className="space-y-1.5">
                <div className="relative flex items-center gap-1.5">
                  <Input
                    type="text"
                    inputMode="text"
                    autoComplete="off"
                    placeholder="Starting address, e.g. Taksim Square, Istanbul"
                    value={manualOrigin}
                    onChange={(e) => {
                      setManualOrigin(e.target.value);
                      setSuggestOpen(true);
                    }}
                    onFocus={() => {
                      if (suggestions.length > 0) setSuggestOpen(true);
                    }}
                    onBlur={() => {
                      // Delay so a click on a suggestion can register first.
                      window.setTimeout(() => setSuggestOpen(false), 150);
                      rememberManualOrigin(manualOrigin);
                    }}
                    onKeyDown={(e) => {
                      if (!suggestOpen || suggestions.length === 0) return;
                      if (e.key === "ArrowDown") {
                        e.preventDefault();
                        setActiveIndex((i) => (i + 1) % suggestions.length);
                      } else if (e.key === "ArrowUp") {
                        e.preventDefault();
                        setActiveIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
                      } else if (e.key === "Enter" && activeIndex >= 0) {
                        e.preventDefault();
                        pickSuggestion(suggestions[activeIndex]);
                      } else if (e.key === "Escape") {
                        setSuggestOpen(false);
                      }
                    }}
                    className="h-8 text-xs"
                    role="combobox"
                    aria-expanded={suggestOpen}
                    aria-autocomplete="list"
                    aria-controls="manual-origin-suggestions"
                    aria-activedescendant={
                      activeIndex >= 0 ? `manual-origin-suggestion-${activeIndex}` : undefined
                    }
                  />
                  {manualOrigin.trim() && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-8 px-2 text-[11px]"
                      onClick={() => {
                        setManualOrigin("");
                        rememberManualOrigin("");
                        setSuggestions([]);
                        setSuggestOpen(false);
                      }}
                    >
                      Forget
                    </Button>
                  )}
                  {suggestOpen && (suggestions.length > 0 || suggestLoading) && (
                    <ul
                      id="manual-origin-suggestions"
                      role="listbox"
                      className="absolute left-0 right-0 top-full z-50 mt-1 max-h-60 overflow-auto rounded-md border bg-popover py-1 text-xs shadow-lg"
                    >
                      {suggestLoading && suggestions.length === 0 && (
                        <li className="flex items-center gap-2 px-3 py-2 text-muted-foreground">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Searching addresses…
                        </li>
                      )}
                      {suggestions.map((s, i) => (
                        <li
                          key={s.placeId}
                          id={`manual-origin-suggestion-${i}`}
                          role="option"
                          aria-selected={i === activeIndex}
                          className={`flex cursor-pointer items-start gap-2 px-3 py-1.5 ${
                            i === activeIndex ? "bg-accent text-accent-foreground" : "hover:bg-accent/60"
                          }`}
                          onMouseDown={(e) => {
                            // Prevent the input's onBlur from firing before the click.
                            e.preventDefault();
                            pickSuggestion(s);
                          }}
                          onMouseEnter={() => setActiveIndex(i)}
                        >
                          <Search className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium">{s.primary}</p>
                            {s.secondary && (
                              <p className="truncate text-[10px] text-muted-foreground">{s.secondary}</p>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Saved on this device for next time. Suggestions are biased toward Istanbul.
                  Used as the origin when location services aren't available — Yandex Maps will
                  open a search prefilled with the route.
                </p>
              </div>
            )}
          </div>

          {!isOnline && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              <WifiOff className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <div className="space-y-1">
                <p className="font-medium">You're offline</p>
                <p className="text-destructive/80">
                  We can't open a map provider right now. Copy the address below and we'll
                  reopen directions automatically once you're back online.
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Button asChild={isOnline} className="gap-2" disabled={!isOnline} onClick={() => isOnline && choose("google")}>
              {isOnline ? (
                <a href={gHref} target="_top" rel="noopener noreferrer">
                  <Navigation className="h-4 w-4" />
                  Open in Google Maps
                  {preferred === "google" && <span className="ml-1 text-[10px] opacity-80">· default</span>}
                </a>
              ) : (
                <span className="inline-flex items-center gap-2">
                  <Navigation className="h-4 w-4" />
                  Open in Google Maps
                </span>
              )}
            </Button>
            <Button asChild={isOnline} variant="outline" className="gap-2" disabled={!isOnline} onClick={() => isOnline && choose("yandex")}>
              {isOnline ? (
                <a href={yHref} target="_top" rel="noopener noreferrer">
                  <Navigation className="h-4 w-4" />
                  Open in Yandex Maps
                  {preferred === "yandex" && <span className="ml-1 text-[10px] opacity-80">· default</span>}
                </a>
              ) : (
                <span className="inline-flex items-center gap-2">
                  <Navigation className="h-4 w-4" />
                  Open in Yandex Maps
                </span>
              )}
            </Button>
          </div>


          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={copyAddress}
            className="w-full justify-center gap-1.5 text-xs"
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copied — paste it anywhere" : "Copy location"}
          </Button>

          {preferred ? (
            <p className="text-[11px] text-muted-foreground">
              We'll open <span className="font-medium">{preferred === "google" ? "Google Maps" : "Yandex Maps"}</span> automatically next time.{" "}
              <button type="button" onClick={forget} className="underline hover:text-foreground">
                Forget
              </button>
            </p>
          ) : (
            <p className="text-[11px] text-muted-foreground">
              Pick a map once and we'll remember it for next time.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
