import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listCustomers, listMyOrganizations, upsertCustomer } from "@/lib/orgs.functions";
import { AppHeader } from "@/components/AppHeader";
import { BizSubnav } from "@/components/BizSubnav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

const search = z.object({ org: z.string().uuid() });

export const Route = createFileRoute("/_authenticated/biz/customers")({
  validateSearch: (s) => search.parse(s),
  component: CustomersPage,
});

function CustomersPage() {
  const { org } = Route.useSearch();
  const custFn = useServerFn(listCustomers);
  const addCust = useServerFn(upsertCustomer);
  const listOrgs = useServerFn(listMyOrganizations);
  const qc = useQueryClient();

  const orgsQ = useQuery({ queryKey: ["orgs"], queryFn: () => listOrgs() });
  const orgRow = orgsQ.data?.organizations.find((o: any) => o.id === org);
  const custQ = useQuery({ queryKey: ["org-customers", org], queryFn: () => custFn({ data: { org_id: org } }) });
  const customers = custQ.data?.customers ?? [];

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [tags, setTags] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await addCust({
        data: {
          org_id: org,
          name,
          email: email || null,
          notes: notes || null,
          tags: tags.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean),
        },
      });
      setName(""); setEmail(""); setTags(""); setNotes("");
      qc.invalidateQueries({ queryKey: ["org-customers", org] });
      toast.success(res.created ? "Customer added" : "Existing customer updated (same email)");
    } catch (e) { toast.error((e as Error).message); }
    finally { setSubmitting(false); }
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader variant="organizer" />
      <BizSubnav orgId={org} orgName={orgRow?.name} />
      <main className="mx-auto max-w-5xl px-6 py-10">
        <h1 className="font-display text-3xl">Customers</h1>
        <p className="mt-1 text-sm text-muted-foreground">Your lightweight CRM · {customers.length}</p>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.3fr,1fr]">
          <ul className="space-y-2">
            {custQ.isLoading && <li className="text-sm text-muted-foreground">Loading…</li>}
            {!custQ.isLoading && customers.length === 0 && (
              <li className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">No customers yet. Add one or import from Leads.</li>
            )}
            {customers.map((c: any) => (
              <li key={c.id} className="rounded-xl border bg-card p-4">
                <div className="flex items-baseline justify-between gap-3">
                  <div className="font-medium">{c.name}</div>
                  <span className="text-xs text-muted-foreground">{new Date(c.created_at).toLocaleDateString()}</span>
                </div>
                {c.email && <div className="text-xs text-muted-foreground">{c.email}</div>}
                {c.notes && <p className="mt-1 text-sm text-muted-foreground">{c.notes}</p>}
                {c.tags?.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {c.tags.map((t: string) => <span key={t} className="rounded-full border px-2 py-0.5 text-xs">{t}</span>)}
                  </div>
                )}
              </li>
            ))}
          </ul>

          <form onSubmit={onSubmit} className="h-fit space-y-3 rounded-xl border bg-card p-6">
            <h3 className="font-display text-xl">Add customer</h3>
            <div className="space-y-2"><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} required /></div>
            <div className="space-y-2"><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            <div className="space-y-2"><Label>Tags</Label><Input placeholder="vip, regular, weekend" value={tags} onChange={(e) => setTags(e.target.value)} /></div>
            <div className="space-y-2"><Label>Notes</Label><Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
            <Button type="submit" disabled={submitting}>{submitting ? "Saving…" : "Add"}</Button>
          </form>
        </div>
      </main>
    </div>
  );
}
