// Offline run of the guide agent (fixed plan: no LOVABLE_API_KEY) with a mocked
// Qloo API, a mocked landmark_qloo_map table (Supabase REST, service role) and a
// fake user-scoped Supabase client for events. Proves the orchestration
// (resolve → rank → restaurants → gatherings → plan) without a key or a model.
// Live behaviour is checked on /app/qloo-status and /app/guide.
//   npx tsx --test tests/guide-agent.offline.test.ts
import test from "node:test";
import assert from "node:assert/strict";

process.env.QLOO_API_KEY = "offline-test-key";
process.env.SUPABASE_URL = "http://supabase.test";
process.env.SUPABASE_SERVICE_ROLE_KEY = "offline-service-role";
delete process.env.LOVABLE_API_KEY;
delete process.env.QLOO_RESTAURANT_TAGS;

const { ISTANBUL_LANDMARKS } = await import("../src/lib/istanbul-landmarks");
const { runGuideAgent } = await import("../src/lib/guide-agent.server");

const TASTE = [
  { entityId: "sig-radiohead", name: "Radiohead", type: "artist" },
  { entityId: "sig-blade-runner", name: "Blade Runner", type: "movie" },
];

type Req = { host: string; path: string; params: URLSearchParams; apiKey: string | null };
const requests: Req[] = [];
/** The mocked landmark_qloo_map table: rows the server upserted. */
let mapRows: Record<string, unknown>[] = [];
let qlooStatusOverride: number | null = null;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

function placeFor(landmark: (typeof ISTANBUL_LANDMARKS)[number]) {
  return {
    entity_id: `ent-${landmark.id}`,
    name: landmark.aliases[0],
    types: ["urn:entity:place"],
    popularity: 0.8,
    properties: {
      address: "Istanbul, Türkiye",
      geocode: { latitude: landmark.latitude, longitude: landmark.longitude, city: "Istanbul" },
    },
  };
}

globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = new URL(
    typeof input === "string" ? input : input instanceof URL ? input.href : input.url,
  );
  const method = (init?.method ?? "GET").toUpperCase();
  const headers = new Headers(init?.headers);
  requests.push({
    host: url.host,
    path: url.pathname,
    params: url.searchParams,
    apiKey: headers.get("x-api-key"),
  });

  // ---- Supabase REST (service role): landmark_qloo_map ----
  if (url.host === "supabase.test") {
    assert.equal(url.pathname, "/rest/v1/landmark_qloo_map");
    if (method === "GET") return json(mapRows);
    if (method === "POST") {
      const incoming = JSON.parse(String(init?.body ?? "[]")) as Record<string, unknown>[];
      for (const row of incoming) {
        mapRows = mapRows.filter((r) => r.landmark_id !== row.landmark_id);
        mapRows.push(row);
      }
      return json(incoming, 201);
    }
    return json({ message: "unexpected" }, 500);
  }

  // ---- Qloo ----
  if (qlooStatusOverride) return json({ message: "forbidden" }, qlooStatusOverride);

  if (url.pathname === "/search") {
    const q = url.searchParams.get("query") ?? "";
    const lm = ISTANBUL_LANDMARKS.find((l) => l.aliases.includes(q));
    if (!lm || lm.id === "lm-kadikoy" || lm.id === "lm-bosphorus-cruise") {
      return json({ results: [] });
    }
    if (lm.id === "lm-taksim") {
      // A namesake far from Istanbul must not be accepted.
      return json({
        results: [
          {
            entity_id: "ent-taksim-elsewhere",
            name: "Taksim Square",
            types: ["urn:entity:place"],
            properties: {
              address: "Mersin, Türkiye",
              geocode: { latitude: 36.8, longitude: 34.6 },
            },
          },
        ],
      });
    }
    return json({
      results: [
        placeFor(lm),
        { entity_id: "ent-noise", name: "Unrelated Café", types: ["urn:entity:place"] },
      ],
    });
  }

  if (url.pathname === "/v2/tags") {
    return json({
      results: {
        tags: [
          { id: "urn:tag:genre:place:restaurant", name: "Restaurant", type: "urn:tag:genre:place" },
        ],
      },
    });
  }

  if (url.pathname === "/v2/insights") {
    const shortlist = url.searchParams.get("filter.results.entities");
    if (shortlist) {
      const entities = shortlist.split(",").map((id, i) => ({
        entity_id: id,
        name: id,
        types: ["urn:entity:place"],
        query: {
          affinity: 1 - i * 0.05,
          explainability: {
            "signal.interests.entities": [
              { entity_id: "sig-radiohead", score: 0.7 - i * 0.02 },
              { entity_id: "sig-blade-runner", score: 0.3 },
            ],
          },
        },
      }));
      return json({ results: { entities } });
    }
    assert.ok(url.searchParams.get("filter.location.query")?.endsWith(", Istanbul"));
    assert.equal(url.searchParams.get("filter.tags"), "urn:tag:genre:place:restaurant");
    return json({
      results: {
        entities: [
          {
            entity_id: "rest-1",
            name: "Meyhane Example",
            types: ["urn:entity:place"],
            query: {
              affinity: 0.91,
              explainability: {
                "signal.interests.entities": [{ entity_id: "sig-blade-runner", score: 0.5 }],
              },
            },
            properties: {
              address: "Somewhere 1, Istanbul",
              price_level: 2,
              business_rating: 4.4,
              geocode: { latitude: 41.01, longitude: 28.98 },
            },
            tags: [
              { id: "t1", name: "Restaurant" },
              { id: "t2", name: "Turkish cuisine" },
            ],
          },
          {
            entity_id: "rest-2",
            name: "Second Place",
            types: ["urn:entity:place"],
            query: { affinity: 0.5 },
            tags: [],
          },
        ],
      },
    });
  }
  return json({ error: "unexpected" }, 500);
}) as typeof fetch;

