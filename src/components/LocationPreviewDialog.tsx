import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Navigation, MapPin, Clock, Copy, Check, ExternalLink, LocateFixed, Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

type Coords = { lat: number; lng: number };

type Provider = "google" | "yandex";
const PROVIDER_KEY = "agora:preferredMapProvider";

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

function googleMapsHref(p: Place, departISO: string) {
  const params = new URLSearchParams({
    api: "1",
    destination: destinationQuery(p),
    travelmode: "driving",
  });
  // Google Maps web URL doesn't officially honor departure_time, but we
  // include it so deep-linking into the Google Maps app can pick it up.
  const unix = toUnixSeconds(departISO);
  if (unix) params.set("departure_time", String(unix));
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

function yandexMapsHref(p: Place, departISO: string) {
  const rtext =
    p.latitude != null && p.longitude != null
      ? `~${p.latitude},${p.longitude}`
      : "";
  const params = new URLSearchParams({ rtt: "auto" });
  if (rtext) {
    params.set("rtext", rtext);
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
  const autoLaunchedRef = useRef(false);
  const embedLoadedRef = useRef(false);
  const label = [place.venue, place.city].filter(Boolean).join(" · ") || place.title;
  const addressLine = [place.venue, place.city].filter(Boolean).join(", ") || place.title;
  const coordsLine =
    place.latitude != null && place.longitude != null
      ? `${place.latitude.toFixed(5)}, ${place.longitude.toFixed(5)}`
      : null;

  const gHref = useMemo(() => googleMapsHref(place, depart), [place, depart]);
  const yHref = useMemo(() => yandexMapsHref(place, depart), [place, depart]);

  // Auto-open the preferred provider on first open of this dialog instance.
  useEffect(() => {
    if (!open || autoLaunchedRef.current) return;
    const pref = getPreferredProvider();
    if (!pref) return;
    autoLaunchedRef.current = true;
    setOpen(false);
    openTop(pref === "google" ? gHref : yHref);
  }, [open, gHref, yHref]);

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

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Button asChild className="gap-2" onClick={() => choose("google")}>
              <a href={gHref} target="_top" rel="noopener noreferrer">
                <Navigation className="h-4 w-4" />
                Open in Google Maps
                {preferred === "google" && <span className="ml-1 text-[10px] opacity-80">· default</span>}
              </a>
            </Button>
            <Button asChild variant="outline" className="gap-2" onClick={() => choose("yandex")}>
              <a href={yHref} target="_top" rel="noopener noreferrer">
                <Navigation className="h-4 w-4" />
                Open in Yandex Maps
                {preferred === "yandex" && <span className="ml-1 text-[10px] opacity-80">· default</span>}
              </a>
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
