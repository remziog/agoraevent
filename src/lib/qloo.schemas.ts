// Shared Qloo types and tolerant response readers. Safe for the client bundle:
// no credentials, no network. The server-only transport lives in qloo.server.ts.

/** JSON-serialisable value — TanStack Start server functions can only return these. */
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

/** Entity types we use. Full list: GET /v2/tags/types or the Qloo docs. */
export const QLOO_ENTITY_PLACE = "urn:entity:place";
export const QLOO_ENTITY_LOCALITY = "urn:entity:locality";

/** Normalised entity used by the UI and the agent tools. */
export type QlooEntity = {
  entityId: string;
  name: string;
  types: string[];
  popularity?: number;
  affinity?: number;
  disambiguation?: string;
  /** Raw `query.explainability` from `feature.explainability=true`, if present. */
  explainability?: JsonValue;
  description?: string;
  imageUrl?: string;
  address?: string;
  /** Address plus the text fields of `properties.geocode` (city, region, country) — used to check "is this in Istanbul?". */
  locationText?: string;
  geocode?: { latitude: number; longitude: number };
  priceLevel?: number;
  rating?: number;
  tags: { id: string; name: string; type?: string }[];
};

export type QlooTag = {
  id: string;
  name: string;
  type?: string;
  /** Entity types this tag applies to (from `parents[].type`), e.g. "urn:entity:place". */
  parentTypes: string[];
};

/** Entity types Qloo's /search accepts in `types` (from the official harness's type table). */
export const QLOO_SEARCH_TYPES = {
  artist: "urn:entity:artist",
  book: "urn:entity:book",
  brand: "urn:entity:brand",
  movie: "urn:entity:movie",
  person: "urn:entity:person",
  place: "urn:entity:place",
  podcast: "urn:entity:podcast",
  tv_show: "urn:entity:tv_show",
  videogame: "urn:entity:videogame",
  locality: "urn:entity:locality",
  actor: "urn:entity:actor",
  album: "urn:entity:album",
  author: "urn:entity:author",
  director: "urn:entity:director",
} as const;

/**
 * One redacted Qloo call for the "how Agora decided" trace and the Devpost
 * request → result explanation. Never contains the API key.
 */
export type QlooCall = {
  endpoint: string;
  /** Host that answered (api.qloo.com or hackathon.api.qloo.com). */
  host?: string;
  params: Record<string, string>;
  status: number;
  ms: number;
  /** Usable results after parsing (entities with an id and a name, or tags with an id). */
  resultCount?: number;
  /** Items in Qloo's raw result array, before parsing. Differs from resultCount when items were unreadable. */
  upstreamCount?: number;
  /** Items dropped while parsing (no id / no name). */
  rejectedCount?: number;
  /** For shortlist rankings: how many parsed results belong to the shortlist Agora sent. */
  matchedCount?: number;
  topResults?: { name: string; entityId: string }[];
  error?: string;
};

// --- Tolerant readers -------------------------------------------------------
// Qloo's payload differs between endpoints and hosts (nulls instead of missing
// fields, strings where numbers are expected, extra shapes). Validating the
// whole array with a strict schema made ONE odd item discard EVERY result —
// which is what turned a successful /v2/insights answer into "0 landmarks"
// in the taste guide. Each entity is now read on its own with field-level
// tolerance: only an id and a name are required.

const asRecord = (v: unknown): Record<string, unknown> | undefined =>
  v !== null && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : undefined;
const asString = (v: unknown): string | undefined =>
  typeof v === "string" && v.trim().length > 0 ? v : undefined;
const asNumber = (v: unknown): number | undefined => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  return undefined;
};
const asStringArray = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

export function normalizeEntity(input: unknown): QlooEntity | null {
  const raw = asRecord(input);
  if (!raw) return null;
  const entityId = asString(raw.entity_id) ?? asString(raw.id);
  const name = asString(raw.name);
  if (!entityId || !name) return null;

  const props = asRecord(raw.properties);
  const query = asRecord(raw.query);
  const image = props?.image;
  const imageUrl = asString(image) ?? asString(asRecord(image)?.url);
  const geo = asRecord(props?.geocode);
  const loc = asRecord(raw.location);
  const lat = asNumber(geo?.latitude) ?? asNumber(loc?.lat) ?? asNumber(loc?.latitude);
  const lon = asNumber(geo?.longitude) ?? asNumber(loc?.lon) ?? asNumber(loc?.longitude);
  const geoText = geo ? Object.values(geo).filter((v): v is string => typeof v === "string") : [];
  const address = asString(props?.address);
  const locationText = [address, ...geoText].filter(Boolean).join(" · ") || undefined;
  const types = asStringArray(raw.types);
  const singleType = asString(raw.type);
  if (types.length === 0 && singleType) types.push(singleType);
  const subtype = asString(raw.subtype);
  if (subtype && !types.includes(subtype)) types.push(subtype);
  const tags = Array.isArray(raw.tags)
    ? raw.tags
        .map((t) => {
          const r = asRecord(t);
          return {
            id: asString(r?.id) ?? asString(r?.tag_id) ?? "",
            name: asString(r?.name) ?? "",
            type: asString(r?.type),
          };
        })
        .filter((t) => t.id && t.name)
    : [];

  return {
    entityId,
    name,
    types,
    popularity: asNumber(raw.popularity),
    affinity: asNumber(raw.affinity) ?? asNumber(query?.affinity),
    disambiguation: asString(raw.disambiguation),
    explainability:
      query?.explainability === undefined || query?.explainability === null
        ? undefined
        : boundJson(query.explainability),
    description: asString(props?.short_description) ?? asString(props?.description),
    imageUrl,
    address,
    locationText,
    geocode: lat !== undefined && lon !== undefined ? { latitude: lat, longitude: lon } : undefined,
    priceLevel: asNumber(props?.price_level),
    rating: asNumber(props?.business_rating),
    tags,
  };
}

