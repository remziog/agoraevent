import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getEvent, rsvpEvent } from "@/lib/events.functions";
import { AppHeader } from "@/components/AppHeader";
import { MemorySection } from "@/components/MemorySection";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/event/$id")({
  loader: async ({ params, context }) => {
    try {
      const data = await context.queryClient.ensureQueryData({
        queryKey: ["event", params.id],
        queryFn: () => getEvent({ data: { id: params.id } }),
      });
      return { event: data?.event ?? null };
    } catch {
      return { event: null };
    }
  },
  head: ({ loaderData }) => {
    const ev = loaderData?.event;
    const title = ev?.title ? `${ev.title} — Agora` : "Event — Agora";
    const description = ev?.description
      ? ev.description.slice(0, 180)
      : ev?.title
        ? `${ev.title} on Agora — see details, RSVP, and find your people.`
        : "Event details on Agora — RSVP and meet your people in real life.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { name: "robots", content: "noindex, nofollow" },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "event" },
      ],
    };
  },
  component: EventDetail,
});

function EventDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const get = useServerFn(getEvent);
  const rsvp = useServerFn(rsvpEvent);
  const qc = useQueryClient();

  const q = useQuery({ queryKey: ["event", id], queryFn: () => get({ data: { id } }) });
  const mutate = useMutation({
    mutationFn: (going: boolean) => rsvp({ data: { event_id: id, going } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["event", id] });
      qc.invalidateQueries({ queryKey: ["rsvps"] });
      qc.invalidateQueries({ queryKey: ["my-stats"] });
      toast.success("Saved · +25 XP");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const event = q.data?.event;
  const going = !!q.data?.rsvp;

  return (
    <div className="min-h-screen bg-background">
      <AppHeader variant="member" />
      <main className="mx-auto max-w-2xl px-6 py-10">
        <button onClick={() => navigate({ to: "/app" })} className="text-sm text-muted-foreground hover:text-foreground">
          ← Back
        </button>
        {q.isLoading && <p className="mt-8 text-muted-foreground">Loading…</p>}
        {event && (
          <article className="mt-6 rounded-2xl border bg-card p-8">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">{event.category}</p>
            <h1 className="mt-2 font-display text-4xl">{event.title}</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Hosted by {event.organizations?.name} · {event.city ?? "—"}
            </p>
            <p className="mt-4 text-sm">
              {new Date(event.starts_at).toLocaleString([], { weekday: "long", hour: "2-digit", minute: "2-digit", month: "long", day: "numeric" })}
              {event.venue ? ` · ${event.venue}` : ""}
            </p>
            {event.description && <p className="mt-6 whitespace-pre-wrap text-base">{event.description}</p>}
            {event.tags?.length > 0 && (
              <div className="mt-6 flex flex-wrap gap-2">
                {event.tags.map((t: string) => (
                  <span key={t} className="rounded-full border px-3 py-1 text-xs">{t}</span>
                ))}
              </div>
            )}
            <div className="mt-8">
              <Button
                size="lg"
                variant={going ? "outline" : "default"}
                disabled={mutate.isPending}
                onClick={() => mutate.mutate(!going)}
              >
                {going ? "You're going — cancel?" : "I'm going"}
              </Button>
            </div>
          </article>
        )}
        {event && (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "Event",
                name: event.title,
                startDate: event.starts_at,
                description: event.description ?? undefined,
                location: {
                  "@type": "Place",
                  name: event.venue ?? event.city ?? "TBD",
                  address: event.city ?? undefined,
                },
                organizer: event.organizations?.name
                  ? { "@type": "Organization", name: event.organizations.name }
                  : undefined,
              }),
            }}
          />
        )}
        {event && <MemorySection eventId={id} canPost={going} />}
      </main>
    </div>
  );
}
