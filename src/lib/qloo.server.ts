// Server-only Qloo transport + typed wrappers for Agora's hackathon features.
//
// Credential: QLOO_API_KEY as a server secret (Lovable secrets in production,
// .env.local for local dev). Never VITE_-prefixed, never in the client bundle —
// the marker import below makes the build fail if a client module imports this.
//
// Base URL: https://api.qloo.com (same host and `X-Api-Key` header the official
// @qloo/qloo-harness uses). Override with QLOO_BASE_URL. The legacy
// QLOO_API_BASE_URL name from the first scaffold is still read as a fallback.
//
// Rules we follow (Qloo hackathon kit, docs/API_ACCESS.md + SAFE_USE.md):
// smallest request that answers the question, bounded retries, no personal data
// (only taste terms, entity ids, tag ids and a neighbourhood name go to Qloo),
// results shown with their source, uncertain matches confirmed by the user.
import "@tanstack/react-start/server-only";

import { z } from "zod";
import {
  normalizeEntity,
  normalizeTag,
  pickResultArray,
  QLOO_ENTITY_PLACE,
  QlooEntitySchema,
  QlooTagSchema,
  type QlooCall,
  type QlooEntity,
  type QlooTag,
} from "./qloo.schemas";

export const DEFAULT_QLOO_BASE_URL = "https://api.qloo.com";
const REQUEST_TIMEOUT_MS = 10_000;
const MAX_RETRY_AFTER_MS = 5_000;

export class QlooConfigurationError extends Error {
  constructor() {
    super("QLOO_API_KEY is missing from the server environment.");
    this.name = "QlooConfigurationError";
  }
}

export class QlooError extends Error {
  readonly status: number;
  readonly endpoint: string;
  constructor(message: string, status: number, endpoint: string) {
    super(message);
    this.name = "QlooError";
    this.status = status;
    this.endpoint = endpoint;
  }
}

export class QlooAuthError extends QlooError {
  constructor(status: number, endpoint: string) {
    super(`Qloo rejected the credential (HTTP ${status}).`, status, endpoint);
    this.name = "QlooAuthError";
  }
}

export class QlooRateLimitError extends QlooError {
  readonly retryAfterSec?: number;
  constructor(endpoint: string, retryAfterSec?: number) {
    super("Qloo rate limit or quota reached (HTTP 429).", 429, endpoint);
    this.name = "QlooRateLimitError";
    this.retryAfterSec = retryAfterSec;
  }
}

export type QlooParams = Record<string, string | number | boolean | readonly string[] | undefined>;

function qlooBaseUrl(): string {
  return process.env.QLOO_BASE_URL ?? process.env.QLOO_API_BASE_URL ?? DEFAULT_QLOO_BASE_URL;
}

function toSearchParams(params: QlooParams): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    out[key] = Array.isArray(value) ? value.join(",") : String(value);
  }
  return out;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Low-level GET. Resolves with the parsed JSON body; throws QlooAuthError /
 * QlooRateLimitError / QlooError. Appends a redacted entry to `log` when given.
 */
export async function qlooGet(
  path: string,
  params: QlooParams = {},
  options: { log?: QlooCall[]; signal?: AbortSignal; retried?: boolean } = {},
): Promise<unknown> {
  const apiKey = process.env.QLOO_API_KEY;
  if (!apiKey) throw new QlooConfigurationError();
  if (!path.startsWith("/") || path.startsWith("//")) {
    throw new Error("Qloo path must be an absolute API path.");
  }

  const base = qlooBaseUrl();
  const url = new URL(path, base);
  if (url.origin !== new URL(base).origin) throw new Error("Qloo path cannot change API origin.");
  const flat = toSearchParams(params);
  for (const [key, value] of Object.entries(flat)) url.searchParams.set(key, value);

  const started = Date.now();
  const entry: QlooCall = { endpoint: path, params: flat, status: 0, ms: 0 };
  const signal = options.signal
    ? AbortSignal.any([options.signal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)])
    : AbortSignal.timeout(REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url, {
      method: "GET",
      headers: { "X-Api-Key": apiKey, Accept: "application/json" },
      signal,
    });
  } catch (error) {
    entry.ms = Date.now() - started;
    entry.error = error instanceof Error ? error.name : "fetch failed";
    options.log?.push(entry);
    throw new QlooError(`Qloo request failed before a response (${entry.error}).`, 0, path);
  }

  entry.status = response.status;
  entry.ms = Date.now() - started;

  if (response.status === 429) {
    const retryAfterHeader = Number(response.headers.get("retry-after"));
    const retryAfterSec =
      Number.isFinite(retryAfterHeader) && retryAfterHeader > 0 ? retryAfterHeader : undefined;
    if (!options.retried) {
      options.log?.push({ ...entry, error: "429, retrying once" });
      await sleep(Math.min((retryAfterSec ?? 1) * 1000, MAX_RETRY_AFTER_MS));
      return qlooGet(path, params, { ...options, retried: true });
    }
    options.log?.push({ ...entry, error: "429" });
    throw new QlooRateLimitError(path, retryAfterSec);
  }

  if (response.status === 401 || response.status === 403) {
    options.log?.push({ ...entry, error: "auth" });
    throw new QlooAuthError(response.status, path);
  }

  if (!response.ok) {
    const body = (await response.text().catch(() => "")).slice(0, 200);
    options.log?.push({ ...entry, error: `HTTP ${response.status}` });
    throw new QlooError(
      `Qloo API request failed (HTTP ${response.status}): ${body}`,
      response.status,
      path,
    );
  }

  const json: unknown = await response.json();
  options.log?.push(entry);
  return json;
}

