// Maps Agora's curated landmarks to Qloo place entities, at runtime.
//
// Each landmark is searched once with Qloo /search (types=urn:entity:place),
// English name first, then the Turkish one. A candidate is accepted only when
//   - its name matches one of the landmark's aliases, and
//   - Qloo places it in Istanbul (address/geocode text names the city or one of
//     its districts, or its coordinates are within 3 km of the landmark).
// The outcome — including "none" — is cached in public.landmark_qloo_map (RLS,
// service role only), so Qloo identifiers never live in the public repository
// and the lookup does not repeat on every request. "none" is retried after
// three days. A landmark without a confident match never gets a Qloo badge.
import "@tanstack/react-start/server-only";

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Json } from "@/integrations/supabase/types";
import type { LandmarkCandidate, LandmarkMatchConfidence, LandmarkQlooRow } from "./guide.types";
import { ISTANBUL_LANDMARKS, type Landmark } from "./istanbul-landmarks";
import { QLOO_ENTITY_PLACE, type QlooCall, type QlooEntity } from "./qloo.schemas";
import { qlooSearch } from "./qloo.server";

const RETRY_NONE_AFTER_MS = 3 * 24 * 60 * 60 * 1000;
const RESOLVE_CONCURRENCY = 3;

const ISTANBUL_HINTS = [
  "istanbul",
  "fatih",
  "beyoglu",
  "besiktas",
  "uskudar",
  "kadikoy",
  "sultanahmet",
  "eminonu",
  "karakoy",
  "galata",
  "ortakoy",
  "beyazit",
  "edirnekapi",
  "taksim",
];
const STOP_WORDS = new Set(["the", "of", "and", "a", "an", "de", "la", "le"]);

