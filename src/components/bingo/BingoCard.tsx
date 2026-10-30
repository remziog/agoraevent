// The monthly 3 × 3 card on the night field (design: Naz Paşalı): line artwork per square,
// status marks, the AGORA FREE centre and the eight lines drawn over the grid.
import { useTranslation } from "react-i18next";
import { BINGO_LINES, type Card, type ChallengeId, type LineKey } from "@/lib/bingo";
import { BQ_ATMOS, SquareArt, StatusIcon } from "./art";
import { monthName } from "./text";

const pt = (i: number) => [50 + (i % 3) * 100, 50 + Math.floor(i / 3) * 100];
const linePath = (key: LineKey) => {
  const idx = BINGO_LINES[key];
  const [x1, y1] = pt(idx[0]);
  const [x2, y2] = pt(idx[2]);
  const dx = Math.sign(x2 - x1) * 34;
  const dy = Math.sign(y2 - y1) * 34;
  return `M${x1 - dx} ${y1 - dy} L${x2 + dx} ${y2 + dy}`;
};

const upperFirst = (s: string, lang: string) => s.charAt(0).toLocaleUpperCase(lang) + s.slice(1);

export function Pips({ lines }: { lines: number }) {
  // every line here is self-reported (provisional): striped, never solid
  return (
    <span className="nb-pips" aria-hidden>
      {[0, 1, 2].map((i) => (
        <i key={i} className={i < Math.min(3, lines) ? "pv" : ""} />
      ))}
    </span>
  );
}

export function BingoCard({
  card,
  flash = [],
  lit = [],
  onOpen,
}: {
  card: Card;
  flash?: string[];
  lit?: LineKey[];
  onOpen: (id: ChallengeId | "free") => void;
}) {
  const { t, i18n } = useTranslation();
  const litCells = new Set<number>(lit.flatMap((k) => [...BINGO_LINES[k]]));
  return (
    <section aria-labelledby="bc-title">
      <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-2">
        <h2 id="bc-title" className="nb-poster m-0 text-[clamp(40px,13vw,52px)]">
          {upperFirst(t("bingo.monthCard", { month: monthName(card.period, i18n.language) }), i18n.language)}
        </h2>
        <div className="grid shrink-0 justify-items-end gap-1.5 text-right">
          <Pips lines={card.lines.length} />
          <span className="nb-mono text-[color:var(--nt-2)]">
            {t("bingo.lines", { count: card.lines.length })} · {t("bingo.squares", { n: card.filled })}
          </span>
        </div>
      </div>

      <div className="nb-grid-wrap mt-4">
        <div className="nb-grid" role="group" aria-label={t("bingo.gridAria")}>
          {card.cells.map((c) => {
            const n = String(c.index + 1).padStart(2, "0");
            if (c.id === "free") {
              return (
                <button
                  key={c.id}
                  type="button"
                  className="nb-bq free"
                  onClick={() => onOpen("free")}
                  aria-label={t("bingo.freeAria")}
                >
                  <span className="nb-top">
                    <span>{n}</span>
                    <span className="nb-st">
                      <StatusIcon status="free" />
                    </span>
                  </span>
                  <span className="nb-free">
                    <img src="/agora-logo.png" alt="" width={720} height={157} draggable={false} />
                    <b>{t("bingo.free")}</b>
                  </span>
                </button>
              );
            }
            const title = t(`bingo.sq.${c.id}.t`);
            const status = t(`bingo.status.${c.status}`);
            return (
              <button
                key={c.id}
                type="button"
                className={`nb-bq st-${c.status}${litCells.has(c.index) ? " lit" : ""}${flash.includes(c.id) ? " flash" : ""}`}
                onClick={() => onOpen(c.id as ChallengeId)}
                aria-label={t("bingo.squareAria", { n: c.index + 1, title, status })}
              >
                <span className="nb-vis" style={{ ["--atm" as string]: BQ_ATMOS[c.id as ChallengeId] }} aria-hidden />
                <span className="nb-art" aria-hidden>
                  <span className="nb-art-i">
                    <SquareArt id={c.id as ChallengeId} />
                  </span>
                  <span className="nb-t nb-ghost">{title}</span>
                </span>
                <span className="nb-top" aria-hidden>
                  <span>{n}</span>
                  <span className="nb-st">
                    <StatusIcon status={c.status} />
                  </span>
                </span>
                <span className="nb-t" aria-hidden>
                  {title}
                </span>
              </button>
            );
          })}
        </div>
        <svg className="nb-lines" viewBox="0 0 300 300" preserveAspectRatio="none" aria-hidden>
          {card.lines.map((k) => (
            <path key={k} d={linePath(k)} pathLength={1} className={`pv${lit.includes(k) ? " draw" : ""}`} />
          ))}
        </svg>
      </div>

      <div className="nb-legend mt-3" aria-hidden>
        <span>
          <i />
          {t("bingo.status.locked")}
        </span>
        <span>
          <i className="p" />
          {t("bingo.status.progress")}
        </span>
        <span>
          <i className="d" />
          {t("bingo.status.done")}
        </span>
        <span>
          <i className="v" />
          {t("bingo.status.verified")}
        </span>
      </div>
      <p className="mt-2 text-[12px] leading-snug text-[color:var(--nt-2)]">{t("bingo.legendNote")}</p>
    </section>
  );
}
