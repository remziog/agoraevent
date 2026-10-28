import type { TFunction } from "i18next";
import { Bot, Database, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { GuideExecution, GuidePlan, GuideTraceStep } from "@/lib/guide.types";

function SourceIcon({ source }: { source?: GuideTraceStep["source"] }) {
  if (source === "qloo") {
    return (
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
        Q
      </span>
    );
  }
  if (source === "ai") return <Sparkles className="h-4 w-4 shrink-0 text-primary" aria-hidden />;
  return <Database className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />;
}

/**
 * One plain-language sentence per execution status. The badge, this sentence
 * and the notice above the results all derive from the same `execution`
 * object, so they can no longer contradict each other (F-03).
 */
export function executionSummary(t: TFunction, x: GuideExecution): { badge: string; text: string } {
  const steps = x.agentSteps ?? 0;
  const model = x.agentModel ?? "";
  const agent =
    x.agentOutcome === "plan"
      ? t("guide.exec.agentPlan", {
          model,
          steps,
          defaultValue:
            "A tool-calling agent ({{model}}) chose which tools to call and submitted the plan in {{steps}} step(s). Rankings, restaurants, events and stories come from the tools below, not from the model.",
        })
      : x.agentOutcome === "no_plan"
        ? t("guide.exec.agentNoPlan", {
            model,
            steps,
            defaultValue:
              "The agent ({{model}}) ran {{steps}} step(s) but did not submit a plan, so Agora completed the plan with its fixed steps using the same tools.",
          })
        : x.agentOutcome === "timeout"
          ? t("guide.exec.agentTimeout", {
              model,
              defaultValue:
                "The agent ({{model}}) did not answer in time, so Agora ran its fixed plan with the same tools.",
            })
          : x.agentOutcome === "failed"
            ? t("guide.exec.agentFailed", {
                model,
                defaultValue:
                  "The agent ({{model}}) failed, so Agora ran its fixed plan with the same tools.",
              })
            : t(
                "guide.exec.notConfigured",
                "No AI agent is configured on this server, so Agora ran its fixed plan with the same tools.",
              );
  const ranking =
    x.ranking === "ranked"
      ? t("guide.exec.ranked", "Qloo ranked Agora's landmarks for your favourites.")
      : x.ranking === "empty"
        ? x.rankingCounts && x.rankingCounts.upstream > 0
          ? t("guide.exec.rankingMismatch", {
              upstream: x.rankingCounts.upstream,
              parsed: x.rankingCounts.parsed,
              matched: x.rankingCounts.matched,
              defaultValue:
                "Qloo answered with {{upstream}} item(s) ({{parsed}} readable), but {{matched}} belong to Agora's landmark shortlist — so no personalised ranking.",
            })
          : t(
              "guide.exec.rankingEmpty",
              "Qloo answered with an empty ranking for these favourites — no personalised ranking.",
            )
        : t("guide.exec.rankingFailed", "The Qloo ranking call failed.");
  const badge =
    x.agentOutcome === "plan"
      ? t("guide.exec.badgeAgent", "Agent")
      : x.agentAttempted
        ? t("guide.exec.badgeAgentFallback", "Agent → fixed plan")
        : t("guide.exec.badgeFixed", "Fixed plan");
  return { badge, text: `${agent} ${ranking}` };
}

/** "How Agora decided": every tool call, every Qloo request (parameters shown in full; the key never appears). */
export function GuideTrace({ plan }: { plan: GuidePlan }) {
  const { t } = useTranslation();
  const qlooCalls = plan.trace.reduce((n, s) => n + (s.qloo?.length ?? 0), 0);
  const summary = executionSummary(t, plan.execution);
  return (
    <details className="group rounded-2xl border bg-card/60 p-5">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
        <span>
          <span className="font-display text-xl">{t("guide.howDecided", "How Agora decided")}</span>
          <span className="ml-2 text-sm text-muted-foreground">
            {t("guide.traceCount", {
              steps: plan.trace.length,
              calls: qlooCalls,
              defaultValue: "{{steps}} steps · {{calls}} Qloo request(s)",
            })}
          </span>
        </span>
        <span className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] uppercase tracking-widest text-muted-foreground">
          <Bot className="h-3.5 w-3.5" aria-hidden />
          {summary.badge}
        </span>
      </summary>

      <div className="mt-4 space-y-1 text-sm text-muted-foreground">
        <p>{summary.text}</p>
        <p>
          {t(
            "guide.sentToQloo",
            "Sent to Qloo: your confirmed favourites (as Qloo IDs), place IDs and a neighbourhood name. Never your name, email or location.",
          )}
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
                      {step.source === "qloo"
                        ? "Qloo"
                        : step.source === "ai"
                          ? t("guide.sourceAi", "AI agent")
                          : "Agora"}
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
                        · {c.ms} ms · GET {c.host ? `${c.host}` : ""}
                        {c.endpoint}?
                        {Object.entries(c.params)
                          .map(([k, v]) => `${k}=${v}`)
                          .join("&")}
                        {c.upstreamCount !== undefined || c.resultCount !== undefined
                          ? ` → ${c.upstreamCount ?? c.resultCount} upstream · ${c.resultCount ?? 0} parsed${
                              c.rejectedCount ? ` · ${c.rejectedCount} unreadable` : ""
                            }${c.matchedCount !== undefined ? ` · ${c.matchedCount} in shortlist` : ""}`
                          : ""}
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
