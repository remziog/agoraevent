import type { TFunction } from "i18next";
import { EVENT_TZ, type ChallengeId, type ExperienceRecord, type SquareId } from "@/lib/bingo";

export const squareTitle = (t: TFunction, id: SquareId) => t(`bingo.sq.${id}.t`);

/** Display name of a record: a self-marked square shows the square's title in the current language. */
export const recordName = (t: TFunction, r: ExperienceRecord) =>
  r.kind === "challenge" ? squareTitle(t, r.refId as ChallengeId) : r.name;

const mid = (period: string) => new Date(`${period}-15T12:00:00Z`);

export function monthName(period: string, lang: string) {
  try {
    return new Intl.DateTimeFormat(lang, { month: "long", timeZone: EVENT_TZ }).format(mid(period));
  } catch {
    return period;
  }
}

export function periodLabel(period: string, lang: string) {
  try {
    return new Intl.DateTimeFormat(lang, { month: "long", year: "numeric", timeZone: EVENT_TZ }).format(mid(period));
  } catch {
    return period;
  }
}

/** A record's Istanbul day, e.g. "31 October" (with the year when it isn't this year). */
export function dayLabel(day: string, lang: string, withYear = false) {
  try {
    return new Intl.DateTimeFormat(lang, {
      day: "numeric",
      month: "long",
      ...(withYear ? { year: "numeric" } : {}),
      timeZone: "UTC",
    }).format(new Date(`${day}T12:00:00Z`));
  } catch {
    return day;
  }
}

export function shortMonth(day: string, lang: string) {
  try {
    return new Intl.DateTimeFormat(lang, { month: "short", timeZone: "UTC" })
      .format(new Date(`${day}T12:00:00Z`))
      .replace(/\.$/, "");
  } catch {
    return day.slice(5, 7);
  }
}
