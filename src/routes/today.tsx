import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { SiteFooter } from "@/components/SiteFooter";
import { listTodayPublicEvents, type PublicEvent } from "@/lib/public-events.functions";

const BASE_URL = "https://ago-ra.life";
const URL = `${BASE_URL}/today`;

function formatHuman(dateIso: string) {
  return new Date(`${dateIso}T12:00:00+03:00`).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Istanbul",
  });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Istanbul",
  });
}

export const Route = createFileRoute("/today")({
  loader: async () => listTodayPublicEvents(),
  head: ({ loaderData }) => {
    const events = loaderData?.events ?? [];
    const dateIso = loaderData?.date ?? new Date().toISOString().slice(0, 10);
    const human = formatHuman(dateIso);
    const count = events.length;
    const titleBase = count > 0 ? `${count} concert${count === 1 ? "" : "s"} in Istanbul today` : "Today in Istanbul";
    const title = `${titleBase} · ${human} | Agora`;
    const description =
      count > 0
        ? `Live music and concerts happening in Istanbul on ${human}: ${events
            .map((e: PublicEvent) => e.title)
            .join(" · ")}. Find your crew on Agora.`
        : `Agora's daily round-up of concerts and live events in Istanbul for ${human}.`;

    return {
      meta: [
        { title },
        { name: "description", content: description.slice(0, 300) },
        { name: "robots", content: "index, follow" },
        { name: "keywords", content: "istanbul concerts today, live music istanbul, events tonight istanbul, agora" },
        { property: "og:title", content: title },
        { property: "og:description", content: description.slice(0, 300) },
        { property: "og:url", content: URL },
        { property: "og:type", content: "website" },
        { property: "og:site_name", content: "Agora" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description.slice(0, 200) },
      ],
      links: [{ rel: "canonical", href: URL }],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "ItemList",
            name: titleBase,
            url: URL,
            numberOfItems: count,
            itemListElement: events.map((e: PublicEvent, i: number) => ({
              "@type": "ListItem",
              position: i + 1,
              url: `${BASE_URL}/concert/${e.slug}`,
              item: {
                "@type": "MusicEvent",
                name: e.title,
                startDate: e.starts_at,
                endDate: e.ends_at ?? undefined,
                eventStatus: "https://schema.org/EventScheduled",
                eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
                url: `${BASE_URL}/concert/${e.slug}`,
                location: {
                  "@type": "Place",
                  name: e.venue ?? e.city ?? "TBD",
                  address: {
                    "@type": "PostalAddress",
                    addressLocality: e.city ?? undefined,
                    addressCountry: "TR",
                  },
                },
              },
            })),
          }),
        },
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Agora", item: BASE_URL },
              { "@type": "ListItem", position: 2, name: "Today", item: URL },
            ],
          }),
        },
      ],
    };
  },
  component: TodayPage,
});

function TodayPage() {
  const { events, date } = Route.useLoaderData();
  const human = formatHuman(date);

  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
        <Link to="/" aria-label="Agora home"><Logo /></Link>
        <nav className="flex items-center gap-3">
          <Link to="/login" className="text-sm text-muted-foreground hover:text-foreground">Log in</Link>
          <Button asChild size="sm"><Link to="/signup">Join Agora</Link></Button>
        </nav>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-10">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Today · Istanbul</p>
        <h1 className="mt-3 font-display text-5xl leading-tight">Concerts in Istanbul tonight</h1>
        <p className="mt-3 text-lg text-muted-foreground">{human}</p>

        {events.length === 0 ? (
          <p className="mt-10 rounded-2xl border bg-card p-6 text-sm text-muted-foreground">
            No public concerts on Agora today. Check back tomorrow, or{" "}
            <Link to="/signup" className="underline">join Agora</Link> to see member-only events.
          </p>
        ) : (
          <ul className="mt-10 space-y-4">
            {events.map((e: PublicEvent) => (
              <li key={e.id} className="rounded-2xl border bg-card p-6">
                <p className="text-xs uppercase tracking-widest text-muted-foreground">
                  {formatTime(e.starts_at)} · {[e.venue, e.city].filter(Boolean).join(", ")}
                </p>
                <h2 className="mt-2 font-display text-2xl">
                  <Link to="/concert/$slug" params={{ slug: e.slug }} className="hover:underline">
                    {e.title}
                  </Link>
                </h2>
                {e.description && (
                  <p className="mt-3 line-clamp-3 text-sm text-muted-foreground">{e.description}</p>
                )}
                <div className="mt-4">
                  <Button asChild size="sm">
                    <Link to="/concert/$slug" params={{ slug: e.slug }}>See details</Link>
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <section className="mt-12 rounded-2xl border bg-card p-6">
          <h2 className="font-display text-2xl">Going out tonight?</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Agora helps you meet people heading to the same show — pre-game plans, shared rides, and a place to land after.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button asChild size="lg"><Link to="/signup">Join Agora — it's free</Link></Button>
            <Button asChild size="lg" variant="outline"><Link to="/login">Log in</Link></Button>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
