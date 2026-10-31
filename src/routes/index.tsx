import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { SiteFooter } from "@/components/SiteFooter";
import { WelcomeGate } from "@/components/WelcomeGate";
import { IS_NATIVE_APP, SITE_URL } from "@/lib/site";
import { supabase } from "@/integrations/supabase/client";
import { takeAfterLogin } from "@/lib/safe-redirect";

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
      {
        name: "description",
        content:
          "Tell Agora the kind of night you want. We find the room — nearby events that match your taste in music, sport, film, and conversation.",
      },
      { property: "og:title", content: "Agora — Meet your people in real life" },
      {
        property: "og:description",
        content: "Tell Agora the kind of night you want. We find the room.",
      },
      { property: "og:url", content: "https://ago-ra.life/" },
      { property: "og:type", content: "website" },
      { property: "og:image", content: OG_IMAGE },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Agora — Meet your people in real life" },
      {
        name: "twitter:description",
        content: "Tell Agora the kind of night you want. We find the room.",
      },
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
          description:
            "Agora helps you find nearby events that match your taste — music, sport, film, and more. The modern gathering place.",
        }),
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  const navigate = useNavigate();

  // Back from Google sign-in (the OAuth broker returns to "/"): continue to
  // where the person was going, e.g. /app/guide.
  useEffect(() => {
    const target = takeAfterLogin();
    if (!target) return;
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ href: target, replace: true });
    });
  }, [navigate]);

  // The front door is Naz Paşalı's welcome: the compass becomes the O, then the
  // three ways in (explore · venue · organise) and sign in / create account.
  return (
    <div className="min-h-screen bg-background text-foreground">
      <WelcomeGate />
      <SiteFooter />
    </div>
  );
}
