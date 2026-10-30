import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

/**
 * The opening (design: Naz Paşalı): liquid light rises out of the dark, the
 * question surfaces — unblurring and tightening, warm amber cooling to ivory —
 * and the night compass screen settles in behind it. Once per visit; never
 * under prefers-reduced-motion; a tap or the Skip button ends it at once.
 */
const KEY = "agora:intro-seen:v1";

export function CinematicIntro() {
  const { t } = useTranslation();
  const [show, setShow] = useState(false);

  useEffect(() => {
    let seen = false;
    try {
      seen = sessionStorage.getItem(KEY) === "1";
      sessionStorage.setItem(KEY, "1");
    } catch {
      seen = true;
    }
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    if (!seen && !reduce) setShow(true);
  }, []);

  useEffect(() => {
    if (!show) return;
    const timer = window.setTimeout(() => setShow(false), 3300);
    return () => window.clearTimeout(timer);
  }, [show]);

  if (!show) return null;
  return (
    <div
      className="agora-intro fixed inset-0 z-[60] cursor-pointer overflow-hidden"
      onClick={() => setShow(false)}
      role="presentation"
    >
      <div className="agora-liquid absolute -inset-1/4 bg-[#0d0b1a] blur-[46px]" aria-hidden>
        <i className="l1" />
        <i className="l2" />
        <i className="l3" />
        <i className="l4" />
        <i className="l5" />
      </div>
      <p className="agora-intro-q absolute inset-x-5 top-[34%] m-0 font-display text-[clamp(4rem,19vw,8rem)] font-[900] leading-[0.84] [font-stretch:62%] text-balance sm:inset-x-[12%]">
        {t("discover.heroTitle", "What do you feel like doing today")}
        <span className="hero-q">?</span>
      </p>
      <p className="agora-intro-tag absolute inset-x-5 bottom-10 m-0 font-mono text-[11px] uppercase tracking-[0.12em] text-[color:rgb(243_235_221/0.7)] sm:inset-x-[12%]">
        {t("intro.tag", "Your mood is the compass.")}
      </p>
      <button
        type="button"
        onClick={() => setShow(false)}
        className="absolute right-4 top-[max(1rem,env(safe-area-inset-top))] z-[2] min-h-11 rounded-full border border-[rgb(243_235_221/0.24)] px-4 font-mono text-[11px] uppercase tracking-[0.1em] text-[#f3ebdd]"
      >
        {t("intro.skip", "Skip")}
      </button>
    </div>
  );
}
