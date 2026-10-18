/**
 * Server-only Qloo API client for Agora's hackathon prototype.
 *
 * Set QLOO_API_KEY in the server environment. Never use VITE_ prefix.
 * Qloo's API base URL can be overridden via QLOO_API_BASE_URL.
 * No external requests happen until a caller invokes qlooGet().
 */
const DEFAULT_QLOO_BASE_URL = "https://hackathon.api.qloo.com";

export type QlooApiResult = unknown;

export class QlooConfigurationError extends Error {
  constructor() {
    super("QLOO_API_KEY is missing from the server environment.");
    this.name = "QlooConfigurationError";
  }
}

export async function qlooGet(
  path: string,
  params: Record<string, string | number | boolean | undefined> = {},
): Promise<QlooApiResult> {
  const apiKey = process.env.QLOO_API_KEY;
  if (!apiKey) throw new QlooConfigurationError();

  if (!path.startsWith("/") || path.startsWith("//")) {
    throw new Error("Qloo path must be an absolute API path.");
  }

  const baseUrl = process.env.QLOO_API_BASE_URL ?? DEFAULT_QLOO_BASE_URL;
  const url = new URL(path, baseUrl);
  if (url.origin !== new URL(baseUrl).origin) {
    throw new Error("Qloo path cannot change API origin.");
  }
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "X-Api-Key": apiKey,
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    throw new Error(`Qloo API request failed (HTTP ${response.status}).`);
  }
  return response.json();
}
