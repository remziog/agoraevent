import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Logo } from "@/components/Logo";
import { SiteFooter } from "@/components/SiteFooter";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service — Agora" },
      {
        name: "description",
        content:
          "The terms that govern your use of Agora — what you can expect from us and what we expect from you.",
      },
      { property: "og:title", content: "Terms of Service — Agora" },
      { property: "og:url", content: "/terms" },
    ],
    links: [{ rel: "canonical", href: "/terms" }],
  }),
  component: TermsPage,
});

function TermsPage() {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="mx-auto w-full max-w-6xl px-6 py-6">
        <Link to="/">
          <Logo />
        </Link>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
        <h1 className="font-display text-4xl">{t("legal.termsTitle")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("legal.lastUpdated")}: 2026-05-28
        </p>
        <div className="prose prose-neutral mt-8 max-w-none text-sm leading-relaxed text-muted-foreground">
          <p>
            By using Agora, you agree to these terms. If you do not agree, please do
            not use the service.
          </p>
          <h2 className="mt-8 text-foreground">Accounts</h2>
          <p>
            You must be at least 16 years old and provide accurate information. You
            are responsible for keeping your credentials secure.
          </p>
          <h2 className="mt-8 text-foreground">Acceptable use</h2>
          <ul>
            <li>No harassment, hate speech, or illegal activity.</li>
            <li>No scraping or automated access without permission.</li>
            <li>Respect event hosts, venues, and other members.</li>
          </ul>
          <h2 className="mt-8 text-foreground">Content</h2>
          <p>
            You retain ownership of content you post. By posting, you grant Agora a
            non-exclusive license to display it within the service.
          </p>
          <h2 className="mt-8 text-foreground">Events</h2>
          <p>
            Agora helps you discover events but does not organize them. Event hosts
            are responsible for their own gatherings, safety, and compliance.
          </p>
          <h2 className="mt-8 text-foreground">Termination</h2>
          <p>
            We may suspend or terminate accounts that violate these terms. You can
            close your account at any time.
          </p>
          <h2 className="mt-8 text-foreground">Contact</h2>
          <p>hello@ago-ra.life</p>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