const NOW = Date.now();
const fakeDb = {
  from: () => {
    const rows = [
      {
        id: "ev-near",
        title: "Vinyl night",
        starts_at: new Date(NOW + 86400e3).toISOString(),
        venue: "Galata",
        category: "music",
        latitude: 41.0086,
        longitude: 28.9805,
        tags: ["demo"],
        organizations: { name: "Vinyl Beyoğlu" },
      },
      {
        id: "ev-far",
        title: "Kadıköy run",
        starts_at: new Date(NOW + 86400e3).toISOString(),
        venue: "Moda",
        category: "sports",
        latitude: 40.988,
        longitude: 29.03,
        tags: ["demo"],
        organizations: { name: "Run Crew" },
      },
    ];
    const chain: Record<string, unknown> = {};
    for (const m of ["select", "gte", "lte", "neq", "not", "order"]) chain[m] = () => chain;
    chain.limit = async () => ({ data: rows, error: null });
    return chain;
  },
};

const qlooCallsByPath = () =>
  requests
    .filter((r) => r.host !== "supabase.test")
    .reduce<Record<string, number>>((acc, r) => ((acc[r.path] = (acc[r.path] ?? 0) + 1), acc), {});

test("fixed plan: maps landmarks, ranks, finds restaurants and gatherings, never leaks a secret", async () => {
  const plan = await runGuideAgent({ db: fakeDb as never, taste: TASTE });

  assert.equal(plan.mode, "fixed");
  assert.match(plan.notice ?? "", /not configured/);
  assert.equal(plan.picks.length, 3);
  assert.equal(plan.picks[0].landmarkId, "lm-hagia-sophia"); // first mapped id → highest mocked affinity
  assert.equal(plan.picks[0].qlooRank, 1);
  assert.deepEqual(plan.picks[0].drivers, ["Radiohead", "Blade Runner"]);
  assert.equal(plan.picks[0].hook, undefined); // no model → no AI note

  // Unmatched: Kadıköy and the ferry (no results), Taksim (namesake far away).
  assert.deepEqual([...plan.unmatchedLandmarkIds].sort(), [
    "lm-bosphorus-cruise",
    "lm-kadikoy",
    "lm-taksim",
  ]);
  assert.equal(mapRows.length, ISTANBUL_LANDMARKS.length, "every outcome is cached in the table");

  assert.equal(plan.dining?.landmarkId, "lm-hagia-sophia");
  assert.equal(plan.dining?.district, "Sultanahmet");
  assert.equal(plan.dining?.restaurants[0].name, "Meyhane Example");
  assert.deepEqual(plan.dining?.drivers["rest-1"], ["Blade Runner"]);

  assert.equal(plan.gatherings?.events.length, 1);
  assert.equal(plan.gatherings?.events[0].id, "ev-near");
  assert.equal(plan.gatherings?.events[0].sample, true);

  assert.deepEqual(
    plan.trace.filter((t) => t.kind === "tool").map((t) => t.name),
    ["rank_landmarks", "restaurants_near", "gatherings_near"],
  );

  // Qloo calls: 13 matched landmarks × 1 search + 3 unmatched × 2 aliases = 19, then rank, tags, places.
  assert.deepEqual(qlooCallsByPath(), { "/search": 19, "/v2/insights": 2, "/v2/tags": 1 });
  assert.ok(
    requests
      .filter((r) => r.host !== "supabase.test")
      .every((r) => r.apiKey === "offline-test-key"),
  );
  const serialised = JSON.stringify(plan);
  assert.ok(!serialised.includes("offline-test-key"), "plan must not contain the Qloo key");
  assert.ok(!serialised.includes("offline-service-role"), "plan must not contain the service role");
  const rank = requests.find((r) => r.params.has("filter.results.entities"));
  assert.equal(rank?.params.get("signal.interests.entities"), "sig-blade-runner,sig-radiohead");
  assert.equal(rank?.params.get("feature.explainability"), "true");
});

test("second run: landmark map comes from the table, ranking from the cache — no new Qloo calls", async () => {
  const before = qlooCallsByPath();
  const plan = await runGuideAgent({ db: fakeDb as never, taste: TASTE });
  assert.equal(plan.picks.length, 3);
  assert.deepEqual(qlooCallsByPath(), before);
});

test("Qloo auth failure propagates as QlooAuthError (planVisit maps it to qloo_auth)", async () => {
  mapRows = [];
  qlooStatusOverride = 403;
  try {
    await assert.rejects(
      runGuideAgent({ db: fakeDb as never, taste: [{ entityId: "sig-new", name: "New Signal" }] }),
      (error: unknown) => error instanceof Error && error.name === "QlooAuthError",
    );
  } finally {
    qlooStatusOverride = null;
  }
});
