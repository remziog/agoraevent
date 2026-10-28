import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { CheckCircle2, CircleAlert, Loader2, Search, UtensilsCrossed } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  debugRank,
  getQlooStatus,
  probeDistrictRestaurants,
  resolveLandmarkMap,
} from "@/lib/qloo.functions";
import type { LandmarkStatusRow, QlooErrorCode } from "@/lib/guide.types";
import { ISTANBUL_LANDMARKS } from "@/lib/istanbul-landmarks";
import type { QlooCall } from "@/lib/qloo.schemas";

export const Route = createFileRoute("/_authenticated/app/qloo-status")({
  head: () => ({
    meta: [{ title: "Qloo status — Agora" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: QlooStatusPage,
});

const ERROR_TEXT: Record<QlooErrorCode, string> = {
  qloo_not_configured: "QLOO_API_KEY is not set on the server.",
  qloo_auth: "Qloo rejected the credential (401/403) on this host.",
  qloo_rate_limited: "Qloo rate limit or quota reached (429).",
  qloo_unavailable: "Qloo did not answer successfully.",
};

const DISTRICTS = Array.from(new Set(ISTANBUL_LANDMARKS.map((l) => l.district)));

function QlooStatusPage() {
  const queryClient = useQueryClient();
  const fetchStatus = useServerFn(getQlooStatus);
  const resolveMap = useServerFn(resolveLandmarkMap);
  const rank = useServerFn(debugRank);
  const probe = useServerFn(probeDistrictRestaurants);

  const status = useQuery({
    queryKey: ["qloo-status"],
    queryFn: () => fetchStatus(),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  const mapMutation = useMutation({
    mutationFn: () => resolveMap(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["qloo-status"] }),
  });

  const [term, setTerm] = useState("Agatha Christie");
  const rankMutation = useMutation({ mutationFn: (t: string) => rank({ data: { term: t } }) });
  const [district, setDistrict] = useState<string | null>(null);
  const probeMutation = useMutation({
    mutationFn: (d: string) => probe({ data: { district: d } }),
  });

  const s = status.data;
  const landmarks = mapMutation.data?.ok ? mapMutation.data.data : (s?.landmarks ?? []);
  const mapped = landmarks.filter((l) => l.entityId).length;

  return (
    <div className="min-h-screen bg-background">
      <AppHeader variant="member" />
      <main className="mx-auto max-w-4xl space-y-10 px-6 py-8">
        <header>
          <p className="text-xs uppercase tracking-[0.3em] text-primary">Diagnostics</p>
          <h1 className="mt-2 font-display text-3xl">Qloo connection</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Live checks against the Qloo API from Agora's server. The key never leaves the server;
            calls below are shown with their parameters, status and timing.{" "}
            <Link to="/app" className="text-primary underline-offset-4 hover:underline">
              Back to Agora
            </Link>
          </p>
        </header>

        <section className="rounded-2xl border bg-card p-5">
          <h2 className="font-display text-xl">1 · Credential and first call</h2>
          {status.isLoading && <Spinner label="Checking…" />}
          {status.error && <ErrorLine text={(status.error as Error).message} />}
          {s && (
            <div className="mt-3 space-y-2 text-sm">
              <Line
                ok={s.configured}
                label={
                  s.configured ? "QLOO_API_KEY is set on the server" : "QLOO_API_KEY is missing"
                }
              />
              <p className="text-muted-foreground">Host: {s.host}</p>
              {s.probe?.ok === true && (
                <Line
                  ok
                  label={`/search answered: ${s.probe.resultCount} place(s) — ${s.probe.top.join(" · ") || "none"}`}
                />
              )}
              {s.probe?.ok === false && <Line ok={false} label={ERROR_TEXT[s.probe.error]} />}
              <Calls calls={s.calls} />
            </div>
          )}
        </section>

        <section className="rounded-2xl border bg-card p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="font-display text-xl">2 · Landmarks in Qloo's graph</h2>
            <Button
              size="sm"
              onClick={() => mapMutation.mutate()}
              disabled={mapMutation.isPending || !s?.configured}
            >
              {mapMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Look up unmapped landmarks"
              )}
            </Button>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {mapped}/{landmarks.length} matched. A match needs the right name and a Qloo location in
            Istanbul; the rest are shown in Agora without a Qloo badge. Results are cached in the
            database.
          </p>
          {mapMutation.data && !mapMutation.data.ok && (
            <ErrorLine text={ERROR_TEXT[mapMutation.data.error]} />
          )}
          {mapMutation.data && <Calls calls={mapMutation.data.calls} />}
          <ul className="mt-4 divide-y">
            {landmarks.map((l) => (
              <LandmarkRow key={l.landmarkId} row={l} />
            ))}
          </ul>
        </section>

        <section className="rounded-2xl border bg-card p-5">
          <h2 className="font-display text-xl">3 · Rank the landmarks for one taste</h2>
          <form
            className="mt-3 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (term.trim()) rankMutation.mutate(term.trim());
            }}
          >
            <Input
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="An artist, film or book"
            />
            <Button type="submit" disabled={rankMutation.isPending || !s?.configured}>
              {rankMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
            </Button>
          </form>
          {rankMutation.data && !rankMutation.data.ok && (
            <ErrorLine text={ERROR_TEXT[rankMutation.data.error]} />
          )}
          {rankMutation.data?.ok && (
            <div className="mt-4 space-y-3 text-sm">
              <p>
                Taste entity: <strong>{rankMutation.data.data.taste?.name ?? "no match"}</strong>{" "}
                <span className="text-muted-foreground">
                  {rankMutation.data.data.taste?.types.join(", ")}
                </span>
              </p>
              <ol className="space-y-2">
                {rankMutation.data.data.picks.map((p, i) => (
                  <li key={p.landmarkId} className="rounded-xl border p-3">
                    <p>
                      {i + 1}. {ISTANBUL_LANDMARKS.find((l) => l.id === p.landmarkId)?.title} —
                      affinity {p.affinity?.toFixed(3) ?? "n/a"}
                    </p>
                    {p.explainability !== undefined && (
                      <pre className="mt-2 max-h-48 overflow-auto rounded bg-muted p-2 text-[11px] leading-snug">
                        {JSON.stringify(p.explainability, null, 2)}
                      </pre>
                    )}
                  </li>
                ))}
              </ol>
              <Calls calls={rankMutation.data.calls} />
            </div>
          )}
        </section>

        <section className="rounded-2xl border bg-card p-5">
          <h2 className="font-display text-xl">4 · Restaurants Qloo knows per district</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {DISTRICTS.map((d) => (
              <Button
                key={d}
                size="sm"
                variant={district === d ? "default" : "outline"}
                disabled={probeMutation.isPending || !s?.configured}
                onClick={() => {
                  setDistrict(d);
                  probeMutation.mutate(d);
                }}
              >
                {d}
              </Button>
            ))}
          </div>
          {probeMutation.isPending && <Spinner label={`Asking Qloo about ${district}…`} />}
          {probeMutation.data && !probeMutation.data.ok && (
            <ErrorLine text={ERROR_TEXT[probeMutation.data.error]} />
          )}
          {probeMutation.data?.ok && (
            <div className="mt-4 text-sm">
              <p className="text-muted-foreground">
                Tag filter: {probeMutation.data.data.restaurantTagIds.join(", ") || "none"} ·{" "}
                {probeMutation.data.data.restaurants.length} result(s)
              </p>
              <ul className="mt-2 space-y-1">
                {probeMutation.data.data.restaurants.map((r) => (
                  <li key={r.qlooEntityId} className="flex items-start gap-2">
                    <UtensilsCrossed className="mt-0.5 h-3.5 w-3.5 text-primary" />
                    <span>
                      {r.name}
                      <span className="text-muted-foreground">
                        {r.address ? ` · ${r.address}` : ""}
                        {r.priceLevel ? ` · ${"$".repeat(r.priceLevel)}` : ""}
                        {r.rating ? ` · ★ ${r.rating}` : ""}
                        {r.cuisineTags.length > 0 ? ` · ${r.cuisineTags.join(", ")}` : ""}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
              <Calls calls={probeMutation.data.calls} />
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function LandmarkRow({ row }: { row: LandmarkStatusRow }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="py-3 text-sm">
      <button
        type="button"
        className="flex w-full items-start justify-between gap-3 text-left"
        onClick={() => setOpen((v) => !v)}
      >
        <span>
          <span className="font-medium">{row.title}</span>
          <span className="text-muted-foreground"> · {row.district}</span>
          <br />
          <span className="text-muted-foreground">
            {row.entityName
              ? `Qloo: ${row.entityName}${row.entityAddress ? ` — ${row.entityAddress}` : ""}`
              : row.note}
          </span>
        </span>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] uppercase tracking-widest ${
            row.confidence === "none"
              ? "bg-muted text-muted-foreground"
              : "bg-primary/15 text-primary"
          }`}
        >
          {row.confidence}
        </span>
      </button>
      {open && row.candidates.length > 0 && (
        <ul className="mt-2 space-y-1 rounded-xl bg-muted/50 p-3 text-xs">
          {row.candidates.map((c) => (
            <li key={c.entityId}>
              {c.name} — name {c.nameMatch}, {c.inIstanbul ? "in Istanbul" : "not in Istanbul"}
              {c.location ? ` · ${c.location}` : ""}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

function Calls({ calls }: { calls: QlooCall[] }) {
  if (calls.length === 0) return null;
  return (
    <details className="mt-3 text-xs">
      <summary className="cursor-pointer text-muted-foreground">
        {calls.length} Qloo call(s)
      </summary>
      <ul className="mt-2 space-y-1 font-mono">
        {calls.map((c, i) => (
          <li key={i} className="break-all">
            {c.status || "—"} · {c.ms} ms · GET {c.endpoint}?
            {Object.entries(c.params)
              .map(([k, v]) => `${k}=${v}`)
              .join("&")}
            {c.resultCount !== undefined ? ` → ${c.resultCount}` : ""}
            {c.error ? ` (${c.error})` : ""}
          </li>
        ))}
      </ul>
    </details>
  );
}

function Line({ ok, label }: { ok: boolean; label: string }) {
  return (
    <p className="flex items-center gap-2">
      {ok ? (
        <CheckCircle2 className="h-4 w-4 text-primary" />
      ) : (
        <CircleAlert className="h-4 w-4 text-destructive" />
      )}
      {label}
    </p>
  );
}

function ErrorLine({ text }: { text: string }) {
  return (
    <p className="mt-3 flex items-center gap-2 text-sm text-destructive">
      <CircleAlert className="h-4 w-4" /> {text}
    </p>
  );
}

function Spinner({ label }: { label: string }) {
  return (
    <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" /> {label}
    </p>
  );
}
