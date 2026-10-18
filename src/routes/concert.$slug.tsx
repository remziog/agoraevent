import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { SiteFooter } from "@/components/SiteFooter";
import { getPublicEvent } from "@/lib/public-events.functions";

const BASE_URL = "https://ago-ra.life";

export const Route = createFileRoute("/concert/$slug")({
  loader: async ({ params }) => {
    const { event } = await getPublicEvent({ data: { slug: params.slug } });
    if (!event) throw notFound();
    return { event };
  },
  head: ({ params, loaderData }) => {
    const ev = loaderData?.event;
    if (!ev) {
      return {
        meta: [
          { title: "Concert — Agora" },
          { name: "robots", content: "noindex, follow" },
        ],
      };
    }
    const url = `${BASE_URL}/concert/${params.slug}`;
    const when = new Date(ev.starts_at).toLocaleString("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/Istanbul",
    });
    const where = [ev.venue, ev.city].filter(Boolean).join(", ");
    const title = `${ev.title} — Live in ${ev.city ?? "Istanbul"} | Agora`;
    const description = `${ev.title} live at ${where} on ${when}. Find your crew on Agora — RSVP, meet attendees, and plan the night.`;
    return {
      meta: [
        { title },
        { name: "description", content: description.slice(0, 300) },
        { name: "robots", content: "index, follow" },
        { name: "keywords", content: ev.tags.filter((t) => !t.startsWith("tip:") && !t.startsWith("mapsurl:")).join(", ") },
        { property: "og:title", content: title },
        { property: "og:description", content: description.slice(0, 300) },
        { property: "og:url", content: url },
        { property: "og:type", content: "event" },
        { property: "og:site_name", content: "Agora" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description.slice(0, 200) },
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "MusicEvent",
            name: ev.title,
            startDate: ev.starts_at,
            endDate: ev.ends_at ?? undefined,
            eventStatus: "https://schema.org/EventScheduled",
            eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
            description: ev.description ?? undefined,
            url,
            location: {
              "@type": "Place",
              name: ev.venue ?? ev.city ?? "TBD",
              address: {
                "@type": "PostalAddress",
                addressLocality: ev.city ?? undefined,
                addressCountry: "TR",
              },
              ...(ev.latitude != null && ev.longitude != null
                ? {
                    geo: {
                      "@type": "GeoCoordinates",
                      latitude: ev.latitude,
                      longitude: ev.longitude,
                    },
                  }
                : {}),
            },
            performer: ev.tags
              .filter((t) => ["kanye-west", "travis-scott"].includes(t))
              .map((t) => ({
                "@type": "MusicGroup",
                name: t
                  .split("-")
                  .map((w) => w[0].toUpperCase() + w.slice(1))
                  .join(" "),
              })),
            organizer: { "@type": "Organization", name: "Agora", url: BASE_URL },
          }),
        },
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Agora", item: BASE_URL },
              // There is no /concert index route; /today is the public listing.
              { "@type": "ListItem", position: 2, name: "Today in Istanbul", item: `${BASE_URL}/today` },
              { "@type": "ListItem", position: 3, name: ev.title, item: url },
            ],
          }),
        },
      ],
    };
  },
  component: ConcertLanding,
  notFoundComponent: () => (
    <div className="grid min-h-screen place-items-center bg-background px-6 text-center">
      <div>
        <h1 className="font-display text-4xl">Concert not found</h1>
        <p className="mt-3 text-muted-foreground">This page may have moved or the concert has passed.</p>
        <Link to="/" className="mt-6 inline-block text-sm underline">← Back to Agora</Link>
      </div>
    </div>
  ),
});

function ConcertLanding() {
  const { event } = Route.useLoaderData();
  const when = new Date(event.starts_at).toLocaleString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Istanbul",
  });
  const where = [event.venue, event.city].filter(Boolean).join(", ");
  const tipTag = event.tags.find((t: string) => t.startsWith("tip:"));
  const tip = tipTag ? tipTag.slice("tip:".length) : null;
  const performers = event.tags.filter((t: string) => ["kanye-west", "travis-scott"].includes(t));

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
        <article>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">
            Concert · {event.city ?? "Istanbul"}
          </p>
          <h1 className="mt-3 font-display text-5xl leading-tight">{event.title}</h1>
          <p className="mt-4 text-lg text-muted-foreground">
            {when} · {where}
          </p>

          {performers.length > 0 && (
            <p className="mt-2 text-sm text-muted-foreground">
              Performing: {performers.map((p: string) => p.split("-").map((w: string) => w[0].toUpperCase() + w.slice(1)).join(" ")).join(", ")}
            </p>
          )}

          {event.description && (
            <p className="mt-8 whitespace-pre-wrap text-base leading-relaxed">{event.description}</p>
          )}

          {tip && (
            <aside className="mt-6 rounded-2xl border bg-card p-5 text-sm">
              <p className="font-medium">Getting there</p>
              <p className="mt-1 text-muted-foreground">{tip}</p>
            </aside>
          )}

          <section className="mt-10 rounded-2xl border bg-card p-6">
            <h2 className="font-display text-2xl">Going? Find your crew.</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Agora helps you meet people going to the same show — pre-game plans,
              shared rides, and a place to land after. Free to join.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Button asChild size="lg"><Link to="/signup">Join Agora — it's free</Link></Button>
              <Button asChild size="lg" variant="outline"><Link to="/login">Already a member? Log in</Link></Button>
            </div>
          </section>

          <section className="mt-10">
            <h2 className="font-display text-2xl">Why Agora for concert nights</h2>
            <ul className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <li className="rounded-xl border p-4">
                <p className="font-medium">Meet people at the same show</p>
                <p className="mt-1 text-muted-foreground">RSVP and see who else is going.</p>
              </li>
              <li className="rounded-xl border p-4">
                <p className="font-medium">Offline-ready getting-there guide</p>
                <p className="mt-1 text-muted-foreground">Transit tips cached on your phone.</p>
              </li>
              <li className="rounded-xl border p-4">
                <p className="font-medium">After the show</p>
                <p className="mt-1 text-muted-foreground">Post a memory, save the night.</p>
              </li>
              <li className="rounded-xl border p-4">
                <p className="font-medium">Your taste, not generic feeds</p>
                <p className="mt-1 text-muted-foreground">Music, sport, film, talks — your call.</p>
              </li>
            </ul>
          </section>
        </article>
      </main>

      <SiteFooter />
    </div>
  );
}
