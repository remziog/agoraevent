// The third action on a detail page (design: Naz Paşalı). Separate from "Save" (I want to) and
// "Add to calendar" (I plan to): "I went here" / "I attended" records a SELF-REPORTED experience
// on this device, with undo. It never claims verification and never unlocks a reward.
import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { CircleCheck, Undo2 } from "lucide-react";
import { deriveCard, recordOrder, type ExperienceInput } from "@/lib/bingo";
import { useExperiences } from "@/lib/use-experiences";
import { dayLabel, squareTitle } from "./text";

export type ExperienceItem = {
  kind: "event" | "place";
  refId: string;
  name: string;
  categories: string[];
  tags: string[];
  district?: string | null;
};

export function ExperienceButton({
  item,
  startsAt,
  className = "",
}: {
  item: ExperienceItem;
  /** Events: the start time. Attendance can only be marked once the event has started. */
  startsAt?: string | null;
  className?: string;
}) {
  const { t, i18n } = useTranslation();
  const xp = useExperiences();
  const isEvent = item.kind === "event";
  const act = isEvent ? t("experiences.attended") : t("experiences.wentHere");

  const mine = useMemo(
    () => xp.records.filter((r) => r.kind === item.kind && r.refId === item.refId).sort(recordOrder),
    [xp.records, item.kind, item.refId],
  );
  // an event is recorded once; a place once per day
  const current = isEvent ? mine[mine.length - 1] : mine.find((r) => r.date === xp.today);
  const earlier = !isEvent && !current && mine.length ? mine[mine.length - 1] : null;
  const notYet = isEvent && !!startsAt && new Date(startsAt).getTime() > Date.now();

  const squaresOf = (id: string) => (xp.card.matches[id] ?? []).map((s) => squareTitle(t, s)).join(" + ");

  function onRecord() {
    if (!xp.userId) {
      toast.error(t("experiences.signIn"));
      return;
    }
    const linesBefore = xp.card.lines;
    const input: ExperienceInput & { startsAt?: string | null } = {
      kind: item.kind,
      refId: item.refId,
      name: item.name,
      categories: item.categories,
      tags: item.tags,
      district: item.district ?? undefined,
      startsAt: startsAt ?? null,
    };
    const res = xp.add(input);
    if (!res.ok) {
      const why =
        res.reason === "future-event"
          ? t("experiences.futureEvent")
          : res.reason === "already-event"
            ? t("experiences.alreadyEvent")
            : res.reason === "already-today"
              ? t("experiences.alreadyToday")
              : t("experiences.badDate");
      toast.error(t("experiences.notSaved"), { description: why });
      return;
    }
    // what the record filled, derived from all records (the hook re-renders a moment later)
    const after = deriveCard([...xp.records, res.record], xp.period);
    const squares = (after.matches[res.record.id] ?? []).map((s) => squareTitle(t, s));
    const id = res.record.id;
    toast.success(t("experiences.added"), {
      description: squares.length
        ? t("experiences.addedBingo", { squares: squares.join(" + ") })
        : t("experiences.addedNoMatch"),
      action: { label: t("experiences.undo"), onClick: () => xp.remove(id) },
    });
    const fresh = after.lines.filter((l) => !linesBefore.includes(l));
    if (fresh.length) {
      toast(t("experiences.lineToast"), { description: t("bingo.cz.sub") });
    }
  }

  function onUndo(id: string) {
    xp.remove(id);
    toast(t("experiences.removed"), { description: t("experiences.recalc") });
  }

  return (
    <div className={`space-y-2 ${className}`}>
      {current ? (
        <div
          className="grid grid-cols-[34px_minmax(0,1fr)] items-center gap-x-3 gap-y-2 rounded-2xl px-3.5 py-3"
          style={{
            background: "color-mix(in oklab, #E9A23B 12%, var(--card))",
            boxShadow: "inset 0 0 0 1px color-mix(in oklab, #E9A23B 50%, transparent)",
          }}
        >
          <span className="grid h-[34px] w-[34px] place-items-center rounded-full bg-[#E9A23B] text-[#241C22]" aria-hidden>
            <CircleCheck className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-[15px] font-semibold">{isEvent ? t("experiences.youAttended") : t("experiences.youWent")}</p>
            <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[12.5px] text-muted-foreground">
              <span>{dayLabel(current.date, i18n.language)}</span>
              <span className="inline-flex min-h-[22px] items-center rounded-full px-2 font-mono text-[9.5px] uppercase tracking-[0.06em] text-[#8A5413] shadow-[inset_0_0_0_1px_#C9842A] dark:text-[#E9A23B]">
                {t("experiences.selfReported")}
              </span>
              {squaresOf(current.id) && (
                <Link
                  to="/app/bingo"
                  className="inline-flex min-h-[22px] items-center rounded-full px-2 font-mono text-[9.5px] uppercase tracking-[0.06em] shadow-[inset_0_0_0_1px_var(--border)] hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  {t("experiences.bingo", { squares: squaresOf(current.id) })}
                </Link>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onUndo(current.id)}
            className="col-span-2 inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-4 text-sm font-semibold shadow-[inset_0_0_0_1px_var(--border)] transition hover:shadow-[inset_0_0_0_1px_var(--foreground)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <Undo2 className="h-4 w-4" aria-hidden />
            {t("experiences.undo")}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={onRecord}
          disabled={!xp.ready || notYet}
          aria-describedby={notYet ? `xp-why-${item.refId}` : undefined}
          className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full px-5 text-[15px] font-semibold shadow-[inset_0_0_0_1.5px_var(--foreground)] transition hover:bg-foreground hover:text-background focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-foreground"
        >
          <CircleCheck className="h-[18px] w-[18px]" aria-hidden />
          {act}
        </button>
      )}
      {notYet && !current && (
        <p id={`xp-why-${item.refId}`} className="text-[12.5px] text-muted-foreground">
          {t("experiences.futureEvent")}
        </p>
      )}
      {earlier && (
        <p className="text-[12.5px] text-muted-foreground">
          {t("experiences.youWent")} · {dayLabel(earlier.date, i18n.language)}
        </p>
      )}
      <p className="text-[12px] leading-snug text-muted-foreground">
        {t("experiences.legend", { act })} {t("experiences.deviceNote")}
      </p>
    </div>
  );
}
