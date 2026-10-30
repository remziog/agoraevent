// Deneyimlerim (design: Naz Paşalı): what you have actually done. The three meanings side by side —
// want (saved), done (self-reported), verified (not available yet) — then the records, filterable,
// each removable (Bingo and badges are re-derived). Kept on this device; the page says so.
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { X } from "lucide-react";
import { groupOf, recordOrder, type ChallengeId, type ExperienceGroup, type ExperienceRecord } from "@/lib/bingo";
import { recordName, shortMonth, squareTitle } from "@/components/bingo/text";

const GROUPS: ("all" | ExperienceGroup)[] = ["all", "art", "music", "food", "other"];

export function ExperienceList({
  records,
  matches,
  wantCount,
  thisYear,
  onRemove,
}: {
  records: ExperienceRecord[];
  matches: Record<string, ChallengeId[]>;
  /** Saved items ("I want to"), or null while unknown. */
  wantCount: number | null;
  thisYear: string;
  onRemove: (id: string) => void;
}) {
  const { t, i18n } = useTranslation();
  const [filter, setFilter] = useState<"all" | ExperienceGroup>("all");
  const [confirm, setConfirm] = useState<string | null>(null);
  const sorted = records.slice().sort((a, b) => -recordOrder(a, b));
  const groups = new Map(sorted.map((r) => [r.id, groupOf(r, matches[r.id] ?? [])]));
  const list = sorted.filter((r) => filter === "all" || groups.get(r.id) === filter);

  return (
    <section className="mt-8 border-t-2 border-foreground pt-3" aria-labelledby="xp-t">
      <div className="flex flex-wrap items-baseline justify-between gap-x-2.5 gap-y-1">
        <h2 id="xp-t" className="m-0 min-w-0 text-[34px] font-[900] uppercase leading-[0.9] tracking-[-0.015em] [font-stretch:66%]">
          {t("experiences.title")}
        </h2>
        <span className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-muted-foreground">
          {t("experiences.history")}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        {(
          [
            ["k-w", t("experiences.tri.want"), wantCount === null ? "—" : String(wantCount), t("experiences.tri.wantS")],
            ["k-d", t("experiences.tri.did"), String(records.length), t("experiences.tri.didS")],
            ["k-v", t("experiences.tri.ver"), "0", t("experiences.tri.verS")],
          ] as const
        ).map(([k, label, n, sub]) => (
          <p key={k} className="m-0 grid content-start gap-px text-[12px] leading-tight text-muted-foreground">
            <i className={`${k} mb-1.5 block h-1 w-[18px] rounded-sm`} aria-hidden />
            <b className="text-[24px] font-[850] leading-none text-foreground [font-stretch:70%]">{n}</b>
            <span>{label}</span>
            <small className="font-mono text-[9.5px] uppercase tracking-[0.06em]">{sub}</small>
          </p>
        ))}
      </div>

      <div className="chip-scroll -mx-4 mt-4 flex gap-1.5 overflow-x-auto px-4 pb-0.5 sm:-mx-6 sm:px-6" role="group" aria-label={t("experiences.filterAria")}>
        {GROUPS.map((g) => (
          <button key={g} type="button" className="nb-xf" aria-pressed={filter === g} onClick={() => setFilter(g)}>
            {t(`experiences.g.${g}`)}
            <small>{g === "all" ? records.length : sorted.filter((r) => groups.get(r.id) === g).length}</small>
          </button>
        ))}
      </div>

      <ol className="m-0 mt-2.5 list-none p-0">
        {list.length ? (
          list.map((r) => {
            const sq = matches[r.id] ?? [];
            const [y, , d] = r.date.split("-");
            const cats = r.kind === "challenge" ? t("experiences.square") : r.categories[0] ?? t(`experiences.kind.${r.kind}`);
            const asking = confirm === r.id;
            return (
              <li
                key={r.id}
                className="grid grid-cols-[46px_minmax(0,1fr)_auto] items-start gap-3 border-b border-border py-3"
              >
                <time dateTime={r.date} className="grid justify-items-center pt-0.5">
                  <b className="text-[28px] font-[850] leading-[0.9] tabular-nums [font-stretch:70%]">{Number(d)}</b>
                  <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                    {shortMonth(r.date, i18n.language)}
                  </span>
                </time>
                <span className="grid min-w-0 gap-[3px]">
                  <b className="text-[15.5px] font-[650] leading-tight [overflow-wrap:anywhere]">{recordName(t, r)}</b>
                  <small className="text-[12.5px] text-muted-foreground">
                    {cats}
                    {r.district ? ` · ${r.district}` : ""}
                    {y !== thisYear ? ` · ${y}` : ""}
                  </small>
                  <span className="mt-[3px] flex flex-wrap gap-[5px]">
                    <span className="nb-xs">{t("experiences.selfReported")}</span>
                    {sq.length ? (
                      <span className="nb-xb">
                        {t("experiences.bingo", { squares: sq.map((s) => squareTitle(t, s)).join(" + ") })}
                      </span>
                    ) : null}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    if (!asking) {
                      setConfirm(r.id);
                      return;
                    }
                    setConfirm(null);
                    onRemove(r.id);
                    toast(t("experiences.removed"), { description: t("experiences.recalc") });
                  }}
                  onBlur={() => asking && setConfirm(null)}
                  aria-label={asking ? t("experiences.confirmRemove") : t("experiences.removeAria", { name: recordName(t, r) })}
                  className={`inline-flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-full text-[12px] font-semibold text-muted-foreground transition hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${asking ? "px-3 text-foreground shadow-[inset_0_0_0_1px_var(--foreground)]" : ""}`}
                >
                  {asking ? t("experiences.remove") : <X className="h-4 w-4" aria-hidden />}
                </button>
              </li>
            );
          })
        ) : (
          <li className="border-b border-border py-4 text-[14px] text-muted-foreground">
            {records.length
              ? t("experiences.noneCat")
              : t("experiences.none", { a: t("experiences.attended"), b: t("experiences.wentHere") })}
          </li>
        )}
      </ol>
      <p className="mt-2.5 text-[12px] text-muted-foreground">{t("bingo.deviceNote")}</p>
    </section>
  );
}
