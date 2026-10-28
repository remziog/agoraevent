import type { TFunction } from "i18next";
// Small display helpers for the taste guide (client-safe).

const TYPE_LABELS: Record<string, string> = {
  "urn:entity:artist": "Artist",
  "urn:entity:movie": "Film",
  "urn:entity:tv_show": "TV series",
  "urn:entity:book": "Book",
  "urn:entity:person": "Person",
  "urn:entity:author": "Author",
  "urn:entity:podcast": "Podcast",
  "urn:entity:videogame": "Video game",
  "urn:entity:brand": "Brand",
  "urn:entity:place": "Place",
  "urn:entity:destination": "Destination",
  "urn:entity:locality": "City",
};

export function entityTypeLabel(types: readonly string[] | string | undefined): string {
  const list = typeof types === "string" ? [types] : (types ?? []);
  for (const t of list) {
    if (TYPE_LABELS[t]) return TYPE_LABELS[t];
  }
  const raw = list[0]?.replace("urn:entity:", "").replace(/_/g, " ");
  return raw ? raw.charAt(0).toUpperCase() + raw.slice(1) : "";
}

export function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Istanbul",
  });
}

export function mapsSearchUrl(name: string, address?: string): string {
  const q = encodeURIComponent([name, address ?? "Istanbul"].filter(Boolean).join(", "));
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
}

/** "A", "A & B", "A, B & C" */
export function joinNames(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} & ${names[names.length - 1]}`;
}

export const QLOO_ERROR_TEXT: Record<string, string> = {
  qloo_not_configured: "Qloo isn't connected on Agora's server yet.",
  qloo_auth: "Qloo didn't accept Agora's credential just now.",
  qloo_rate_limited: "Qloo is busy right now (rate limit). Try again in a minute.",
  qloo_unavailable: "Qloo didn't answer just now. Try again in a moment.",
};


/** Localised text for a Qloo error code (falls back to the English table). */
export function qlooErrorText(t: TFunction, code: string): string {
  return t(`guide.error.${code}`, { defaultValue: QLOO_ERROR_TEXT[code] ?? QLOO_ERROR_TEXT.qloo_unavailable });
}

/** Date/time in Istanbul for the selected language. */
export function formatWhenLocalized(iso: string, lang: string): string {
  const locale = lang.startsWith("tr") ? "tr-TR" : lang.startsWith("de") ? "de-DE" : lang.startsWith("ru") ? "ru-RU" : "en-GB";
  return new Date(iso).toLocaleString(locale, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Istanbul",
  });
}
