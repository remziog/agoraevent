// Types shared by the taste guide's server functions and UI. Client-safe: no
// runtime code, no credentials.
import type { JsonValue, QlooCall, QlooEntity } from "./qloo.schemas";

export type QlooErrorCode =
  | "qloo_not_configured"
  | "qloo_auth"
  | "qloo_rate_limited"
  | "qloo_unavailable";

/** Every Qloo-backed function returns this shape so the UI can show provenance or degrade honestly. */
export type QlooOutcome<T> =
  | { ok: true; data: T; calls: QlooCall[] }
  | { ok: false; error: QlooErrorCode; calls: QlooCall[] };

/** Which guide field a term came from; decides the Qloo entity types searched first. */
export type TasteField = "music" | "film" | "book";

export type TasteCandidate = {
  term: string;
  field?: TasteField;
  /** Candidates of the field's own kind (artist for music, film/series, book/author). */
  matches: QlooEntity[];
  /** Candidates of other kinds (an album, a café named after the film…), shown separately. */
  others: QlooEntity[];
};

export type LandmarkPick = {
  landmarkId: string;
  qlooEntityId: string;
  affinity?: number;
  explainability?: JsonValue;
};

export type RecommendPlacesResult = {
  /** Landmarks Qloo could rank, best affinity first. Only these may carry a Qloo badge. */
  picks: LandmarkPick[];
  /** Landmarks with no confident Qloo entity (see landmark_qloo_map). */
  unmatchedLandmarkIds: string[];
};

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

/** A Qloo place (restaurant, bar, museum…) ranked for the person's taste. */
export type Place = Restaurant;

export type RestaurantsResult = {
  district: string;
  /** The kind of place that was asked for ("restaurant", "bar", "museum"); null = any place. */
  kind?: string | null;
  /** Tag ids used as `filter.tags`, for the trace. */
  restaurantTagIds: string[];
  /** "restaurants": the kind's tag filter produced results; "places": no tag was available (untagged search); "none": Qloo returned nothing. */
  scope: "restaurants" | "places" | "none";
  restaurants: Restaurant[];
};

export type LandmarkMatchConfidence = "exact" | "likely" | "none";

export type LandmarkCandidate = {
  entityId: string;
  name: string;
  location?: string;
  /** Same place as the landmark (coordinates within a few km, or the address names its neighbourhood). */
  inIstanbul: boolean;
  /** Distance from the landmark pin when Qloo gave coordinates. */
  distanceKm?: number;
  nameMatch: "exact" | "contains" | "partial" | "none";
};

export type LandmarkQlooRow = {
  landmarkId: string;
  entityId: string | null;
  entityName: string | null;
  entityAddress: string | null;
  confidence: LandmarkMatchConfidence;
  note: string | null;
  candidates: LandmarkCandidate[];
  resolvedAt: string;
};

export type LandmarkStatusRow = LandmarkQlooRow & { title: string; district: string };

/** A favourite the person confirmed, resolved to a Qloo entity. */
export type TasteEntity = { entityId: string; name: string; type?: string };

export type GuidePick = {
  landmarkId: string;
  /**
   * "qloo": Qloo ranked this landmark for the favourites (qlooRank ≥ 1).
   * "editorial": Agora's own hero landmark shown because Qloo returned no
   * ranking — never labelled as a Qloo result.
   */
  source: "qloo" | "editorial";
  /** 1-based position in Qloo's ranking of the curated landmarks (0 for editorial picks). */
  qlooRank: number;
  affinity?: number;
  /** Favourites Qloo's explainability credits for this landmark (may be empty). */
  drivers: string[];
  /** Story section the agent chose to open with (a title from landmark-stories). */
  storySectionTitle?: string;
  /** One sentence written by the agent (AI), labelled as Agora's note in the UI. */
  hook?: string;
};

export type GatheringEvent = {
  id: string;
  title: string;
  startsAt: string;
  venue: string | null;
  organizer: string | null;
  distanceKm: number;
  /** Seeded sample event (tag "demo"), shown with a "Sample" label. */
  sample: boolean;
};

export type GuideTraceStep = {
  kind: "tool" | "agent" | "note";
  name: string;
  /** Short human-readable line for the "How Agora decided" panel. */
  label: string;
  ms?: number;
  input?: JsonValue;
  qloo?: QlooCall[];
  source?: "qloo" | "agora" | "ai";
};

/**
 * One execution status for the whole run, so the headline, the notice and the
 * "How Agora decided" panel never contradict each other.
 */
export type GuideExecution = {
  /** Qloo's landmark ranking: results came back / Qloo answered but ranked none / the call failed. */
  ranking: "ranked" | "empty" | "failed";
  rankingError?: QlooErrorCode;
  /** Items Qloo sent in the ranking answer, how many were readable, how many were our landmarks. */
  rankingCounts?: { upstream: number; parsed: number; matched: number };
  /** Was a model run attempted (false without an AI credential)? */
  agentAttempted: boolean;
  agentModel?: string;
  agentSteps?: number;
  agentOutcome: "plan" | "no_plan" | "failed" | "timeout" | "not_configured";
  /** The fixed plan filled in what the agent did not deliver. */
  fallbackUsed: boolean;
  fallbackReason?: string;
};

export type GuidePlan = {
  /** "agent": the tool-calling agent produced the plan. "fixed": Agora's fixed plan (agent unavailable). */
  mode: "agent" | "fixed";
  model?: string;
  execution: GuideExecution;
  taste: TasteEntity[];
  mood?: string;
  picks: GuidePick[];
  dining: (RestaurantsResult & { landmarkId: string; drivers: Record<string, string[]> }) | null;
  /** Agora gatherings near the first pick, or city-wide when there is no Qloo pick (landmarkId null). */
  gatherings: { landmarkId: string | null; events: GatheringEvent[] } | null;
  unmatchedLandmarkIds: string[];
  /** Agent's one-line summary (AI). */
  summary?: string;
  /** Why the plan is incomplete or fell back, in plain words. */
  notice?: string;
  trace: GuideTraceStep[];
};

export type QlooStatus = {
  configured: boolean;
  host: string;
  probe:
    | { ok: true; resultCount: number; top: string[] }
    | { ok: false; error: QlooErrorCode }
    | null;
  landmarks: LandmarkStatusRow[];
  calls: QlooCall[];
};
