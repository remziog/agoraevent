import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Logo } from "@/components/Logo";
import { SiteFooter } from "@/components/SiteFooter";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — Agora" },
      {
        name: "description",
        content:
          "How Agora collects, uses, and protects your information when you use our event discovery service.",
      },
      { property: "og:title", content: "Privacy Policy — Agora" },
      { property: "og:description", content: "How Agora collects, uses, and protects your information when you use our event discovery service." },
      { property: "og:url", content: "https://ago-ra.life/privacy" },
    ],
    links: [{ rel: "canonical", href: "https://ago-ra.life/privacy" }],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="mx-auto w-full max-w-6xl px-6 py-6">
        <Link to="/">
          <Logo />
        </Link>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
        <h1 className="font-display text-4xl">{t("legal.privacyTitle")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("legal.lastUpdated")}: 2026-05-28
        </p>
        <div className="prose prose-neutral mt-8 max-w-none text-sm leading-relaxed text-muted-foreground">
          <p>
            Agora ("we", "us") respects your privacy. This policy explains what we
            collect, why, and how you can control it.
          </p>
          <h2 className="mt-8 text-foreground">What we collect</h2>
          <ul>
            <li>Account info: name, email, profile photo (optional).</li>
            <li>Taste preferences you share during onboarding.</li>
            <li>Approximate location to surface nearby events.</li>
            <li>Usage analytics (page views, device type) to improve the product.</li>
          </ul>
          <h2 className="mt-8 text-foreground">How we use it</h2>
          <ul>
            <li>To match you with relevant nearby events.</li>
            <li>To operate authentication and account security.</li>
            <li>To send essential transactional emails.</li>
          </ul>
          <h2 className="mt-8 text-foreground">Third parties</h2>
          <p>
            We use trusted infrastructure providers (hosting, database, analytics,
            email, maps). They process data on our behalf under their own terms.
          </p>
          <h2 className="mt-8 text-foreground">Your rights</h2>
          <p>
            You can request access, correction, or deletion of your data at any time
            by emailing privacy@ago-ra.life.
          </p>
          <h2 className="mt-8 text-foreground">Contact</h2>
          <p>privacy@ago-ra.life</p>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
