// Shared Qloo types and lenient response schemas. Safe for the client bundle:
// no credentials, no network. The server-only transport lives in qloo.server.ts.
import { z } from "zod";

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

const Geocode = z
  .object({
    latitude: z.number().optional(),
    longitude: z.number().optional(),
  })
  .passthrough();

const Image = z.union([z.string(), z.object({ url: z.string().optional() }).passthrough()]);

/**
 * Only the fields Agora reads. `passthrough()` keeps the rest of Qloo's payload so
 * the redacted "request → result" trace can show it without us guessing the schema.
 */
export const QlooEntitySchema = z
  .object({
    entity_id: z.string().optional(),
    id: z.string().optional(),
    name: z.string(),
    type: z.string().optional(),
    subtype: z.string().optional(),
    types: z.array(z.string()).optional(),
    popularity: z.number().optional(),
    affinity: z.number().optional(),
    disambiguation: z.string().optional(),
    location: z
      .object({
        lat: z.number().optional(),
        lon: z.number().optional(),
        latitude: z.number().optional(),
        longitude: z.number().optional(),
      })
      .passthrough()
      .optional(),
    query: z
      .object({
        affinity: z.number().optional(),
        explainability: z.unknown().optional(),
      })
      .passthrough()
      .optional(),
    properties: z
      .object({
        description: z.string().optional(),
        short_description: z.string().optional(),
        image: Image.optional(),
        address: z.string().optional(),
        geocode: Geocode.optional(),
        price_level: z.number().optional(),
        business_rating: z.number().optional(),
        website: z.string().optional(),
        phone: z.string().optional(),
        keywords: z.array(z.unknown()).optional(),
      })
      .passthrough()
      .optional(),
    tags: z
      .array(
        z
          .object({
            id: z.string().optional(),
            tag_id: z.string().optional(),
            name: z.string().optional(),
            type: z.string().optional(),
          })
          .passthrough(),
      )
      .optional(),
  })
  .passthrough();

export type QlooEntityRaw = z.infer<typeof QlooEntitySchema>;

export const QlooTagSchema = z
  .object({
    id: z.string().optional(),
    tag_id: z.string().optional(),
    name: z.string(),
    type: z.string().optional(),
    subtype: z.string().optional(),
  })
  .passthrough();

export type QlooTagRaw = z.infer<typeof QlooTagSchema>;

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

export type QlooTag = { id: string; name: string; type?: string };

/**
 * One redacted Qloo call for the "how Agora decided" trace and the Devpost
 * request → result explanation. Never contains the API key.
 */
export type QlooCall = {
  endpoint: string;
  params: Record<string, string>;
  status: number;
  ms: number;
  resultCount?: number;
  topResults?: { name: string; entityId: string }[];
  error?: string;
};

export function normalizeEntity(raw: QlooEntityRaw): QlooEntity | null {
  const entityId = raw.entity_id ?? raw.id;
  if (!entityId) return null;
  const props = raw.properties;
  const image = props?.image;
  const imageUrl = typeof image === "string" ? image : image?.url;
  const geo = props?.geocode;
  const loc = raw.location;
  const lat = geo?.latitude ?? loc?.lat ?? loc?.latitude;
  const lon = geo?.longitude ?? loc?.lon ?? loc?.longitude;
  const geoText = geo
    ? Object.values(geo as Record<string, unknown>).filter(
        (v): v is string => typeof v === "string",
      )
    : [];
  const locationText = [props?.address, ...geoText].filter(Boolean).join(" · ") || undefined;
  const types = raw.types ?? (raw.type ? [raw.type] : []);
  return {
    entityId,
    name: raw.name,
    types,
    popularity: raw.popularity,
    affinity: raw.affinity ?? raw.query?.affinity,
    disambiguation: raw.disambiguation,
    explainability:
      raw.query?.explainability === undefined ? undefined : boundJson(raw.query.explainability),
    description: props?.short_description ?? props?.description,
    imageUrl,
    address: props?.address,
    locationText,
    geocode:
      typeof lat === "number" && typeof lon === "number"
        ? { latitude: lat, longitude: lon }
        : undefined,
    priceLevel: props?.price_level,
    rating: props?.business_rating,
    tags: (raw.tags ?? [])
      .map((t) => ({ id: t.id ?? t.tag_id ?? "", name: t.name ?? "", type: t.type }))
      .filter((t) => t.id && t.name),
  };
}

export function normalizeTag(raw: QlooTagRaw): QlooTag | null {
  const id = raw.id ?? raw.tag_id;
  if (!id) return null;
  return { id, name: raw.name, type: raw.type ?? raw.subtype };
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
