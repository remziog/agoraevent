import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { runGuideAgent } from "@/lib/guide-agent.server";
import type { TasteEntity } from "@/lib/guide.types";
import { ISTANBUL_LANDMARKS } from "@/lib/istanbul-landmarks";
import { getLandmarkQlooMap } from "@/lib/qloo-landmarks.server";
import { QLOO_ENTITY_PLACE, type QlooCall } from "@/lib/qloo.schemas";
import { DEFAULT_QLOO_BASE_URL, qlooErrorCode, qlooSearch } from "@/lib/qloo.server";

// Operator health check for the taste guide, used during the hackathon build
// to verify the Qloo credential, the landmark map and the agent from a
// preview deployment without a browser session.
//
// Enabled only when GUIDE_HEALTH_TOKEN is set in the server environment; the
// caller must send it as `Authorization: Bearer <token>`. Unset = 404, so the
// route does not exist in production unless an operator turns it on. Nothing
// here writes user data; the landmark map cache is the same one the app fills.
//
//   GET  /api/guide-health            → credential + first /search + landmark map
//   POST /api/guide-health {terms}    → resolve terms, run the agent, return the plan

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function authorize(request: Request): Response | null {
  const expected = process.env.GUIDE_HEALTH_TOKEN;
  if (!expected || expected.length < 16) return new Response("Not found", { status: 404 });
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token || !constantTimeEqual(token, expected)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  return null;
}

function hostLabel(): string {
  try {
    return new URL(
      process.env.QLOO_BASE_URL ?? process.env.QLOO_API_BASE_URL ?? DEFAULT_QLOO_BASE_URL,
    ).host;
  } catch {
    return "invalid QLOO_BASE_URL";
  }
}

export const Route = createFileRoute("/api/guide-health")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const denied = authorize(request);
        if (denied) return denied;

        const calls: QlooCall[] = [];
        const out: Record<string, unknown> = {
          qlooConfigured: Boolean(process.env.QLOO_API_KEY),
          qlooHost: hostLabel(),
          aiConfigured: Boolean(process.env.LOVABLE_API_KEY),
        };

        try {
          const found = await qlooSearch(
            { query: "Hagia Sophia", types: [QLOO_ENTITY_PLACE], take: 3 },
            calls,
          );
          out.probe = {
            ok: true,
            top: found.map((e) => ({
              name: e.name,
              location: e.locationText,
              hasGeocode: Boolean(e.geocode),
            })),
          };
        } catch (error) {
          out.probe = {
            ok: false,
            error: qlooErrorCode(error),
            message: error instanceof Error ? error.message.slice(0, 200) : String(error),
          };
        }

        const url = new URL(request.url);
        if (url.searchParams.get("map") === "1" && (out.probe as { ok: boolean }).ok) {
          try {
            const map = await getLandmarkQlooMap(calls);
            out.landmarks = ISTANBUL_LANDMARKS.map((l) => {
              const row = map.get(l.id);
              return {
                id: l.id,
                title: l.title,
                confidence: row?.confidence ?? "none",
                entityName: row?.entityName ?? null,
                location: row?.entityAddress ?? null,
                note: row?.note ?? null,
                candidates: (row?.candidates ?? []).map(
                  (c) =>
                    `${c.name} [${c.nameMatch}${c.inIstanbul ? ", Istanbul" : ""}]${c.location ? ` · ${c.location}` : ""}`,
                ),
              };
            });
          } catch (error) {
            out.landmarksError =
              error instanceof Error ? error.message.slice(0, 200) : String(error);
          }
        }

        out.calls = calls;
        return Response.json(out);
      },

      POST: async ({ request }) => {
        const denied = authorize(request);
        if (denied) return denied;

        let body: { terms?: unknown; mood?: unknown } = {};
        try {
          body = (await request.json()) as typeof body;
        } catch {
          /* empty body */
        }
        const terms = Array.isArray(body.terms)
          ? body.terms
              .filter((t): t is string => typeof t === "string" && t.trim().length > 0)
              .slice(0, 5)
          : ["Nick Cave", "Amélie", "Agatha Christie"];
        const mood = typeof body.mood === "string" ? body.mood.slice(0, 160) : undefined;

        const calls: QlooCall[] = [];
        const taste: TasteEntity[] = [];
        const resolved: Record<string, string | null> = {};
        try {
          for (const term of terms) {
            const matches = await qlooSearch({ query: term, take: 5 }, calls);
            const best = matches[0];
            resolved[term] = best ? `${best.name} (${best.types[0] ?? "?"})` : null;
            if (best) taste.push({ entityId: best.entityId, name: best.name, type: best.types[0] });
          }
        } catch (error) {
          return Response.json(
            {
              stage: "resolve",
              error: qlooErrorCode(error),
              message: error instanceof Error ? error.message : String(error),
              calls,
            },
            { status: 502 },
          );
        }
        if (taste.length === 0)
          return Response.json({ stage: "resolve", resolved, error: "no_entities", calls });

        const started = Date.now();
        try {
          const plan = await runGuideAgent({ db: supabaseAdmin, taste, mood });
          return Response.json({ resolved, ms: Date.now() - started, resolveCalls: calls, plan });
        } catch (error) {
          return Response.json(
            {
              stage: "plan",
              resolved,
              error: qlooErrorCode(error),
              message: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
              ms: Date.now() - started,
            },
            { status: 502 },
          );
        }
      },
    },
  },
});
