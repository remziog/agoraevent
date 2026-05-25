import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createOrganization, listMyOrganizations } from "@/lib/orgs.functions";
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
        <p className="mt-2 text-muted-foreground">Each organization runs its own events, leads, and customers.</p>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.4fr,1fr]">
          <div className="space-y-3">
            {q.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
            {!q.isLoading && orgs.length === 0 && (
              <p className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
                No organizations yet. Create your first one →
              </p>
            )}
            {orgs.map((o: any) => (
              <div key={o.id} className="rounded-xl border bg-card p-5">
                <div className="flex items-baseline justify-between">
                  <h3 className="font-display text-xl">{o.name}</h3>
                  <span className="text-xs text-muted-foreground">{o.city}</span>
                </div>
                <p className="text-sm text-muted-foreground">{o.category}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link to="/biz/events" search={{ org: o.id }}><Button size="sm" variant="outline">Events</Button></Link>
                  <Link to="/biz/leads" search={{ org: o.id }}><Button size="sm" variant="outline">Leads</Button></Link>
                  <Link to="/biz/customers" search={{ org: o.id }}><Button size="sm" variant="outline">Customers</Button></Link>
                  <Link to="/biz/insights" search={{ org: o.id }}><Button size="sm" variant="outline">Insights</Button></Link>
                </div>
              </div>
            ))}
          </div>
          <form onSubmit={onCreate} className="h-fit space-y-3 rounded-xl border bg-card p-6">
            <h3 className="font-display text-xl">New organization</h3>
            <div className="space-y-2"><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} required /></div>
            <div className="space-y-2"><Label>Category</Label><Input placeholder="coffee shop, gym, club…" value={category} onChange={(e) => setCategory(e.target.value)} required /></div>
            <div className="space-y-2"><Label>City</Label><Input value={city} onChange={(e) => setCity(e.target.value)} required /></div>
            <div className="space-y-2"><Label>Description</Label><Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} /></div>
            <Button type="submit" disabled={creating}>{creating ? "Creating…" : "Create"}</Button>
          </form>
        </div>
      </main>
    </div>
  );
}
