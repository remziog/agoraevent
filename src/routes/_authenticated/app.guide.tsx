import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ArrowRight, BookOpen, Check, CircleAlert, Film, Music } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { CompassLoader } from "@/components/CompassLoader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GuideResults } from "@/components/guide/GuideResults";
import { entityTypeLabel, QLOO_ERROR_TEXT } from "@/components/guide/guide-format";
import { planVisit } from "@/lib/guide.functions";
import type { GuidePlan, TasteCandidate, TasteEntity } from "@/lib/guide.types";
import { resolveTaste } from "@/lib/qloo.functions";

export const Route = createFileRoute("/_authenticated/app/guide")({
  head: () => ({
    meta: [
      { title: "Your Istanbul, by taste — Agora" },
      {
        name: "description",
        content:
          "Tell Agora three things you love. Qloo's taste graph ranks Istanbul's landmarks for you; Agora tells each place's story.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: GuidePage,
});

const FIELDS = [
  { key: "music", label: "A musician or band", placeholder: "e.g. Nick Cave", icon: Music },
  { key: "film", label: "A film or series", placeholder: "e.g. Amélie", icon: Film },
  { key: "book", label: "A book or author", placeholder: "e.g. Agatha Christie", icon: BookOpen },
] as const;

type FieldKey = (typeof FIELDS)[number]["key"];

const EXAMPLE: Record<FieldKey, string> = {
  music: "Nick Cave",
  film: "Amélie",
  book: "Agatha Christie",
};

const LOADING_LINES = [
  "Asking Qloo's taste graph…",
  "Ranking Istanbul's landmarks for you…",
  "Choosing where each story should begin…",
  "Looking for a table nearby…",
];

const STORAGE_KEY = "agora:guide:v1";

type Saved = { plan: GuidePlan };

function loadSaved(): Saved | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Saved) : null;
  } catch {
    return null;
  }
}

function GuidePage() {
  const resolve = useServerFn(resolveTaste);
  const plan = useServerFn(planVisit);

  const [values, setValues] = useState<Record<FieldKey, string>>({ music: "", film: "", book: "" });
  const [mood, setMood] = useState("");
  const [candidates, setCandidates] = useState<TasteCandidate[] | null>(null);
  const [choice, setChoice] = useState<Record<string, string | null>>({});
  const [result, setResult] = useState<GuidePlan | null>(null);
  const [loadingLine, setLoadingLine] = useState(0);

  useEffect(() => {
    const saved = loadSaved();
    if (saved?.plan) setResult(saved.plan);
  }, []);

  const resolveMutation = useMutation({
    mutationFn: (terms: string[]) => resolve({ data: { terms } }),
    onSuccess: (res) => {
      if (!res.ok) return;
      setCandidates(res.data);
      const initial: Record<string, string | null> = {};
      for (const c of res.data) initial[c.term] = c.matches[0]?.entityId ?? null;
      setChoice(initial);
    },
  });

  const planMutation = useMutation({
    mutationFn: (input: { taste: TasteEntity[]; mood?: string }) => plan({ data: input }),
    onSuccess: (res) => {
      if (!res.ok) return;
      setResult(res.plan);
      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ plan: res.plan } satisfies Saved));
      } catch {
        /* storage unavailable: results just won't survive a reload */
      }
      window.scrollTo({ top: 0 });
    },
  });

  useEffect(() => {
    if (!planMutation.isPending) return;
    setLoadingLine(0);
    const id = window.setInterval(
      () => setLoadingLine((n) => (n + 1) % LOADING_LINES.length),
      2800,
    );
    return () => window.clearInterval(id);
  }, [planMutation.isPending]);

  function submitTaste(e: React.FormEvent) {
    e.preventDefault();
    const terms = FIELDS.map((f) => values[f.key].trim()).filter(Boolean);
    if (terms.length === 0) return;
    resolveMutation.mutate(terms);
  }

  function confirmTaste() {
    if (!candidates) return;
    const taste: TasteEntity[] = [];
    for (const c of candidates) {
      const id = choice[c.term];
      const match = c.matches.find((m) => m.entityId === id);
      if (match) taste.push({ entityId: match.entityId, name: match.name, type: match.types[0] });
    }
    if (taste.length === 0) return;
    planMutation.mutate({ taste, mood: mood.trim() || undefined });
  }

  function restart() {
    setResult(null);
    setCandidates(null);
    setChoice({});
    planMutation.reset();
    resolveMutation.reset();
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    window.scrollTo({ top: 0 });
  }

  const resolveError =
    resolveMutation.data && !resolveMutation.data.ok ? resolveMutation.data.error : null;
  const planError = planMutation.data && !planMutation.data.ok ? planMutation.data.error : null;
  const transportError = (resolveMutation.error ?? planMutation.error) as Error | null;
  const confirmedCount = candidates ? candidates.filter((c) => choice[c.term]).length : 0;

  return (
    <div className="min-h-screen bg-background">
      <AppHeader variant="member" />
      {planMutation.isPending && <CompassLoader message={LOADING_LINES[loadingLine]} />}

      <main className="mx-auto max-w-5xl px-6 py-10">
        {result ? (
          <GuideResults plan={result} onRestart={restart} />
        ) : !candidates ? (
          <section className="mx-auto max-w-2xl">
            <p className="text-xs uppercase tracking-[0.3em] text-primary">
              Taste guide · powered by Qloo
            </p>
            <h1 className="mt-3 font-display text-4xl leading-tight sm:text-5xl">
              Your Istanbul, by taste.
            </h1>
            <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
              Tell Agora three things you love. Qloo's taste graph ranks the city's landmarks for
              you, Agora tells each place's story — history and legend kept apart — and finds a
              table and a gathering nearby.
            </p>

            <form onSubmit={submitTaste} className="mt-8 space-y-5">
              {FIELDS.map((f) => (
                <label key={f.key} className="block">
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <f.icon className="h-4 w-4 text-primary" />
                    {f.label}
                  </span>
                  <Input
                    value={values[f.key]}
                    onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    maxLength={80}
                    className="mt-1.5 h-12 rounded-xl text-base"
                  />
                </label>
              ))}
              <label className="block">
                <span className="text-sm font-medium">
                  Your mood today{" "}
                  <span className="font-normal text-muted-foreground">(optional)</span>
                </span>
                <Input
                  value={mood}
                  onChange={(e) => setMood(e.target.value)}
                  placeholder="e.g. slow and quiet, good coffee"
                  maxLength={160}
                  className="mt-1.5 h-12 rounded-xl text-base"
                />
              </label>

              {(resolveError || transportError) && (
                <p className="flex items-center gap-2 text-sm text-destructive">
                  <CircleAlert className="h-4 w-4" />
                  {resolveError
                    ? QLOO_ERROR_TEXT[resolveError]
                    : "Something went wrong. Please try again."}
                </p>
              )}

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Button
                  type="submit"
                  size="lg"
                  className="gap-2 rounded-full"
                  disabled={resolveMutation.isPending || FIELDS.every((f) => !values[f.key].trim())}
                >
                  {resolveMutation.isPending ? "Asking Qloo…" : "Find my Istanbul"}
                  <ArrowRight className="h-4 w-4" />
                </Button>
                <button
                  type="button"
                  className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                  onClick={() => setValues(EXAMPLE)}
                >
                  Use an example
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                Only these words go to Qloo — never your name, email or location.
              </p>
            </form>
          </section>
        ) : (
          <section className="mx-auto max-w-3xl">
            <p className="text-xs uppercase tracking-[0.3em] text-primary">
              Step 2 of 2 · confirm with Qloo
            </p>
            <h1 className="mt-3 font-display text-4xl leading-tight">Is this who you mean?</h1>
            <p className="mt-3 text-muted-foreground">
              Qloo found these in its taste graph. Pick the right one — Agora only uses what you
              confirm.
            </p>

            <div className="mt-8 space-y-8">
              {candidates.map((c) => (
                <fieldset key={c.term}>
                  <legend className="font-display text-xl">“{c.term}”</legend>
                  {c.matches.length === 0 ? (
                    <p className="mt-2 text-sm text-muted-foreground">
                      Qloo found nothing for this one; it will be skipped.
                    </p>
                  ) : (
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {c.matches.slice(0, 4).map((m) => {
                        const selected = choice[c.term] === m.entityId;
                        return (
                          <button
                            key={m.entityId}
                            type="button"
                            onClick={() => setChoice((s) => ({ ...s, [c.term]: m.entityId }))}
                            className={`flex items-center gap-3 rounded-2xl border p-3 text-left transition ${
                              selected ? "border-primary bg-primary/5" : "hover:border-primary/40"
                            }`}
                          >
                            {m.imageUrl ? (
                              <img
                                src={m.imageUrl}
                                alt=""
                                className="h-12 w-12 shrink-0 rounded-xl object-cover"
                                loading="lazy"
                              />
                            ) : (
                              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-muted font-display text-lg">
                                {m.name.charAt(0)}
                              </span>
                            )}
                            <span className="min-w-0 flex-1">
                              <span className="block truncate font-medium">{m.name}</span>
                              <span className="block truncate text-xs text-muted-foreground">
                                {[entityTypeLabel(m.types), m.disambiguation]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </span>
                            </span>
                            {selected && <Check className="h-4 w-4 shrink-0 text-primary" />}
                          </button>
                        );
                      })}
                      <button
                        type="button"
                        onClick={() => setChoice((s) => ({ ...s, [c.term]: null }))}
                        className={`rounded-2xl border border-dashed p-3 text-left text-sm transition ${
                          choice[c.term] === null
                            ? "border-primary text-foreground"
                            : "text-muted-foreground hover:border-primary/40"
                        }`}
                      >
                        None of these — skip
                      </button>
                    </div>
                  )}
                </fieldset>
              ))}
            </div>

            {(planError || transportError) && (
              <p className="mt-6 flex items-center gap-2 text-sm text-destructive">
                <CircleAlert className="h-4 w-4" />
                {planError ? QLOO_ERROR_TEXT[planError] : "Something went wrong. Please try again."}
              </p>
            )}

            <div className="mt-10 flex flex-wrap items-center gap-3">
              <Button
                size="lg"
                className="gap-2 rounded-full"
                disabled={confirmedCount === 0 || planMutation.isPending}
                onClick={confirmTaste}
              >
                Plan my visit <ArrowRight className="h-4 w-4" />
              </Button>
              <Button variant="ghost" onClick={() => setCandidates(null)}>
                Back
              </Button>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
