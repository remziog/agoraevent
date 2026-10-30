/**
 * "Add to calendar" for one gathering: an RFC 5545 .ics file and a Google
 * Calendar link, built only from the event record. Pure (no DOM, no imports) so
 * it runs in the browser, on the server and under `node --test`.
 *
 * Honesty rule: Agora never shows an end time the organiser didn't give. When
 * the record has no end, the exported file and link use a 2-hour default — and
 * say so in their description. The UI itself never shows that invented end.
 */

export type CalendarEventInput = {
  /** Event id (uuid); the UID is derived from it, so re-exporting updates instead of duplicating. */
  id: string;
  title: string;
  /** ISO 8601 start, any offset. */
  startsAt: string;
  /** ISO 8601 end, when the organiser gave one. */
  endsAt?: string | null;
  location?: string | null;
  description?: string | null;
  /** Public page of the event (http/https only). */
  url?: string | null;
};

export type CalendarTextOptions = {
  /** Sentence appended to the description when the record has no end time. */
  noEndNote?: string;
  /** More lines for the description (source, demo label…), in order. */
  extra?: readonly (string | null | undefined | false)[];
};

export const DEFAULT_DURATION_MINUTES = 120;
/** Events are listed in Istanbul time; calendars convert from UTC themselves. */
export const EVENT_TIME_ZONE = "Europe/Istanbul";
const UID_DOMAIN = "ago-ra.life"; // SITE_URL in src/lib/site.ts
const DEFAULT_NO_END_NOTE =
  "No end time was given; the 2-hour duration in this calendar entry is an estimate.";

/** UTC in iCalendar basic format: 2026-10-31T19:30:00+03:00 → 20261031T163000Z. */
export function icsUtc(date: Date): string {
  if (Number.isNaN(date.getTime())) throw new RangeError("Invalid date");
  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
}

/**
 * Escape a TEXT value (RFC 5545 §3.3.11): backslash, semicolon and comma get a
 * backslash, every line break becomes "\n". Other control characters are not
 * allowed in TEXT and are dropped; the colon needs no escaping.
 */
export function escapeIcsText(value: string | null | undefined): string {
  return String(value ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");
}

function utf8Length(ch: string): number {
  const cp = ch.codePointAt(0) ?? 0;
  return cp < 0x80 ? 1 : cp < 0x800 ? 2 : cp < 0x10000 ? 3 : 4;
}

/**
 * Fold a content line (RFC 5545 §3.1): no line longer than 75 octets, each
 * continuation starts with one space, and a multi-byte UTF-8 character is
 * never split between two lines.
 */
export function foldIcsLine(line: string, limit = 75): string {
  const out: string[] = [];
  let cur = "";
  let bytes = 0;
  let max = limit;
  for (const ch of line) {
    const n = utf8Length(ch);
    if (bytes + n > max && cur !== "") {
      out.push(cur);
      cur = "";
      bytes = 0;
      max = limit - 1; // the leading space of a continuation line counts
    }
    cur += ch;
    bytes += n;
  }
  out.push(cur);
  return out.join("\r\n ");
}

/** Start and end as dates; `endEstimated` is true when the end is the 2-hour default. */
export function calendarWindow(ev: Pick<CalendarEventInput, "startsAt" | "endsAt">): {
  start: Date;
  end: Date;
  endEstimated: boolean;
} {
  const start = new Date(ev.startsAt);
  if (Number.isNaN(start.getTime())) throw new RangeError("Invalid start date");
  const given = ev.endsAt ? new Date(ev.endsAt) : null;
  if (given && !Number.isNaN(given.getTime()) && given.getTime() > start.getTime()) {
    return { start, end: given, endEstimated: false };
  }
  return {
    start,
    end: new Date(start.getTime() + DEFAULT_DURATION_MINUTES * 60_000),
    endEstimated: true,
  };
}

/** The description shared by the file and the Google link (plain text, not escaped). */
export function calendarDescription(
  ev: CalendarEventInput,
  opts: CalendarTextOptions = {},
): string {
  const { endEstimated } = calendarWindow(ev);
  return [
    ev.description?.trim(),
    endEstimated ? (opts.noEndNote ?? DEFAULT_NO_END_NOTE) : null,
    ...(opts.extra ?? []),
    safeUrl(ev.url),
  ]
    .filter((s): s is string => typeof s === "string" && s.trim() !== "")
    .join("\n\n");
}

function safeUrl(url: string | null | undefined): string | null {
  return url && /^https?:\/\/[^\s"<>]+$/i.test(url) ? url : null;
}

/** A stable UID from the event id: exporting the same gathering twice updates one entry. */
export function icsUid(id: string): string {
  const clean = String(id).replace(/[^A-Za-z0-9._-]/g, "") || "event";
  return `event-${clean}@${UID_DOMAIN}`;
}

/** The whole VCALENDAR as text with CRLF line endings, every line folded. */
export function buildIcs(
  ev: CalendarEventInput,
  opts: CalendarTextOptions & { now?: Date } = {},
): string {
  const { start, end } = calendarWindow(ev);
  const description = calendarDescription(ev, opts);
  const url = safeUrl(ev.url);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Agora//Agora gatherings//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${icsUid(ev.id)}`,
    `DTSTAMP:${icsUtc(opts.now ?? new Date())}`,
    `DTSTART:${icsUtc(start)}`,
    `DTEND:${icsUtc(end)}`,
    `SUMMARY:${escapeIcsText(ev.title)}`,
    ev.location?.trim() ? `LOCATION:${escapeIcsText(ev.location.trim())}` : null,
    description ? `DESCRIPTION:${escapeIcsText(description)}` : null,
    url ? `URL:${url}` : null,
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter((l): l is string => l !== null);
  return lines.map((l) => foldIcsLine(l)).join("\r\n") + "\r\n";
}

/** A Google Calendar "add event" link with the same times (UTC) and description. */
export function googleCalendarUrl(ev: CalendarEventInput, opts: CalendarTextOptions = {}): string {
  const { start, end } = calendarWindow(ev);
  const q = new URLSearchParams({
    action: "TEMPLATE",
    text: ev.title,
    dates: `${icsUtc(start)}/${icsUtc(end)}`,
    details: calendarDescription(ev, opts),
    ctz: EVENT_TIME_ZONE,
  });
  if (ev.location?.trim()) q.set("location", ev.location.trim());
  return `https://calendar.google.com/calendar/render?${q.toString()}`;
}

/** "agora-kadikoy-jazz-night.ics": ASCII, lower case, at most 40 characters of title. */
export function icsFileName(title: string): string {
  const slug = String(title ?? "")
    .replace(/ı/g, "i")
    .replace(/İ/g, "I")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
  return `agora-${slug || "event"}.ics`;
}
