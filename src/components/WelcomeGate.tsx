import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { LivingCanvas } from "@/components/LivingCanvas";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

/**
 * The front door (design: Naz Paşalı). Agora's own compass — the same geometry
 * as the discovery dial — draws itself, turns, sheds its detail and settles
 * into the O of the wordmark at the logo's real proportions; the word unmasks
 * outward from it, then the slogan, then the three ways in.
 *
 * The whole sequence is CSS (styles.css, "Welcome"), so it plays from the first
 * paint without waiting for hydration, ends in a readable page without
 * JavaScript, and shows the end state at once under prefers-reduced-motion.
 * Skip jumps to the end. About 4.7 s.
 */

const pt = (deg: number, r: number): [string, string] => {
  const a = (deg * Math.PI) / 180;
  return [(160 + Math.sin(a) * r).toFixed(2), (160 - Math.cos(a) * r).toFixed(2)];
};

const TICKS = Array.from({ length: 72 }, (_, i) => {
  const major = i % 18 === 0;
  const mid = i % 9 === 0;
  const [x1, y1] = pt(i * 5, 150);
  const [x2, y2] = pt(i * 5, major ? 136 : mid ? 141.5 : 145.5);
  return { i, x1, y1, x2, y2, cls: major ? "major" : mid ? "mid" : "" };
});

const AXIS = [0, 90, 180, 270].map((deg, i) => {
  const [x1, y1] = pt(deg, 15);
  const [x2, y2] = pt(deg, 116);
  return { i, x1, y1, x2, y2 };
});

function WelcomeCompass() {
  return (
    <svg className="wl-compass" viewBox="0 0 320 320" aria-hidden>
      <circle className="wl-disc" cx="160" cy="160" r="150" />
      <circle
        className="wl-line wl-outer"
        cx="160"
        cy="160"
        r="150"
        pathLength={1}
        transform="rotate(-90 160 160)"
      />
      <g className="wl-detail">
        <circle
          className="wl-line wl-faint wl-inner"
          cx="160"
          cy="160"
          r="124"
          pathLength={1}
          transform="rotate(90 160 160)"
        />
        <g>
          {TICKS.map((k) => (
            <line
              key={k.i}
              className={`wl-tick ${k.cls}`}
              x1={k.x1}
              y1={k.y1}
              x2={k.x2}
              y2={k.y2}
              pathLength={1}
              style={{ animationDelay: `${620 + k.i * 7}ms` }}
            />
          ))}
        </g>
        <g>
          {AXIS.map((k) => (
            <line
              key={k.i}
              className="wl-axis"
              x1={k.x1}
              y1={k.y1}
              x2={k.x2}
              y2={k.y2}
              pathLength={1}
              style={{ animationDelay: `${980 + k.i * 50}ms` }}
            />
          ))}
        </g>
        <path className="wl-fill wl-dot" d="M160 0.5 L164 7.5 L156 7.5 Z" />
        <g className="wl-needle">
          <path
            className="wl-needle-s"
            d="M160 160 L165.5 148 L160 42 L154.5 148 Z"
            pathLength={1}
          />
          <path className="wl-fill wl-dot" d="M160 42 L162.5 90 L157.5 90 Z" />
          <path
            className="wl-needle-s wl-tail"
            d="M160 160 L163.5 171 L160 222 L156.5 171 Z"
            pathLength={1}
          />
          <circle className="wl-fill wl-dot" cx="160" cy="160" r="2.8" />
        </g>
      </g>
    </svg>
  );
}

const ArrowGo = () => (
  <svg className="wl-go" viewBox="0 0 24 24" aria-hidden>
    <path d="M5 12h14" />
    <path d="m13 6 6 6-6 6" />
  </svg>
);

