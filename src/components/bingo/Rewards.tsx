// Reward tiers (design: Naz Paşalı's three tickets). Partner, validity, inventory, eligibility and
// terms are empty because no partner agreement exists: every tier says "not available yet", and no
// code, voucher or ticket is ever shown as usable.
import { useTranslation } from "react-i18next";
import { REWARDS, type RewardTier } from "@/lib/bingo";
import { periodLabel } from "./text";

export function Ticket({ tier, period }: { tier: RewardTier; period: string }) {
  const { t, i18n } = useTranslation();
  const per = periodLabel(period, i18n.language).toLocaleUpperCase(i18n.language);
  // the stamp sits in the ticket's head row, so it can wrap instead of covering the kicker
  const head = (k: string) => (
    <span className="hd">
      <span className="k">{k}</span>
      <span className="stamp">{t("bingo.tk.stamp")}</span>
    </span>
  );
  if (tier === 1)
    return (
      <div className="nb-ticket t1" aria-hidden>
        <div className="main nb-paper">
          {head(t("bingo.tk.k1"))}
          <span className="big">
            {t("bingo.tk.big1")}
            <span>{t("bingo.tk.big1b")}</span>
          </span>
          <span className="sub">{t("bingo.rw.1s")}</span>
        </div>
        <div className="stub nb-paper">
          <span>
            {per}
            <br />
            No. 001
          </span>
        </div>
      </div>
    );
  if (tier === 2)
    return (
      <div className="nb-ticket t2" aria-hidden>
        <span className="cup" />
        <div className="main">
          {head(t("bingo.tk.k2"))}
          <span className="big">{t("bingo.tk.big2")}</span>
          <span className="sub">{t("bingo.rw.2s")}</span>
        </div>
        <div className="stub nb-paper">
          <span>
            {t("bingo.tk.cup")}
            <br />
            <br />
            {per}
          </span>
        </div>
      </div>
    );
  return (
    <div className="nb-ticket t3" aria-hidden>
      <div className="main">
        {head(t("bingo.tk.k3"))}
        <span className="big">{t("bingo.tk.big3")}</span>
        <span className="sub">{t("bingo.rw.3s")}</span>
      </div>
      <div className="stub">
        <span className="grid justify-items-center gap-2">
          <span className="bar" />
          <span>{t("bingo.tk.entry")} · 01</span>
        </span>
      </div>
    </div>
  );
}

export function RewardsList({ lines, period }: { lines: number; period: string }) {
  const { t } = useTranslation();
  return (
    <div className="grid gap-6">
      {REWARDS.map((r) => {
        const reached = lines >= r.tier;
        const left = Math.max(0, r.tier - lines);
        return (
          <article key={r.tier} className="nb-rw na" aria-labelledby={`rw-${r.tier}`}>
            <Ticket tier={r.tier} period={period} />
            <div className="flex flex-wrap items-center justify-between gap-2.5">
              <h2 id={`rw-${r.tier}`} className="nb-mono m-0 text-[color:var(--nt-2)]">
                {t("bingo.rw.tier", { n: r.tier })} · {t(`bingo.rw.${r.tier}t`)}
              </h2>
              <span className={`nb-chip${reached ? " on" : ""}`}>{t("bingo.rw.na")}</span>
            </div>
            <dl className="nb-facts">
              <dt>{t("bingo.rw.partner")}</dt>
              <dd>{t("bingo.rw.noPartner")}</dd>
              <dt>{t("bingo.rw.validity")}</dt>
              <dd>{t("bingo.rw.none")}</dd>
              <dt>{t("bingo.rw.terms")}</dt>
              <dd>{t("bingo.rw.none")}</dd>
              <dt>{t("bingo.rw.status")}</dt>
              <dd>{reached ? t("bingo.rw.reached") : t("bingo.rw.more", { count: left })}</dd>
            </dl>
          </article>
        );
      })}
    </div>
  );
}
