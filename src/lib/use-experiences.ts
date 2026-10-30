// React access to the device-kept experience records of the signed-in user, plus everything the
// Bingo card, badges and profile derive from them. Records never leave this device.
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  badgeProgress,
  deriveCard,
  istanbulDay,
  periodOf,
  type ChallengeId,
  type ExperienceInput,
  type LineKey,
} from "./bingo";
import {
  EMPTY_STORE,
  addChallenge,
  addExperience,
  getStore,
  markCelebrated,
  markStarted,
  removeExperience,
  subscribe,
} from "./experiences";

/** The signed-in Supabase user id (null while loading or signed out). */
export function useSessionUserId() {
  const [userId, setUserId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let alive = true;
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!alive) return;
        setUserId(data.session?.user.id ?? null);
        setReady(true);
      })
      .catch(() => alive && setReady(true));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (alive) setUserId(session?.user.id ?? null);
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);
  return { userId, ready };
}

const NO_LINES: LineKey[] = [];
const NO_SQUARES: ChallengeId[] = [];

export function useExperiences() {
  const { userId, ready } = useSessionUserId();
  const store = useSyncExternalStore(
    subscribe,
    () => getStore(userId),
    () => EMPTY_STORE,
  );
  // the card follows the Istanbul month; re-check once a minute so midnight brings the new card
  const [today, setToday] = useState(() => istanbulDay());
  useEffect(() => {
    const t = window.setInterval(() => setToday(istanbulDay()), 60_000);
    return () => window.clearInterval(t);
  }, []);
  const period = periodOf(today);

  const card = useMemo(
    () => deriveCard(store.records, period, store.started[period] ?? NO_SQUARES),
    [store, period],
  );
  const badges = useMemo(() => badgeProgress(store.records), [store]);

  const add = useCallback(
    (input: ExperienceInput & { startsAt?: string | null }) =>
      userId ? addExperience(userId, input) : ({ ok: false, reason: "bad-date" } as const),
    [userId],
  );
  const markSquare = useCallback(
    (square: ChallengeId, name: string) => (userId ? addChallenge(userId, square, name) : null),
    [userId],
  );
  const remove = useCallback((id: string) => userId && removeExperience(userId, id), [userId]);
  const start = useCallback(
    (square: ChallengeId) => userId && markStarted(userId, period, square),
    [userId, period],
  );
  const celebrate = useCallback(
    (lines: LineKey[]) => userId && markCelebrated(userId, period, lines),
    [userId, period],
  );

  return {
    ready,
    userId,
    today,
    period,
    records: store.records,
    celebrated: store.celebrated[period] ?? NO_LINES,
    card,
    badges,
    add,
    markSquare,
    remove,
    start,
    celebrate,
  };
}
