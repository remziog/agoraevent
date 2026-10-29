// Unit tests for the shared discovery logic (pure, no network).
//   node --test tests/discovery.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import {
  extractConstraints,
  interestWords,
  mergeConstraints,
  scoreEvent,
  splitEvents,
  windowFor,
  eventDistrict,
} from "../src/lib/discovery.ts";

// Wed 28 Oct 2026, 20:55 Istanbul (17:55 UTC)
const NOW = new Date("2026-10-28T17:55:00Z");

const F01 =
  "Bu akşam Kadıköy'de, en fazla 700 TL, küçük bir grupta elektronik müzik dinleyip yeni insanlarla tanışmak istiyorum.";

test("F-01 prompt → tonight (Istanbul), Kadıköy, ≤700 TL, small group, social", () => {
  const c = extractConstraints(F01, NOW);
  assert.equal(c.when?.label, "tonight");
  assert.equal(c.when?.from, "2026-10-28T17:55:00.000Z"); // already evening → from now
  assert.equal(c.when?.to, "2026-10-28T23:59:00+03:00");
  assert.equal(c.district, "Kadıköy");
  assert.equal(c.budgetMax, 700);
  assert.equal(c.groupSize, "small");
  assert.equal(c.social, true);
  assert.deepEqual(interestWords(F01).sort(), ["elektronik", "muzik"]);
});

test("English phrasing and ₺ amounts", () => {
  const c = extractConstraints(
    "Tomorrow evening in Karaköy, under ₺500, indie film with new people",
    NOW,
  );
  assert.equal(c.when?.label, "tomorrow-evening");
  assert.equal(c.when?.from, "2026-10-29T17:00:00+03:00");
  assert.equal(c.district, "Karaköy");
  assert.equal(c.budgetMax, 500);
  assert.equal(c.social, true);
  assert.equal(extractConstraints("something loud and sweaty tonight", NOW).groupSize, "large");
});

test("follow-up 'yarın da olur ama bütçe aynı' changes only the date", () => {
  const first = mergeConstraints(
    null,
    extractConstraints(F01, NOW),
    ["electronic-music", "techno"],
    true,
  );
  const turn = "Yarın da olur ama bütçe aynı.";
  const ex = extractConstraints(turn, NOW);
  assert.equal(ex.when?.label, "tomorrow");
  assert.equal(ex.keepBudget, true);
  assert.deepEqual(interestWords(turn), []);
  const next = mergeConstraints(first, ex, ["yarin", "olur"], false);
  assert.equal(next.when?.label, "tomorrow");
  assert.equal(next.when?.from, "2026-10-29T00:00:00+03:00");
  assert.equal(next.district, "Kadıköy");
  assert.equal(next.budgetMax, 700);
  assert.equal(next.groupSize, "small");
  assert.equal(next.social, true);
  assert.deepEqual(
    next.tags,
    ["electronic-music", "techno"],
    "interest tags survive a pure follow-up",
  );
});

test("weekend window and 'this week' default", () => {
  const w = windowFor("weekend", NOW); // Wed → Sat 31 Oct – Sun 1 Nov
  assert.equal(w.from, "2026-10-31T00:00:00+03:00");
  assert.equal(w.to, "2026-11-01T23:59:00+03:00");
  const week = windowFor("this-week", NOW);
  assert.equal(week.from, NOW.toISOString());
  assert.equal(week.to, "2026-11-04T23:59:00+03:00");
});

const film = {
  id: "film",
  title: "Karaköy Film Club: Blade Runner",
  starts_at: "2026-10-29T16:30:00Z",
  city: "Istanbul",
  venue: "Karaköy Cinema Loft",
  category: "film",
  price: "0.00",
  capacity: 30,
  latitude: 41.0238,
  longitude: 28.977,
  tags: ["demo", "film", "sci-fi"],
};
const techno = {
  id: "techno",
  title: "Moda basement techno",
  starts_at: "2026-10-28T19:00:00Z",
  city: "Istanbul",
  venue: "Moda Sahili",
  category: "music",
  price: 450,
  capacity: 20,
  latitude: 40.9887,
  longitude: 29.026,
  tags: ["techno", "electronic-music"],
};
const unknownPrice = {
  ...techno,
  id: "unknown",
  price: null,
  title: "Kadıköy techno (price not listed)",
};
const landmark = { ...film, id: "lm", category: "landmark", title: "Hagia Sophia" };

test("district from venue text, else from coordinates", () => {
  assert.equal(eventDistrict(film), "Karaköy");
  assert.equal(eventDistrict(techno), "Kadıköy");
  assert.equal(
    eventDistrict({
      venue: null,
      title: "Rooftop",
      tags: [],
      latitude: 41.0238,
      longitude: 28.977,
      city: null,
    }),
    "Karaköy",
  );
  assert.equal(
    eventDistrict({
      venue: null,
      title: "Nowhere",
      tags: [],
      latitude: null,
      longitude: null,
      city: null,
    }),
    null,
  );
});

