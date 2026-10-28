// Qloo-backed server functions for the taste-aware guide. Same pattern as the
// rest of src/lib/*.functions.ts: createServerFn + requireSupabaseAuth + zod.
// Only server functions are exported from here (plain helpers live in
// *.server.ts files so they can never be pulled into the client bundle).
//
// Only taste terms, Qloo entity/tag ids and a neighbourhood name are sent to
// Qloo — never the user's identity or GPS position (hackathon kit, SAFE_USE.md).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type {
  LandmarkPick,
  LandmarkQlooRow,
  LandmarkStatusRow,
  QlooOutcome,
  QlooStatus,
  RecommendPlacesResult,
  RestaurantsResult,
  TasteCandidate,
} from "./guide.types";
import { ISTANBUL_LANDMARKS } from "./istanbul-landmarks";
import { QLOO_ENTITY_PLACE, type QlooCall } from "./qloo.schemas";
import {
  cached,
  DEFAULT_QLOO_BASE_URL,
  qlooErrorCode,
  qlooPlacesNear,
  qlooSearch,
} from "./qloo.server";
import { getLandmarkQlooMap, readLandmarkQlooMap } from "./qloo-landmarks.server";
import {
  rankLandmarks,
  restaurantTagIds,
  restaurantsNear,
  runQloo,
  toRestaurant,
} from "./qloo-guide.server";

const EntityIds = z.array(z.string().min(1).max(120)).min(1).max(10);
const LandmarkId = z
  .string()
  .refine((id) => ISTANBUL_LANDMARKS.some((l) => l.id === id), "Unknown landmark");
const District = z
  .string()
  .refine((d) => ISTANBUL_LANDMARKS.some((l) => l.district === d), "Unknown district");

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
    return runQloo(calls, async () => {
      const unique = Array.from(new Set(data.terms.map((t) => t.trim()))).slice(0, 10);
      const candidates: TasteCandidate[] = [];
      for (const term of unique) {
        const matches = await cached(`search:${term.toLowerCase()}`, () =>
          qlooSearch({ query: term, take: 5 }, calls),
        );
        candidates.push({ term, matches });
      }
      return candidates;
    });
  });

/** Rank Agora's curated landmarks against the user's confirmed Qloo entities. */
export const recommendPlaces = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ entityIds: EntityIds }).parse(d))
  .handler(async ({ data }): Promise<QlooOutcome<RecommendPlacesResult>> => {
    const calls: QlooCall[] = [];
    return runQloo(calls, async () => {
      const { picks, unmatchedLandmarkIds } = await rankLandmarks(data.entityIds, calls);
      return { picks, unmatchedLandmarkIds };
    });
  });

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
    return runQloo(calls, () =>
      restaurantsNear(data.landmarkId, data.entityIds, data.limit, calls),
    );
  });

// ---------------------------------------------------------------------------
// Diagnostics (/app/qloo-status). Signed-in users only; every call is bounded
// and cached, and nothing here can force a re-resolution of the whole map.
// ---------------------------------------------------------------------------

function withTitles(map: Map<string, LandmarkQlooRow>): LandmarkStatusRow[] {
  return ISTANBUL_LANDMARKS.map((l) => {
    const row = map.get(l.id);
    return {
      landmarkId: l.id,
      title: l.title,
      district: l.district,
      entityId: row?.entityId ?? null,
      entityName: row?.entityName ?? null,
      entityAddress: row?.entityAddress ?? null,
      confidence: row?.confidence ?? "none",
      note: row ? row.note : "not looked up yet",
      candidates: row?.candidates ?? [],
      resolvedAt: row?.resolvedAt ?? "",
    };
  });
}

/** Is the key configured, does one live call succeed, and what does the landmark map look like? */
export const getQlooStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<QlooStatus> => {
    const calls: QlooCall[] = [];
    const configured = Boolean(process.env.QLOO_API_KEY);
    let host: string;
    try {
      host = new URL(
        process.env.QLOO_BASE_URL ?? process.env.QLOO_API_BASE_URL ?? DEFAULT_QLOO_BASE_URL,
      ).host;
    } catch {
      host = "invalid QLOO_BASE_URL";
    }
    let probe: QlooStatus["probe"] = null;
    if (configured) {
      try {
        const found = await cached("status:probe", () =>
          qlooSearch({ query: "Hagia Sophia", types: [QLOO_ENTITY_PLACE], take: 3 }, calls),
        );
        probe = { ok: true, resultCount: found.length, top: found.map((e) => e.name) };
      } catch (error) {
        probe = { ok: false, error: qlooErrorCode(error) };
      }
    }
    const map = await readLandmarkQlooMap();
    return { configured, host, probe, landmarks: withTitles(map), calls };
  });

/** Look up landmarks that have never been mapped (or "none" older than three days). */
export const resolveLandmarkMap = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<QlooOutcome<LandmarkStatusRow[]>> => {
    const calls: QlooCall[] = [];
    return runQloo(calls, async () => withTitles(await getLandmarkQlooMap(calls)));
  });

export type DebugRankResult = {
  taste: { entityId: string; name: string; types: string[] } | null;
  picks: LandmarkPick[];
  unmatchedLandmarkIds: string[];
};

/** One taste term → top Qloo entity → landmark ranking with raw explainability, for tuning the UI. */
export const debugRank = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ term: z.string().trim().min(1).max(80) }).parse(d))
  .handler(async ({ data }): Promise<QlooOutcome<DebugRankResult>> => {
    const calls: QlooCall[] = [];
    return runQloo(calls, async () => {
      const matches = await cached(`search:${data.term.toLowerCase()}`, () =>
        qlooSearch({ query: data.term, take: 5 }, calls),
      );
      const taste = matches[0];
      if (!taste) return { taste: null, picks: [], unmatchedLandmarkIds: [] };
      const { picks, unmatchedLandmarkIds } = await rankLandmarks([taste.entityId], calls);
      return {
        taste: { entityId: taste.entityId, name: taste.name, types: taste.types },
        picks,
        unmatchedLandmarkIds,
      };
    });
  });

/** What Qloo knows about restaurants in one district (popularity only, no taste signal). */
export const probeDistrictRestaurants = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ district: District }).parse(d))
  .handler(async ({ data }): Promise<QlooOutcome<RestaurantsResult>> => {
    const calls: QlooCall[] = [];
    return runQloo(calls, async () => {
      const tagIds = await restaurantTagIds(calls);
      const places = await cached(`probe:${data.district}:${tagIds.join("|")}`, () =>
        qlooPlacesNear(
          { locationQuery: `${data.district}, Istanbul`, tagIds, take: 6, explain: false },
          calls,
        ),
      );
      return {
        district: data.district,
        restaurantTagIds: tagIds,
        restaurants: places.map((p) => toRestaurant(p, data.district)),
      };
    });
  });
