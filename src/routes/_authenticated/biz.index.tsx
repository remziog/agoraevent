import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createOrganization, listMyOrganizations, createEvent, listOrgEvents, listLeads, listCustomers, upsertCustomer } from "@/lib/orgs.functions";
import { getDemandInsightsAdmin } from "@/lib/insights.functions";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/biz/")({ component: BizDashboard });

function BizDashboard() {
  const listOrgs = useServerFn(listMyOrganizations);
  const createOrg = useServerFn(createOrganization);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["orgs"], queryFn: () => listOrgs() });
  const orgs = q.data?.organizations ?? [];

  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [city, setCity] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      await createOrg({ data: { name, category, city, description: description || null } });
      setName(""); setCategory(""); setCity(""); setDescription("");
      qc.invalidateQueries({ queryKey: ["orgs"] });
      toast.success("Organization created");
    } catch (e) { toast.error((e as Error).message); }
    finally { setCreating(false); }
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader variant="organizer" />
      <main className="mx-auto max-w-5xl px-6 py-10">
        <h1 className="font-display text-4xl">Your gatherings</h1>
        <p className="mt-2 text-muted-foreground">Each organization can host its own events.</p>

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <div className="space-y-3">
            {orgs.length === 0 && (
              <p className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
                No organizations yet. Create your first one →
              </p>
            )}
            {orgs.map((o: any) => (
              <OrgCard key={o.id} org={o} />
            ))}
          </div>
          <form onSubmit={onCreate} className="space-y-3 rounded-xl border bg-card p-6">
            <h3 className="font-display text-xl">New organization</h3>
            <div className="space-y-2"><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} required /></div>
            <div className="space-y-2"><Label>Category</Label><Input placeholder="coffee shop, gym, club…" value={category} onChange={(e) => setCategory(e.target.value)} required /></div>
            <div className="space-y-2"><Label>City</Label><Input value={city} onChange={(e) => setCity(e.target.value)} required /></div>
            <div className="space-y-2"><Label>Description</Label><Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} /></div>
            <Button type="submit" disabled={creating}>{creating ? "Creating…" : "Create"}</Button>
          </form>
        </div>

        {orgs.map((o: any) => (
          <OrgPanel key={o.id} org={o} />
        ))}
      </main>
    </div>
  );
}

function OrgCard({ org }: { org: any }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-baseline justify-between">
        <h3 className="font-display text-xl">{org.name}</h3>
        <span className="text-xs text-muted-foreground">{org.city}</span>
      </div>
      <p className="text-sm text-muted-foreground">{org.category}</p>
    </div>
  );
}

