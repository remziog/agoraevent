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
import type { QlooCall, QlooEntity, QlooTag } from "./qloo.schemas";
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

/** Restaurant tag discovery: `/v2/tags` semantic search, cached per isolate. */
export async function restaurantTagIds(calls: QlooCall[]): Promise<string[]> {
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

/** Taste-ranked restaurants in a landmark's neighbourhood (district name, never GPS). */
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
  const places = await cached(`places:${district}:${tagIds.join("|")}:${signal.join(",")}`, () =>
    qlooPlacesNear(
      { locationQuery: `${district}, Istanbul`, tagIds, signalEntityIds: signal, take: 10 },
      calls,
    ),
  );
  return {
    district,
    restaurantTagIds: tagIds,
    restaurants: places.slice(0, limit).map((p) => toRestaurant(p, district)),
  };
}