test("an alternative is never an exact match; it carries the constraints it misses", () => {
  const c = mergeConstraints(
    null,
    extractConstraints(F01, NOW),
    ["electronic-music", "techno"],
    true,
  );
  const scoredFilm = scoreEvent(film, c);
  assert.deepEqual(scoredFilm.violations, ["date", "district", "interest"]);
  assert.deepEqual(scoredFilm.unverified, []);
  assert.equal(scoredFilm.demo, true);
  const scoredTechno = scoreEvent(techno, c);
  assert.deepEqual(scoredTechno.violations, []);
  assert.deepEqual(scoredTechno.unverified, []);
  assert.equal(scoredTechno._score, 2);
  // Unknown price is never "within budget".
  const scoredUnknown = scoreEvent(unknownPrice, c);
  assert.deepEqual(scoredUnknown.violations, []);
  assert.deepEqual(scoredUnknown.unverified, ["price"]);

  const split = splitEvents([film, techno, unknownPrice, landmark], c);
  assert.deepEqual(
    split.matches.map((e) => e.id),
    ["techno"],
  );
  assert.deepEqual(
    split.alternatives.map((e) => e.id),
    ["unknown", "film"],
    "fewest misses first; landmarks excluded",
  );
});

test("no exact match: nothing is promoted to a match", () => {
  const c = mergeConstraints(null, extractConstraints(F01, NOW), ["electronic-music"], true);
  const split = splitEvents([film], c);
  assert.equal(split.matches.length, 0);
  assert.equal(split.alternatives.length, 1);
});

test("rules fallback maps Turkish interest words to the English tags organisers use", async () => {
  const { fallbackTags } = await import("../src/lib/discovery.ts");
  assert.deepEqual(fallbackTags(F01), ["electronic-music", "techno", "music", "live-music"]);
  assert.deepEqual(fallbackTags("indie film and wine night"), ["indie", "film", "wine"]);
});

// --- Intent (DISC-29-01): a restaurant request is never answered with gatherings ---

test("DISC-29-01 prompt → restaurant intent, Kadıköy, tonight, small table; favourites are not interest words", async () => {
  const { extractIntent } = await import("../src/lib/discovery.ts");
  const p =
    "Khruangbin ve Amélie seviyorum. Bu akşam Kadıköy'de iki kişilik sakin bir restoran öner.";
  assert.deepEqual(extractIntent(p), { intent: "restaurant", placeKind: null });
  const c = extractConstraints(p, NOW);
  assert.equal(c.intent, "restaurant");
  assert.equal(c.district, "Kadıköy");
  assert.equal(c.when?.label, "tonight");
  assert.equal(c.groupSize, "small");
  // the grammar words are gone; the proper nouns remain for the model to pick up
  assert.deepEqual(interestWords(p).sort(), ["amelie", "khruangbin"]);
});

test("place words → place intent with a Qloo-searchable kind; gathering words win over place words", async () => {
  const { extractIntent } = await import("../src/lib/discovery.ts");
  assert.deepEqual(extractIntent("Karaköy'de sakin bir kafe"), {
    intent: "place",
    placeKind: "cafe",
  });
  assert.deepEqual(extractIntent("a museum in Sultanahmet"), {
    intent: "place",
    placeKind: "museum",
  });
  assert.deepEqual(extractIntent("Beyoğlu'nda bir yer öner"), { intent: "place", placeKind: null });
  assert.deepEqual(extractIntent("dinner in a meyhane in Kadıköy"), {
    intent: "restaurant",
    placeKind: "meyhane",
  });
  assert.deepEqual(extractIntent("a concert in a bar in Kadıköy"), {
    intent: "event",
    placeKind: null,
  });
  assert.deepEqual(extractIntent("Yarın da olur ama bütçe aynı"), {});
  // "yerine" (instead) is not a place word
  assert.deepEqual(extractIntent("Kadıköy yerine Beşiktaş olsun"), {});
});

test("intent is kept across follow-ups and changed only when the person says so", () => {
  const first = mergeConstraints(
    null,
    extractConstraints("Kadıköy'de bir restoran", NOW),
    [],
    false,
  );
  assert.equal(first.intent, "restaurant");
  const second = mergeConstraints(first, extractConstraints("Yarın da olur", NOW), [], false);
  assert.equal(second.intent, "restaurant");
  assert.equal(second.district, "Kadıköy");
  const third = mergeConstraints(
    second,
    extractConstraints("Aslında bir buluşma olsun", NOW),
    [],
    false,
  );
  assert.equal(third.intent, "event");
  assert.equal(third.placeKind, null);
});

test("direction prompts stay gatherings (no place word hijacks them)", async () => {
  const { extractIntent } = await import("../src/lib/discovery.ts");
  for (const p of [
    "A quiet gathering with a small group, vinyl and slow conversation",
    "A loud gathering with a big crowd, live music or dancing",
    "A run, a swim or a workout gathering with strangers, outdoors",
    "An indie film club night with wine",
  ]) {
    assert.equal(extractIntent(p).intent, "event", p);
  }
});
