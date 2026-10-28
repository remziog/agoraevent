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
import {
  QLOO_ENTITY_PLACE,
  QLOO_SEARCH_TYPES,
  type QlooCall,
  type QlooEntity,
} from "./qloo.schemas";
import {
  cached,
  qlooAcceptedBaseUrl,
  qlooConfiguredBaseUrl,
  qlooErrorCode,
  QlooError,
  qlooPlacesNear,
  qlooSearch,
} from "./qloo.server";
import type { TasteField } from "./guide.types";

/** Entity types searched first for each guide field (official /search `types` values). */
export const FIELD_TYPES: Record<TasteField, readonly string[]> = {
  music: [QLOO_SEARCH_TYPES.artist],
  film: [QLOO_SEARCH_TYPES.movie, QLOO_SEARCH_TYPES.tv_show],
  book: [QLOO_SEARCH_TYPES.book, QLOO_SEARCH_TYPES.author],
};

const TERM_RE = z.string().trim().min(1).max(80);
const TermInput = z.union([
  TERM_RE,
  z.object({ term: TERM_RE, field: z.enum(["music", "film", "book"]).optional() }),
]);

/**
 * Candidates for one term: the field's own kinds first (one typed /search), the
 * untyped search only when the typed one found nothing (or the host rejected
 * the `types` filter). Other kinds are returned separately so an album or a
 * café named after a film is never the default choice (F-04).
 */
async function candidatesFor(
  term: string,
  field: TasteField | undefined,
  calls: QlooCall[],
): Promise<TasteCandidate> {
  const key = term.toLowerCase();
  const types = field ? FIELD_TYPES[field] : undefined;
  let typed: QlooEntity[] = [];
  let typedFailed = false;
  if (types) {
    try {
      typed = await cached(`search:${field}:${key}`, () =>
        qlooSearch({ query: term, types, take: 5 }, calls),
      );
    } catch (error) {
      if (error instanceof QlooError && error.status === 400) typedFailed = true;
      else throw error;
    }
  }
  if (typed.length > 0 && !typedFailed) {
    return { term, field, matches: typed, others: [] };
  }
  const all = await cached(`search:${key}`, () => qlooSearch({ query: term, take: 5 }, calls));
  if (!types) return { term, field, matches: all, others: [] };
  const own = all.filter((e) => e.types.some((t) => types.includes(t)));
  const others = all.filter((e) => !own.includes(e));
  return { term, field, matches: own, others };
}
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
  .inputValidator((d: unknown) => z.object({ terms: z.array(TermInput).min(1).max(10) }).parse(d))
  .handler(async ({ data }): Promise<QlooOutcome<TasteCandidate[]>> => {
    const calls: QlooCall[] = [];
    return runQloo(calls, async () => {
      const seen = new Set<string>();
      const candidates: TasteCandidate[] = [];
      for (const input of data.terms.slice(0, 10)) {
        const term = typeof input === "string" ? input.trim() : input.term.trim();
        const field = typeof input === "string" ? undefined : input.field;
        const dedupe = `${field ?? ""}:${term.toLowerCase()}`;
        if (seen.has(dedupe)) continue;
        seen.add(dedupe);
        candidates.push(await candidatesFor(term, field, calls));
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
      host = new URL(qlooConfiguredBaseUrl()).host;
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
    // The host that actually accepted the key may differ from the configured one
    // (hackathon credentials live on hackathon.api.qloo.com); say which one answered.
    const accepted = qlooAcceptedBaseUrl();
    if (accepted) {
      const acceptedHost = new URL(accepted).host;
      if (acceptedHost !== host)
        host = `${acceptedHost} (configured: ${host}, which rejected the key)`;
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
      // Same strategy as the guide: each tag candidate in turn, then honestly empty.
      for (const tagId of tagIds.length > 0 ? tagIds : [null]) {
        const places = await cached(`probe:${data.district}:${tagId ?? "-"}`, () =>
          qlooPlacesNear(
            {
              locationQuery: `${data.district}, Istanbul`,
              tagIds: tagId ? [tagId] : undefined,
              take: 6,
              explain: false,
            },
            calls,
          ),
        );
        if (places.length > 0) {
          return {
            district: data.district,
            restaurantTagIds: tagId ? [tagId] : [],
            scope: tagId ? ("restaurants" as const) : ("places" as const),
            restaurants: places.map((p) => toRestaurant(p, data.district)),
          };
        }
      }
      return {
        district: data.district,
        restaurantTagIds: tagIds,
        scope: "none" as const,
        restaurants: [],
      };
    });
  });
