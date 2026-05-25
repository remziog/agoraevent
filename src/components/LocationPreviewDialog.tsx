import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Navigation, MapPin } from "lucide-react";
import { useState, type ReactNode } from "react";

type Place = {
  title: string;
  venue?: string | null;
  city?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

function destinationQuery(p: Place) {
  if (p.latitude != null && p.longitude != null) return `${p.latitude},${p.longitude}`;
  return [p.venue, p.city, p.title].filter(Boolean).join(", ");
}

function googleMapsHref(p: Place) {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destinationQuery(p))}`;
}

function yandexMapsHref(p: Place) {
  if (p.latitude != null && p.longitude != null) {
    // Yandex uses lon,lat order
    return `https://yandex.com/maps/?rtext=~${p.latitude},${p.longitude}&rtt=auto`;
  }
  const q = [p.venue, p.city, p.title].filter(Boolean).join(", ");
  return `https://yandex.com/maps/?text=${encodeURIComponent(q)}`;
}

function embedSrc(p: Place) {
  const q = destinationQuery(p);
  // No-key embeddable Google map preview
  return `https://www.google.com/maps?q=${encodeURIComponent(q)}&output=embed`;
}

export function LocationPreviewDialog({ place, trigger }: { place: Place; trigger: ReactNode }) {
  const [open, setOpen] = useState(false);
  const label = [place.venue, place.city].filter(Boolean).join(" · ") || place.title;

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

        <div className="grid grid-cols-1 gap-2 p-5 sm:grid-cols-2">
          <Button asChild className="gap-2">
            <a href={googleMapsHref(place)} target="_top" rel="noopener noreferrer">
              <Navigation className="h-4 w-4" />
              Open in Google Maps
            </a>
          </Button>
          <Button asChild variant="outline" className="gap-2">
            <a href={yandexMapsHref(place)} target="_top" rel="noopener noreferrer">
              <Navigation className="h-4 w-4" />
              Open in Yandex Maps
            </a>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
