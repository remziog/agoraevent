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
const { nameMatch, samePlace, MAP_RULES_VERSION } =
  await import("../src/lib/qloo-landmarks.server");
const { pickRestaurantTags } = await import("../src/lib/qloo-guide.server");

const TASTE = [
  { entityId: "sig-radiohead", name: "Radiohead", type: "artist" },
  { entityId: "sig-blade-runner", name: "Blade Runner", type: "movie" },
];

type Req = { host: string; path: string; params: URLSearchParams; apiKey: string | null };
const requests: Req[] = [];
/** The mocked landmark_qloo_map table: rows the server upserted. */
let mapRows: Record<string, unknown>[] = [];
let qlooStatusOverride: number | null = null;
/** When set, api.qloo.com answers 401 and only hackathon.api.qloo.com accepts the key. */
let rejectDefaultHost = false;
/** When set, /v2/insights shortlist rankings answer with an empty list (a real "Qloo ranked nothing"). */
let emptyRanking = false;

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
  if (rejectDefaultHost && url.host === "api.qloo.com") return json({ error: { code: 401 } }, 401);

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
    if (lm.id === "lm-ortakoy") {
      // The live bug (AG-02): a same-named mosque in Silivri whose address says
      // "Istanbul" comes first; only the one at the pin may be accepted.
      return json({
        results: [
          {
            entity_id: "ent-ortakoy-silivri",
            name: "Ortakoy Mosque",
            types: ["urn:entity:place"],
            properties: {
              address: "Selimpaşa 34590 Silivri/Istanbul - Europe Türkiye",
              geocode: { latitude: 41.06, longitude: 28.37, city: "Istanbul" },
            },
          },
          placeFor(lm),
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
    // Café / coffee-shop lookups (excluded from restaurant answers): one place tag each.
    const q = url.searchParams.get("filter.query") ?? "";
    if (/coffee|cafe/i.test(q)) {
      return json({
        results: {
          tags: [
            {
              id: `urn:tag:genre:place:${q.replace(/\s+/g, "_")}`,
              name: q === "cafe" ? "Cafe" : "Coffee Shop",
              type: "urn:tag:genre:place",
              parents: [{ type: "urn:entity:place" }],
            },
          ],
        },
      });
    }
    // The live answer put a product/service tag first; the place-scoped one must win.
    return json({
      results: {
        tags: [
          {
            id: "urn:tag:product_service:qloo:restaurant_dining",
            name: "Restaurant Dining",
            type: "urn:tag:product_service",
            parents: [{ type: "urn:entity:brand" }],
          },
          {
            id: "urn:tag:genre:place:restaurant",
            name: "Restaurant",
            type: "urn:tag:genre:place",
            parents: [{ type: "urn:entity:place" }],
          },
        ],
      },
    });
  }

  if (url.pathname === "/v2/insights") {
    const shortlist = url.searchParams.get("filter.results.entities");
    if (shortlist) {
      if (emptyRanking) return json({ results: { entities: [] } });
      const entities: unknown[] = shortlist.split(",").map((id, i) => ({
        entity_id: id,
        name: id,
        types: ["urn:entity:place"],
        // Fields Qloo sends as null or as strings must not break parsing.
        disambiguation: null,
        popularity: "0.5",
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
      // One unreadable item (no name) used to discard the whole answer (F-02).
      entities.push({ entity_id: "ent-broken", name: null });
      return json({ results: { entities } });
    }
    assert.ok(url.searchParams.get("filter.location.query")?.endsWith(", Istanbul"));
    assert.equal(url.searchParams.get("filter.tags"), "urn:tag:genre:place:restaurant");
    // Cafés are excluded from a restaurant answer (dinner ≠ coffee).
    assert.equal(
      url.searchParams.get("filter.exclude.tags"),
      "urn:tag:genre:place:coffee_shop,urn:tag:genre:place:cafe",
    );
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

test("matching rules: one-word aliases need an exact name; coordinates decide identity", () => {
  assert.equal(nameMatch("Moda Kayıkhane", ["Moda", "Kadıköy"]), "none");
  assert.equal(nameMatch("Moda", ["Moda", "Kadıköy"]), "exact");
  assert.equal(nameMatch("Galata Tower Museum", ["Galata Tower", "Galata Kulesi"]), "contains");
  assert.equal(nameMatch("Ortakoy Mosque", ["Ortakoy Mosque", "Büyük Mecidiye Camii"]), "exact");
  const ortakoy = {
    latitude: 41.0475,
    longitude: 29.0268,
    district: "Ortaköy",
    kind: "place" as const,
  };
  // Same name, 55 km away, address says "Istanbul" → not the same place.
  assert.equal(
    samePlace(
      {
        geocode: { latitude: 41.06, longitude: 28.37 },
        locationText: "Selimpaşa · Silivri · Istanbul",
      },
      ortakoy,
    ).ok,
    false,
  );
  assert.equal(samePlace({ geocode: { latitude: 41.048, longitude: 29.027 } }, ortakoy).ok, true);
  // No coordinates: the address must name the neighbourhood/district, not just the city.
  assert.equal(samePlace({ locationText: "Istanbul, Türkiye" }, ortakoy).ok, false);
  assert.equal(samePlace({ locationText: "Mecidiye, Beşiktaş/İstanbul" }, ortakoy).ok, true);
});

test("restaurant tag: place-scoped, exact 'restaurant' first; product/service tags last", () => {
  const picked = pickRestaurantTags([
    {
      id: "urn:tag:product_service:qloo:restaurant_dining",
      name: "Restaurant Dining",
      parentTypes: ["urn:entity:brand"],
    },
    {
      id: "urn:tag:keyword:place:fine_dining",
      name: "Fine dining restaurant",
      parentTypes: ["urn:entity:place"],
    },
    { id: "urn:tag:genre:place:restaurant", name: "Restaurant", parentTypes: ["urn:entity:place"] },
  ]);
  assert.deepEqual(
    picked.map((t) => t.id),
    ["urn:tag:genre:place:restaurant", "urn:tag:keyword:place:fine_dining"],
  );
  // Without parent metadata nothing is scoped away, but product/service tags still rank last.
  const loose = pickRestaurantTags([
    {
      id: "urn:tag:product_service:qloo:restaurant_dining",
      name: "Restaurant Dining",
      parentTypes: [],
    },
    { id: "urn:tag:genre:place:restaurant", name: "Restaurant", parentTypes: [] },
  ]);
  assert.equal(loose[0].id, "urn:tag:genre:place:restaurant");
});

test("fixed plan: maps landmarks, ranks, finds restaurants and gatherings, never leaks a secret", async () => {
  // A row written by the old rules (the Silivri namesake accepted as EXACT) must be re-resolved.
  mapRows = [
    {
      landmark_id: "lm-ortakoy",
      entity_id: "ent-ortakoy-silivri",
      entity_name: "Ortakoy Mosque",
      entity_address: "Selimpaşa 34590 Silivri/Istanbul",
      confidence: "exact",
      note: 'matched "Ortakoy Mosque"',
      candidates: [],
      resolved_at: new Date().toISOString(),
    },
  ];
  const plan = await runGuideAgent({ db: fakeDb as never, taste: TASTE });

  assert.equal(plan.mode, "fixed");
  assert.equal(plan.execution.agentOutcome, "not_configured");
  assert.equal(plan.execution.ranking, "ranked");
  assert.equal(plan.execution.fallbackUsed, true);
  assert.match(plan.notice ?? "", /not configured/);
  assert.equal(plan.picks.length, 3);
  assert.equal(plan.picks[0].source, "qloo");
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
  const ortakoyRow = mapRows.find((r) => r.landmark_id === "lm-ortakoy");
  assert.equal(
    ortakoyRow?.entity_id,
    "ent-lm-ortakoy",
    "the namesake in Silivri is replaced by the mosque at the pin",
  );
  assert.ok(String(ortakoyRow?.note).startsWith(`[v${MAP_RULES_VERSION}]`));

  // The unreadable item in Qloo's answer is dropped, the rest is ranked.
  assert.deepEqual(plan.execution.rankingCounts, { upstream: 14, parsed: 13, matched: 13 });

  assert.equal(plan.dining?.landmarkId, "lm-hagia-sophia");
  assert.equal(plan.dining?.district, "Sultanahmet");
  assert.equal(plan.dining?.scope, "restaurants");
  assert.deepEqual(plan.dining?.restaurantTagIds, ["urn:tag:genre:place:restaurant"]);
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
  // tags: restaurant + the two café words excluded from restaurant answers
  assert.deepEqual(qlooCallsByPath(), { "/search": 19, "/v2/insights": 2, "/v2/tags": 3 });
  const rankCall = plan.trace
    .find((t) => t.name === "rank_landmarks")
    ?.qloo?.find((c) => c.endpoint === "/v2/insights");
  assert.equal(rankCall?.upstreamCount, 14);
  assert.equal(rankCall?.resultCount, 13);
  assert.equal(rankCall?.rejectedCount, 1);
  assert.equal(rankCall?.matchedCount, 13);
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

test("empty Qloo ranking: no dead end — editorial landmarks (unbadged), Qloo restaurants, city-wide gatherings", async () => {
  emptyRanking = true;
  try {
    const plan = await runGuideAgent({
      db: fakeDb as never,
      taste: [{ entityId: "sig-nobody", name: "Nobody Known" }],
    });
    assert.equal(plan.execution.ranking, "empty");
    assert.deepEqual(plan.execution.rankingCounts, { upstream: 0, parsed: 0, matched: 0 });
    assert.equal(plan.picks.length, 3);
    assert.ok(plan.picks.every((p) => p.source === "editorial" && p.qlooRank === 0));
    assert.match(plan.notice ?? "", /editorial/);
    assert.equal(plan.gatherings?.landmarkId, null, "city-wide when there is no Qloo pick");
    assert.equal(plan.gatherings?.events.length, 2);
    assert.equal(plan.dining?.restaurants.length, 2, "restaurants are still Qloo-ranked by taste");
    assert.ok(plan.trace.some((t) => t.name === "editorial_fallback"));
  } finally {
    emptyRanking = false;
  }
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

test("a key provisioned only on hackathon.api.qloo.com: auth failure on the default host falls back and is remembered", async () => {
  mapRows = [];
  rejectDefaultHost = true;
  try {
    const before = requests.length;
    const plan = await runGuideAgent({ db: fakeDb as never, taste: TASTE });
    assert.equal(plan.picks.length, 3);
    const qloo = requests.slice(before).filter((r) => r.host !== "supabase.test");
    assert.ok(
      qloo.some((r) => r.host === "api.qloo.com"),
      "default host tried first",
    );
    assert.ok(
      qloo.some((r) => r.host === "hackathon.api.qloo.com"),
      "then the hackathon host",
    );
    // The resolver starts 3 searches at once, so up to 3 may hit the default host before the
    // first rejection is remembered; everything after that goes straight to the accepted host.
    const defaultHits = qloo.filter((r) => r.host === "api.qloo.com").length;
    assert.ok(defaultHits >= 1 && defaultHits <= 3, `default host hits: ${defaultHits}`);
    const rankStep = plan.trace.find((t) => t.name === "rank_landmarks");
    assert.ok(rankStep?.qloo?.some((c) => c.error?.includes("trying hackathon.api.qloo.com")));
    assert.ok(rankStep?.qloo?.every((c) => !JSON.stringify(c).includes("offline-test-key")));
  } finally {
    rejectDefaultHost = false;
  }
});
