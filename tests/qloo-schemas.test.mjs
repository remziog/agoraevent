// Unit tests for the pure Qloo helpers (no network, no key).
//   node --test tests/qloo-schemas.test.mjs
// Node >= 22.6 strips TypeScript types from the imported module.
import test from "node:test";
import assert from "node:assert/strict";
import {
  boundJson,
  explainDrivers,
  normalizeEntity,
  pickResultArray,
} from "../src/lib/qloo.schemas.ts";

const TASTE = [
  { entityId: "sig-radiohead", name: "Radiohead" },
  { entityId: "sig-blade-runner", name: "Blade Runner" },
];

test("explainDrivers reads arrays of {entity_id, score}, strongest first, unknown ids dropped", () => {
  const drivers = explainDrivers(
    {
      "signal.interests.entities": [
        { entity_id: "sig-blade-runner", score: 0.41 },
        { entity_id: "sig-radiohead", score: 0.82 },
        { entity_id: "sig-unknown", score: 0.99 },
      ],
    },
    TASTE,
  );
  assert.deepEqual(
    drivers.map((d) => [d.name, d.weight]),
    [
      ["Radiohead", 0.82],
      ["Blade Runner", 0.41],
    ],
  );
});

test("explainDrivers reads id-keyed objects and bare id strings", () => {
  assert.deepEqual(explainDrivers({ "sig-radiohead": 0.3, "sig-other": 0.9 }, TASTE), [
    { entityId: "sig-radiohead", name: "Radiohead", weight: 0.3 },
  ]);
  assert.deepEqual(explainDrivers(["sig-blade-runner"], TASTE), [
    { entityId: "sig-blade-runner", name: "Blade Runner", weight: undefined },
  ]);
});

test("explainDrivers returns [] for missing or unknown shapes", () => {
  assert.deepEqual(explainDrivers(undefined, TASTE), []);
  assert.deepEqual(explainDrivers({ foo: "bar" }, TASTE), []);
  assert.deepEqual(explainDrivers({ entity_id: "sig-radiohead" }, []), []);
});

test("boundJson caps strings, arrays and depth", () => {
  const deep = { a: { b: { c: { d: { e: { f: { g: { h: 1 } } } } } } } };
  assert.ok(JSON.stringify(boundJson(deep)).includes("[…]"));
  assert.equal(boundJson("x".repeat(400)).length, 301);
  assert.equal(boundJson(Array.from({ length: 20 }, (_, i) => i)).length, 12);
});

test("normalizeEntity reads geocode from properties or location and builds locationText", () => {
  const a = normalizeEntity({
    entity_id: "e1",
    name: "Hagia Sophia",
    properties: {
      address: "Sultanahmet, Istanbul",
      geocode: { latitude: 41.0086, longitude: 28.9802, city: "Istanbul" },
    },
  });
  assert.deepEqual(a?.geocode, { latitude: 41.0086, longitude: 28.9802 });
  assert.equal(a?.locationText, "Sultanahmet, Istanbul · Istanbul");

  const b = normalizeEntity({ id: "e2", name: "Somewhere", location: { lat: 1, lon: 2 } });
  assert.deepEqual(b?.geocode, { latitude: 1, longitude: 2 });
  assert.equal(normalizeEntity({ name: "no id" }), null);
});

test("pickResultArray handles both Qloo envelope shapes", () => {
  assert.deepEqual(pickResultArray({ results: [1, 2] }, "entities"), [1, 2]);
  assert.deepEqual(pickResultArray({ results: { entities: [3] } }, "entities"), [3]);
  assert.deepEqual(pickResultArray({ results: { tags: [4] } }, "tags"), [4]);
  assert.deepEqual(pickResultArray(null, "entities"), []);
});
