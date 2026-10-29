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
  TasteCandidate,
  TasteField,
} from "./guide.types";
import { ISTANBUL_LANDMARKS } from "./istanbul-landmarks";
import {
  QLOO_ENTITY_PLACE,
  QLOO_SEARCH_TYPES,
  type QlooCall,
  type QlooEntity,
  type QlooTag,
} from "./qloo.schemas";
import { getLandmarkQlooMap } from "./qloo-landmarks.server";
import {
  cached,
  QlooError,
  qlooErrorCode,
  qlooFindTags,
  qlooPlacesNear,
  qlooRankShortlist,
  qlooSearch,
} from "./qloo.server";

/** Entity types searched first for each guide field (official /search `types` values). */
export const FIELD_TYPES: Record<TasteField, readonly string[]> = {
  music: [QLOO_SEARCH_TYPES.artist],
  film: [QLOO_SEARCH_TYPES.movie, QLOO_SEARCH_TYPES.tv_show],
  book: [QLOO_SEARCH_TYPES.book, QLOO_SEARCH_TYPES.author],
};

/**
 * Candidates for one term: the field's own kinds first (one typed /search), the
 * untyped search only when the typed one found nothing (or the host rejected
 * the `types` filter). Other kinds are returned separately so an album or a
 * café named after a film is never the default choice (F-04).
 */
export async function candidatesFor(
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

const foldName = (s: string) =>
  s
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .replace(/^(the|a|an|le|la|les|der|die|das)\s+/i, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

/**
 * A taste term the person typed, checked against Qloo's typed search. The top
 * candidate is used only when its name is the term (ignoring case, accents and
 * a leading article); anything else is an open question for the person, never
 * a silent assumption (kit rule, F-04). "Amélie" → the 2001 film is an exact
 * name match; "Christie" → a question with the candidates.
 */
export type TasteCheck =
  | { term: string; field?: TasteField; status: "confirmed"; entity: QlooEntity }
  | { term: string; field?: TasteField; status: "ambiguous"; candidates: QlooEntity[] }
  | { term: string; field?: TasteField; status: "unknown" };

export async function checkTaste(
  term: string,
  field: TasteField | undefined,
  calls: QlooCall[],
): Promise<TasteCheck> {
  const c = await candidatesFor(term, field, calls);
  const pool = c.matches.length > 0 ? c.matches : c.others;
  if (pool.length === 0) return { term, field, status: "unknown" };
  const wanted = foldName(term);
  const exact = pool.filter((e) => foldName(e.name) === wanted);
  // One exact-name candidate of the field's own kind: that is the person's word, resolved.
  if (exact.length === 1 && c.matches.includes(exact[0]))
    return { term, field, status: "confirmed", entity: exact[0] };
  if (exact.length === 1 && c.matches.length === 0 && c.others.length === 1)
    return { term, field, status: "confirmed", entity: exact[0] };
  return { term, field, status: "ambiguous", candidates: pool.slice(0, 4) };
}

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

/**
 * Tag candidates for any kind of place ("bar", "museum", "cafe"), the same
 * place-scoped selection as for restaurants. Up to 2 ids, best first; empty
 * when Qloo has no place tag for the word (the caller then searches without a
 * tag and says so — `scope: "places"`).
 */
export async function placeTagIds(kind: string, calls: QlooCall[]): Promise<string[]> {
  const word = kind.trim().toLowerCase();
  if (!word) return [];
  if (word === "restaurant") return restaurantTagIds(calls);
  const tags = await cached<QlooTag[]>(`tags:place:${word}:v1`, () =>
    qlooFindTags({ query: word, take: 20 }, calls),
  );
  return pickPlaceTags(tags, word).map((t) => t.id);
}

/** Pure selection for any place word: exact name first, then place genre/category tags that mention it. */
export function pickPlaceTags(tags: readonly QlooTag[], word: string): QlooTag[] {
  const w = norm(word);
  const first = w.split(/\s+/)[0] ?? w;
  const withParents = tags.filter((t) => t.parentTypes.length > 0);
  const scoped =
    withParents.length > 0 ? tags.filter((t) => t.parentTypes.includes(QLOO_ENTITY_PLACE)) : tags;
  const pool = scoped.length > 0 ? scoped : tags;
  const mentions = (t: QlooTag) => norm(t.name).includes(first);
  const score = (t: QlooTag) =>
    (norm(t.name) === w ? 100 : 0) +
    (mentions(t) ? 30 : 0) +
    (/^urn:tag:(genre|category):place:/.test(t.id) ? 40 : 0) +
    (/^urn:tag:[^:]+:place:/.test(t.id) ? 20 : 0) +
    (/^urn:tag:product_service:/.test(t.id) ? -50 : 0);
  return [...pool]
    .filter((t) => mentions(t) || norm(t.name) === w)
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
    rating: typeof p.rating === "number" ? Math.round(p.rating * 10) / 10 : undefined,
    cuisineTags: p.tags.map((t) => t.name).slice(0, 3),
  };
}

/**
 * Taste-ranked places of one kind in a district (district name, never GPS):
 * the direct path the compass uses for "a quiet restaurant in Kadıköy for
 * two" — no landmark in between. Tag candidates are tried one at a time; when
 * none yields a place the result is honestly empty (`scope: "none"`) — Agora
 * never pads it with unrelated places under a "restaurants" heading.
 */
export async function placesNearDistrict(
  input: {
    district: string;
    /** "restaurant", a place word ("bar", "museum") or null for any place. */
    kind: string | null;
    signalEntityIds: readonly string[];
    limit: number;
  },
  calls: QlooCall[],
): Promise<RestaurantsResult> {
  const { district } = input;
  const tagIds = input.kind ? await placeTagIds(input.kind, calls) : [];
  const signal = [...input.signalEntityIds].sort();
  const locationQuery = `${district}, Istanbul`;
  // A kind with no tag is searched untagged once, labelled "places" (not "restaurants").
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
        kind: input.kind,
        restaurantTagIds: tagId ? [tagId] : [],
        scope: tagId ? "restaurants" : "places",
        restaurants: places.slice(0, input.limit).map((p) => toRestaurant(p, district)),
      };
    }
  }
  return { district, kind: input.kind, restaurantTagIds: tagIds, scope: "none", restaurants: [] };
}

/** Taste-ranked restaurants in a landmark's neighbourhood — the guide's path, on top of the district one. */
export async function restaurantsNear(
  landmarkId: string,
  signalEntityIds: readonly string[],
  limit: number,
  calls: QlooCall[],
): Promise<RestaurantsResult> {
  const landmark = ISTANBUL_LANDMARKS.find((l) => l.id === landmarkId);
  if (!landmark) throw new Error("Unknown landmark");
  return placesNearDistrict(
    { district: landmark.district, kind: "restaurant", signalEntityIds, limit },
    calls,
  );
}
