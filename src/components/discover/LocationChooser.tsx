import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, Globe2, LocateFixed, MapPin, Search } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { DISTRICTS, fold } from "@/lib/discovery";
import { distanceKm } from "@/components/compass/DiscoveryDial";

/**
 * Where to discover (design: Naz Paşalı). The discovery location is separate
 * from where the person physically is: it is a district chosen from the list,
 * the nearest district to the device (only when the person asks for it), or
 * the whole city. It is stored on this device and only fills in a district
 * when the request doesn't name one — a written district always wins.
 */
const KEY = "agora:discovery-location:v1";

export type DiscoveryLocation =
  | { mode: "city" }
  | { mode: "district"; name: string; near?: boolean };

export function readLocation(): DiscoveryLocation {
  try {
    const raw = localStorage.getItem(KEY);
    const v = raw ? (JSON.parse(raw) as DiscoveryLocation) : null;
    if (v && v.mode === "district" && DISTRICTS.some((d) => d.name === v.name)) return v;
  } catch {
    /* storage unavailable */
  }
  return { mode: "city" };
}

function writeLocation(v: DiscoveryLocation) {
  try {
    localStorage.setItem(KEY, JSON.stringify(v));
  } catch {
    /* kept for this visit only */
  }
}

export function useDiscoveryLocation() {
  const [loc, setLoc] = useState<DiscoveryLocation>({ mode: "city" });
  useEffect(() => setLoc(readLocation()), []);
  return [
    loc,
    (v: DiscoveryLocation) => {
      writeLocation(v);
      setLoc(v);
    },
  ] as const;
}

export function LocationChooser({
  value,
  onChange,
}: {
  value: DiscoveryLocation;
  onChange: (v: DiscoveryLocation) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);

  const list = useMemo(() => {
    const f = fold(query).trim();
    return f
      ? DISTRICTS.filter((d) => fold(d.name).includes(f) || d.aliases.some((a) => a.includes(f)))
      : DISTRICTS;
  }, [query]);

  const label =
    value.mode === "city"
      ? t("loc.city", "All Istanbul")
      : value.near
        ? t("loc.near", { name: value.name, defaultValue: "Near me · {{name}}" })
        : value.name;

  function pick(v: DiscoveryLocation) {
    onChange(v);
    setOpen(false);
    setNote(null);
    setQuery("");
  }

  function useDevice() {
    if (!("geolocation" in navigator)) {
      setNote(
        t("loc.unsupported", "This browser can't share a location. Pick a district instead."),
      );
      return;
    }
    setLocating(true);
    setNote(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const here = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        const nearest = DISTRICTS.map((d) => ({ d, km: distanceKm(here, d) })).sort(
          (a, b) => a.km - b.km,
        )[0];
        if (!nearest || nearest.km > 15) {
          setNote(
            t(
              "loc.outside",
              "You seem to be outside Istanbul. Agora knows Istanbul only — pick a district.",
            ),
          );
          return;
        }
        pick({ mode: "district", name: nearest.d.name, near: true });
      },
      () => {
        setLocating(false);
        setNote(t("loc.denied", "Location wasn't shared. Pick a district from the list."));
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 },
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-label={t("loc.button", {
          place: label,
          defaultValue: "Discovery location: {{place}}. Change",
        })}
        className="inline-flex min-h-11 max-w-[11rem] shrink-0 items-center gap-1.5 rounded-full px-3 text-[13px] text-[color:var(--nt)] shadow-[inset_0_0_0_1px_var(--nt-line)] transition hover:shadow-[inset_0_0_0_1px_var(--nt)]"
      >
        <span
          aria-hidden
          className={`h-2 w-2 shrink-0 rounded-full ${value.mode === "city" ? "shadow-[inset_0_0_0_1.5px_var(--nt-2)]" : "bg-[color:var(--amber)] shadow-[0_0_0_3px_rgb(242_164_58/0.22)]"}`}
        />
        <span className="truncate">{label}</span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="bottom"
          className="max-h-[85dvh] overflow-y-auto rounded-t-[34px] px-5 pb-6"
        >
          <SheetHeader className="text-left">
            <SheetTitle className="text-[2.1rem] font-[850] leading-none [font-stretch:70%]">
              {t("loc.title", "Where shall we explore?")}
            </SheetTitle>
            <SheetDescription>
              {t(
                "loc.lead",
                "Agora fills in this district when your request doesn't name one. It is kept on this device.",
              )}
            </SheetDescription>
          </SheetHeader>

          <label className="relative mt-4 block">
            <span className="sr-only">{t("loc.search", "Search a district")}</span>
            <Search
              className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("loc.search", "Search a district")}
              className="h-12 w-full rounded-2xl border bg-card pl-11 pr-4 text-base outline-none focus:border-foreground"
            />
          </label>

          <ul className="mt-3 divide-y">
            <li>
              <button
                type="button"
                onClick={useDevice}
                disabled={locating}
                className="flex min-h-14 w-full items-center gap-3 text-left disabled:opacity-60"
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border">
                  <LocateFixed className="h-4 w-4 text-brand" aria-hidden />
                </span>
                <span>
                  <b className="block font-semibold">{t("loc.useMine", "Use my location")}</b>
                  <small className="text-muted-foreground">
                    {locating
                      ? t("loc.locating", "Finding the nearest district…")
                      : t(
                          "loc.useMineHint",
                          "Only to pick the nearest district; never sent to Qloo",
                        )}
                  </small>
                </span>
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={() => pick({ mode: "city" })}
                aria-pressed={value.mode === "city"}
                className="flex min-h-14 w-full items-center gap-3 text-left"
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border">
                  <Globe2 className="h-4 w-4 text-brand" aria-hidden />
                </span>
                <span>
                  <b className="block font-semibold">{t("loc.city", "All Istanbul")}</b>
                  <small className="text-muted-foreground">
                    {t("loc.cityHint", "Agora asks for a district when a place needs one")}
                  </small>
                </span>
              </button>
            </li>
            {list.map((d) => (
              <li key={d.name}>
                <button
                  type="button"
                  onClick={() => pick({ mode: "district", name: d.name })}
                  aria-pressed={value.mode === "district" && value.name === d.name}
                  className="flex min-h-12 w-full items-center gap-3 text-left aria-pressed:font-semibold"
                >
                  <MapPin className="ml-3 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                  {d.name}
                </button>
              </li>
            ))}
          </ul>
          {note && (
            <p className="mt-3 text-sm text-brand" role="status">
              {note}
            </p>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}

/** Adds the chosen district to a request that names none (the written word always wins). */
export function withLocation(
  request: string,
  loc: DiscoveryLocation,
  hasDistrict: boolean,
): string {
  if (loc.mode !== "district" || hasDistrict) return request;
  return `${request} · ${loc.name}`;
}
