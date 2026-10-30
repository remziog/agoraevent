// Agora Bingo + Deneyimlerim rules (design: Naz Paşalı). Pure, no storage, no network.
//   node --test tests/bingo.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import {
  badgeProgress,
  buildChallengeRecord,
  buildRecord,
  checkAttendance,
  deriveCard,
  fold,
  groupOf,
  istanbulDay,
  linesThrough,
  matchRecords,
  previewMatch,
  REWARDS,
  sanitizeRecords,
  squaresToNextLine,
} from "../src/lib/bingo.ts";

let n = 0;
const rec = (input, date, at = `${date}T10:00:00.000Z`) => buildRecord(input, date, at, `r${++n}`);
const cafe = (refId, extra = {}) => ({ kind: "place", refId, name: `Café ${refId}`, categories: ["Coffee shop"], tags: [], ...extra });
const concert = (refId, extra = {}) => ({ kind: "event", refId, name: `Concert ${refId}`, categories: ["concert"], tags: ["live music"], ...extra });

test("Istanbul day and month: 21:30 UTC on 31 Oct is already 1 Nov in Istanbul", () => {
  assert.equal(istanbulDay(new Date("2026-10-31T21:30:00Z")), "2026-11-01");
  assert.equal(istanbulDay(new Date("2026-10-31T20:59:00Z")), "2026-10-31");
  assert.equal(fold("Kadıköy İSTANBUL Café_Bar"), "kadikoy istanbul cafe bar");
});

test("a fresh card: only the AGORA FREE centre is filled, no lines", () => {
  const card = deriveCard([], "2026-10");
  assert.equal(card.filled, 1);
  assert.equal(card.cells[4].id, "free");
  assert.equal(card.cells[4].status, "free");
  assert.deepEqual(card.lines, []);
  assert.equal(squaresToNextLine(card), 2); // a line through the centre needs two squares
  assert.equal(deriveCard([], "2026-10", ["coffee"]).cells[0].status, "progress");
});

test("coffee: a new café fills the square; the same café never counts twice", () => {
  const a = rec(cafe("p1"), "2026-10-02");
  const again = rec(cafe("p1"), "2026-10-05");
  const m = matchRecords([again, a]); // input order does not matter
  assert.deepEqual(m[a.id], ["coffee"]);
  assert.deepEqual(m[again.id], []);
  const card = deriveCard([a, again], "2026-10");
  assert.equal(card.cells[0].status, "done");
  assert.deepEqual(card.cells[0].recordIds, [a.id]);
});

test("music: only a concert-type event; a venue alone does not count", () => {
  const ev = rec(concert("e1"), "2026-10-03");
  const bar = rec({ kind: "place", refId: "p9", name: "Bar", categories: ["bar"], tags: ["live music"] }, "2026-10-03");
  const m = matchRecords([ev, bar]);
  assert.deepEqual(m[ev.id], ["music"]);
  assert.deepEqual(m[bar.id], []);
});

test("cuisine: needs a restaurant with a named cuisine, new to you", () => {
  const sushi = rec({ kind: "place", refId: "p2", name: "S", categories: ["Japanese restaurant"], tags: ["sushi"] }, "2026-10-04");
  const ramen = rec({ kind: "place", refId: "p3", name: "R", categories: ["restaurant"], tags: ["ramen"] }, "2026-10-06");
  const none = rec({ kind: "place", refId: "p4", name: "N", categories: ["restaurant"], tags: [] }, "2026-10-07");
  const garden = rec({ kind: "place", refId: "p5", name: "G", categories: ["Japanese garden"], tags: [] }, "2026-10-07");
  const m = matchRecords([sushi, ramen, none, garden]);
  assert.deepEqual(m[sushi.id], ["cuisine"]);
  assert.deepEqual(m[ramen.id], []); // Japanese again
  assert.deepEqual(m[none.id], []); // no cuisine on the record
  assert.deepEqual(m[garden.id], []); // not a restaurant
});

test("shop needs an independent marker; a coffee shop is a café, not a shop; parks exclude car parks", () => {
  const chain = rec({ kind: "place", refId: "s1", name: "Chain", categories: ["clothing store"], tags: [] }, "2026-10-08");
  const indie = rec({ kind: "place", refId: "s2", name: "Indie", categories: ["store"], tags: ["vintage"] }, "2026-10-08");
  const cs = rec({ kind: "place", refId: "s3", name: "CS", categories: ["urn:tag:category:place:coffee_shop"], tags: ["independent"] }, "2026-10-09");
  const park = rec({ kind: "place", refId: "k1", name: "Yıldız Parkı", categories: ["Park"], tags: [] }, "2026-10-09");
  const carpark = rec({ kind: "place", refId: "k2", name: "Otopark", categories: ["car park"], tags: [] }, "2026-10-09");
  const m = matchRecords([chain, indie, cs, park, carpark]);
  assert.deepEqual(m[chain.id], []);
  assert.deepEqual(m[indie.id], ["shop"]);
  assert.deepEqual(m[cs.id], ["coffee"]);
  assert.deepEqual(m[park.id], ["park"]);
  assert.deepEqual(m[carpark.id], []);
});

