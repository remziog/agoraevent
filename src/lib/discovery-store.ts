// The one discovery context shared by the compass (/app), the results page
// (/app/map) and the conversation panel: constraints, turns, results and the
// request sequence that keeps a slow old answer from overwriting a newer one.
// Persisted per tab in sessionStorage; "New search" is the only reset.
import { useCallback, useSyncExternalStore } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { discoverEvents, type DiscoverResult } from "./events.functions";
import type { Constraints } from "./discovery";

export type Turn = {
  id: string;
  role: "user" | "agora";
  text: string;
  at: number;
  kind?: "summary" | "error" | "note";
};

export type DiscoveryStatus = "idle" | "searching" | "ready" | "empty" | "error";

export type DiscoveryState = {
  turns: Turn[];
  constraints: Constraints | null;
  result: DiscoverResult | null;
  status: DiscoveryStatus;
  error: string | null;
  /** Monotonic request counter; a response is applied only if it is the latest request. */
  seq: number;
  /** The compass direction the person picked (for the needle), if any. */
  direction: string | null;
};

const STORAGE_KEY = "agora:discovery:v1";

const INITIAL: DiscoveryState = {
  turns: [],
  constraints: null,
  result: null,
  status: "idle",
  error: null,
  seq: 0,
  direction: null,
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

export function useDiscovery() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const discover = useServerFn(discoverEvents);
  const { t } = useTranslation();

  const run = useCallback(
    async (input: {
      prompt: string;
      edits?: Partial<Constraints>;
      direction?: string | null;
      userText?: string;
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
        turns: userTurn ? [...s.turns, userTurn] : s.turns,
      }));
      try {
        const result = await discover({
          data: { prompt: input.prompt, previous: state.constraints, edits: input.edits },
        });
        // A newer request started while this one was in flight: drop this answer.
        if (seq !== state.seq) return null;
        const summary = summarize(t, result);
        set((s) => ({
          result,
          constraints: result.constraints,
          status: result.matches.length > 0 ? "ready" : "empty",
          turns: [
            ...s.turns,
            { id: turnId(), role: "agora", text: summary, at: Date.now(), kind: "summary" },
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
    [discover, t],
  );

  /** A typed or spoken message, or a compass direction's prompt. */
  const ask = useCallback(
    (text: string, options: { direction?: string | null; display?: string } = {}) =>
      run({ prompt: text, direction: options.direction, userText: options.display ?? text }),
    [run],
  );

  /** A chip edit: re-run with the same conversation and an explicit constraint change. */
  const edit = useCallback(
    (edits: Partial<Constraints>, label: string) => run({ prompt: label, edits, userText: label }),
    [run],
  );

  return { state: snapshot, ask, edit, reset: resetDiscovery };
}

function summarize(t: TFunction, r: DiscoverResult): string {
  const parts: string[] = [];
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
