import { Link } from "@tanstack/react-router";

export function BizSubnav({ orgId, orgName }: { orgId: string; orgName?: string }) {
  const tabs = [
    { to: "/biz/events", label: "Events" },
    { to: "/biz/leads", label: "Leads" },
    { to: "/biz/customers", label: "Customers" },
    { to: "/biz/insights", label: "Insights" },
  ] as const;
  return (
    <div className="border-b border-border/60 bg-background/60">
      <div className="mx-auto flex max-w-5xl items-center gap-1 px-6 py-2 overflow-x-auto">
        <Link to="/biz" className="mr-3 text-xs text-muted-foreground hover:text-foreground">
          ← {orgName ?? "Organizations"}
        </Link>
        {tabs.map((t) => (
          <Link
            key={t.to}
            to={t.to}
            search={{ org: orgId }}
            className="rounded-full px-3 py-1 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
            activeProps={{ className: "bg-foreground text-background hover:bg-foreground hover:text-background" }}
          >
            {t.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
