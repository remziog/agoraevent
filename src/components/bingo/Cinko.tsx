// The çinko moment (design: Naz Paşalı): full-screen, after the line has been drawn. Every line in
// this app is self-reported, so it is the "provisional" moment: the reward tier it reaches is shown
// greyed and stamped "not available". Motion only without prefers-reduced-motion (CSS).
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import type { RewardTier } from "@/lib/bingo";
import { Ticket } from "./Rewards";
import { periodLabel } from "./text";

export function Cinko({
  count,
  tier,
  period,
  onClose,
  onTiers,
}: {
  /** How many new lines this moment celebrates. */
  count: number;
  /** The reward tier the first new line reaches (null past the third line). */
  tier: RewardTier | null;
  period: string;
  onClose: () => void;
  onTiers: () => void;
}) {
  const { t, i18n } = useTranslation();
  const primary = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    primary.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      prev?.focus?.({ preventScroll: true });
    };
  }, [onClose]);
  return (
    <div className="nb-cz nb-scope" role="dialog" aria-modal="true" aria-labelledby="cz-h" aria-describedby="cz-sub">
      <div className="bg" aria-hidden />
      <p className="nb-mono m-0 text-[#E9A23B]">{t("bingo.cz.kicker", { period: periodLabel(period, i18n.language) })}</p>
      <h2 id="cz-h" className="h nb-poster">
        {t("bingo.cz.title")}
      </h2>
      <p id="cz-sub" className="sub">
        {count > 1 ? t("bingo.cz.subMany", { count }) : t("bingo.cz.sub")}
      </p>
      {tier ? (
        <div className="tkw" style={{ ["--nb-hole" as string]: "#15111f" }}>
          <Ticket tier={tier} period={period} />
        </div>
      ) : null}
      <div className="acts">
        <button ref={primary} type="button" className="nb-btn nb-mg w-full" onClick={onClose}>
          {t("bingo.cz.seeCard")}
        </button>
        <button type="button" className="nb-btn nb-nline w-full" onClick={onTiers}>
          {t("bingo.cz.seeTiers")}
        </button>
      </div>
    </div>
  );
}