test("neighbourhood stacks on top of the activity square, once per district", () => {
  const a = rec(cafe("p1", { district: "Kadıköy" }), "2026-10-02");
  const b = rec(concert("e1", { district: "kadikoy" }), "2026-10-03");
  const c = rec(concert("e2", { district: "Balat" }), "2026-10-04");
  const m = matchRecords([a, b, c]);
  assert.deepEqual(m[a.id], ["coffee", "hood"]);
  assert.deepEqual(m[b.id], ["music"]);
  assert.deepEqual(m[c.id], ["music", "hood"]);
});

test("lines: café + exhibition + concert complete row 1; undo removes the line", () => {
  const a = rec(cafe("p1"), "2026-10-02");
  const b = rec({ kind: "event", refId: "e5", name: "Opening", categories: ["exhibition"], tags: [] }, "2026-10-03");
  const c = rec(concert("e1"), "2026-10-04");
  const card = deriveCard([a, b, c], "2026-10");
  assert.deepEqual(card.lines, ["r0"]);
  assert.equal(card.filled, 4);
  assert.deepEqual(linesThrough(card, 1).map((l) => [l.key, l.left]), [["r0", 0], ["c1", 1]]);
  assert.deepEqual(deriveCard([a, c], "2026-10").lines, []);
});

test("the centre is free: exhibition + park complete the middle column, concert + cuisine the anti-diagonal", () => {
  const ex = rec({ kind: "place", refId: "g1", name: "Galeri", categories: ["Art gallery"], tags: [] }, "2026-10-10");
  const park = rec({ kind: "place", refId: "k1", name: "Koru", categories: ["park"], tags: [] }, "2026-10-11");
  assert.deepEqual(deriveCard([ex, park], "2026-10").lines, ["c1"]);
  const food = rec({ kind: "place", refId: "f1", name: "Meze", categories: ["restaurant"], tags: ["meyhane"] }, "2026-10-11");
  assert.deepEqual(deriveCard([rec(concert("e3"), "2026-10-12"), food], "2026-10").lines, ["d1"]);
});

test("records from another month count for badges, never for this month's card", () => {
  const sep = rec(cafe("p1"), "2026-09-30");
  const card = deriveCard([sep], "2026-10");
  assert.equal(card.cells[0].status, "locked");
  assert.equal(badgeProgress([sep]).find((b) => b.id === "coffee").count, 1);
});

test("badges: distinct cafés and districts; Culture Collector stays at 0 without verification", () => {
  const recs = [
    rec(cafe("p1", { district: "Moda" }), "2026-10-01"),
    rec(cafe("p1", { district: "Moda" }), "2026-10-02"),
    rec(cafe("p2", { district: "Karaköy" }), "2026-10-03"),
  ];
  const b = Object.fromEntries(badgeProgress(recs).map((x) => [x.id, x]));
  assert.equal(b.coffee.count, 2);
  assert.equal(b.nomad.count, 2);
  assert.equal(b.culture.count, 0);
  assert.equal(b.culture.needsVerification, true);
  assert.equal(b.coffee.done, false);
});

test("challenge records fill their own square; previews write nothing", () => {
  const s = buildChallengeRecord("surprise", "Take a surprise trip", "2026-10-12", "2026-10-12T10:00:00.000Z", "c1");
  assert.deepEqual(matchRecords([s])[s.id], ["surprise"]);
  assert.equal(groupOf(s), "other");
  const existing = [rec(cafe("p1"), "2026-10-02")];
  assert.deepEqual(previewMatch(existing, cafe("p1"), "2026-10-20"), []);
  assert.deepEqual(previewMatch(existing, cafe("p7"), "2026-10-20"), ["coffee"]); // a different café still fits the rule
  assert.equal(existing.length, 1);
});

test("attendance rules: future events refused, an event once, a place once per day", () => {
  const now = new Date("2026-10-31T12:00:00Z");
  assert.deepEqual(checkAttendance([], { ...concert("e1"), startsAt: "2026-11-02T18:00:00Z" }, now), { ok: false, reason: "future-event" });
  const ok = checkAttendance([], { ...concert("e1"), startsAt: "2026-10-30T18:00:00Z" }, now);
  assert.deepEqual(ok, { ok: true, date: "2026-10-30" });
  const e = rec(concert("e1"), "2026-10-30");
  assert.deepEqual(checkAttendance([e], concert("e1"), now), { ok: false, reason: "already-event" });
  const p = rec(cafe("p1"), "2026-10-31");
  assert.deepEqual(checkAttendance([p], cafe("p1"), now), { ok: false, reason: "already-today" });
  assert.deepEqual(checkAttendance([p], cafe("p1"), now, "2026-11-05"), { ok: false, reason: "future-date" });
  assert.deepEqual(checkAttendance([p], cafe("p1"), now, "2026-10-29"), { ok: true, date: "2026-10-29" });
});

test("device records are sanitised and can never claim to be verified; rewards are never available", () => {
  const out = sanitizeRecords([
    { id: "a", kind: "place", refId: "p1", name: "X", categories: ["cafe"], tags: [], date: "2026-10-01", status: "verified", at: "2026-10-01T10:00:00Z" },
    { id: "b", kind: "place", refId: "p1", date: "not-a-day" },
    { id: "c", kind: "challenge", refId: "nope", date: "2026-10-01" },
    null,
  ]);
  assert.equal(out.length, 1);
  assert.equal(out[0].status, "self");
  assert.ok(REWARDS.every((r) => r.available === false && r.partner === null && r.terms === null));
});
