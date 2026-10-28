import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowRight, BookOpen, Check, CircleAlert, Film, Music } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { CompassLoader } from "@/components/CompassLoader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GuideResults } from "@/components/guide/GuideResults";
import { entityTypeLabel, qlooErrorText } from "@/components/guide/guide-format";
import { planVisit } from "@/lib/guide.functions";
import type { GuidePlan, TasteCandidate, TasteEntity, TasteField } from "@/lib/guide.types";
import type { QlooEntity } from "@/lib/qloo.schemas";
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

const FIELDS: { key: TasteField; icon: typeof Music }[] = [
  { key: "music", icon: Music },
  { key: "film", icon: Film },
  { key: "book", icon: BookOpen },
];

const EXAMPLE: Record<TasteField, string> = {
  music: "Nick Cave",
  film: "Amélie",
  book: "Agatha Christie",
};

const STORAGE_KEY = "agora:guide:v2";

type Saved = { plan: GuidePlan };

function loadSaved(): Saved | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    const saved = raw ? (JSON.parse(raw) as Saved) : null;
    // Plans saved by an older build lack the execution status; start fresh.
    return saved?.plan?.execution ? saved : null;
  } catch {
    return null;
  }
}

function GuidePage() {
  const { t } = useTranslation();
  const resolve = useServerFn(resolveTaste);
  const plan = useServerFn(planVisit);

  const [values, setValues] = useState<Record<TasteField, string>>({ music: "", film: "", book: "" });
  const [mood, setMood] = useState("");
  const [candidates, setCandidates] = useState<TasteCandidate[] | null>(null);
  /** term → chosen entity id, null = skipped */
  const [choice, setChoice] = useState<Record<string, string | null>>({});
  const [result, setResult] = useState<GuidePlan | null>(null);
  const [loadingLine, setLoadingLine] = useState(0);

  const loadingLines = [
    t("guide.loading1", "Asking Qloo's taste graph…"),
    t("guide.loading2", "Ranking Istanbul's landmarks for you…"),
    t("guide.loading3", "Choosing where each story should begin…"),
    t("guide.loading4", "Looking for a table nearby…"),
  ];

  useEffect(() => {
    const saved = loadSaved();
    if (saved?.plan) setResult(saved.plan);
  }, []);

  const resolveMutation = useMutation({
    mutationFn: (terms: { term: string; field: TasteField }[]) => resolve({ data: { terms } }),
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
    const id = window.setInterval(() => setLoadingLine((n) => (n + 1) % 4), 2800);
    return () => window.clearInterval(id);
  }, [planMutation.isPending]);

  function submitTaste(e: React.FormEvent) {
    e.preventDefault();
    const terms = FIELDS.map((f) => ({ term: values[f.key].trim(), field: f.key })).filter(
      (x) => x.term,
    );
    if (terms.length === 0) return;
    resolveMutation.mutate(terms);
  }

  function confirmTaste() {
    if (!candidates) return;
    const taste: TasteEntity[] = [];
    for (const c of candidates) {
      const id = choice[c.term];
      const match = [...c.matches, ...c.others].find((m) => m.entityId === id);
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
  const filledCount = FIELDS.filter((f) => values[f.key].trim()).length;
  const anyMatches = candidates?.some((c) => c.matches.length + c.others.length > 0) ?? false;

  return (
    <div className="min-h-screen bg-background">
      <AppHeader variant="member" />
      {planMutation.isPending && <CompassLoader message={loadingLines[loadingLine]} />}

      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        {result ? (
          <GuideResults plan={result} onRestart={restart} />
        ) : !candidates ? (
          <section className="mx-auto max-w-2xl">
            <p className="text-xs uppercase tracking-[0.3em] text-primary">
              {t("guide.kicker", "Taste guide · powered by Qloo")}
            </p>
            <h1 className="mt-3 font-display text-4xl leading-tight sm:text-5xl">
              {t("guide.title", "Your Istanbul, by taste.")}
            </h1>
            <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
              {t(
                "guide.intro",
                "Add one to three things you love. Qloo's taste graph ranks the city's landmarks for you, Agora tells each place's story — history and legend kept apart — and finds a table and a gathering nearby.",
              )}
            </p>

            <form onSubmit={submitTaste} className="mt-8 space-y-5" aria-describedby="guide-rule">
              {FIELDS.map((f) => (
                <label key={f.key} className="block">
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <f.icon className="h-4 w-4 text-primary" aria-hidden />
                    {t(`guide.field.${f.key}`)}
                  </span>
                  <Input
                    value={values[f.key]}
                    onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                    placeholder={t(`guide.placeholder.${f.key}`, { name: EXAMPLE[f.key] })}
                    maxLength={80}
                    autoComplete="off"
                    className="mt-1.5 h-12 rounded-xl text-base"
                  />
                </label>
              ))}
              <label className="block">
                <span className="text-sm font-medium">
                  {t("guide.mood", "Your mood today")}{" "}
                  <span className="font-normal text-muted-foreground">
                    ({t("guide.optional", "optional")})
                  </span>
                </span>
                <Input
                  value={mood}
                  onChange={(e) => setMood(e.target.value)}
                  placeholder={t("guide.moodPlaceholder", "e.g. slow and quiet, good coffee")}
                  maxLength={160}
                  className="mt-1.5 h-12 rounded-xl text-base"
                />
              </label>
              <p id="guide-rule" className="text-xs text-muted-foreground">
                {t("guide.rule", {
                  count: filledCount,
                  defaultValue:
                    "One favourite is enough; three give Qloo more to work with. Only these words go to Qloo — never your name, email or location.",
                })}
              </p>

              {(resolveError || transportError) && (
                <p className="flex items-center gap-2 text-sm text-destructive" role="alert">
                  <CircleAlert className="h-4 w-4" aria-hidden />
                  {resolveError
                    ? qlooErrorText(t, resolveError)
                    : t("guide.genericError", "Something went wrong. Please try again.")}
                </p>
              )}

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Button
                  type="submit"
                  size="lg"
                  className="gap-2 rounded-full"
                  disabled={resolveMutation.isPending || filledCount === 0}
                >
                  {resolveMutation.isPending
                    ? t("guide.asking", "Asking Qloo…")
                    : t("guide.find", "Find my Istanbul")}
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Button>
                <button
                  type="button"
                  className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                  onClick={() => setValues(EXAMPLE)}
                >
                  {t("guide.useExample", "Use an example")}
                </button>
              </div>
            </form>
          </section>
        ) : (
          <section className="mx-auto max-w-3xl">
            <p className="text-xs uppercase tracking-[0.3em] text-primary">
              {t("guide.step2", "Step 2 of 2 · confirm with Qloo")}
            </p>
            {anyMatches ? (
              <>
                <h1 className="mt-3 font-display text-4xl leading-tight">
                  {t("guide.confirmTitle", "Is this who you mean?")}
                </h1>
                <p className="mt-3 text-muted-foreground">
                  {t(
                    "guide.confirmIntro",
                    "Qloo found these in its taste graph. Pick the right one — Agora only uses what you confirm.",
                  )}
                </p>
              </>
            ) : (
              <>
                <h1 className="mt-3 font-display text-4xl leading-tight">
                  {t("guide.noMatchTitle", "We couldn't match these.")}
                </h1>
                <p className="mt-3 text-muted-foreground">
                  {t(
                    "guide.noMatchIntro",
                    "Qloo's taste graph found nothing for these names. Check the spelling, try a better-known artist, film or author, or use the example.",
                  )}
                </p>
              </>
            )}

            <div className="mt-8 space-y-8">
              {candidates.map((c) => (
                <CandidateGroup
                  key={c.term}
                  candidate={c}
                  value={choice[c.term] ?? null}
                  onChange={(id) => setChoice((s) => ({ ...s, [c.term]: id }))}
                />
              ))}
            </div>

            {(planError || transportError) && (
              <p className="mt-6 flex items-center gap-2 text-sm text-destructive" role="alert">
                <CircleAlert className="h-4 w-4" aria-hidden />
                {planError
                  ? qlooErrorText(t, planError)
                  : t("guide.genericError", "Something went wrong. Please try again.")}
              </p>
            )}

            {anyMatches && confirmedCount === 0 && (
              <p className="mt-6 text-sm text-muted-foreground" role="status">
                {t(
                  "guide.nothingConfirmed",
                  "Pick at least one favourite to continue — everything is skipped right now.",
                )}
              </p>
            )}

            <div className="mt-10 flex flex-wrap items-center gap-3">
              <Button
                size="lg"
                className="gap-2 rounded-full"
                disabled={confirmedCount === 0 || planMutation.isPending}
                onClick={confirmTaste}
              >
                {t("guide.plan", "Plan my visit")} <ArrowRight className="h-4 w-4" aria-hidden />
              </Button>
              <Button variant="ghost" onClick={() => setCandidates(null)}>
                {anyMatches ? t("common.back", "Back") : t("guide.editFavourites", "Edit favourites")}
              </Button>
              {!anyMatches && (
                <button
                  type="button"
                  className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                  onClick={() => {
                    setValues(EXAMPLE);
                    setCandidates(null);
                  }}
                >
                  {t("guide.useExample", "Use an example")}
                </button>
              )}
            </div>
            {!anyMatches && (
              <p className="mt-6 text-sm text-muted-foreground">
                <Link to="/app" className="text-primary underline-offset-4 hover:underline">
                  {t("guide.exploreInstead", "Or explore this week's gatherings instead →")}
                </Link>
              </p>
            )}
          </section>
        )}
      </main>
    </div>
  );
}

/**
 * One term's candidates as a native radio group: the group is labelled by the
 * term, every option (including "skip") is a real radio input, so screen
 * readers announce the selected state and arrow keys move the selection.
 */
function CandidateGroup({
  candidate,
  value,
  onChange,
}: {
  candidate: TasteCandidate;
  value: string | null;
  onChange: (id: string | null) => void;
}) {
  const { t } = useTranslation();
  const name = useId();
  const legendId = useId();
  const total = candidate.matches.length + candidate.others.length;
  const fieldLabel = candidate.field ? t(`guide.field.${candidate.field}`) : undefined;

  if (total === 0) {
    return (
      <fieldset>
        <legend className="font-display text-xl">“{candidate.term}”</legend>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("guide.noneForTerm", "Qloo found nothing for this one; it will be skipped.")}
        </p>
      </fieldset>
    );
  }

  const option = (m: QlooEntity) => {
    const selected = value === m.entityId;
    return (
      <label
        key={m.entityId}
        className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-3 text-left transition focus-within:ring-2 focus-within:ring-primary/60 ${
          selected ? "border-primary bg-primary/5" : "hover:border-primary/40"
        }`}
      >
        <input
          type="radio"
          name={name}
          value={m.entityId}
          checked={selected}
          onChange={() => onChange(m.entityId)}
          className="sr-only"
        />
        {m.imageUrl ? (
          <img
            src={m.imageUrl}
            alt=""
            className="h-12 w-12 shrink-0 rounded-xl object-cover"
            loading="lazy"
          />
        ) : (
          <span
            aria-hidden
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-muted font-display text-lg"
          >
            {m.name.charAt(0)}
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{m.name}</span>
          <span className="block truncate text-xs text-muted-foreground">
            {[entityTypeLabel(m.types), m.disambiguation].filter(Boolean).join(" · ")}
          </span>
        </span>
        {selected && <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden />}
      </label>
    );
  };

  return (
    <fieldset aria-labelledby={legendId}>
      <legend id={legendId} className="font-display text-xl">
        “{candidate.term}”
        {fieldLabel && (
          <span className="ml-2 text-sm font-normal text-muted-foreground">{fieldLabel}</span>
        )}
      </legend>
      {candidate.matches.length === 0 && candidate.others.length > 0 && (
        <p className="mt-2 text-sm text-muted-foreground">
          {t("guide.onlyOtherKinds", {
            kind: fieldLabel?.toLowerCase(),
            defaultValue:
              "Qloo has nothing of this kind by that name — only other kinds, listed below.",
          })}
        </p>
      )}
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {candidate.matches.slice(0, 4).map(option)}
        <label
          className={`flex cursor-pointer items-center rounded-2xl border border-dashed p-3 text-left text-sm transition focus-within:ring-2 focus-within:ring-primary/60 ${
            value === null ? "border-primary text-foreground" : "text-muted-foreground hover:border-primary/40"
          }`}
        >
          <input
            type="radio"
            name={name}
            value=""
            checked={value === null}
            onChange={() => onChange(null)}
            className="sr-only"
          />
          {t("guide.skip", "None of these — skip")}
        </label>
      </div>
      {candidate.others.length > 0 && (
        <details className="mt-3">
          <summary className="cursor-pointer text-sm text-muted-foreground underline-offset-4 hover:underline">
            {t("guide.otherKinds", { count: candidate.others.length, defaultValue: "Other kinds ({{count}})" })}
          </summary>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">{candidate.others.slice(0, 4).map(option)}</div>
        </details>
      )}
    </fieldset>
  );
}
