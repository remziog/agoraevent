import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Bookmark, BookmarkCheck } from "lucide-react";
import { formatWhenLocalized } from "@/components/guide/guide-format";
import { fmtDay, fmtTime, istanbulDay } from "./cal-dates";

/** The fields the calendar rows read (from listUpcomingEvents / listMyRsvps). */
export type CalEvent = {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string | null;
  venue: string | null;
  city: string | null;
  price: number | null;
  tags: string[] | null;
  organizations: { name: string } | null;
};

const MONO = "font-mono text-[10.5px] uppercase tracking-[0.08em]";
export const FOCUS =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff5b1f]";

/** Pill segmented control (Naz v3 ".seg"). */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="inline-flex gap-0.5 rounded-full bg-card p-[3px] shadow-[inset_0_0_0_1px_var(--border)]"
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={`min-h-11 rounded-full px-4 text-[13px] transition-colors ${FOCUS} ${
            value === o.value
              ? "bg-foreground font-semibold text-background"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Seven days with dots: an orange dot for listed gatherings, an ink one for my plans. */
export function WeekStrip({
  days,
  today,
  selected,
  locale,
  eventCount,
  planCount,
  onSelect,
}: {
  days: number[];
  today: number;
  selected: number | null;
  locale: string;
  eventCount: (day: number) => number;
  planCount: (day: number) => number;
  onSelect: (day: number | null) => void;
}) {
  const { t } = useTranslation();
  return (
    <div
      role="group"
      aria-label={t("v3paper.cal.pickDay", "Pick a day")}
      className="-mx-4 mt-4 grid grid-cols-7 sm:mx-0 sm:gap-1"
    >
      {days.map((day) => {
        const pressed = selected === day;
        const n = eventCount(day);
        const mine = planCount(day);
        const label = [
          fmtDay(day, locale, { weekday: "long", day: "numeric", month: "long" }),
          n > 0
            ? t("v3paper.cal.dayEvents", { count: n, defaultValue: "{{count}} gatherings" })
            : "",
          mine > 0 ? t("v3paper.cal.dayPlans", "you're going") : "",
        ]
          .filter(Boolean)
          .join(", ");
        return (
          <button
            key={day}
            type="button"
            aria-pressed={pressed}
            aria-label={label}
            onClick={() => onSelect(pressed ? null : day)}
            className={`grid min-h-16 min-w-0 place-items-center rounded-2xl py-1.5 transition-colors ${FOCUS} ${
              pressed ? "bg-foreground text-background" : "hover:bg-muted"
            }`}
          >
            <small
              className={`${MONO} text-[9.5px] ${pressed ? "text-background/70" : "text-muted-foreground"}`}
            >
              {day === today
                ? t("v3paper.cal.todayShort", "Today")
                : fmtDay(day, locale, { weekday: "short" })}
            </small>
            <b className="font-display text-2xl font-[800] leading-none [font-stretch:75%]">
              {fmtDay(day, locale, { day: "numeric" })}
            </b>
            <span aria-hidden className="flex h-[5px] gap-[3px]">
              {mine > 0 && (
                <i
                  className={`h-[5px] w-[5px] rounded-full ${pressed ? "bg-background" : "bg-foreground"}`}
                />
              )}
              {n > 0 && <i className="h-[5px] w-[5px] rounded-full bg-[#ff5b1f]" />}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function DayHeader({ title, date }: { title: string; date: string }) {
  return (
    <div className="mt-7 flex items-baseline justify-between gap-3 border-t-2 border-foreground pb-1 pt-2">
      <h3 className="font-display text-2xl font-[850] leading-none [font-stretch:72%]">{title}</h3>
      <span className={`${MONO} text-muted-foreground`}>{date}</span>
    </div>
  );
}

/** One gathering: time · title · meta · save toggle (Naz v3 ".crow"). Save is never an RSVP. */
export function CalendarRow({
  event: e,
  locale,
  going,
  saved,
  saveBusy,
  onToggleSave,
}: {
  event: CalEvent;
  locale: string;
  going: boolean;
  saved: boolean;
  saveBusy: boolean;
  onToggleSave: () => void;
}) {
  const { t } = useTranslation();
  const demo = (e.tags ?? []).includes("demo");
  const price = e.price === null || e.price === undefined ? null : Number(e.price);
  const end = e.ends_at && Date.parse(e.ends_at) > Date.parse(e.starts_at) ? e.ends_at : null;
  const nextDay = end ? istanbulDay(new Date(end)) > istanbulDay(new Date(e.starts_at)) : false;
  const place = [e.venue ?? e.city, e.organizations?.name].filter(Boolean).join(" · ");
  return (
    <article className="grid grid-cols-[58px_minmax(0,1fr)_auto] items-center gap-x-2.5 border-b py-2">
      <time
        dateTime={e.starts_at}
        className="font-mono text-[15px] font-medium tabular-nums leading-tight"
      >
        {fmtTime(e.starts_at, locale)}
        {end && (
          <small className="block text-[11px] font-normal text-muted-foreground">
            {fmtTime(end, locale)}
            {nextDay ? " +1" : ""}
          </small>
        )}
      </time>
      <Link
        to="/app/event/$id"
        params={{ id: e.id }}
        className={`block min-h-11 min-w-0 rounded-md py-1 ${FOCUS}`}
      >
        <h4 className="text-[15px] font-semibold leading-tight [overflow-wrap:anywhere] hover:underline">
          {e.title}
        </h4>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12.5px] text-muted-foreground">
          {place && <span className="min-w-0 [overflow-wrap:anywhere]">{place}</span>}
          {price !== null && Number.isFinite(price) && (
            <span>{price === 0 ? t("event.free", "Free") : `${price} TL`}</span>
          )}
          {going && (
            <span className="inline-flex items-center gap-1 font-semibold text-foreground">
              <i aria-hidden className="h-[7px] w-[7px] rounded-full bg-[#ff5b1f]" />
              {t("plans.goingBadge", "Going")}
            </span>
          )}
          {demo && (
            <span className={`${MONO} rounded-full bg-muted px-1.5 text-[9.5px] text-foreground`}>
              {t("common.demo", "Demo")}
            </span>
          )}
        </p>
      </Link>
      <button
        type="button"
        disabled={saveBusy}
        aria-pressed={saved}
        onClick={onToggleSave}
        aria-label={
          saved
            ? t("save.removeLabel", {
                name: e.title,
                defaultValue: "Remove {{name}} from my plans",
              })
            : t("save.addLabel", { name: e.title, defaultValue: "Save {{name}} to my plans" })
        }
        className={`inline-flex h-11 w-11 items-center justify-center rounded-full border transition-colors disabled:opacity-50 ${FOCUS} ${
          saved ? "border-foreground bg-foreground text-background" : "hover:bg-muted"
        }`}
      >
        {saved ? (
          <BookmarkCheck className="h-[18px] w-[18px]" aria-hidden />
        ) : (
          <Bookmark className="h-[18px] w-[18px]" aria-hidden />
        )}
      </button>
    </article>
  );
}

/** The dark "next plan" card (Naz v3 ".next-plan"). */
export function NextPlanCard({ event: e, lang }: { event: CalEvent; lang: string }) {
  const { t } = useTranslation();
  return (
    <article className="relative mt-5 grid gap-1 overflow-hidden rounded-[22px] bg-foreground p-4 text-background">
      <span
        aria-hidden
        className="absolute -bottom-16 -right-10 h-[170px] w-[170px] rounded-full bg-gradient-to-br from-[#ff5b1f] to-[#ff4fa8] opacity-90 blur-[24px]"
      />
      <span className={`${MONO} relative text-background/65`}>
        {t("v3paper.cal.next", "Your next plan")}
      </span>
      <h3 className="relative pe-10 font-display text-[30px] font-[850] leading-[0.95] [font-stretch:70%] [overflow-wrap:anywhere]">
        <Link
          to="/app/event/$id"
          params={{ id: e.id }}
          className={`-my-1 inline-block rounded-sm py-1 hover:underline ${FOCUS}`}
        >
          {e.title}
        </Link>
      </h3>
      <p className="relative text-[13px]">
        {formatWhenLocalized(e.starts_at, lang)}
        {e.venue || e.city ? ` · ${e.venue ?? e.city}` : ""}
      </p>
    </article>
  );
}
