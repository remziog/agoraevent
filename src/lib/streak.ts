// Streak semantics (STATE-29-01): the streak is computed from the gatherings
// the person is actually going to, never incremented by an action. Joining
// then cancelling leaves no trace, and the number means one thing: how many
// distinct gatherings in a row, each within two weeks of the previous one,
// ending with the latest one on the calendar. Pure and client-safe.

export const STREAK_GAP_MS = 14 * 24 * 3600 * 1000;

export type Streak = {
  /** Length of the chain that ends with the latest gathering (0 with no gatherings). */
  current: number;
  /** Longest chain anywhere in the person's gatherings. */
  longest: number;
  /** Start time of the latest counted gathering, or null. */
  lastEventAt: Date | null;
};

/** `starts` = start times of every gathering with an RSVP (any order, duplicates allowed). */
export function streakFromDates(starts: readonly (Date | string | number)[]): Streak {
  const times = Array.from(
    new Set(
      starts
        .map((d) => (d instanceof Date ? d.getTime() : new Date(d).getTime()))
        .filter((t) => Number.isFinite(t)),
    ),
  ).sort((a, b) => a - b);
  if (times.length === 0) return { current: 0, longest: 0, lastEventAt: null };
  let longest = 1;
  let run = 1;
  for (let i = 1; i < times.length; i++) {
    run = times[i] - times[i - 1] <= STREAK_GAP_MS ? run + 1 : 1;
    if (run > longest) longest = run;
  }
  // `run` now describes the chain ending with the latest gathering.
  return { current: run, longest, lastEventAt: new Date(times[times.length - 1]) };
}
