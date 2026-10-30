// The badge collection (design: Naz Paşalı): five long-term achievements with their own artwork,
// progress derived from the experience records, and a detail sheet. Culture Collector counts
// verified squares only, so it says plainly that it can't progress until verification exists.
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import type { BadgeId, BadgeProgress } from "@/lib/bingo";
import { BadgeArt } from "./art";
import { DarkSheet } from "./DarkSheet";
import { dayLabel } from "./text";

function Segments({ n, goal }: { n: number; goal: number }) {
  return (
    <span className="nb-prog" aria-hidden>
      {Array.from({ length: goal }, (_, k) => (
        <i key={k} className={k < n ? "on" : ""} />
      ))}
    </span>
  );
}

export function BadgeBand({ badges }: { badges: BadgeProgress[] }) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState<BadgeId | null>(null);
  const unlocked = badges.filter((b) => b.done).length;
  const current = badges.find((b) => b.id === open) ?? null;
  return (
    <section className="nb-band -mx-4 px-4 pb-6 pt-5 sm:mx-0 sm:rounded-3xl sm:px-6" aria-labelledby="bdg-t">
      <div className="flex items-baseline justify-between gap-2.5">
        <h2 id="bdg-t" className="nb-poster m-0 text-[34px] leading-[0.9] [font-stretch:66%]">
          {t("badges.title")}
        </h2>
        <span className="nb-mono text-[color:var(--nt-2)]">
          {unlocked}/{badges.length}
        </span>
      </div>
      <p className="mt-2 max-w-[40ch] text-[13px] text-[color:var(--nt-2)]">{t("badges.lead")}</p>
      <div className="nb-bdg-grid mt-4">
        {badges.map((b, i) => {
          const wide = i === badges.length - 1 && badges.length % 2 === 1;
          return (
            <button
              key={b.id}
              type="button"
              className={`nb-bdg ${b.done ? "done" : "locked"}${wide ? " wide" : ""}`}
              onClick={() => setOpen(b.id)}
              aria-label={
                b.done ? t("badges.ariaDone", { name: b.name }) : t("badges.aria", { name: b.name, n: b.count, goal: b.goal })
              }
            >
              <BadgeArt id={b.id} />
              <b lang="en">{b.name}</b>
              <small>{t(`badges.${b.id}.req`)}</small>
              <Segments n={b.count} goal={b.goal} />
              <span className="bp">
                {b.done
                  ? t("badges.unlocked")
                  : b.needsVerification
                    ? t("badges.needsVerification")
                    : `${b.count}/${b.goal}`}
              </span>
            </button>
          );
        })}
      </div>

      <DarkSheet open={!!current} onOpenChange={(o) => !o && setOpen(null)} title={current?.name ?? ""}>
        {current ? (
          <>
            <div className={`mt-1 grid grid-cols-[minmax(0,132px)_minmax(0,1fr)] items-center gap-4 pr-10 ${current.done ? "" : "locked"}`}>
              <BadgeArt id={current.id} size={132} />
              <div className="min-w-0">
                <b className="nb-mono block font-medium text-[#E9A23B]">
                  {current.done ? t("badges.unlocked") : t("badges.locked")} · {current.count}/{current.goal}
                </b>
                <h3 className="nb-poster m-0 mt-1.5 text-[34px] leading-[0.9] [font-stretch:66%]" lang="en">
                  {current.name}
                </h3>
              </div>
            </div>
            <section className="nb-sec">
              <h4>{t("badges.req")}</h4>
              <p className="m-0 text-[14px] leading-[1.45]">{t(`badges.${current.id}.req`)}.</p>
            </section>
            <section className="nb-sec">
              <h4>{t("badges.howH")}</h4>
              <p className="m-0 text-[14px] leading-[1.45]">{t(`badges.${current.id}.how`)}</p>
              <div className="mt-2.5">
                <Segments n={current.count} goal={current.goal} />
              </div>
              {current.needsVerification && (
                <p className="mt-2 text-[12px] text-[#E9A23B]">{t("badges.needsVerification")}</p>
              )}
            </section>
            <section className="nb-sec">
              <h4>{t("badges.archive")}</h4>
              {current.items.length ? (
                <ul className="m-0 grid list-none gap-1.5 p-0 text-[13px] text-[color:var(--nt-2)]">
                  {current.items
                    .slice()
                    .reverse()
                    .map((it) => (
                      <li key={it.key} className="flex justify-between gap-2.5">
                        <b className="min-w-0 font-medium text-[color:var(--nt)]">{it.title}</b>
                        <span className="shrink-0">{dayLabel(it.date, i18n.language)}</span>
                      </li>
                    ))}
                </ul>
              ) : (
                <p className="m-0 text-[14px] text-[color:var(--nt-2)]">{t("badges.empty")}</p>
              )}
            </section>
            <Link to="/app/bingo" className="nb-btn nb-mg mt-5 w-full" onClick={() => setOpen(null)}>
              {t("badges.openCard")}
            </Link>
            <p className="mt-3 text-[12px] text-[color:var(--nt-2)]">{t("bingo.deviceNote")}</p>
          </>
        ) : null}
      </DarkSheet>
    </section>
  );
}

