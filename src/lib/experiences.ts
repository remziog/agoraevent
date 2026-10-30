// Deneyimlerim storage: experience records kept on THIS device only (localStorage), keyed by the
// signed-in Supabase user id. Nothing is sent to a server, nothing is verified, and every read and
// write is wrapped so a private window or blocked storage simply keeps records for this visit.
// The pure rules live in ./bingo.ts.
import {
  buildChallengeRecord,
  buildRecord,
  checkAttendance,
  istanbulDay,
  periodOf,
  sanitizeRecords,
  type AttendCheck,
  type ChallengeId,
  type ExperienceInput,
  type ExperienceRecord,
  type LineKey,
} from "./bingo.ts";

export type ExperienceStore = {
  v: 1;
  records: ExperienceRecord[];
  /** Squares opened from the card ("in progress"), per month. */
  started: Record<string, ChallengeId[]>;
  /** Lines whose çinko moment was already shown, per month. */
  celebrated: Record<string, LineKey[]>;
};

export const EMPTY_STORE: ExperienceStore = Object.freeze({
  v: 1,
  records: [],
  started: {},
  celebrated: {},
}) as ExperienceStore;

export const storageKey = (userId: string) => `agora:experiences:v1:${userId}`;

const cache = new Map<string, ExperienceStore>();
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function readStore(userId: string): ExperienceStore {
  let raw: string | null = null;
  try {
    raw = typeof window !== "undefined" ? window.localStorage.getItem(storageKey(userId)) : null;
  } catch {
    raw = null;
  }
  if (!raw) return { v: 1, records: [], started: {}, celebrated: {} };
  try {
    const p = JSON.parse(raw) as Partial<ExperienceStore>;
    const obj = (o: unknown) => (o && typeof o === "object" && !Array.isArray(o) ? (o as Record<string, unknown>) : {});
    const lists = <T,>(o: unknown) =>
      Object.fromEntries(
        Object.entries(obj(o)).filter(([, v]) => Array.isArray(v)).map(([k, v]) => [k, (v as unknown[]).filter((s) => typeof s === "string")]),
      ) as Record<string, T[]>;
    return {
      v: 1,
      records: sanitizeRecords(p.records),
      started: lists<ChallengeId>(p.started),
      celebrated: lists<LineKey>(p.celebrated),
    };
  } catch {
    return { v: 1, records: [], started: {}, celebrated: {} };
  }
}

/** The current store for a user (stable reference until it changes). */
export function getStore(userId: string | null): ExperienceStore {
  if (!userId) return EMPTY_STORE;
  let s = cache.get(userId);
  if (!s) {
    s = readStore(userId);
    cache.set(userId, s);
  }
  return s;
}

function writeStore(userId: string, next: ExperienceStore) {
  cache.set(userId, next);
  try {
    window.localStorage.setItem(storageKey(userId), JSON.stringify(next));
  } catch {
    /* storage unavailable: kept for this visit only */
  }
  emit();
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (!e.key || !e.key.startsWith("agora:experiences:v1:")) return;
    cache.delete(e.key.slice("agora:experiences:v1:".length));
    listener();
  };
  if (typeof window !== "undefined") window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    if (typeof window !== "undefined") window.removeEventListener("storage", onStorage);
  };
}

const rid = () => `exp-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export type AddResult = { ok: true; record: ExperienceRecord } | Extract<AttendCheck, { ok: false }>;

/** "Katıldım / Buraya gittim": write a self-reported record (attendance rules enforced). */
export function addExperience(
  userId: string,
  input: ExperienceInput & { startsAt?: string | null },
  now: Date = new Date(),
): AddResult {
  const s = getStore(userId);
  const chk = checkAttendance(s.records, input, now);
  if (!chk.ok) return chk;
  const record = buildRecord(input, chk.date, now.toISOString(), rid());
  writeStore(userId, { ...s, records: [...s.records, record] });
  return { ok: true, record };
}

/** "I did it, mark it" on a Bingo square: a self-reported record for this month's card. */
export function addChallenge(userId: string, square: ChallengeId, name: string, now: Date = new Date()): ExperienceRecord | null {
  const s = getStore(userId);
  const today = istanbulDay(now);
  if (s.records.some((r) => r.kind === "challenge" && r.refId === square && periodOf(r.date) === periodOf(today))) return null;
  const record = buildChallengeRecord(square, name, today, now.toISOString(), rid());
  writeStore(userId, { ...s, records: [...s.records, record] });
  return record;
}

/** Undo / remove: Bingo squares, lines and badges are re-derived from what is left. */
export function removeExperience(userId: string, id: string) {
  const s = getStore(userId);
  if (!s.records.some((r) => r.id === id)) return;
  writeStore(userId, { ...s, records: s.records.filter((r) => r.id !== id) });
}

export function markStarted(userId: string, period: string, square: ChallengeId) {
  const s = getStore(userId);
  const cur = s.started[period] ?? [];
  if (cur.includes(square)) return;
  writeStore(userId, { ...s, started: { ...s.started, [period]: [...cur, square] } });
}

export function markCelebrated(userId: string, period: string, lines: LineKey[]) {
  const s = getStore(userId);
  const cur = s.celebrated[period] ?? [];
  const next = Array.from(new Set([...cur, ...lines]));
  if (next.length === cur.length) return;
  writeStore(userId, { ...s, celebrated: { ...s.celebrated, [period]: next } });
}
