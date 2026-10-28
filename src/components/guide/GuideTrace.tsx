import { Bot, Database, Sparkles } from "lucide-react";
import type { GuidePlan, GuideTraceStep } from "@/lib/guide.types";

function SourceIcon({ source }: { source?: GuideTraceStep["source"] }) {
  if (source === "qloo") {
    return (
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
        Q
      </span>
    );
  }
  if (source === "ai") return <Sparkles className="h-4 w-4 shrink-0 text-primary" />;
  return <Database className="h-4 w-4 shrink-0 text-muted-foreground" />;
}

const SOURCE_LABEL: Record<NonNullable<GuideTraceStep["source"]>, string> = {
  qloo: "Qloo",
  agora: "Agora",
  ai: "AI agent",
};

/** "How Agora decided": every tool call, every Qloo request (parameters redacted of nothing but the key, which never appears). */
export function GuideTrace({ plan }: { plan: GuidePlan }) {
  const qlooCalls = plan.trace.reduce((n, s) => n + (s.qloo?.length ?? 0), 0);
  return (
    <details className="group rounded-2xl border bg-card/60 p-5">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
        <span>
          <span className="font-display text-xl">How Agora decided</span>
          <span className="ml-2 text-sm text-muted-foreground">
            {plan.trace.length} steps · {qlooCalls} Qloo request{qlooCalls === 1 ? "" : "s"}
          </span>
        </span>
        <span className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] uppercase tracking-widest text-muted-foreground">
          <Bot className="h-3.5 w-3.5" />
          {plan.mode === "agent" ? "Agent" : "Fixed plan"}
        </span>
      </summary>

      <div className="mt-4 space-y-1 text-sm text-muted-foreground">
        {plan.mode === "agent" ? (
          <p>
            A tool-calling agent ({plan.model}) chose which tools to call and wrote the short notes.
            Rankings, restaurants, events and stories come from the tools below, not from the model.
          </p>
        ) : (
          <p>The agent wasn't available, so Agora ran its fixed plan with the same tools.</p>
        )}
        <p>
          Sent to Qloo: your confirmed favourites (as Qloo IDs), place IDs and a neighbourhood name.
          Never your name, email or location.
        </p>
      </div>

      <ol className="mt-4 space-y-3">
        {plan.trace.map((step, i) => (
          <li key={i} className="rounded-xl border bg-background/60 p-3">
            <div className="flex items-start gap-2.5">
              <SourceIcon source={step.source} />
              <div className="min-w-0 flex-1">
                <p className="text-sm">
                  <span className="font-mono text-xs text-muted-foreground">{step.name}</span>
                  {step.source && (
                    <span className="ml-2 text-[10px] uppercase tracking-widest text-muted-foreground">
                      {SOURCE_LABEL[step.source]}
                    </span>
                  )}
                </p>
                <p className="mt-0.5 text-sm text-foreground/90">{step.label}</p>
                {step.ms !== undefined && (
                  <p className="text-xs text-muted-foreground">{step.ms} ms</p>
                )}
                {step.qloo && step.qloo.length > 0 && (
                  <ul className="mt-2 space-y-1 font-mono text-[11px] leading-snug text-muted-foreground">
                    {step.qloo.map((c, j) => (
                      <li key={j} className="break-all">
                        <span
                          className={
                            c.status >= 200 && c.status < 300 ? "text-primary" : "text-destructive"
                          }
                        >
                          {c.status || "—"}
                        </span>{" "}
                        · {c.ms} ms · GET {c.endpoint}?
                        {Object.entries(c.params)
                          .map(([k, v]) => `${k}=${v}`)
                          .join("&")}
                        {c.resultCount !== undefined ? ` → ${c.resultCount} result(s)` : ""}
                        {c.error ? ` (${c.error})` : ""}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </details>
  );
}