/** Result of reading an entity list: how many items Qloo sent vs. how many were usable. */
export type ParsedEntities = {
  entities: QlooEntity[];
  /** Items in Qloo's result array before any parsing. */
  upstreamCount: number;
  /** Items dropped because they had no id or no name. */
  rejectedCount: number;
};

export function parseEntityList(payload: unknown): ParsedEntities {
  const items = pickResultArray(payload, "entities");
  const entities: QlooEntity[] = [];
  let rejectedCount = 0;
  for (const item of items) {
    const e = normalizeEntity(item);
    if (e) entities.push(e);
    else rejectedCount++;
  }
  return { entities, upstreamCount: items.length, rejectedCount };
}

export function normalizeTag(input: unknown): QlooTag | null {
  const raw = asRecord(input);
  if (!raw) return null;
  const id = asString(raw.id) ?? asString(raw.tag_id);
  const name = asString(raw.name);
  if (!id || !name) return null;
  const parentTypes = Array.isArray(raw.parents)
    ? Array.from(
        new Set(
          raw.parents
            .map((p) => asString(asRecord(p)?.type))
            .filter((t): t is string => typeof t === "string"),
        ),
      )
    : [];
  return { id, name, type: asString(raw.type) ?? asString(raw.subtype), parentTypes };
}

/** Bound an arbitrary JSON payload (depth, array length, keys, string length) before it crosses the wire or reaches a model. */
export function boundJson(value: unknown, depth = 0): JsonValue {
  if (value === null || typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "string") return value.length > 300 ? `${value.slice(0, 300)}…` : value;
  if (depth >= 6) return "[…]";
  if (Array.isArray(value)) return value.slice(0, 12).map((v) => boundJson(v, depth + 1));
  if (typeof value === "object") {
    const out: { [key: string]: JsonValue } = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>).slice(0, 30)) {
      if (v !== undefined) out[k] = boundJson(v, depth + 1);
    }
    return out;
  }
  return null;
}

export type TasteDriver = { entityId: string; name: string; weight?: number };

/**
 * Which of the user's confirmed taste entities Qloo's `feature.explainability`
 * credits for a result, strongest first. Structure-agnostic on purpose: it only
 * reports an entity when the payload names one of `taste` by id, so it can
 * under-report but never invents a reason.
 */
export function explainDrivers(
  explainability: JsonValue | undefined,
  taste: readonly { entityId: string; name: string }[],
): TasteDriver[] {
  if (explainability === undefined || explainability === null) return [];
  const names = new Map(taste.map((t) => [t.entityId, t.name]));
  const weights = new Map<string, number | undefined>();
  const credit = (id: string, weight?: number) => {
    const prev = weights.get(id);
    weights.set(
      id,
      weight === undefined ? prev : Math.max(prev ?? Number.NEGATIVE_INFINITY, weight),
    );
  };
  const visit = (node: JsonValue, depth: number) => {
    if (depth > 8 || node === null) return;
    if (typeof node === "string") {
      if (names.has(node)) credit(node);
      return;
    }
    if (Array.isArray(node)) {
      for (const child of node) visit(child, depth + 1);
      return;
    }
    if (typeof node !== "object") return;
    const record = node as { [key: string]: JsonValue };
    const idValue = [record.entity_id, record.id, record.entity].find(
      (v): v is string => typeof v === "string" && names.has(v),
    );
    if (idValue) {
      const weight = [
        record.score,
        record.weight,
        record.affinity,
        record.contribution,
        record.value,
      ].find((v): v is number => typeof v === "number");
      credit(idValue, weight);
    }
    for (const [key, child] of Object.entries(record)) {
      if (names.has(key)) credit(key, typeof child === "number" ? child : undefined);
      visit(child, depth + 1);
    }
  };
  visit(explainability, 0);
  return [...weights.entries()]
    .map(([entityId, weight]) => ({ entityId, name: names.get(entityId) ?? entityId, weight }))
    .sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0));
}

/** Qloo wraps results as `{ results: [...] }` (search) or `{ results: { entities: [...] } }` (insights). */
export function pickResultArray(payload: unknown, key: "entities" | "tags"): unknown[] {
  if (!payload || typeof payload !== "object") return [];
  const results = (payload as { results?: unknown }).results;
  if (Array.isArray(results)) return results;
  if (results && typeof results === "object") {
    const inner = (results as Record<string, unknown>)[key];
    if (Array.isArray(inner)) return inner;
  }
  return [];
}
