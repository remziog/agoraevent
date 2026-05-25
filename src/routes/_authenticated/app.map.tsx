import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, MapPin } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/app/map")({
  component: MapView,
});

type EventRow = {
  id: string;
  title: string;
  starts_at: string;
  city: string | null;
  category: string;
  latitude: number | null;
  longitude: number | null;
  venue: string | null;
  organizations?: { name?: string } | null;
  tags?: string[];
};

declare global {
  interface Window {
    google?: any;
    __agoraInitMap?: () => void;
  }
}

function MapView() {
  const navigate = useNavigate();
  const mapRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<{
    events: EventRow[];
    tags: string[];
    prompt: string;
  } | null>(null);
  const [selected, setSelected] = useState<EventRow | null>(null);
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    const raw = sessionStorage.getItem("agora:lastSearch");
    if (!raw) {
      navigate({ to: "/app" });
      return;
    }
    try {
      const parsed = JSON.parse(raw);
      setData(parsed);
      setSelected(parsed.events?.[0] ?? null);
    } catch {
      navigate({ to: "/app" });
    }
  }, [navigate]);

  // Load Google Maps JS
  useEffect(() => {
    if (window.google?.maps) {
      setMapReady(true);
      return;
    }
    const key = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY;
    const tracking = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID;
    if (!key) return;
    window.__agoraInitMap = () => setMapReady(true);
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${key}&loading=async&callback=__agoraInitMap${tracking ? `&channel=${tracking}` : ""}`;
    s.async = true;
    document.head.appendChild(s);
    return () => {
      window.__agoraInitMap = undefined;
    };
  }, []);

  // Render map + markers
  useEffect(() => {
    if (!mapReady || !data || !mapRef.current || !window.google?.maps) return;
    const withCoords = data.events.filter(
      (e) => typeof e.latitude === "number" && typeof e.longitude === "number",
    );
    const center =
      withCoords[0] && withCoords[0].latitude && withCoords[0].longitude
        ? { lat: withCoords[0].latitude, lng: withCoords[0].longitude }
        : { lat: 41.0082, lng: 28.9784 }; // fallback Istanbul

    const map = new window.google.maps.Map(mapRef.current, {
      center,
      zoom: withCoords.length > 0 ? 13 : 4,
      disableDefaultUI: true,
      zoomControl: true,
      styles: [
        { elementType: "geometry", stylers: [{ color: "#1a1d24" }] },
        { elementType: "labels.text.stroke", stylers: [{ color: "#1a1d24" }] },
        { elementType: "labels.text.fill", stylers: [{ color: "#8a8f9a" }] },
        { featureType: "water", elementType: "geometry", stylers: [{ color: "#0e1015" }] },
        { featureType: "road", elementType: "geometry", stylers: [{ color: "#272a32" }] },
        { featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] },
      ],
    });

    withCoords.forEach((e, idx) => {
      const marker = new window.google.maps.Marker({
        position: { lat: e.latitude!, lng: e.longitude! },
        map,
        title: e.title,
        label: idx === 0 ? { text: "★", color: "#fff", fontSize: "16px" } : undefined,
        animation: idx === 0 ? window.google.maps.Animation.DROP : undefined,
      });
      marker.addListener("click", () => setSelected(e));
    });
  }, [mapReady, data]);

  return (
    <div className="flex h-screen flex-col bg-background">
      <AppHeader variant="member" />
      <div className="relative flex-1 overflow-hidden">
        {/* Map */}
        <div ref={mapRef} className="absolute inset-0 bg-muted">
          {!mapReady && (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Loading map…
            </div>
          )}
        </div>

        {/* Top bar */}
        <div className="absolute left-4 right-4 top-4 z-10 flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => navigate({ to: "/app" })}
            className="gap-1 shadow-lg"
          >
            <ArrowLeft className="h-4 w-4" />
            New search
          </Button>
          {data && (
            <div className="flex flex-1 flex-wrap gap-1 overflow-hidden">
              {data.tags.slice(0, 5).map((t) => (
                <span
                  key={t}
                  className="rounded-full bg-background/90 px-2 py-1 text-xs shadow-sm backdrop-blur"
                >
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Bottom sheet of results */}
        <div className="absolute inset-x-0 bottom-0 z-10 max-h-[55%] overflow-y-auto rounded-t-3xl border-t border-border bg-background/95 p-4 shadow-2xl backdrop-blur">
          {data && (
            <>
              <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-muted-foreground/30" />
              <p className="text-xs uppercase tracking-widest text-muted-foreground">
                {data.events.length} matches for
              </p>
              <p className="line-clamp-1 font-display text-base">"{data.prompt}"</p>

              {selected && (
                <Link
                  to="/app/event/$id"
                  params={{ id: selected.id }}
                  className="mt-3 block rounded-2xl border border-primary/40 bg-card p-4 transition hover:border-primary"
                >
                  <p className="text-xs uppercase tracking-widest text-primary">Top match</p>
                  <h3 className="mt-1 font-display text-xl">{selected.title}</h3>
                  <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    {selected.venue ?? selected.organizations?.name} · {selected.city ?? "—"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(selected.starts_at).toLocaleString([], {
                      weekday: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                </Link>
              )}

              {data.events.length > 1 && (
                <div className="mt-3 space-y-2">
                  <p className="text-xs uppercase tracking-widest text-muted-foreground">
                    Also nearby
                  </p>
                  {data.events.slice(1, 6).map((e) => (
                    <button
                      key={e.id}
                      onClick={() => setSelected(e)}
                      className="block w-full rounded-xl border bg-card/60 p-3 text-left transition hover:border-primary/50"
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="font-medium">{e.title}</span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(e.starts_at).toLocaleDateString([], {
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {e.city ?? "—"} · {e.category}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
