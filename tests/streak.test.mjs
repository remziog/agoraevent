// Streak semantics (STATE-29-01): computed from the gatherings on the calendar, never incremented.
//   node --test tests/streak.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { streakFromDates } from "../src/lib/streak.ts";

const d = (s) => new Date(s);

test("no gatherings → 0; one gathering → 1", () => {
  assert.deepEqual(streakFromDates([]), { current: 0, longest: 0, lastEventAt: null });
  const one = streakFromDates([d("2026-10-30T18:00:00Z")]);
  assert.equal(one.current, 1);
  assert.equal(one.longest, 1);
});

test("join → cancel leaves the streak exactly where it was", () => {
  const before = [d("2026-10-20T18:00:00Z"), d("2026-10-27T18:00:00Z")];
  const joined = [...before, d("2026-11-02T18:00:00Z")];
  assert.equal(streakFromDates(before).current, 2);
  assert.equal(streakFromDates(joined).current, 3);
  assert.equal(streakFromDates(before).current, 2); // cancelled: same input, same number
});

test("a gap of more than two weeks breaks the chain; the longest chain is remembered", () => {
  const s = streakFromDates([
    "2026-09-01T18:00:00Z",
    "2026-09-08T18:00:00Z",
    "2026-09-15T18:00:00Z",
    "2026-10-20T18:00:00Z", // > 14 days later
    "2026-10-27T18:00:00Z",
  ]);
  assert.equal(s.current, 2);
  assert.equal(s.longest, 3);
  assert.equal(s.lastEventAt?.toISOString(), "2026-10-27T18:00:00.000Z");
});

test("the same gathering twice counts once; order does not matter", () => {
  const s = streakFromDates([
    "2026-10-27T18:00:00Z",
    "2026-10-20T18:00:00Z",
    "2026-10-27T18:00:00Z",
  ]);
  assert.equal(s.current, 2);
});
