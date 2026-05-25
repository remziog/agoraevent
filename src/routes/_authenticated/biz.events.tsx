import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createEvent, listOrgEvents, listMyOrganizations } from "@/lib/orgs.functions";
import { AppHeader } from "@/components/AppHeader";
import { BizSubnav } from "@/components/BizSubnav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const search = z.object({ org: z.string().uuid() });

export const Route = createFileRoute("/_authenticated/biz/events")({
  validateSearch: (s) => search.parse(s),
  component: EventsPage,
});

function EventsPage() {
  const { org } = Route.useSearch();
  const listEv = useServerFn(listOrgEvents);
  const createEv = useServerFn(createEvent);
  const listOrgs = useServerFn(listMyOrganizations);
  const qc = useQueryClient();

  const orgsQ = useQuery({ queryKey: ["orgs"], queryFn: () => listOrgs() });
  const orgRow = orgsQ.data?.organizations.find((o: any) => o.id === org);
  const evQ = useQuery({ queryKey: ["org-events", org], queryFn: () => listEv({ data: { org_id: org } }) });

  const [title, setTitle] = useState("");
  const [cat, setCat] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [venue, setVenue] = useState("");
  const [capacity, setCapacity] = useState("");
  const [price, setPrice] = useState("");
  const [tags, setTags] = useState("");
  const [desc, setDesc] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await createEv({
        data: {
          org_id: org,
          title,
          description: desc || null,
          category: cat,
          starts_at: new Date(startsAt).toISOString(),
          city: orgRow?.city ?? null,
          venue: venue || null,
          capacity: capacity ? Number(capacity) : null,
          price: price ? Number(price) : 0,
          tags: tags.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean),
        },
      });
      setTitle(""); setCat(""); setStartsAt(""); setVenue(""); setCapacity(""); setPrice(""); setTags(""); setDesc("");
      qc.invalidateQueries({ queryKey: ["org-events", org] });
      toast.success("Event created");
    } catch (e) { toast.error((e as Error).message); }
    finally { setSubmitting(false); }
  }

  const events = evQ.data?.events ?? [];

  return (
    <div className="min-h-screen bg-background">
      <AppHeader variant="organizer" />
      <BizSubnav orgId={org} orgName={orgRow?.name} />
      <main className="mx-auto max-w-5xl px-6 py-10">
        <h1 className="font-display text-3xl">Events</h1>
        <p className="mt-1 text-sm text-muted-foreground">{orgRow?.name ?? "Organization"} · {events.length} total</p>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.3fr,1fr]">
          <ul className="space-y-3">
            {evQ.isLoading && <li className="text-sm text-muted-foreground">Loading…</li>}
            {!evQ.isLoading && events.length === 0 && (
              <li className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">No events yet. Create one →</li>
            )}
            {events.map((e: any) => {
              const count = e.rsvps?.[0]?.count ?? 0;
              return (
                <li key={e.id} className="rounded-xl border bg-card p-4">
                  <div className="flex items-baseline justify-between gap-3">
                    <Link to="/app/event/$id" params={{ id: e.id }} className="font-display text-lg hover:underline">{e.title}</Link>
                    <span className="text-xs text-muted-foreground">{new Date(e.starts_at).toLocaleString()}</span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{e.category}{e.venue ? ` · ${e.venue}` : ""}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
                    {(e.tags ?? []).map((t: string) => (
                      <span key={t} className="rounded-full border px-2 py-0.5">{t}</span>
                    ))}
                    <span className="ml-auto text-muted-foreground">{count} RSVP{count === 1 ? "" : "s"}</span>
                  </div>
                </li>
              );
            })}
          </ul>

          <form onSubmit={onSubmit} className="h-fit space-y-3 rounded-xl border bg-card p-6">
            <h3 className="font-display text-xl">New event</h3>
            <div className="space-y-2"><Label>Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} required /></div>
            <div className="space-y-2"><Label>Category</Label><Input placeholder="run club, listening session…" value={cat} onChange={(e) => setCat(e.target.value)} required /></div>
            <div className="space-y-2"><Label>Starts at</Label><Input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} required /></div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2"><Label>Venue</Label><Input value={venue} onChange={(e) => setVenue(e.target.value)} /></div>
              <div className="space-y-2"><Label>Capacity</Label><Input type="number" value={capacity} onChange={(e) => setCapacity(e.target.value)} /></div>
            </div>
            <div className="space-y-2"><Label>Price</Label><Input type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} /></div>
            <div className="space-y-2"><Label>Tags</Label><Input placeholder="comma, separated" value={tags} onChange={(e) => setTags(e.target.value)} /></div>
            <div className="space-y-2"><Label>Description</Label><Textarea rows={3} value={desc} onChange={(e) => setDesc(e.target.value)} /></div>
            <Button type="submit" disabled={submitting}>{submitting ? "Creating…" : "Create event"}</Button>
          </form>
        </div>
      </main>
    </div>
  );
}