function OrgPanel({ org }: { org: any }) {
  const listEv = useServerFn(listOrgEvents);
  const createEv = useServerFn(createEvent);
  const leadsFn = useServerFn(listLeads);
  const custFn = useServerFn(listCustomers);
  const addCust = useServerFn(upsertCustomer);
  const insightsFn = useServerFn(getDemandInsightsAdmin);
  const qc = useQueryClient();

  const evQ = useQuery({ queryKey: ["org-events", org.id], queryFn: () => listEv({ data: { org_id: org.id } }) });
  const leadsQ = useQuery({ queryKey: ["org-leads", org.id], queryFn: () => leadsFn({ data: { org_id: org.id } }) });
  const custQ = useQuery({ queryKey: ["org-customers", org.id], queryFn: () => custFn({ data: { org_id: org.id } }) });
  const insightsQ = useQuery({ queryKey: ["org-insights", org.id], queryFn: () => insightsFn({ data: { org_id: org.id } }) });

  const [title, setTitle] = useState("");
  const [cat, setCat] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [tags, setTags] = useState("");
  const [desc, setDesc] = useState("");

  async function onCreateEvent(e: React.FormEvent) {
    e.preventDefault();
    try {
      await createEv({
        data: {
          org_id: org.id,
          title,
          description: desc || null,
          category: cat,
          starts_at: new Date(startsAt).toISOString(),
          city: org.city,
          venue: null,
          capacity: null,
          price: 0,
          tags: tags.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean),
        },
      });
      setTitle(""); setCat(""); setStartsAt(""); setTags(""); setDesc("");
      qc.invalidateQueries({ queryKey: ["org-events", org.id] });
      toast.success("Event created");
    } catch (e) { toast.error((e as Error).message); }
  }

  return (
    <section className="mt-12 rounded-2xl border bg-card/50 p-6">
      <h2 className="font-display text-2xl">{org.name}</h2>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div>
          <h3 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Events</h3>
          <ul className="mt-2 space-y-2 text-sm">
            {(evQ.data?.events ?? []).map((e: any) => (
              <li key={e.id} className="rounded-lg border bg-background p-3">
                <Link to="/app/event/$id" params={{ id: e.id }} className="font-medium">{e.title}</Link>
                <p className="text-xs text-muted-foreground">{new Date(e.starts_at).toLocaleString()} · {e.tags?.join(", ")}</p>
              </li>
            ))}
            {(evQ.data?.events ?? []).length === 0 && <p className="text-sm text-muted-foreground">No events yet.</p>}
          </ul>
          <form onSubmit={onCreateEvent} className="mt-4 space-y-2 rounded-lg border bg-background p-4">
            <h4 className="font-display text-base">New event</h4>
            <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} required />
            <Input placeholder="Category (run club, listening session…)" value={cat} onChange={(e) => setCat(e.target.value)} required />
            <Input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} required />
            <Input placeholder="tags, comma, separated" value={tags} onChange={(e) => setTags(e.target.value)} />
            <Textarea rows={2} placeholder="Short description" value={desc} onChange={(e) => setDesc(e.target.value)} />
            <Button type="submit" size="sm">Create event</Button>
          </form>
        </div>

        <div>
          <h3 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Demand near you</h3>
          {insightsQ.data ? (
            <div className="mt-2 rounded-lg border bg-background p-4">
              <p className="text-xs text-muted-foreground">{insightsQ.data.total} prompts in last 30 days</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {insightsQ.data.top.map((t: any) => (
                  <span key={t.tag} className="rounded-full border px-2 py-0.5 text-xs">
                    {t.tag} <span className="text-muted-foreground">· {t.count}</span>
                  </span>
                ))}
                {insightsQ.data.top.length === 0 && <span className="text-sm text-muted-foreground">Nothing yet.</span>}
              </div>
              {insightsQ.data.samples?.length > 0 && (
                <ul className="mt-4 space-y-1 text-xs text-muted-foreground">
                  {insightsQ.data.samples.map((s: string, i: number) => <li key={i}>"{s}"</li>)}
                </ul>
              )}
            </div>
          ) : <p className="text-sm text-muted-foreground">Loading…</p>}

          <h3 className="mt-6 text-sm font-medium uppercase tracking-wider text-muted-foreground">Leads (RSVPs)</h3>
          <ul className="mt-2 space-y-2 text-sm">
            {(leadsQ.data?.leads ?? []).slice(0, 10).map((l: any) => (
              <li key={l.id} className="flex items-center justify-between rounded-lg border bg-background p-3">
                <div>
                  <div className="font-medium">{l.profiles?.display_name ?? "Anonymous"}</div>
                  <div className="text-xs text-muted-foreground">{l.events?.title} · {l.profiles?.city ?? ""}</div>
                </div>
                <Button size="sm" variant="ghost" onClick={async () => {
                  try {
                    await addCust({ data: { org_id: org.id, name: l.profiles?.display_name ?? "Lead", tags: [] } });
                    qc.invalidateQueries({ queryKey: ["org-customers", org.id] });
                    toast.success("Added to customers");
                  } catch (e) { toast.error((e as Error).message); }
                }}>+ CRM</Button>
              </li>
            ))}
            {(leadsQ.data?.leads ?? []).length === 0 && <p className="text-sm text-muted-foreground">No leads yet.</p>}
          </ul>

          <h3 className="mt-6 text-sm font-medium uppercase tracking-wider text-muted-foreground">Customers</h3>
          <ul className="mt-2 space-y-1 text-sm">
            {(custQ.data?.customers ?? []).map((c: any) => (
              <li key={c.id} className="rounded-lg border bg-background p-2 px-3">
                {c.name} <span className="text-xs text-muted-foreground">{c.email}</span>
              </li>
            ))}
            {(custQ.data?.customers ?? []).length === 0 && <p className="text-sm text-muted-foreground">No customers yet.</p>}
          </ul>
        </div>
      </div>
    </section>
  );
}
