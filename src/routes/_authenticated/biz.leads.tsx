import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { exportLeadsCsv, listLeads, listMyOrganizations, upsertCustomer } from "@/lib/orgs.functions";
import { AppHeader } from "@/components/AppHeader";
import { BizSubnav } from "@/components/BizSubnav";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const search = z.object({ org: z.string().uuid() });

export const Route = createFileRoute("/_authenticated/biz/leads")({
  validateSearch: (s) => search.parse(s),
  component: LeadsPage,
});

function LeadsPage() {
  const { org } = Route.useSearch();
  const leadsFn = useServerFn(listLeads);
  const exportFn = useServerFn(exportLeadsCsv);
  const addCust = useServerFn(upsertCustomer);
  const listOrgs = useServerFn(listMyOrganizations);
  const qc = useQueryClient();

  const orgsQ = useQuery({ queryKey: ["orgs"], queryFn: () => listOrgs() });
  const orgRow = orgsQ.data?.organizations.find((o: any) => o.id === org);
  const leadsQ = useQuery({ queryKey: ["org-leads", org], queryFn: () => leadsFn({ data: { org_id: org } }) });
  const leads = leadsQ.data?.leads ?? [];

  async function onExport() {
    try {
      const res = await exportFn({ data: { org_id: org } });
      const blob = new Blob([res.csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = res.filename; a.click();
      URL.revokeObjectURL(url);
    } catch (e) { toast.error((e as Error).message); }
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader variant="organizer" />
      <BizSubnav orgId={org} orgName={orgRow?.name} />
      <main className="mx-auto max-w-5xl px-6 py-10">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl">Leads</h1>
            <p className="mt-1 text-sm text-muted-foreground">People who RSVP'd to your events · {leads.length}</p>
          </div>
          <Button variant="outline" onClick={onExport} disabled={leads.length === 0}>Export CSV</Button>
        </div>

        <ul className="mt-8 space-y-2">
          {leadsQ.isLoading && <li className="text-sm text-muted-foreground">Loading…</li>}
          {!leadsQ.isLoading && leads.length === 0 && (
            <li className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">No RSVPs yet.</li>
          )}
          {leads.map((l: any) => (
            <li key={l.id} className="flex items-center justify-between gap-4 rounded-xl border bg-card p-4">
              <div className="min-w-0">
                <div className="font-medium">{l.profiles?.display_name ?? "Anonymous"}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {l.events?.title} · {l.profiles?.city ?? "—"} · {new Date(l.created_at).toLocaleDateString()}
                </div>
                {l.profiles?.bio && <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">"{l.profiles.bio}"</div>}
              </div>
              <Button size="sm" variant="ghost" onClick={async () => {
                try {
                  await addCust({ data: { org_id: org, name: l.profiles?.display_name ?? "Lead", tags: [] } });
                  qc.invalidateQueries({ queryKey: ["org-customers", org] });
                  toast.success("Added to customers");
                } catch (e) { toast.error((e as Error).message); }
              }}>+ CRM</Button>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
