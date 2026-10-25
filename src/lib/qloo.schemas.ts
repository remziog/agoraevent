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
  const types = raw.types ?? (raw.type ? [raw.type] : []);
  return {
    entityId,
    name: raw.name,
    types,
    popularity: raw.popularity,
    affinity: raw.affinity ?? raw.query?.affinity,
    disambiguation: raw.disambiguation,
    explainability: raw.query?.explainability as JsonValue | undefined,
    description: props?.short_description ?? props?.description,
    imageUrl,
    address: props?.address,
    geocode:
      geo && typeof geo.latitude === "number" && typeof geo.longitude === "number"
        ? { latitude: geo.latitude, longitude: geo.longitude }
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
