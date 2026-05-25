import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getEvent, rsvpEvent } from "@/lib/events.functions";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/event/$id")({
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
      toast.success("Saved");
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
      </main>
    </div>
  );
}
