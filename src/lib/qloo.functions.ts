// Qloo-backed server functions for the taste-aware guide. Same pattern as the
// rest of src/lib/*.functions.ts: createServerFn + requireSupabaseAuth + zod.
//
// Only taste terms, Qloo entity/tag ids and a neighbourhood name are sent to
// Qloo — never the user's identity or GPS position (hackathon kit, SAFE_USE.md).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ISTANBUL_LANDMARKS } from "./istanbul-landmarks";
import type { JsonValue, QlooCall, QlooEntity, QlooTag } from "./qloo.schemas";
import {
  cached,
  qlooErrorCode,
  qlooFindTags,
  qlooPlacesNear,
  qlooRankShortlist,
  qlooSearch,
} from "./qloo.server";

export type QlooErrorCode = ReturnType<typeof qlooErrorCode>;

/** Every Qloo-backed function returns this shape so the UI can show provenance or degrade honestly. */
export type QlooOutcome<T> =
  | { ok: true; data: T; calls: QlooCall[] }
  | { ok: false; error: QlooErrorCode; calls: QlooCall[] };

const EntityIds = z.array(z.string().min(1).max(120)).min(1).max(10);
const LandmarkId = z
  .string()
  .refine((id) => ISTANBUL_LANDMARKS.some((l) => l.id === id), "Unknown landmark");

async function run<T>(calls: QlooCall[], fn: () => Promise<T>): Promise<QlooOutcome<T>> {
  try {
    const data = await fn();
    return { ok: true, data, calls };
  } catch (error) {
    console.error("[qloo]", error instanceof Error ? `${error.name}: ${error.message}` : error);
    return { ok: false, error: qlooErrorCode(error), calls };
  }
}

export type TasteCandidate = { term: string; matches: QlooEntity[] };

/**
 * Resolve free-text taste terms (artists, films, books…) to Qloo entities. The
 * UI shows the candidates and lets the user confirm ambiguous ones before they
 * are used as signals (kit rule: uncertain matches are confirmed, not assumed).
 */
export const resolveTaste = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ terms: z.array(z.string().trim().min(1).max(80)).min(1).max(10) }).parse(d),
  )
  .handler(async ({ data }): Promise<QlooOutcome<TasteCandidate[]>> => {
    const calls: QlooCall[] = [];
    return run(calls, async () => {
      const unique = Array.from(new Set(data.terms.map((t) => t.toLowerCase()))).slice(0, 10);
      const candidates: TasteCandidate[] = [];
      for (const term of unique) {
        const matches = await cached(`search:${term}`, () =>
          qlooSearch({ query: term, take: 5 }, calls),
        );
        candidates.push({ term, matches });
      }
      return candidates;
    });
  });

export type LandmarkPick = {
  landmarkId: string;
  qlooEntityId: string;
  affinity?: number;
  explainability?: JsonValue;
};

export type RecommendPlacesResult = {
  /** Landmarks Qloo could rank, best affinity first. Only these may carry a Qloo badge. */
  picks: LandmarkPick[];
  /** Landmarks with no confident Qloo entity yet (see scripts/qloo-map-landmarks.mjs). */
  unmatchedLandmarkIds: string[];
};

/**
 * Rank Agora's curated landmarks against the user's confirmed Qloo entities
 * (`/v2/insights` + `filter.results.entities`, the harness's `qloo_rank`).
 */
export const recommendPlaces = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ entityIds: EntityIds }).parse(d))
  .handler(async ({ data }): Promise<QlooOutcome<RecommendPlacesResult>> => {
    const calls: QlooCall[] = [];
    return run(calls, async () => {
      const mapped = ISTANBUL_LANDMARKS.filter((l) => l.qloo.entityId);
      const unmatchedLandmarkIds = ISTANBUL_LANDMARKS.filter((l) => !l.qloo.entityId).map(
        (l) => l.id,
      );
      if (mapped.length === 0) return { picks: [], unmatchedLandmarkIds };

      const signal = [...data.entityIds].sort();
      const ranked = await cached(`rank:${signal.join(",")}`, () =>
        qlooRankShortlist(
          {
            resultEntityIds: mapped.map((l) => l.qloo.entityId as string),
            signalEntityIds: signal,
          },
          calls,
        ),
      );

      const byEntity = new Map(mapped.map((l) => [l.qloo.entityId as string, l.id]));
      const picks: LandmarkPick[] = ranked
        .filter((e) => byEntity.has(e.entityId))
        .map((e) => ({
          landmarkId: byEntity.get(e.entityId) as string,
          qlooEntityId: e.entityId,
          affinity: e.affinity,
          explainability: e.explainability,
        }))
        .sort((a, b) => (b.affinity ?? 0) - (a.affinity ?? 0));
      return { picks, unmatchedLandmarkIds };
    });
  });

export type Restaurant = {
  qlooEntityId: string;
  name: string;
  district: string;
  affinity?: number;
  explainability?: JsonValue;
  imageUrl?: string;
  address?: string;
  geocode?: { latitude: number; longitude: number };
  priceLevel?: number;
  rating?: number;
  cuisineTags: string[];
};

export type RestaurantsResult = {
  district: string;
  /** Tag ids used as `filter.tags`, for the trace. */
  restaurantTagIds: string[];
  restaurants: Restaurant[];
};

/** Restaurant tag discovery: `/v2/tags` semantic search, cached for the isolate's lifetime window. */
async function restaurantTagIds(calls: QlooCall[]): Promise<string[]> {
  const configured = (process.env.QLOO_RESTAURANT_TAGS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (configured.length > 0) return configured;
  const tags = await cached<QlooTag[]>("tags:restaurant", () =>
    qlooFindTags({ query: "restaurant", take: 5 }, calls),
  );
  const best = tags.find((t) => /restaurant/i.test(t.name)) ?? tags[0];
  return best ? [best.id] : [];
}

/**
 * Taste-ranked restaurants in the landmark's neighbourhood. Location sent to Qloo
 * is the district name ("Karaköy, Istanbul"), not the user's position.
 */
export const findRestaurantsNearby = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        landmarkId: LandmarkId,
        entityIds: EntityIds,
        limit: z.number().int().min(1).max(6).default(3),
      })
      .parse(d),
  )
  .handler(async ({ data }): Promise<QlooOutcome<RestaurantsResult>> => {
    const calls: QlooCall[] = [];
    return run(calls, async () => {
      const landmark = ISTANBUL_LANDMARKS.find((l) => l.id === data.landmarkId);
      if (!landmark) throw new Error("Unknown landmark");
      const district = landmark.district;
      const tagIds = await restaurantTagIds(calls);
      const signal = [...data.entityIds].sort();
      const places = await cached(
        `places:${district}:${tagIds.join("|")}:${signal.join(",")}`,
        () =>
          qlooPlacesNear(
            {
              locationQuery: `${district}, Istanbul`,
              tagIds,
              signalEntityIds: signal,
              take: 10,
            },
            calls,
          ),
      );
      const restaurants: Restaurant[] = places.slice(0, data.limit).map((p) => ({
        qlooEntityId: p.entityId,
        name: p.name,
        district,
        affinity: p.affinity,
        explainability: p.explainability,
        imageUrl: p.imageUrl,
        address: p.address,
        geocode: p.geocode,
        priceLevel: p.priceLevel,
        rating: p.rating,
        cuisineTags: p.tags.map((t) => t.name).slice(0, 3),
      }));
      return { district, restaurantTagIds: tagIds, restaurants };
    });
  });
