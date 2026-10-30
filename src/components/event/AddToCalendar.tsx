import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { CalendarPlus, Download, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { buildIcs, googleCalendarUrl, icsFileName, type CalendarEventInput } from "@/lib/ics";

/**
 * "Add to calendar" on an event page: an .ics download and a Google Calendar
 * link. It copies the gathering into the person's own calendar only — it is
 * not an RSVP, and the organiser isn't told. When the organiser gave no end
 * time, the export uses a 2-hour default and says so; the page never shows it.
 */
export function AddToCalendar({
  event,
  demo,
}: {
  event: {
    id: string;
    title: string;
    starts_at: string;
    ends_at: string | null;
    venue: string | null;
    city: string | null;
    description: string | null;
  };
  demo: boolean;
}) {
  const { t } = useTranslation();
  // The page's own address goes into the export; read after hydration so the
  // server and the first client render produce the same link.
  const [origin, setOrigin] = useState<string | null>(null);
  useEffect(() => setOrigin(window.location.origin), []);
  const noEnd = !event.ends_at;
  const start = Date.parse(event.starts_at);
  const end = event.ends_at ? Date.parse(event.ends_at) : NaN;
  const valid = Number.isFinite(start);
  const ended = valid && Date.now() > (Number.isFinite(end) ? end : start);

  const input: CalendarEventInput = useMemo(
    () => ({
      id: event.id,
      title: event.title,
      startsAt: event.starts_at,
      endsAt: event.ends_at,
      location: [event.venue, event.city].filter(Boolean).join(", ") || null,
      description: event.description,
      url: origin ? `${origin}/app/event/${encodeURIComponent(event.id)}` : null,
    }),
    [event, origin],
  );
  const text = {
    noEndNote: t(
      "v3paper.detail.icsNoEnd",
      "The organiser gave no end time; the 2-hour duration of this entry is an estimate.",
    ),
    extra: [
      demo
        ? t(
            "v3paper.detail.icsDemo",
            "Agora demo gathering: the venue is real, the meeting is not.",
          )
        : null,
      t("v3paper.detail.icsNotRsvp", "Added from Agora. This is not an RSVP or a ticket."),
    ],
  };
  const gcal = valid && !ended ? googleCalendarUrl(input, text) : null;

  function download() {
    try {
      const ics = buildIcs(input, { ...text, now: new Date() });
      const href = URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8" }));
      const a = document.createElement("a");
      a.href = href;
      a.download = icsFileName(event.title);
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(href), 10_000);
      toast.success(t("v3paper.detail.icsSaved", "Calendar file downloaded"), {
        description: t(
          "v3paper.detail.icsSavedSub",
          "Open it to add the gathering to your calendar app.",
        ),
      });
    } catch {
      toast.error(
        t(
          "v3paper.detail.icsFailed",
          "Couldn't create the calendar file. Try the Google Calendar link.",
        ),
      );
    }
  }

  return (
    <section
      aria-labelledby="add-to-calendar-heading"
      className="relative grid gap-3 overflow-hidden rounded-[22px] bg-card p-4 shadow-[inset_0_0_0_1px_var(--border)]"
    >
      <h2
        id="add-to-calendar-heading"
        className="flex items-center gap-1.5 font-mono text-[10.5px] font-normal uppercase tracking-[0.1em] text-muted-foreground"
      >
        <CalendarPlus className="h-3.5 w-3.5" aria-hidden />
        {t("v3paper.detail.addToCalendar", "Add to calendar")}
      </h2>
      {!valid || ended ? (
        <p className="text-sm text-muted-foreground">
          {t("v3paper.detail.ended", "This gathering has ended — it can't be added any more.")}
        </p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="min-h-11 flex-1 basis-40 px-4"
              onClick={download}
            >
              <Download aria-hidden />
              {t("v3paper.detail.icsFile", ".ics file")}
            </Button>
            {gcal && (
              <Button asChild variant="outline" size="lg" className="min-h-11 flex-1 basis-40 px-4">
                <a href={gcal} target="_blank" rel="noopener noreferrer">
                  <ExternalLink aria-hidden />
                  {t("v3paper.detail.google", "Google Calendar")}
                  <span className="sr-only">
                    {" "}
                    {t("v3paper.common.newTab", "(opens in a new tab)")}
                  </span>
                </a>
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {t(
              "v3paper.detail.calendarNote",
              "This only copies it into your own calendar — it isn't an RSVP and the organiser isn't told.",
            )}
            {noEnd &&
              ` ${t(
                "v3paper.detail.noEndExport",
                "No end time was given, so the calendar entry uses 2 hours, marked as an estimate.",
              )}`}
          </p>
        </>
      )}
    </section>
  );
}
