// Shared helper for the Qloo probe scripts. Node >= 22, no dependencies.
// Run with:  node --env-file=.env.local scripts/<script>.mjs
// The key is read from QLOO_API_KEY and is never printed.

export const BASE_URL =
  process.env.QLOO_BASE_URL ?? process.env.QLOO_API_BASE_URL ?? "https://api.qloo.com";

export function requireKey() {
  const key = process.env.QLOO_API_KEY;
  if (!key) {
    console.error(
      "QLOO_API_KEY is not set. Put it in .env.local (never commit) and run with --env-file=.env.local",
    );
    process.exit(2);
  }
  return key;
}

/** GET an endpoint; returns { status, ms, json | text }. Arrays are joined with commas. */
export async function qlooGet(path, params = {}) {
  const key = requireKey();
  const url = new URL(path, BASE_URL);
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    url.searchParams.set(k, Array.isArray(v) ? v.join(",") : String(v));
  }
  const started = Date.now();
  const res = await fetch(url, {
    headers: { "X-Api-Key": key, Accept: "application/json" },
    signal: AbortSignal.timeout(15_000),
  });
  const ms = Date.now() - started;
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    /* not JSON */
  }
  return {
    status: res.status,
    ms,
    json,
    text: text.slice(0, 300),
    url: `${url.origin}${url.pathname}?${redact(url.searchParams)}`,
  };
}

function redact(searchParams) {
  // The key travels in a header, not the query string, but be defensive anyway.
  const copy = new URLSearchParams(searchParams);
  for (const k of [...copy.keys()]) if (/key|token/i.test(k)) copy.set(k, "<redacted>");
  return copy.toString();
}

/** Qloo wraps results as { results: [...] } or { results: { entities: [...] } }. */
export function resultArray(json, key = "entities") {
  const r = json?.results;
  if (Array.isArray(r)) return r;
  if (r && Array.isArray(r[key])) return r[key];
  return [];
}

export function compact(entity) {
  const p = entity?.properties ?? {};
  return {
    entity_id: entity?.entity_id ?? entity?.id,
    name: entity?.name,
    types: entity?.types ?? (entity?.type ? [entity.type] : []),
    popularity: entity?.popularity,
    affinity: entity?.affinity ?? entity?.query?.affinity,
    address: p.address,
    price_level: p.price_level,
    business_rating: p.business_rating,
    has_image: Boolean(p.image),
    has_geocode: Boolean(p.geocode),
  };
}

export function printTable(rows) {
  if (rows.length === 0) {
    console.log("(no rows)");
    return;
  }
  console.table(rows);
}
