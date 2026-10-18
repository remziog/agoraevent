import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

// ---------------------------------------------------------------------------
// CORS for the iOS/Android app (Capacitor, see mobile/). The app runs a static
// build at its own origin and calls the server functions here cross-origin
// (src/lib/site.ts → nativeServerFnFetch). Only server-function paths and only
// the app's origins get CORS headers. Server functions authenticate with a
// Bearer token, never cookies, so this grants nothing to a page without a token.
const NATIVE_APP_ORIGINS = new Set([
  "capacitor://localhost", // iOS
  "https://localhost", // Android (androidScheme "https", Capacitor's default)
  "http://localhost", // Android with androidScheme "http"
]);
const SERVER_FN_PATH_PREFIX = "/_serverFn/";
// Response headers the TanStack server-function client reads. Cross-origin,
// anything beyond the CORS-safelisted headers is invisible unless exposed.
const EXPOSED_HEADERS = "x-tss-serialized, x-tss-raw, x-tss-context, location";

function nativeAppCorsOrigin(request: Request): string | null {
  const origin = request.headers.get("origin");
  if (!origin || !NATIVE_APP_ORIGINS.has(origin)) return null;
  return new URL(request.url).pathname.startsWith(SERVER_FN_PATH_PREFIX) ? origin : null;
}

function corsPreflightResponse(request: Request, origin: string): Response {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers":
        request.headers.get("access-control-request-headers") ??
        "authorization, content-type, accept, x-tsr-serverfn",
      "Access-Control-Max-Age": "86400",
      Vary: "Origin",
    },
  });
}

function withCors(response: Response, origin: string): Response {
  const res = new Response(response.body, response);
  res.headers.set("Access-Control-Allow-Origin", origin);
  res.headers.set("Access-Control-Expose-Headers", EXPOSED_HEADERS);
  res.headers.append("Vary", "Origin");
  return res;
}
// ---------------------------------------------------------------------------

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => ((m as { default?: ServerEntry }).default ?? (m as unknown as ServerEntry)),
    );
  }
  return serverEntryPromise;
}

function brandedErrorResponse(): Response {
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isCatastrophicSsrErrorBody(body: string, responseStatus: number): boolean {
  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    return false;
  }

  if (!payload || Array.isArray(payload) || typeof payload !== "object") {
    return false;
  }

  const fields = payload as Record<string, unknown>;
  const expectedKeys = new Set(["message", "status", "unhandled"]);
  if (!Object.keys(fields).every((key) => expectedKeys.has(key))) {
    return false;
  }

  return (
    fields.unhandled === true &&
    fields.message === "HTTPError" &&
    (fields.status === undefined || fields.status === responseStatus)
  );
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isCatastrophicSsrErrorBody(body, response.status)) {
    return response;
  }

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return brandedErrorResponse();
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    const corsOrigin = nativeAppCorsOrigin(request);
    if (corsOrigin && request.method === "OPTIONS") {
      return corsPreflightResponse(request, corsOrigin);
    }
    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      const normalized = await normalizeCatastrophicSsrResponse(response);
      return corsOrigin ? withCors(normalized, corsOrigin) : normalized;
    } catch (error) {
      console.error(error);
      const fallback = brandedErrorResponse();
      return corsOrigin ? withCors(fallback, corsOrigin) : fallback;
    }
  },
};