/** Lowercase, strip diacritics (İ→i, ş→s, ç→c, ö→o, ü→u, ğ→g, ı→i), keep letters and digits. */
export function foldName(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .replace(/ı/g, "i")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function tokens(value: string): string[] {
  return foldName(value)
    .split(" ")
    .filter((t) => t.length > 1 && !STOP_WORDS.has(t));
}

function nameMatch(candidate: string, aliases: readonly string[]): LandmarkCandidate["nameMatch"] {
  const cand = tokens(candidate);
  if (cand.length === 0) return "none";
  let best: LandmarkCandidate["nameMatch"] = "none";
  for (const alias of aliases) {
    const al = tokens(alias);
    if (al.length === 0) continue;
    if (cand.join(" ") === al.join(" ")) return "exact";
    if (al.every((t) => cand.includes(t))) best = "contains";
    else if (best === "none") {
      const shared = al.filter((t) => cand.includes(t)).length;
      if (al.length >= 2 && shared / al.length >= 0.66) best = "partial";
    }
  }
  return best;
}

function distanceKm(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
) {
  const R = 6371;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.latitude * Math.PI) / 180) *
      Math.cos((b.latitude * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

function inIstanbul(entity: QlooEntity, landmark: Landmark): boolean {
  if (entity.geocode && distanceKm(entity.geocode, landmark) <= 3) return true;
  const text = foldName([entity.locationText, entity.disambiguation].filter(Boolean).join(" "));
  return ISTANBUL_HINTS.some((hint) => text.includes(hint));
}

function toCandidate(entity: QlooEntity, landmark: Landmark): LandmarkCandidate {
  return {
    entityId: entity.entityId,
    name: entity.name,
    location: entity.locationText?.slice(0, 160),
    inIstanbul: inIstanbul(entity, landmark),
    nameMatch: nameMatch(entity.name, landmark.aliases),
  };
}

const MATCH_RANK = { exact: 3, contains: 2, partial: 1, none: 0 } as const;

function pick(
  candidates: LandmarkCandidate[],
): { best: LandmarkCandidate; confidence: LandmarkMatchConfidence } | null {
  const usable = candidates
    .filter((c) => c.inIstanbul && c.nameMatch !== "none")
    .sort((a, b) => MATCH_RANK[b.nameMatch] - MATCH_RANK[a.nameMatch]);
  const best = usable[0];
  if (!best) return null;
  return { best, confidence: best.nameMatch === "exact" ? "exact" : "likely" };
}

async function resolveOne(landmark: Landmark, calls: QlooCall[]): Promise<LandmarkQlooRow> {
  const seen: LandmarkCandidate[] = [];
  // English alias first, then the Turkish one: at most two searches per landmark.
  for (const query of landmark.aliases.slice(0, 2)) {
    const entities = await qlooSearch({ query, types: [QLOO_ENTITY_PLACE], take: 5 }, calls);
    for (const entity of entities) {
      if (!seen.some((c) => c.entityId === entity.entityId))
        seen.push(toCandidate(entity, landmark));
    }
    const chosen = pick(seen);
    if (chosen) {
      return {
        landmarkId: landmark.id,
        entityId: chosen.best.entityId,
        entityName: chosen.best.name,
        entityAddress: chosen.best.location ?? null,
        confidence: chosen.confidence,
        note: `matched "${query}"`,
        candidates: seen.slice(0, 8),
        resolvedAt: new Date().toISOString(),
      };
    }
  }
  return {
    landmarkId: landmark.id,
    entityId: null,
    entityName: null,
    entityAddress: null,
    confidence: "none",
    note:
      seen.length === 0
        ? "Qloo returned no place for these names"
        : "No candidate both matched the name and was located in Istanbul",
    candidates: seen.slice(0, 8),
    resolvedAt: new Date().toISOString(),
  };
}

type DbRow = {
  landmark_id: string;
  entity_id: string | null;
  entity_name: string | null;
  entity_address: string | null;
  confidence: string;
  note: string | null;
  candidates: Json;
  resolved_at: string;
};

function fromDb(row: DbRow): LandmarkQlooRow {
  const confidence: LandmarkMatchConfidence =
    row.confidence === "exact" || row.confidence === "likely" ? row.confidence : "none";
  return {
    landmarkId: row.landmark_id,
    entityId: confidence === "none" ? null : row.entity_id,
    entityName: row.entity_name,
    entityAddress: row.entity_address,
    confidence,
    note: row.note,
    candidates: Array.isArray(row.candidates)
      ? (row.candidates as unknown as LandmarkCandidate[])
      : [],
    resolvedAt: row.resolved_at,
  };
}

function toDb(row: LandmarkQlooRow): DbRow {
  return {
    landmark_id: row.landmarkId,
    entity_id: row.entityId,
    entity_name: row.entityName,
    entity_address: row.entityAddress,
    confidence: row.confidence,
    note: row.note,
    candidates: row.candidates as unknown as Json,
    resolved_at: row.resolvedAt,
  };
}

export async function readLandmarkQlooMap(): Promise<Map<string, LandmarkQlooRow>> {
  const { data, error } = await supabaseAdmin.from("landmark_qloo_map").select("*");
  if (error) throw new Error(`landmark_qloo_map read failed: ${error.message}`);
  return new Map((data ?? []).map((row) => [row.landmark_id, fromDb(row as DbRow)]));
}

/**
 * The landmark → Qloo entity map. Landmarks never looked up (or "none" older
 * than three days) are resolved now and written back. Qloo errors propagate,
 * so callers can report "Qloo unavailable" honestly.
 */
export async function getLandmarkQlooMap(calls: QlooCall[]): Promise<Map<string, LandmarkQlooRow>> {
  const map = await readLandmarkQlooMap();
  const now = Date.now();
  const pending = ISTANBUL_LANDMARKS.filter((l) => {
    const row = map.get(l.id);
    if (!row) return true;
    return row.confidence === "none" && now - Date.parse(row.resolvedAt) > RETRY_NONE_AFTER_MS;
  });
  if (pending.length === 0) return map;

  const resolved: LandmarkQlooRow[] = [];
  for (let i = 0; i < pending.length; i += RESOLVE_CONCURRENCY) {
    const batch = pending.slice(i, i + RESOLVE_CONCURRENCY);
    resolved.push(...(await Promise.all(batch.map((l) => resolveOne(l, calls)))));
  }
  const { error } = await supabaseAdmin.from("landmark_qloo_map").upsert(resolved.map(toDb));
  if (error) console.error("[qloo] landmark_qloo_map upsert failed:", error.message);
  for (const row of resolved) map.set(row.landmarkId, row);
  return map;
}
