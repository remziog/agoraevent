// The one discovery context shared by the compass (/app), the results stage
// (/app/map) and the conversation panel: constraints, confirmed taste signals,
// turns, results and the request sequence that keeps a slow old answer from
// overwriting a newer one. Persisted per tab in sessionStorage; "New search"
// is the only reset.
import { useCallback, useSyncExternalStore } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { discover, type DiscoverResult, type TasteSignal } from "./events.functions";
import type { Constraints } from "./discovery";

export type Turn = {
  id: string;
  role: "user" | "agora";
  text: string;
  at: number;
  kind?: "summary" | "error" | "note" | "question";
};

export type DiscoveryStatus = "idle" | "searching" | "ready" | "empty" | "question" | "error";

export type DiscoveryState = {
  turns: Turn[];
  constraints: Constraints | null;
  /** Favourites resolved to Qloo entities so far — carried into every later turn. */
  signals: TasteSignal[];
  result: DiscoverResult | null;
  status: DiscoveryStatus;
  error: string | null;
  /** Monotonic request counter; a response is applied only if it is the latest request. */
  seq: number;
  /** The compass direction the person picked (for the needle), if any. */
  direction: string | null;
  /** Last request text, for the stage header. */
  lastPrompt: string | null;
};

const STORAGE_KEY = "agora:discovery:v2";

const INITIAL: DiscoveryState = {
  turns: [],
  constraints: null,
  signals: [],
  result: null,
  status: "idle",
  error: null,
  seq: 0,
  direction: null,
  lastPrompt: null,
};

let state: DiscoveryState = load();
const listeners = new Set<() => void>();

function load(): DiscoveryState {
  if (typeof sessionStorage === "undefined") return INITIAL;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return INITIAL;
    const saved = JSON.parse(raw) as DiscoveryState;
    // A search that was in flight when the tab reloaded is over.
    return { ...INITIAL, ...saved, status: saved.status === "searching" ? "idle" : saved.status };
  } catch {
    return INITIAL;
  }
}

function persist(next: DiscoveryState) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable: the context lives in memory only */
  }
}

function set(update: Partial<DiscoveryState> | ((s: DiscoveryState) => Partial<DiscoveryState>)) {
  const patch = typeof update === "function" ? update(state) : update;
  state = { ...state, ...patch };
  persist(state);
  for (const l of listeners) l();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const getSnapshot = () => state;
const getServerSnapshot = () => INITIAL;

let turnCounter = 0;
const turnId = () => `${Date.now().toString(36)}-${(turnCounter++).toString(36)}`;

export function resetDiscovery() {
  set({ ...INITIAL, seq: state.seq + 1 });
}

/** Status derived from a result: a question to answer, something found, or nothing. */
function statusFor(r: DiscoverResult): DiscoveryStatus {
  if (r.question) return "question";
  if (r.qlooError) return "error";
  if (r.intent === "event") return r.matches.length > 0 ? "ready" : "empty";
  return r.places && r.places.items.length > 0 ? "ready" : "empty";
}

export function useDiscovery() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const call = useServerFn(discover);
  const { t } = useTranslation();

  const run = useCallback(
    async (input: {
      prompt: string;
      edits?: Partial<Constraints>;
      answers?: { term: string; entityId: string | null }[];
      direction?: string | null;
      userText?: string;
      /** "edit": a chip or option click — the text is a label, not a request to analyse. */
      mode?: "ask" | "edit";
      /** Keep the stage's request line (answers and edits refine the same request). */
      keepPrompt?: boolean;
    }) => {
      const seq = state.seq + 1;
      const userTurn: Turn | null = input.userText
        ? { id: turnId(), role: "user", text: input.userText, at: Date.now() }
        : null;
      set((s) => ({
        seq,
        status: "searching",
        error: null,
        direction: input.direction === undefined ? s.direction : input.direction,
        lastPrompt: input.keepPrompt
          ? (s.lastPrompt ?? input.prompt)
          : (input.userText ?? input.prompt),
        turns: userTurn ? [...s.turns, userTurn] : s.turns,
      }));
      try {
        const result = await call({
          data: {
            prompt: input.prompt,
            previous: state.constraints,
            edits: input.edits,
            signals: state.signals,
            answers: input.answers,
            mode: input.mode ?? "ask",
          },
        });
        // A newer request started while this one was in flight: drop this answer.
        if (seq !== state.seq) return null;
        const summary = summarize(t, result);
        const status = statusFor(result);
        set((s) => ({
          result,
          constraints: result.constraints,
          signals: result.signals,
          status,
          error: result.qlooError ?? null,
          turns: [
            ...s.turns,
            {
              id: turnId(),
              role: "agora",
              text: summary,
              at: Date.now(),
              kind: status === "question" ? "question" : status === "error" ? "error" : "summary",
            },
          ],
        }));
        return result;
      } catch (e) {
        if (seq !== state.seq) return null;
        const message = e instanceof Error ? e.message : String(e);
        set((s) => ({
          status: "error",
          error: message,
          turns: [
            ...s.turns,
            {
              id: turnId(),
              role: "agora",
              text: t("discover.error", "I couldn't search just now. Try again in a moment."),
              at: Date.now(),
              kind: "error",
            },
          ],
        }));
        return null;
      }
    },
    [call, t],
  );

  /** A typed or spoken message, or a compass direction's prompt. */
  const ask = useCallback(
    (text: string, options: { direction?: string | null; display?: string } = {}) =>
      run({ prompt: text, direction: options.direction, userText: options.display ?? text }),
    [run],
  );

  /** A chip edit: re-run with the same conversation and an explicit constraint change. */
  const edit = useCallback(
    (edits: Partial<Constraints>, label: string) =>
      run({ prompt: label, edits, userText: label, mode: "edit", keepPrompt: true }),
    [run],
  );

  /** Answer to Agora's question (a district, or which favourite was meant); re-runs the last request. */
  const answer = useCallback(
    (input: {
      district?: string;
      answers?: { term: string; entityId: string | null }[];
      label: string;
    }) =>
      run({
        prompt: state.lastPrompt ?? input.label,
        edits: input.district ? { district: input.district } : undefined,
        answers: input.answers,
        userText: input.label,
        keepPrompt: true,
      }),
    [run],
  );

  /** Drop a confirmed favourite from the conversation (the next turn runs without it). */
  const removeSignal = useCallback((entityId: string) => {
    set((s) => ({ signals: s.signals.filter((x) => x.entityId !== entityId) }));
  }, []);

  return { state: snapshot, ask, edit, answer, removeSignal, reset: resetDiscovery };
}

