// Server-side building blocks of the taste guide: landmark ranking and
// restaurant lookup. Used by the server functions in qloo.functions.ts and by
// the agent's tools (guide-agent.server.ts). Never imported by client code.
import "@tanstack/react-start/server-only";

import type {
  LandmarkPick,
  LandmarkQlooRow,
  QlooOutcome,
  RecommendPlacesResult,
  Restaurant,
  RestaurantsResult,
} from "./guide.types";
import { ISTANBUL_LANDMARKS } from "./istanbul-landmarks";
import { QLOO_ENTITY_PLACE, type QlooCall, type QlooEntity, type QlooTag } from "./qloo.schemas";
import { getLandmarkQlooMap } from "./qloo-landmarks.server";
import {
  cached,
  qlooErrorCode,
  qlooFindTags,
  qlooPlacesNear,
  qlooRankShortlist,
} from "./qloo.server";

export async function runQloo<T>(calls: QlooCall[], fn: () => Promise<T>): Promise<QlooOutcome<T>> {
  try {
    const data = await fn();
    return { ok: true, data, calls };
  } catch (error) {
    console.error("[qloo]", error instanceof Error ? `${error.name}: ${error.message}` : error);
    return { ok: false, error: qlooErrorCode(error), calls };
  }
}

/** Rank the mapped landmarks for the given taste entities (the harness's `qloo_rank`). */
export async function rankLandmarks(
  signalEntityIds: readonly string[],
  calls: QlooCall[],
): Promise<RecommendPlacesResult & { map: Map<string, LandmarkQlooRow> }> {
  const map = await getLandmarkQlooMap(calls);
  const mapped = ISTANBUL_LANDMARKS.filter((l) => map.get(l.id)?.entityId);
  const unmatchedLandmarkIds = ISTANBUL_LANDMARKS.filter((l) => !map.get(l.id)?.entityId).map(
    (l) => l.id,
  );
  if (mapped.length === 0 || signalEntityIds.length === 0) {
    return { picks: [], unmatchedLandmarkIds, map };
  }
  const signal = [...signalEntityIds].sort();
  const resultEntityIds = mapped.map((l) => map.get(l.id)?.entityId as string);
  const ranked = await cached(`rank:${signal.join(",")}:${resultEntityIds.join(",")}`, () =>
    qlooRankShortlist({ resultEntityIds, signalEntityIds: signal }, calls),
  );
  const byEntity = new Map(mapped.map((l) => [map.get(l.id)?.entityId as string, l.id]));
  const picks: LandmarkPick[] = ranked
    .filter((e) => byEntity.has(e.entityId))
    .map((e) => ({
      landmarkId: byEntity.get(e.entityId) as string,
      qlooEntityId: e.entityId,
      affinity: e.affinity,
      explainability: e.explainability,
    }))
    .sort((a, b) => (b.affinity ?? 0) - (a.affinity ?? 0));
  return { picks, unmatchedLandmarkIds, map };
}

/**
 * Restaurant tag discovery, the way the official harness resolves a tag for a
 * target type: `/v2/tags` semantic search (take 20), keep tags whose
 * `parents[].type` includes `urn:entity:place` when that metadata exists,
 * prefer an exact "restaurant" name, then a place genre/category tag. The
 * first version took the first "restaurant" hit of five, which was
 * `urn:tag:product_service:…:restaurant_dining` — not a place tag — and every
 * district came back empty.
 */
export async function restaurantTagIds(calls: QlooCall[]): Promise<string[]> {
  const configured = (process.env.QLOO_RESTAURANT_TAGS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (configured.length > 0) return configured;
  const tags = await cached<QlooTag[]>("tags:restaurant:v2", () =>
    qlooFindTags({ query: "restaurant", take: 20 }, calls),
  );
  return pickRestaurantTags(tags).map((t) => t.id);
}

const norm = (s: string) => s.trim().toLowerCase();

/** Pure selection so it can be unit-tested. Returns up to 2 tag candidates, best first. */
export function pickRestaurantTags(tags: readonly QlooTag[]): QlooTag[] {
  const withParents = tags.filter((t) => t.parentTypes.length > 0);
  const scoped =
    withParents.length > 0 ? tags.filter((t) => t.parentTypes.includes(QLOO_ENTITY_PLACE)) : tags;
  const pool = scoped.length > 0 ? scoped : tags;
  const score = (t: QlooTag) =>
    (norm(t.name) === "restaurant" ? 100 : 0) +
    (/^urn:tag:(genre|category):place:/.test(t.id) ? 40 : 0) +
    (/^urn:tag:[^:]+:place:/.test(t.id) ? 20 : 0) +
    (/restaurant/i.test(t.name) ? 10 : 0) +
    (/^urn:tag:product_service:/.test(t.id) ? -50 : 0);
  return [...pool]
    .filter((t) => score(t) > 0 || /restaurant/i.test(t.name))
    .sort((a, b) => score(b) - score(a))
    .slice(0, 2);
}

export function toRestaurant(p: QlooEntity, district: string): Restaurant {
  return {
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
  };
}

/**
 * Taste-ranked restaurants in a landmark's neighbourhood (district name, never
 * GPS). Tag candidates are tried one at a time; when none yields a place the
 * result is honestly empty (`scope: "none"`) — Agora never pads it with
 * unrelated places under a "restaurants" heading.
 */
export async function restaurantsNear(
  landmarkId: string,
  signalEntityIds: readonly string[],
  limit: number,
  calls: QlooCall[],
): Promise<RestaurantsResult> {
  const landmark = ISTANBUL_LANDMARKS.find((l) => l.id === landmarkId);
  if (!landmark) throw new Error("Unknown landmark");
  const district = landmark.district;
  const tagIds = await restaurantTagIds(calls);
  const signal = [...signalEntityIds].sort();
  const locationQuery = `${district}, Istanbul`;
  for (const tagId of tagIds.length > 0 ? tagIds : [null]) {
    const places = await cached(`places:${district}:${tagId ?? "-"}:${signal.join(",")}`, () =>
      qlooPlacesNear(
        {
          locationQuery,
          tagIds: tagId ? [tagId] : undefined,
          signalEntityIds: signal,
          take: 10,
        },
        calls,
      ),
    );
    if (places.length > 0) {
      return {
        district,
        restaurantTagIds: tagId ? [tagId] : [],
        scope: tagId ? "restaurants" : "places",
        restaurants: places.slice(0, limit).map((p) => toRestaurant(p, district)),
      };
    }
  }
  return { district, restaurantTagIds: tagIds, scope: "none", restaurants: [] };
}
