// One Bingo square, opened from the card (design: Naz Paşalı): title, lead, how it counts, the
// compass hand-off, this month's matching experiences, the honest verification state, the
// self-mark (with undo) and reward progress through the lines that cross this square.
import type { ReactNode } from "react";
import { useRouter } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ArrowRight, Undo2 } from "lucide-react";
import { ArtBlock } from "@/components/ArtBlock";
import { linesThrough, periodOf, type Card, type ChallengeId, type ExperienceRecord, type SquareId } from "@/lib/bingo";
import { DarkSheet } from "./DarkSheet";
import { dayLabel, periodLabel, recordName } from "./text";

export function ChallengeSheet({
  square,
  card,
  records,
  onClose,
  onStart,
  onMark,
  onUndo,
}: {
  square: SquareId | null;
  card: Card;
  records: ExperienceRecord[];
  onClose: () => void;
  onStart: (id: ChallengeId) => void;
  onMark: (id: ChallengeId) => void;
  onUndo: (recordId: string) => void;
}) {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const cell = square ? card.cells.find((c) => c.id === square) : undefined;
  const title = square ? t(`bingo.sq.${square}.t`) : "";
  const per = periodLabel(card.period, i18n.language);
  const n = cell ? String(cell.index + 1).padStart(2, "0") : "";
  const order = ["locked", "progress", "done", "verified"] as const;
  const at = cell ? (cell.status === "free" ? 3 : order.indexOf(cell.status as (typeof order)[number])) : 0;

  const steps = (
    <ol className="nb-steps mt-4" aria-label={t("bingo.ch.progress")}>
      {order.map((s, k) => (
        <li key={s} className={`${k <= at && s !== "verified" ? "on" : ""}${s === "verified" ? " na" : ""}`}>
          {t(`bingo.status.${s}`)}
        </li>
      ))}
    </ol>
  );

  let body: ReactNode = null;
  if (square === "free" && cell) {
    body = (
      <>
        <p className="nb-mono m-0 pr-12 text-[color:var(--nt-2)]">
          {t("bingo.ch.square", { n })} · {t("bingo.period", { period: per })}
        </p>
        <div className="nb-paper -mx-5 mt-3 flex h-[150px] items-end px-5 pb-4">
          <h2 className="nb-poster relative z-[1] m-0 text-[44px] uppercase text-[#241C22]">{title}</h2>
        </div>
        <p className="mt-4 text-[17px] leading-[1.4]">{t("bingo.sq.free.l")}</p>
      </>
    );
  } else if (square && cell) {
    const id = square as ChallengeId;
    const mine = records
      .filter((r) => cell.recordIds.includes(r.id))
      .sort((a, b) => a.date.localeCompare(b.date));
    const selfMark = records.find(
      (r) => r.kind === "challenge" && r.refId === id && periodOf(r.date) === card.period,
    );
    const through = linesThrough(card, cell.index);
    const nextTier = Math.min(3, card.lines.length + 1);
    const q = t(`bingo.sq.${id}.q`);
    body = (
      <>
        <div className="flex items-center gap-3 pr-12">
          <p className="nb-mono m-0 grow text-[color:var(--nt-2)]">
            {t("bingo.ch.square", { n })} · {t("bingo.period", { period: per })}
          </p>
          <span className="nb-mono shrink-0 text-[#E9A23B]">{t(`bingo.status.${cell.status}`)}</span>
        </div>
        <div className="relative -mx-5 mt-3 h-[190px] overflow-hidden">
          <div className="absolute inset-0 [filter:grayscale(1)_contrast(1.3)_brightness(0.7)]" aria-hidden>
            <ArtBlock seed={`bingo-${id}`} className="h-full w-full" shade={false} />
          </div>
          <span aria-hidden className="nb-tear" />
          <span aria-hidden className="nb-dot" />
          <span
            aria-hidden
            className="absolute inset-0"
            style={{ background: "linear-gradient(180deg, rgba(13,11,26,0) 25%, rgba(31,16,36,.6) 55%, rgba(31,16,36,.94))" }}
          />
          <h2 className="nb-poster absolute inset-x-5 bottom-3.5 z-[2] m-0 text-[clamp(36px,11vw,46px)] uppercase text-balance">
            {title}
          </h2>
        </div>
        <p className="mt-4 text-[17px] leading-[1.4]">{t(`bingo.sq.${id}.l`)}</p>
        {steps}
        <button
          type="button"
          className="nb-btn nb-mg mt-4 w-full"
          onClick={() => {
            onStart(id);
            onClose();
            router.history.push(`/app?q=${encodeURIComponent(q)}`);
          }}
        >
          {t("bingo.ch.find")}
          <ArrowRight aria-hidden />
        </button>

        <section className="nb-sec">
          <h3>{t("bingo.ch.howCounts")}</h3>
          <p className="m-0 text-[14px] leading-[1.45]">{t(`bingo.rule.${id}`)}</p>
        </section>

        <section className="nb-sec">
          <h3>{t("bingo.ch.yourXp")}</h3>
          {mine.length ? (
            <ul className="m-0 grid list-none gap-1.5 p-0">
              {mine.map((r) => (
                <li
                  key={r.id}
                  className="flex flex-wrap items-center justify-between gap-2 border-b border-[color:var(--nt-line)] py-2 text-[14px]"
                >
                  <span className="min-w-0">
                    {recordName(t, r)}{" "}
                    <small className="text-[color:var(--nt-2)]">{dayLabel(r.date, i18n.language)}</small>
                  </span>
                  <span className="nb-xs">{t("experiences.selfReported")}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="m-0 text-[13px] leading-snug text-[color:var(--nt-2)]">{t("bingo.ch.noXp")}</p>
          )}
          <div className="nb-vm mt-3">
            <h4>{t("bingo.ch.selfT")}</h4>
            {selfMark ? (
              <>
                <p>{t("bingo.ch.selfDone")}</p>
                <button type="button" className="nb-btn nb-nline" onClick={() => onUndo(selfMark.id)}>
                  <Undo2 aria-hidden />
                  {t("bingo.ch.undo")}
                </button>
              </>
            ) : (
              <>
                <p>{t("bingo.ch.selfP")}</p>
                <button type="button" className="nb-btn nb-nline" onClick={() => onMark(id)}>
                  {t("bingo.ch.selfBtn")}
                </button>
              </>
            )}
          </div>
          <p className="mt-2 text-[12px] text-[color:var(--nt-2)]">{t("bingo.deviceNote")}</p>
        </section>

        <section className="nb-sec">
          <h3>{t("bingo.ch.verification")}</h3>
          <div className="nb-vm" aria-disabled="true">
            <h4>
              {t("bingo.status.verified")}{" "}
              <small className="nb-mono ml-1 text-[#E9A23B]">{t("bingo.rw.na")}</small>
            </h4>
            <p>{t("bingo.ch.verifyNA")}</p>
          </div>
          <p className="mt-2 text-[12px] text-[color:var(--nt-2)]">{t("bingo.ch.noTracking")}</p>
        </section>

        <section className="nb-sec">
          <h3>{t("bingo.ch.rewardProgress")}</h3>
          <div className="nb-rp">
            {through.map((l) => (
              <div key={l.key} className="nb-rp-line">
                <span className="cells" aria-hidden>
                  {cellsOf(l.key).map((j) => {
                    const c = card.cells[j];
                    const ok = c.status === "done" || c.status === "free";
                    return <i key={j} className={`${ok ? "ok" : ""}${j === cell.index ? " me" : ""}`} />;
                  })}
                </span>
                <span>
                  {t(`bingo.line.${l.key}`)} ·{" "}
                  {l.done ? t("bingo.ch.lineDone") : t("bingo.ch.left", { count: l.left })}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[12px] text-[color:var(--nt-2)]">
            {card.lines.length >= 3
              ? t("bingo.ch.allTiers")
              : t("bingo.ch.nextTier", { n: nextTier, title: t(`bingo.rw.${nextTier}t`) })}
          </p>
        </section>
      </>
    );
  }

  return (
    <DarkSheet open={!!square} onOpenChange={(o) => !o && onClose()} title={title}>
      {body}
    </DarkSheet>
  );
}

const LINE_CELLS: Record<string, number[]> = {
  r0: [0, 1, 2],
  r1: [3, 4, 5],
  r2: [6, 7, 8],
  c0: [0, 3, 6],
  c1: [1, 4, 7],
  c2: [2, 5, 8],
  d0: [0, 4, 8],
  d1: [2, 4, 6],
};
const cellsOf = (k: string) => LINE_CELLS[k] ?? [];
