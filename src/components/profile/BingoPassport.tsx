// The Bingo passport (design: Naz Paşalı): a dark membership card in the profile with this month's
// 3 × 3 at a glance, lines, the next reward tier (said to be not available) and the way in.
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ArrowRight } from "lucide-react";
import { squaresToNextLine, type Card } from "@/lib/bingo";
import { Pips } from "@/components/bingo/BingoCard";
import { periodLabel } from "@/components/bingo/text";

export function BingoPassport({ card }: { card: Card }) {
  const { t, i18n } = useTranslation();
  const lines = card.lines.length;
  const next = Math.min(3, lines + 1);
  const left = squaresToNextLine(card);
  return (
    <section className="nb-pass" aria-labelledby="pass-t">
      <div className="top">
        <div className="min-w-0">
          <span className="nb-mono k" lang="en">
            {t("profile3.pass.k")}
          </span>
          <h2 id="pass-t" className="nb-poster t">
            Bingo
            <br />
            {periodLabel(card.period, i18n.language)}
          </h2>
          <p className="nb-mono no m-0">{t("profile3.pass.no")}</p>
        </div>
        <div className="nb-pass-grid" role="img" aria-label={t("bingo.squares", { n: card.filled })}>
          {card.cells.map((c) => (
            <i key={c.id} className={c.status} />
          ))}
        </div>
      </div>
      <div className="bot">
        <div className="row">
          <span>
            <b>{t("profile3.pass.squares", { n: card.filled })}</b>
          </span>
          <Pips lines={lines} />
          <span>
            <b>{t("profile3.pass.lines", { n: Math.min(3, lines) })}</b>
          </span>
        </div>
        <div className="row">
          {lines >= 3 ? (
            <span>{t("profile3.pass.all")}</span>
          ) : (
            <>
              <span>
                {t("profile3.pass.next")} <b>{t(`bingo.rw.${next}t`)}</b> · {t("profile3.pass.na")}
              </span>
              {left > 0 && <span>{t("bingo.ch.left", { count: left })}</span>}
            </>
          )}
        </div>
        <div className="acts">
          <Link to="/app/bingo" className="nb-btn nb-mg min-h-11 text-[14px]">
            {t("profile3.pass.open")}
            <ArrowRight aria-hidden className="rtl:-scale-x-100" />
          </Link>
          <Link to="/app/bingo" search={{ view: "rewards" }} className="nb-btn nb-nline min-h-11 px-4 text-[14px]">
            {t("profile3.pass.rewards")}
          </Link>
        </div>
      </div>
    </section>
  );
}