function parseEntities(payload: unknown, entry?: QlooCall): QlooEntity[] {
  const parsed = z.array(QlooEntitySchema).safeParse(pickResultArray(payload, "entities"));
  if (!parsed.success) return [];
  const entities = parsed.data.map(normalizeEntity).filter((e): e is QlooEntity => e !== null);
  if (entry) {
    entry.resultCount = entities.length;
    entry.topResults = entities.slice(0, 3).map((e) => ({ name: e.name, entityId: e.entityId }));
  }
  return entities;
}

function lastEntry(log?: QlooCall[]): QlooCall | undefined {
  return log && log.length > 0 ? log[log.length - 1] : undefined;
}

/** GET /search — resolve a free-text taste term ("Agatha Christie") to Qloo entities. */
export async function qlooSearch(
  input: { query: string; types?: readonly string[]; take?: number },
  log?: QlooCall[],
): Promise<QlooEntity[]> {
  const payload = await qlooGet(
    "/search",
    { query: input.query.trim(), types: input.types, take: input.take ?? 5 },
    { log },
  );
  return parseEntities(payload, lastEntry(log));
}

/**
 * GET /v2/insights with `filter.results.entities` — what the official harness's
 * `qloo_rank` does: rank a shortlist (our 16 landmarks) against the user's taste
 * signals. Explainability tells which signal drove each result.
 */
export async function qlooRankShortlist(
  input: {
    resultEntityIds: readonly string[];
    signalEntityIds: readonly string[];
    signalTagIds?: readonly string[];
    type?: string;
    explain?: boolean;
  },
  log?: QlooCall[],
): Promise<QlooEntity[]> {
  if (input.resultEntityIds.length === 0) return [];
  const payload = await qlooGet(
    "/v2/insights",
    {
      "filter.type": input.type ?? QLOO_ENTITY_PLACE,
      "filter.results.entities": input.resultEntityIds,
      "signal.interests.entities":
        input.signalEntityIds.length > 0 ? input.signalEntityIds : undefined,
      "signal.interests.tags":
        input.signalTagIds && input.signalTagIds.length > 0 ? input.signalTagIds : undefined,
      "feature.explainability": input.explain ?? true,
      take: input.resultEntityIds.length,
    },
    { log },
  );
  return parseEntities(payload, lastEntry(log));
}

/**
 * GET /v2/insights for places in a neighbourhood ("Karaköy, Istanbul"), ranked by
 * the user's taste signals and optionally restricted to tags (e.g. restaurants).
 * `locationQuery` is a place name, never the user's coordinates.
 */
export async function qlooPlacesNear(
  input: {
    locationQuery: string;
    signalEntityIds?: readonly string[];
    tagIds?: readonly string[];
    excludeTagIds?: readonly string[];
    take?: number;
    explain?: boolean;
  },
  log?: QlooCall[],
): Promise<QlooEntity[]> {
  const payload = await qlooGet(
    "/v2/insights",
    {
      "filter.type": QLOO_ENTITY_PLACE,
      "filter.location.query": input.locationQuery,
      "filter.tags": input.tagIds && input.tagIds.length > 0 ? input.tagIds : undefined,
      "filter.exclude.tags":
        input.excludeTagIds && input.excludeTagIds.length > 0 ? input.excludeTagIds : undefined,
      "signal.interests.entities":
        input.signalEntityIds && input.signalEntityIds.length > 0
          ? input.signalEntityIds
          : undefined,
      "feature.explainability": input.explain ?? true,
      take: input.take ?? 10,
    },
    { log },
  );
  return parseEntities(payload, lastEntry(log));
}

/** GET /v2/tags — semantic tag search ("restaurant", "turkish cuisine"). */
export async function qlooFindTags(
  input: { query: string; take?: number; tagTypes?: readonly string[] },
  log?: QlooCall[],
): Promise<QlooTag[]> {
  const payload = await qlooGet(
    "/v2/tags",
    {
      "filter.query": input.query.trim(),
      "feature.semantic_search": true,
      "filter.tag.types": input.tagTypes,
      take: input.take ?? 5,
    },
    { log },
  );
  const parsed = z.array(QlooTagSchema).safeParse(pickResultArray(payload, "tags"));
  if (!parsed.success) return [];
  const tags = parsed.data.map(normalizeTag).filter((t): t is QlooTag => t !== null);
  const entry = lastEntry(log);
  if (entry) entry.resultCount = tags.length;
  return tags;
}

/**
 * Tiny in-memory cache (per worker isolate, best effort). Qloo quota is shared by
 * every surface of the event credential, so identical questions are not re-asked
 * within an hour.
 */
const CACHE_TTL_MS = 60 * 60 * 1000;
const cache = new Map<string, { expires: number; value: unknown }>();

export async function cached<T>(key: string, compute: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.value as T;
  const value = await compute();
  cache.set(key, { expires: Date.now() + CACHE_TTL_MS, value });
  if (cache.size > 500) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  return value;
}

/** Map a thrown error to the stable codes the UI shows; never leaks the key. */
export function qlooErrorCode(
  error: unknown,
): "qloo_not_configured" | "qloo_auth" | "qloo_rate_limited" | "qloo_unavailable" {
  if (error instanceof QlooConfigurationError) return "qloo_not_configured";
  if (error instanceof QlooAuthError) return "qloo_auth";
  if (error instanceof QlooRateLimitError) return "qloo_rate_limited";
  return "qloo_unavailable";
}
