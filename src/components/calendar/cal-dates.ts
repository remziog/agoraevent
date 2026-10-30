// Calendar days in Istanbul time, independent of the device's time zone.
// A "day number" counts calendar days since 1970-01-01 *in Istanbul*, so two
// instants on the same Istanbul date always share a day number.

export const EVENT_TZ = "Europe/Istanbul";

const partsFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: EVENT_TZ,
  year: "numeric",
  month: "numeric",
  day: "numeric",
});

export function istanbulDay(date: Date): number {
  const parts = partsFmt.formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return Math.round(Date.UTC(get("year"), get("month") - 1, get("day")) / 86_400_000);
}

/** Midday in Istanbul on that day — safe to format with `timeZone: EVENT_TZ`. */
export function dayToDate(day: number): Date {
  return new Date(day * 86_400_000 + 9 * 3_600_000);
}

export function localeFor(lang: string): string {
  return lang.startsWith("tr")
    ? "tr-TR"
    : lang.startsWith("de")
      ? "de-DE"
      : lang.startsWith("ru")
        ? "ru-RU"
        : "en-GB";
}

export function fmtDay(day: number, locale: string, opts: Intl.DateTimeFormatOptions): string {
  return dayToDate(day).toLocaleDateString(locale, { ...opts, timeZone: EVENT_TZ });
}

/** "19:30" in Istanbul. */
export function fmtTime(iso: string, locale: string): string {
  return new Date(iso).toLocaleTimeString(locale, {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: EVENT_TZ,
  });
}
