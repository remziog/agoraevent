// Maps Agora's curated landmarks to Qloo place entities, at runtime.
//
// Each landmark is searched once with Qloo /search (types=urn:entity:place),
// English name first, then the Turkish one. A candidate is accepted only when
//   - its name matches one of the landmark's aliases (a one-word alias must
//     match exactly, so "Moda" never accepts "Moda Kayıkhane"), and
//   - it is geographically the same place: when Qloo gives coordinates they
//     must be within a few km of the landmark (an "Ortaköy Mosque" in Silivri,
//     55 km away, is rejected even though its address says "Istanbul"); when
//     Qloo gives no coordinates, the address text must name the landmark's own
//     neighbourhood or district, not merely the city.
//   - area/experience entries (a neighbourhood, a ferry ride) accept only an
//     exact name match, so a business that borrows the name is never used.
// The outcome — including "none" — is cached in public.landmark_qloo_map (RLS,
// service role only), so Qloo identifiers never live in the public repository
// and the lookup does not repeat on every request. "none" is retried after
// three days; rows written by an older rule set (see MAP_RULES_VERSION) are
// re-resolved so a bad cached match cannot survive a rule fix. A landmark
// without a confident match never gets a Qloo badge.
import "@tanstack/react-start/server-only";

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Json } from "@/integrations/supabase/types";
import type { LandmarkCandidate, LandmarkMatchConfidence, LandmarkQlooRow } from "./guide.types";
import { ISTANBUL_LANDMARKS, type Landmark } from "./istanbul-landmarks";
import { QLOO_ENTITY_PLACE, type QlooCall, type QlooEntity } from "./qloo.schemas";
import { qlooSearch } from "./qloo.server";

const RETRY_NONE_AFTER_MS = 3 * 24 * 60 * 60 * 1000;
const RESOLVE_CONCURRENCY = 3;
/** Bump when the matching rules change: cached rows from older rules are re-resolved. */
export const MAP_RULES_VERSION = 3;
const VERSION_PREFIX = `[v${MAP_RULES_VERSION}] `;
/** A place candidate with coordinates must be this close to the landmark. */
const PLACE_RADIUS_KM = 2.5;
/** Area/experience entries (a neighbourhood, a ferry) may sit further from the pin. */
const AREA_RADIUS_KM = 6;

/**
 * Neighbourhood/district names (diacritics folded) that count as "the same
 * place" as each landmark district when Qloo gives an address but no
 * coordinates. "istanbul" alone is deliberately absent: the province spans
 * 5,000 km², so it says nothing about identity.
 */
const DISTRICT_HINTS: Record<string, string[]> = {
  Sultanahmet: ["sultanahmet", "sultan ahmet", "cankurtaran", "alemdar", "binbirdirek", "fatih"],
  Beyazıt: ["beyazit", "kapalicarsi", "mercan", "fatih"],
  Eminönü: ["eminonu", "rustempasa", "rustem pasa", "hobyar", "fatih"],
  Karaköy: ["karakoy", "galata", "bereketzade", "beyoglu"],
  Beyoğlu: ["beyoglu", "taksim", "istiklal", "gumussuyu", "kocatepe", "tomtom", "asmali mescit"],
  Beşiktaş: ["besiktas", "visnezade", "dolmabahce", "kabatas"],
  Ortaköy: ["ortakoy", "mecidiye", "besiktas"],
  Üsküdar: ["uskudar", "salacak", "uskuedar"],
  Fatih: ["suleymaniye", "vefa", "fatih"],
  Edirnekapı: ["edirnekapi", "kariye", "ayvansaray", "karagumruk", "fatih"],
  Kadıköy: ["kadikoy", "moda", "caferaga", "yeldegirmeni"],
};
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