function summarize(t: TFunction, r: DiscoverResult): string {
  const parts: string[] = [];
  if (r.question?.kind === "district") {
    parts.push(
      t("discover.askDistrict", {
        kind: kindWord(t, r),
        defaultValue: "Which district should I look in for {{kind}}?",
      }),
    );
    return parts.join(" ");
  }
  if (r.question?.kind === "taste") {
    parts.push(
      t("discover.askTaste", {
        terms: r.question.items.map((i) => `“${i.term}”`).join(", "),
        defaultValue: "Qloo knows more than one {{terms}} — which did you mean?",
      }),
    );
    return parts.join(" ");
  }
  if (r.intent !== "event") {
    if (r.qlooError) {
      parts.push(
        t(
          "discover.qlooFailed",
          "Qloo didn't answer just now, so I can't rank places — try again in a moment.",
        ),
      );
      return parts.join(" ");
    }
    const places = r.places;
    if (places && places.items.length > 0) {
      parts.push(
        places.signals.length > 0
          ? t("discover.summaryPlaces", {
              count: places.items.length,
              kind: kindWord(t, r),
              district: places.district,
              names: places.signals.map((s) => s.name).join(", "),
              defaultValue:
                "Qloo ranked {{count}} {{kind}} in {{district}} for your taste ({{names}}).",
            })
          : t("discover.summaryPlacesPopular", {
              count: places.items.length,
              kind: kindWord(t, r),
              district: places.district,
              defaultValue:
                "{{count}} {{kind}} in {{district}} by popularity — name an artist, film or book and Qloo will rank them for you.",
            }),
      );
      if (places.scope === "places" && places.kind)
        parts.push(
          t("discover.summaryUntagged", {
            kind: places.kind,
            defaultValue: "Qloo has no “{{kind}}” filter, so these are places of any kind.",
          }),
        );
    } else {
      parts.push(
        t("discover.summaryNoPlaces", {
          kind: kindWord(t, r),
          district: r.constraints.district ?? "",
          defaultValue: "Qloo returned no {{kind}} in {{district}}. Try another district.",
        }),
      );
    }
    if (places && places.unknownTerms.length > 0)
      parts.push(
        t("discover.summaryUnknownTaste", {
          terms: places.unknownTerms.join(", "),
          defaultValue: "Qloo doesn't know {{terms}}, so I left it out.",
        }),
      );
    if (r.matches.length > 0)
      parts.push(
        t("discover.summaryNearbyGatherings", {
          count: r.matches.length,
          defaultValue: "Also: {{count}} Agora gathering(s) nearby in the same window.",
        }),
      );
    return parts.join(" ");
  }
  if (r.matches.length > 0) {
    parts.push(
      t("discover.summaryMatches", {
        count: r.matches.length,
        defaultValue: "{{count}} gathering(s) meet every condition you gave.",
      }),
    );
    if (r.alternatives.length > 0) {
      parts.push(
        t("discover.summaryAlsoAlternatives", {
          count: r.alternatives.length,
          defaultValue: "{{count}} more are close but miss a condition — each one says which.",
        }),
      );
    }
  } else if (r.alternatives.length > 0) {
    parts.push(
      t("discover.summaryNoExact", {
        count: r.alternatives.length,
        defaultValue:
          "I couldn't verify a gathering that meets all of your conditions. Below are {{count}} nearby alternatives, each marked with what it misses — I won't change your conditions unless you tell me to.",
      }),
    );
  } else {
    parts.push(
      t("discover.summaryNothing", {
        checked: r.checked,
        defaultValue:
          "Nothing in the {{checked}} upcoming listings fits — not even loosely. Try another time or district, or browse the calendar.",
      }),
    );
  }
  if (r.constraints.when?.assumed) {
    parts.push(
      t(
        "discover.summaryAssumedWeek",
        "You didn't say when, so I looked at the next 7 days — change it any time.",
      ),
    );
  }
  return parts.join(" ");
}

/** "restaurants", "bars", "places" — the word for what was asked. */
export function kindWord(t: TFunction, r: Pick<DiscoverResult, "intent" | "constraints">): string {
  if (r.intent === "restaurant") return t("discover.kind.restaurant", "restaurants");
  const k = r.constraints.placeKind;
  if (!k) return t("discover.kind.place", "places");
  return t(`discover.kind.${k.replace(/\s+/g, "-")}`, { defaultValue: `${k}s` });
}
