// Naz Paşalı's Bingo entry for the home header: a ticket stub on the night field —
// "BINGO" on the left, this month's filled squares on the right. Self-contained styles.
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useExperiences } from "@/lib/use-experiences";
import { monthName } from "./text";

export function BingoEntry({ className = "" }: { className?: string }) {
  const { t, i18n } = useTranslation();
  const xp = useExperiences();
  const n = xp.card.filled;
  return (
    <Link
      to="/app/bingo"
      aria-label={t("bingo.entry.aria", { month: monthName(xp.period, i18n.language), n })}
      className={`group inline-flex h-11 items-stretch font-mono text-[10px] uppercase tracking-[0.12em] text-[#f3ebdd] no-underline focus-visible:rounded-[10px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E9A23B] ${className}`}
    >
      <span className="inline-flex items-center rounded-l-[9px] rounded-r-[2px] px-2.5 font-medium text-[#E9A23B] shadow-[inset_0_0_0_1px_#E9A23B] transition-colors group-hover:bg-[#E9A23B] group-hover:text-[#241C22]">
        {t("bingo.title")}
      </span>
      <span className="-ml-px inline-flex items-center rounded-l-[2px] rounded-r-[9px] border-l border-dashed border-[#E9A23B] px-2.5 tabular-nums shadow-[inset_0_0_0_1px_#E9A23B]">
        {n}/9
      </span>
    </Link>
  );
}
