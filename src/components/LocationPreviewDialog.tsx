import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Navigation, MapPin, Clock } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

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
  const label = [place.venue, place.city].filter(Boolean).join(" · ") || place.title;

  const gHref = useMemo(() => googleMapsHref(place, depart), [place, depart]);
  const yHref = useMemo(() => yandexMapsHref(place, depart), [place, depart]);

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

        <div className="mt-3 aspect-video w-full bg-muted">
          <iframe
            title={`Map of ${place.title}`}
            src={embedSrc(place)}
            className="h-full w-full border-0"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            allowFullScreen
          />
        </div>

        <div className="space-y-3 p-5">
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
            <Button asChild className="gap-2">
              <a href={gHref} target="_top" rel="noopener noreferrer">
                <Navigation className="h-4 w-4" />
                Open in Google Maps
              </a>
            </Button>
            <Button asChild variant="outline" className="gap-2">
              <a href={yHref} target="_top" rel="noopener noreferrer">
                <Navigation className="h-4 w-4" />
                Open in Yandex Maps
              </a>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