export function WelcomeGate() {
  const { t } = useTranslation();
  const [done, setDone] = useState(false);

  // One opening per visit: the app's own intro stays quiet after this one.
  useEffect(() => {
    try {
      sessionStorage.setItem("agora:intro-seen:v1", "1");
    } catch {
      /* private mode */
    }
  }, []);

  useEffect(() => {
    if (done) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDone(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [done]);

  const roles = [
    {
      key: "explorer",
      to: "/app" as const,
      title: t("wl.explorer", "I want to explore"),
      sub: t("wl.explorer_sub", "Restaurants, events, exhibitions, matched to your mood."),
      icon: (
        <svg className="wl-ri" viewBox="0 0 32 32" aria-hidden>
          <circle cx="16" cy="16" r="12.5" />
          <circle cx="16" cy="16" r="9.5" opacity=".45" />
          <path d="M16 5.5l2.4 10.5L16 26.5 13.6 16z" />
          <path d="M16 3v1.6M16 27.4V29M3 16h1.6M27.4 16H29" opacity=".6" />
        </svg>
      ),
    },
    {
      key: "venue",
      to: "/biz" as const,
      title: t("wl.venue", "I have a venue"),
      sub: t("wl.venue_sub", "Restaurant, café, gallery or event space."),
      icon: (
        <svg className="wl-ri" viewBox="0 0 32 32" aria-hidden>
          <path d="M5 27.5h22" />
          <path d="M7.5 27.5V11h17v16.5" />
          <path d="M5.5 11h21l-2 5h-17z" />
          <path
            d="M10 16c0 1.4 1.2 2.2 2.2 2.2s2.2-.8 2.2-2.2c0 1.4 1.1 2.2 2.1 2.2s2.2-.8 2.2-2.2c0 1.4 1.1 2.2 2.1 2.2s2.2-.8 2.2-2.2"
            opacity=".55"
          />
          <path d="M17.5 27.5v-6h4.5v6" />
          <rect x="10" y="21" width="5" height="3.5" opacity=".7" />
        </svg>
      ),
    },
    {
      key: "organizer",
      to: "/biz" as const,
      title: t("wl.organizer", "I organise events"),
      sub: t("wl.organizer_sub", "Artist, curator, collective or promoter."),
      icon: (
        <svg className="wl-ri" viewBox="0 0 32 32" aria-hidden>
          <path d="M4 10.5h24v3.2a2.8 2.8 0 0 0 0 5.6v3.2H4v-3.2a2.8 2.8 0 0 0 0-5.6z" />
          <path d="M21 10.5v12" strokeDasharray="1.4 2" />
          <path
            d="M11 13.5l1 2.6 2.8.2-2.2 1.8.7 2.7L11 19.3l-2.3 1.5.7-2.7-2.2-1.8 2.8-.2z"
            opacity=".75"
          />
        </svg>
      ),
    },
  ];

  return (
    <section
      className={`night-field wl ${done ? "is-done" : ""}`}
      aria-label="Agora"
      onAnimationEnd={(e) => {
        if (e.animationName === "wl-skip-out") setDone(true);
      }}
    >
      <LivingCanvas mode="home" focusSelector=".wl-stage" />
      <span className="night-grain" aria-hidden />

      <div className="wl-top">
        <LanguageSwitcher />
        <button type="button" className="wl-skip" onClick={() => setDone(true)}>
          {t("wl.skip", "Skip")}
        </button>
      </div>

      <div className="wl-stage">
        <WelcomeCompass />
        <div className="wl-logo">
          <img src="/agora-wordmark.png" alt="AGORA" width={1200} height={313} />
        </div>
      </div>
      <p className="wl-slogan" lang="en" dir="ltr">
        YOUR MOOD IS THE COMPASS.
      </p>
      <h1 className="wl-msg">{t("wl.msg", "Discover the city at your own rhythm.")}</h1>

      <nav className="wl-roles" aria-label={t("wl.rolesLabel", "Ways in")}>
        {roles.map((r, i) => (
          <Link
            key={r.key}
            to={r.to}
            className="wl-role"
            style={{ animationDelay: `${4040 + i * 90}ms` }}
          >
            {r.icon}
            <span>
              <b>{r.title}</b>
              <small>{r.sub}</small>
            </span>
            <ArrowGo />
          </Link>
        ))}
      </nav>
      <div className="wl-auth">
        <Link to="/login">{t("wl.signin", "Sign in")}</Link>
        <span aria-hidden>·</span>
        <Link to="/signup">{t("wl.create", "Create account")}</Link>
      </div>
      <p className="wl-powered">{t("wl.powered", "Taste ranking by Qloo · Istanbul")}</p>
    </section>
  );
}