export function nameMatch(
  candidate: string,
  aliases: readonly string[],
): LandmarkCandidate["nameMatch"] {
  const cand = tokens(candidate);
  if (cand.length === 0) return "none";
  let best: LandmarkCandidate["nameMatch"] = "none";
  for (const alias of aliases) {
    const al = tokens(alias);
    if (al.length === 0) continue;
    if (cand.join(" ") === al.join(" ")) return "exact";
    // A single-word alias ("Moda", "Galata") inside a longer name is not evidence
    // of identity — "Moda Kayıkhane" is a restaurant, not the neighbourhood.
    if (al.length < 2) continue;
    if (al.every((t) => cand.includes(t))) best = "contains";
    else if (best === "none") {
      const shared = al.filter((t) => cand.includes(t)).length;
      if (shared / al.length >= 0.66) best = "partial";
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

/**
 * Is this Qloo entity the same place as the landmark? Coordinates decide when
 * Qloo provides them (a namesake 55 km away is rejected even if its address
 * says "Istanbul"); otherwise the address text must name the landmark's own
 * neighbourhood or district.
 */
export function samePlace(
  entity: Pick<QlooEntity, "geocode" | "locationText" | "disambiguation">,
  landmark: Pick<Landmark, "latitude" | "longitude" | "district" | "kind">,
): { ok: boolean; distanceKm?: number } {
  const radius = landmark.kind === "area" ? AREA_RADIUS_KM : PLACE_RADIUS_KM;
  if (entity.geocode) {
    const d = distanceKm(entity.geocode, landmark);
    return { ok: d <= radius, distanceKm: Math.round(d * 10) / 10 };
  }
  const text = foldName([entity.locationText, entity.disambiguation].filter(Boolean).join(" "));
  const hints = DISTRICT_HINTS[landmark.district] ?? [foldName(landmark.district)];
  return { ok: hints.some((hint) => text.includes(hint)) };
}

function toCandidate(entity: QlooEntity, landmark: Landmark): LandmarkCandidate {
  const place = samePlace(entity, landmark);
  return {
    entityId: entity.entityId,
    name: entity.name,
    location: entity.locationText?.slice(0, 160),
    inIstanbul: place.ok,
    distanceKm: place.distanceKm,
    nameMatch: nameMatch(entity.name, landmark.aliases),
  };
}

const MATCH_RANK = { exact: 3, contains: 2, partial: 1, none: 0 } as const;

export function pick(
  candidates: LandmarkCandidate[],
  kind: Landmark["kind"] = "place",
): { best: LandmarkCandidate; confidence: LandmarkMatchConfidence } | null {
  const usable = candidates
    .filter((c) => c.inIstanbul && c.nameMatch !== "none")
    // Areas and experiences (a neighbourhood, a ferry ride) only on an exact name.
    .filter((c) => kind !== "area" || c.nameMatch === "exact")
    .sort(
      (a, b) =>
        MATCH_RANK[b.nameMatch] - MATCH_RANK[a.nameMatch] ||
        (a.distanceKm ?? 99) - (b.distanceKm ?? 99),
    );
  const best = usable[0];
  if (!best) return null;
  return { best, confidence: best.nameMatch === "exact" ? "exact" : "likely" };
}

async function resolveOne(landmark: Landmark, calls: QlooCall[]): Promise<LandmarkQlooRow> {
  const seen: LandmarkCandidate[] = [];
  // At most three searches per landmark (English, Turkish, a known Qloo spelling).
  for (const query of landmark.aliases.slice(0, 3)) {
    const entities = await qlooSearch({ query, types: [QLOO_ENTITY_PLACE], take: 5 }, calls);
    for (const entity of entities) {
      if (!seen.some((c) => c.entityId === entity.entityId))
        seen.push(toCandidate(entity, landmark));
    }
    const chosen = pick(seen, landmark.kind);
    if (chosen) {
      return {
        landmarkId: landmark.id,
        entityId: chosen.best.entityId,
        entityName: chosen.best.name,
        entityAddress: chosen.best.location ?? null,
        confidence: chosen.confidence,
        note: `${VERSION_PREFIX}matched "${query}"${
          chosen.best.distanceKm !== undefined ? ` · ${chosen.best.distanceKm} km from the pin` : ""
        }`,
        candidates: seen.slice(0, 8),
        resolvedAt: new Date().toISOString(),
      };
    }
  }
  const far = seen.filter((c) => c.nameMatch !== "none" && !c.inIstanbul);
  return {
    landmarkId: landmark.id,
    entityId: null,
    entityName: null,
    entityAddress: null,
    confidence: "none",
    note:
      VERSION_PREFIX +
      (seen.length === 0
        ? "Qloo returned no place for these names"
        : far.length > 0
          ? `Name matched but not the same place (${far
              .slice(0, 2)
              .map(
                (c) => `${c.name}${c.distanceKm !== undefined ? ` ${c.distanceKm} km away` : ""}`,
              )
              .join("; ")})`
          : landmark.kind === "area"
            ? "No exact name match for this area (businesses borrowing the name are not accepted)"
            : "No candidate both matched the name and was located at this place"),
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
    // Written by an older rule set → re-check (e.g. a namesake accepted on city text alone).
    if (!row.note?.startsWith(VERSION_PREFIX)) return true;
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
