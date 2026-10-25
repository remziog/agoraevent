import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, MapPin, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { autocompletePlaces, getPlaceDetails, type PlaceDetails } from "@/lib/places.functions";

type Suggestion = { placeId: string; primary: string; secondary: string; text: string };

const DEBOUNCE_MS = 350;
const newToken = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`;

/**
 * Venue picker for the organizer event form: Google Places autocomplete
 * (via the connector gateway), then Place Details for coordinates. The user
 * can also just type a venue name — then no coordinates are attached.
 */
export function PlacePicker({
  value,
  onTextChange,
  onPick,
  placeholder,
  disabled,
}: {
  value: string;
  onTextChange: (text: string) => void;
  onPick: (place: PlaceDetails) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const fetchSuggestions = useServerFn(autocompletePlaces);
  const fetchDetails = useServerFn(getPlaceDetails);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [picked, setPicked] = useState<PlaceDetails | null>(null);
  const skipNextFetchRef = useRef(false);
  const sessionTokenRef = useRef<string>(newToken());

  useEffect(() => {
    if (skipNextFetchRef.current) {
      skipNextFetchRef.current = false;
      return;
    }
    const q = value.trim();
    if (q.length < 3) {
      setSuggestions([]);
      setOpen(false);
      setLoading(false);
      return;
    }
    let cancelled = false;
    const controller = new AbortController();
    setLoading(true);
    const handle = window.setTimeout(async () => {
      try {
        const { suggestions: next } = await fetchSuggestions({
          data: { input: q, sessionToken: sessionTokenRef.current },
          signal: controller.signal,
        });
        if (cancelled) return;
        setSuggestions(next);
        setOpen(next.length > 0);
        setActiveIndex(-1);
      } catch (err) {
        if (cancelled || (err as { name?: string } | null)?.name === "AbortError") return;
        setSuggestions([]);
        setOpen(false);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
      controller.abort();
    };
  }, [value, fetchSuggestions]);

  async function pick(s: Suggestion) {
    skipNextFetchRef.current = true;
    onTextChange(s.primary || s.text);
    setOpen(false);
    setSuggestions([]);
    setActiveIndex(-1);
    setResolving(true);
    try {
      const { place } = await fetchDetails({
        data: { placeId: s.placeId, sessionToken: sessionTokenRef.current },
      });
      if (place) {
        setPicked(place);
        onPick(place);
      }
    } catch (err) {
      console.error("[places] details failed", err);
    } finally {
      setResolving(false);
      sessionTokenRef.current = newToken();
    }
  }

  return (
    <div className="relative">
      <div className="flex items-center gap-1.5">
        <Input
          value={value}
          onChange={(e) => {
            onTextChange(e.target.value);
            setPicked(null);
          }}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (!open || suggestions.length === 0) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActiveIndex((i) => (i + 1) % suggestions.length);
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActiveIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
            } else if (e.key === "Enter" && activeIndex >= 0) {
              e.preventDefault();
              void pick(suggestions[activeIndex]);
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
          placeholder={placeholder ?? "Venue — start typing to search"}
          autoComplete="off"
          disabled={disabled}
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
          aria-controls="place-picker-suggestions"
        />
        {(loading || resolving) && (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
        )}
        {value && !loading && !resolving && (
          <button
            type="button"
            aria-label="Clear venue"
            className="text-muted-foreground hover:text-foreground"
            onClick={() => {
              onTextChange("");
              setPicked(null);
              setSuggestions([]);
              setOpen(false);
            }}
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {open && suggestions.length > 0 && (
        <ul
          id="place-picker-suggestions"
          role="listbox"
          className="absolute left-0 right-0 top-full z-50 mt-1 max-h-60 overflow-auto rounded-md border bg-popover py-1 text-sm shadow-lg"
        >
          {suggestions.map((s, i) => (
            <li
              key={s.placeId}
              role="option"
              aria-selected={i === activeIndex}
              className={`flex cursor-pointer items-start gap-2 px-3 py-1.5 ${
                i === activeIndex ? "bg-accent text-accent-foreground" : "hover:bg-accent/60"
              }`}
              onMouseDown={(e) => {
                e.preventDefault();
                void pick(s);
              }}
              onMouseEnter={() => setActiveIndex(i)}
            >
              <Search className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{s.primary}</p>
                {s.secondary && (
                  <p className="truncate text-xs text-muted-foreground">{s.secondary}</p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
        <MapPin className="h-3 w-3" />
        {picked
          ? `${picked.formattedAddress || picked.name} · ${picked.latitude.toFixed(4)}, ${picked.longitude.toFixed(4)}`
          : "Pick a suggestion to attach coordinates (map pin + directions)."}
      </p>
    </div>
  );
}
