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

export type TasteCandidate = { term: string; matches: QlooEntity[] };

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

export type RestaurantsResult = {
  district: string;
  /** Tag ids used as `filter.tags`, for the trace. */
  restaurantTagIds: string[];
  restaurants: Restaurant[];
};

export type LandmarkMatchConfidence = "exact" | "likely" | "none";

export type LandmarkCandidate = {
  entityId: string;
  name: string;
  location?: string;
  inIstanbul: boolean;
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
  /** 1-based position in Qloo's ranking of the curated landmarks. */
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

export type GuidePlan = {
  /** "agent": the tool-calling agent produced the plan. "fixed": Agora's fixed plan (agent unavailable). */
  mode: "agent" | "fixed";
  model?: string;
  taste: TasteEntity[];
  mood?: string;
  picks: GuidePick[];
  dining: (RestaurantsResult & { landmarkId: string; drivers: Record<string, string[]> }) | null;
  gatherings: { landmarkId: string; events: GatheringEvent[] } | null;
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
