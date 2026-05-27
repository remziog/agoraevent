import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { listMyOrganizations } from "@/lib/orgs.functions";
import { getDemandInsightsAdmin, getRecentRequestsAdmin } from "@/lib/insights.functions";
import { AppHeader } from "@/components/AppHeader";
import { BizSubnav } from "@/components/BizSubnav";

const search = z.object({ org: z.string().uuid() });

export const Route = createFileRoute("/_authenticated/biz/insights")({
  validateSearch: (s) => search.parse(s),
  component: InsightsPage,
});

function InsightsPage() {
  const { org } = Route.useSearch();
  const insightsFn = useServerFn(getDemandInsightsAdmin);
  const requestsFn = useServerFn(getRecentRequestsAdmin);
  const listOrgs = useServerFn(listMyOrganizations);

  const orgsQ = useQuery({ queryKey: ["orgs"], queryFn: () => listOrgs() });
  const orgRow = orgsQ.data?.organizations.find((o: any) => o.id === org);
  const q = useQuery({ queryKey: ["org-insights", org], queryFn: () => insightsFn({ data: { org_id: org } }) });
  const reqQ = useQuery({ queryKey: ["org-requests", org], queryFn: () => requestsFn({ data: { org_id: org } }) });

  const max = q.data?.top[0]?.count ?? 1;

  return (
    <div className="min-h-screen bg-background">
      <AppHeader variant="organizer" />
      <BizSubnav orgId={org} orgName={orgRow?.name} />
      <main className="mx-auto max-w-5xl px-6 py-10">
        <h1 className="font-display text-3xl">Demand near you</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {q.data ? `${q.data.total} prompts in ${orgRow?.city ?? "your city"} over the last 30 days` : "Loading…"}
        </p>

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <section className="rounded-xl border bg-card p-6">
            <h2 className="font-display text-xl">Top tags</h2>
            {q.data?.top.length === 0 && <p className="mt-3 text-sm text-muted-foreground">No prompts yet in your city.</p>}
            <ul className="mt-4 space-y-2">
              {q.data?.top.map((t) => (
                <li key={t.tag} className="flex items-center gap-3">
                  <span className="w-32 truncate text-sm">{t.tag}</span>
                  <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-foreground" style={{ width: `${(t.count / max) * 100}%` }} />
                  </div>
                  <span className="w-8 text-right text-xs text-muted-foreground">{t.count}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-xl border bg-card p-6">
            <h2 className="font-display text-xl">What people are saying</h2>
            {(!q.data || q.data.samples.length === 0) && (
              <p className="mt-3 text-sm text-muted-foreground">No recent prompts.</p>
            )}
            <ul className="mt-4 space-y-3 text-sm">
              {q.data?.samples.map((s: string, i: number) => (
                <li key={i} className="border-l-2 border-foreground/20 pl-3 text-muted-foreground">"{s}"</li>
              ))}
            </ul>
          </section>
        </div>

        <section className="mt-8 rounded-xl border bg-card p-6">
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-xl">Recent requests</h2>
            <span className="text-xs text-muted-foreground">
              Anonymous · {reqQ.data?.requests.length ?? 0} latest
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            What people in {orgRow?.city ?? "your city"} typed into the compass. Use these to
            shape your next event.
          </p>
          {reqQ.isLoading && <p className="mt-4 text-sm text-muted-foreground">Loading…</p>}
          {!reqQ.isLoading && (reqQ.data?.requests.length ?? 0) === 0 && (
            <p className="mt-4 rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              No requests yet in your city.
            </p>
          )}
          <ul className="mt-4 space-y-3">
            {reqQ.data?.requests.map((r) => (
              <li key={r.id} className="rounded-lg border bg-background/40 p-4">
                <p className="text-sm text-muted-foreground">Tagged request</p>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span>{new Date(r.created_at).toLocaleString()}</span>
                  {r.city && <span>· {r.city}</span>}
                  {r.tags.slice(0, 6).map((t) => (
                    <span key={t} className="rounded-full border px-2 py-0.5">
                      {t}
                    </span>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}
