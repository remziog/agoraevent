import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Logo, LogoMark } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { SiteFooter } from "@/components/SiteFooter";
import { IS_NATIVE_APP, SITE_URL } from "@/lib/site";

const OG_IMAGE = `${SITE_URL}/og-landing.jpg`;

export const Route = createFileRoute("/")({
  // The iOS/Android app opens on "/": skip the marketing page and go to the
  // app (which sends signed-out users to /login).
  beforeLoad: () => {
    if (IS_NATIVE_APP) throw redirect({ to: "/app" });
  },
  head: () => ({
    meta: [
      { title: "Agora — Meet your people in real life" },
      { name: "description", content: "Tell Agora the kind of night you want. We find the room — nearby events that match your taste in music, sport, film, and conversation." },
      { property: "og:title", content: "Agora — Meet your people in real life" },
      { property: "og:description", content: "Tell Agora the kind of night you want. We find the room." },
      { property: "og:url", content: "https://ago-ra.life/" },
      { property: "og:type", content: "website" },
      { property: "og:image", content: OG_IMAGE },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Agora — Meet your people in real life" },
      { name: "twitter:description", content: "Tell Agora the kind of night you want. We find the room." },
      { name: "twitter:image", content: OG_IMAGE },
    ],
    links: [{ rel: "canonical", href: "https://ago-ra.life/" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "Agora",
          url: "https://ago-ra.life/",
          description: "Find nearby events that match your taste.",
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "Agora",
          url: "https://ago-ra.life/",
          logo: `${SITE_URL}/icons/icon-512.png`,
          description: "Agora helps you find nearby events that match your taste — music, sport, film, and more. The modern gathering place.",
        }),
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  const { t } = useTranslation();

  const pillars = [
    { t: t("landing.pillar1Title"), d: t("landing.pillar1Desc") },
    { t: t("landing.pillar2Title"), d: t("landing.pillar2Desc") },
    { t: t("landing.pillar3Title"), d: t("landing.pillar3Desc") },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-6 sm:px-6">
        <Logo />
        <nav className="flex items-center gap-2 sm:gap-3">
          <LanguageSwitcher />
          <Link to="/login" className="text-sm text-muted-foreground hover:text-foreground">
            {t("landing.navSignIn")}
          </Link>
          <Button asChild size="sm">
            <Link to="/signup">{t("landing.navJoin")}</Link>
          </Button>
        </nav>
      </header>

      <main>
        {/* Hero */}
        <section className="mx-auto max-w-4xl px-4 pb-20 pt-12 text-center sm:px-6 sm:pt-16">
          <p className="mb-6 text-xs uppercase tracking-[0.28em] text-muted-foreground">
            {t("landing.kicker")}
          </p>
          <h1 className="font-display text-4xl font-semibold leading-[1.05] sm:text-7xl">
            {t("landing.heroTitleLine1")}
            <br />
            {t("landing.heroTitleLine2")}
          </h1>
          <p className="mx-auto mt-8 max-w-2xl text-base text-muted-foreground sm:text-lg">
            {t("landing.heroSub")}
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg">
              <Link to="/signup">{t("landing.ctaFindEvent")}</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link to="/biz">{t("landing.ctaIHost")}</Link>
            </Button>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            {t("landing.freeNote")}
          </p>
        </section>

        {/* Three pillars */}
        <section className="border-y border-border/60 bg-card/40">
          <div className="mx-auto grid max-w-6xl gap-12 px-4 py-16 sm:grid-cols-3 sm:px-6 sm:py-20">
            {pillars.map((p) => (
              <div key={p.t}>
                <LogoMark className="mb-4 h-7 w-7 text-primary" />
                <h2 className="font-display text-2xl">{p.t}</h2>
                <p className="mt-2 text-sm text-muted-foreground">{p.d}</p>
              </div>
            ))}
          </div>
        </section>

        {/* For hosts */}
        <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24">
          <div className="grid gap-12 sm:grid-cols-2 sm:items-center">
            <div>
              <p className="mb-3 text-xs uppercase tracking-[0.28em] text-muted-foreground">
                {t("landing.hostsKicker")}
              </p>
              <h2 className="font-display text-3xl sm:text-5xl">
                {t("landing.hostsTitle")}
              </h2>
              <p className="mt-5 text-muted-foreground">
                {t("landing.hostsDesc")}
              </p>
              <div className="mt-7">
                <Button asChild>
                  <Link to="/biz">{t("landing.hostsCta")}</Link>
                </Button>
              </div>
            </div>
            <div className="rounded-2xl border bg-card p-6 shadow-sm">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">
                {t("landing.demandLabel")}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {["acoustic", "vinyl listening", "5k run", "boardgames", "indie film", "single malt", "techno", "climbing", "pottery", "espresso"].map(
                  (tag) => (
                    <span
                      key={tag}
                      className="rounded-full border bg-background px-3 py-1 text-sm"
                    >
                      {tag}
                    </span>
                  ),
                )}
              </div>
              <p className="mt-6 text-sm text-muted-foreground">
                {t("landing.hostsFooter")}
              </p>
            </div>
          </div>
        </section>

        {/* Closing */}
        <section className="border-t border-border/60 bg-secondary/40">
          <div className="mx-auto max-w-3xl px-4 py-20 text-center sm:px-6 sm:py-24">
            <h2 className="font-display text-3xl sm:text-5xl">
              {t("landing.closingTitle")}
            </h2>
            <p className="mt-5 text-muted-foreground">
              {t("landing.closingDesc")}
            </p>
            <div className="mt-8">
              <Button asChild size="lg">
                <Link to="/signup">{t("landing.ctaFindEvent")}</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
