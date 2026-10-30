import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ArrowLeft, Ticket as TicketIcon } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { BingoCard } from "@/components/bingo/BingoCard";
import { ChallengeSheet } from "@/components/bingo/ChallengeSheet";
import { Cinko } from "@/components/bingo/Cinko";
import { RewardsList } from "@/components/bingo/Rewards";
import { BingoStyles } from "@/components/bingo/styles";
import { periodLabel } from "@/components/bingo/text";
import type { ChallengeId, LineKey, RewardTier, SquareId } from "@/lib/bingo";
import { useExperiences } from "@/lib/use-experiences";

type Search = { view?: "rewards" };

export const Route = createFileRoute("/_authenticated/app/bingo")({
  validateSearch: (s: Record<string, unknown>): Search => (s.view === "rewards" ? { view: "rewards" } : {}),
  head: () => ({
    meta: [{ title: "Agora Bingo — Agora" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: BingoPage,
});

const reducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/**
 * Agora Bingo (design: Naz Paşalı): a monthly cultural passport on the night field. Squares fill
 * from the person's own experience records (self-reported, kept on this device); there is no
 * verifier and no partner yet, so nothing here is verified and no reward can be used.
 */
function BingoPage() {
  const { t, i18n } = useTranslation();
  const { view } = Route.useSearch();
  const navigate = useNavigate();
  const xp = useExperiences();
  const [open, setOpen] = useState<SquareId | null>(null);
  const [flash, setFlash] = useState<string[]>([]);
  const [lit, setLit] = useState<LineKey[]>([]);
  const [cz, setCz] = useState<{ count: number; tier: RewardTier | null } | null>(null);
  const timer = useRef<number | null>(null);
  const per = periodLabel(xp.period, i18n.language);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [view]);

  // a new line (from this screen or from an "I went" elsewhere) gets its çinko moment once
  useEffect(() => {
    if (!xp.ready || !xp.userId || timer.current !== null) return;
    const fresh = xp.card.lines.filter((l) => !xp.celebrated.includes(l));
    if (!fresh.length) return;
    xp.celebrate(fresh);
    setLit(fresh);
    const first = xp.card.lines.length - fresh.length + 1;
    timer.current = window.setTimeout(
      () => {
        timer.current = null;
        setCz({ count: fresh.length, tier: first <= 3 ? (first as RewardTier) : null });
      },
      reducedMotion() ? 50 : 1300,
    );
  }, [xp.ready, xp.userId, xp.card.lines, xp.celebrated, xp.celebrate]);

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );

  const closeCz = useCallback(() => {
    setCz(null);
    setLit([]);
  }, []);

  function onMark(id: ChallengeId) {
    const rec = xp.markSquare(id, t(`bingo.sq.${id}.t`));
    if (!rec) return;
    setFlash([id]);
    window.setTimeout(() => setFlash([]), 1700);
    toast.success(t("experiences.added"), {
      description: t("experiences.addedBingo", { squares: t(`bingo.sq.${id}.t`) }),
      action: { label: t("experiences.undo"), onClick: () => xp.remove(rec.id) },
    });
  }

  function onUndo(recordId: string) {
    xp.remove(recordId);
    toast(t("experiences.removed"), { description: t("experiences.recalc") });
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="night-field nb-scope nb-night min-h-screen">
        <span className="night-grain" aria-hidden />
        <BingoStyles />
        <AppHeader variant="member" tone="night" />

        <main className="mx-auto max-w-md px-4 pb-16 sm:max-w-lg sm:px-6">
          <div className="flex min-h-12 items-center gap-2">
            {view === "rewards" ? (
              <Link
                to="/app/bingo"
                className="nb-focus grid h-11 w-11 shrink-0 place-items-center rounded-full shadow-[inset_0_0_0_1px_var(--nt-line)]"
                aria-label={t("bingo.backToCard")}
              >
                <ArrowLeft className="h-5 w-5 rtl:-scale-x-100" aria-hidden />
              </Link>
            ) : (
              <Link
                to="/app"
                className="nb-focus grid h-11 w-11 shrink-0 place-items-center rounded-full shadow-[inset_0_0_0_1px_var(--nt-line)]"
                aria-label={t("bingo.back")}
              >
                <ArrowLeft className="h-5 w-5 rtl:-scale-x-100" aria-hidden />
              </Link>
            )}
            <p className="nb-mono m-0 grow text-[color:var(--nt-2)]">{t("bingo.period", { period: per })}</p>
            {view !== "rewards" && (
              <Link
                to="/app/bingo"
                search={{ view: "rewards" }}
                className="nb-focus grid h-11 w-11 shrink-0 place-items-center rounded-full shadow-[inset_0_0_0_1px_var(--nt-line)]"
                aria-label={t("bingo.rewards")}
              >
                <TicketIcon className="h-5 w-5" aria-hidden />
              </Link>
            )}
          </div>

          {view === "rewards" ? (
            <section aria-labelledby="rw-title" className="mt-3">
              <h1 id="rw-title" className="nb-poster m-0 text-[clamp(48px,15vw,64px)]">
                {t("bingo.rewards")}
              </h1>
              <p className="mt-3 rounded-xl px-3 py-2.5 text-[12.5px] leading-[1.45] text-[color:var(--nt-2)] shadow-[inset_0_0_0_1px_var(--nt-line)]">
                {t("bingo.rw.note")}
              </p>
              <div className="mt-5" style={{ ["--nb-hole" as string]: "#120d1c" }}>
                <RewardsList lines={xp.card.lines.length} period={xp.period} />
              </div>
              <Link to="/app/bingo" className="nb-btn nb-nline mt-8 w-full">
                {t("bingo.backToCard")}
              </Link>
            </section>
          ) : (
            <>
              <div className="mt-3">
                <h1 className="m-0 flex flex-wrap items-end gap-3">
                  <img
                    src="/agora-logo.png"
                    alt="Agora"
                    width={720}
                    height={157}
                    draggable={false}
                    className="h-auto w-[132px] invert"
                  />
                  <b className="nb-poster text-[52px] leading-[0.78] text-[#E9A23B]">BINGO</b>
                </h1>
                <p className="mt-3 max-w-[28ch] text-[18px] font-medium leading-[1.3] text-balance">{t("bingo.lead")}</p>
                <p className="nb-mono mt-2 text-[color:var(--nt-2)]">{t("bingo.tag")}</p>
              </div>

              <div className="mt-7">
                <BingoCard card={xp.card} flash={flash} lit={lit} onOpen={setOpen} />
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <Link to="/app/bingo" search={{ view: "rewards" }} className="nb-btn nb-mg">
                  {t("bingo.rewards")}
                </Link>
                <a href="#how" className="nb-btn nb-nline">
                  {t("bingo.howBtn")}
                </a>
              </div>
              <p className="mt-4 rounded-xl px-3 py-2.5 text-[12.5px] leading-[1.45] text-[color:var(--nt-2)] shadow-[inset_0_0_0_1px_var(--nt-line)]">
                {t("bingo.deviceNote")} {t("bingo.cardNote")}
              </p>

              <section id="how" aria-labelledby="how-t" className="mt-8 scroll-mt-4 border-t border-[color:var(--nt-line)] pt-4">
                <h2 id="how-t" className="m-0 text-[30px] font-[850] leading-none [font-stretch:70%]">
                  {t("bingo.howTitle")}
                </h2>
                <ol className="m-0 mt-4 grid list-none gap-3 p-0">
                  {[1, 2, 3, 4].map((i) => (
                    <li key={i} className="grid grid-cols-[32px_minmax(0,1fr)] gap-2.5 text-[14px] leading-[1.45] text-[color:var(--nt-2)]">
                      <span className="pt-0.5 font-mono text-[12px] text-[#E9A23B]" aria-hidden>
                        0{i}
                      </span>
                      <span>
                        <b className="block font-semibold text-[color:var(--nt)]">{t(`bingo.how.${i}t`)}</b>
                        {t(`bingo.how.${i}d`)}
                      </span>
                    </li>
                  ))}
                </ol>
              </section>
            </>
          )}
        </main>
      </div>

      <ChallengeSheet
        square={open}
        card={xp.card}
        records={xp.records}
        onClose={() => setOpen(null)}
        onStart={(id) => xp.start(id)}
        onMark={onMark}
        onUndo={onUndo}
      />

      {cz && (
        <Cinko
          count={cz.count}
          tier={cz.tier}
          period={xp.period}
          onClose={closeCz}
          onTiers={() => {
            closeCz();
            navigate({ to: "/app/bingo", search: { view: "rewards" } });
          }}
        />
      )}
    </div>
  );
}
