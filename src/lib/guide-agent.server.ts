// The taste guide agent. Built on the Vercel AI SDK's ToolLoopAgent (tool
// calling over the Lovable AI gateway). The model decides which tools to call
// and writes one-sentence hooks; every fact the UI shows (rankings, affinities,
// restaurants, events, story text) comes from tool executions recorded here on
// the server, never from the model's text. If the agent is unavailable, Agora
// falls back to a fixed plan built from the same tools and says so.
import "@tanstack/react-start/server-only";

import { hasToolCall, stepCountIs, tool, ToolLoopAgent } from "ai";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";
import type {
  GatheringEvent,
  GuidePick,
  GuidePlan,
  GuideTraceStep,
  LandmarkPick,
  RestaurantsResult,
  TasteEntity,
} from "./guide.types";
import { ISTANBUL_LANDMARKS, type Landmark } from "./istanbul-landmarks";
import { getLandmarkStory } from "./landmark-stories";
import { explainDrivers, type QlooCall } from "./qloo.schemas";
import { qlooErrorCode } from "./qloo.server";
import { rankLandmarks, restaurantsNear } from "./qloo-guide.server";

/** Tried in order; the gateway's catalogue changes, so a rejected model falls through to the next. */
const MODELS = ["google/gemini-3-flash-preview", "google/gemini-2.5-flash"];
const AGENT_TIMEOUT_MS = 30_000;
const PICKS = 3;
const GATHERING_RADIUS_KM = 3;

const landmarkById = new Map(ISTANBUL_LANDMARKS.map((l) => [l.id, l]));

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

type Db = SupabaseClient<Database>;

/** Agora's own community events within a few km of the landmark in the next 7 days (not Qloo data). */
async function gatheringsNear(db: Db, landmark: Landmark): Promise<GatheringEvent[]> {
  const now = new Date();
  const inAWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const { data, error } = await db
    .from("events")
    .select("id, title, starts_at, venue, latitude, longitude, category, tags, organizations(name)")
    .gte("starts_at", now.toISOString())
    .lte("starts_at", inAWeek.toISOString())
    .not("latitude", "is", null)
    .not("longitude", "is", null)
    .neq("category", "landmark")
    .order("starts_at", { ascending: true })
    .limit(80);
  if (error) throw new Error(`events query failed: ${error.message}`);
  return (data ?? [])
    .map((e) => ({
      id: e.id,
      title: e.title,
      startsAt: e.starts_at,
      venue: e.venue,
      organizer: (e.organizations as { name?: string } | null)?.name ?? null,
      distanceKm: distanceKm(landmark, {
        latitude: e.latitude as number,
        longitude: e.longitude as number,
      }),
      sample: (e.tags ?? []).includes("demo"),
    }))
    .filter((e) => e.distanceKm <= GATHERING_RADIUS_KM)
    .slice(0, 3)
    .map((e) => ({ ...e, distanceKm: Math.round(e.distanceKm * 10) / 10 }));
}

type Collected = {
  ranked: LandmarkPick[] | null;
  unmatched: string[];
  restaurants: Map<string, RestaurantsResult>;
  gatherings: Map<string, GatheringEvent[]>;
  submitted: {
    picks: { landmarkId: string; storySection: string; hook: string }[];
    diningLandmarkId: string;
    summary: string;
  } | null;
};

/** One guide run: tools share the collected state and the trace. */
function makeTools(db: Db, taste: TasteEntity[], collected: Collected, trace: GuideTraceStep[]) {
  const tasteIds = taste.map((t) => t.entityId);

  async function timed<T>(
    name: string,
    input: GuideTraceStep["input"],
    source: GuideTraceStep["source"],
    fn: (calls: QlooCall[]) => Promise<{ value: T; label: string }>,
  ): Promise<T> {
    const calls: QlooCall[] = [];
    const started = Date.now();
    try {
      const { value, label } = await fn(calls);
      trace.push({
        kind: "tool",
        name,
        label,
        input,
        ms: Date.now() - started,
        qloo: calls,
        source,
      });
      return value;
    } catch (error) {
      const reason =
        source === "qloo"
          ? qlooErrorCode(error)
          : error instanceof Error
            ? error.message
            : "failed";
      trace.push({
        kind: "tool",
        name,
        label: `failed (${reason})`,
        input,
        ms: Date.now() - started,
        qloo: calls,
        source,
      });
      throw error;
    }
  }

  const rank = () =>
    timed("rank_landmarks", null, "qloo", async (calls) => {
      const { picks, unmatchedLandmarkIds } = await rankLandmarks(tasteIds, calls);
      collected.ranked = picks;
      collected.unmatched = unmatchedLandmarkIds;
      return {
        value: picks,
        label: `Qloo ranked ${picks.length} landmarks for your taste (${unmatchedLandmarkIds.length} not in Qloo's graph)`,
      };
    });

  const restaurants = (landmarkId: string) =>
    timed("restaurants_near", { landmarkId }, "qloo", async (calls) => {
      const result = await restaurantsNear(landmarkId, tasteIds, 3, calls);
      collected.restaurants.set(landmarkId, result);
      return {
        value: result,
        label: `Qloo ranked ${result.restaurants.length} restaurants in ${result.district} for your taste`,
      };
    });

  const gatherings = (landmarkId: string) =>
    timed("gatherings_near", { landmarkId }, "agora", async () => {
      const landmark = landmarkById.get(landmarkId);
      if (!landmark) throw new Error("unknown landmark");
      const events = await gatheringsNear(db, landmark);
      collected.gatherings.set(landmarkId, events);
      return {
        value: events,
        label: `${events.length} Agora gathering(s) within ${GATHERING_RADIUS_KM} km this week`,
      };
    });

  const landmarkIdSchema = z
    .string()
    .describe("A landmarkId exactly as returned by rank_landmarks, e.g. lm-basilica-cistern");

  const tools = {
    rank_landmarks: tool({
      description:
        "Rank Agora's curated Istanbul landmarks with Qloo's taste graph for this person's confirmed favourites. Call this first.",
      inputSchema: z.object({}),
      execute: async () => {
        const picks = await rank();
        return {
          ranked: picks.slice(0, 8).map((p, i) => {
            const l = landmarkById.get(p.landmarkId);
            return {
              landmarkId: p.landmarkId,
              qlooRank: i + 1,
              name: l?.title,
              district: l?.district,
              kind: l?.category,
              qlooCredits: explainDrivers(p.explainability, taste).map((d) => d.name),
            };
          }),
          note: "Order is Qloo's affinity ranking. Landmarks Qloo cannot place are not listed.",
        };
      },
    }),
    story_outline: tool({
      description: "The narrated story sections of a landmark (history and legend kept separate).",
      inputSchema: z.object({ landmarkId: landmarkIdSchema }),
      execute: async ({ landmarkId }) => {
        const landmark = landmarkById.get(landmarkId);
        if (!landmark) return { error: "unknown landmarkId" };
        const story = getLandmarkStory(landmark);
        trace.push({
          kind: "tool",
          name: "story_outline",
          label: `Read the story outline of ${landmark.title}`,
          input: { landmarkId },
          source: "agora",
        });
        return {
          landmark: landmark.title,
          sections: story.sections.map((s) => ({
            kind: s.kind,
            title: s.title,
            opening: s.text.split(/(?<=[.!?])\s/)[0]?.slice(0, 220),
          })),
        };
      },
    }),
    restaurants_near: tool({
      description:
        "Restaurants in the landmark's neighbourhood, ranked by Qloo for this person's taste. Call for the first chosen landmark only.",
      inputSchema: z.object({ landmarkId: landmarkIdSchema }),
      execute: async ({ landmarkId }) => {
        if (!landmarkById.has(landmarkId)) return { error: "unknown landmarkId" };
        const result = await restaurants(landmarkId);
        return {
          district: result.district,
          restaurants: result.restaurants.map((r) => ({
            name: r.name,
            cuisine: r.cuisineTags,
            qlooCredits: explainDrivers(r.explainability, taste).map((d) => d.name),
          })),
        };
      },
    }),
    gatherings_near: tool({
      description:
        "Agora community gatherings within a few km of the landmark in the next 7 days (Agora data, not Qloo). Call for the first chosen landmark only.",
      inputSchema: z.object({ landmarkId: landmarkIdSchema }),
      execute: async ({ landmarkId }) => {
        if (!landmarkById.has(landmarkId)) return { error: "unknown landmarkId" };
        const events = await gatherings(landmarkId);
        return {
          gatherings: events.map((e) => ({ title: e.title, startsAt: e.startsAt, venue: e.venue })),
        };
      },
    }),
    submit_plan: tool({
      description: "Submit the finished plan. Call exactly once, last.",
      inputSchema: z.object({
        picks: z
          .array(
            z.object({
              landmarkId: landmarkIdSchema,
              storySection: z
                .string()
                .describe("Title of the chosen story section, copied from story_outline"),
              hook: z
                .string()
                .describe(
                  "One sentence, second person, at most 28 words, linking one of the person's favourites to that story section",
                ),
            }),
          )
          .min(1)
          .max(PICKS),
        diningLandmarkId: landmarkIdSchema.describe(
          "The landmark whose neighbourhood restaurants you looked up",
        ),
        summary: z
          .string()
          .describe("One short sentence summing up the visit, second person, no numbers"),
      }),
      execute: async (plan) => {
        collected.submitted = plan;
        return { ok: true };
      },
    }),
  };
  return { tools, rank, restaurants, gatherings };
}

function instructions(taste: TasteEntity[], mood?: string) {
  return [
    "You are Agora's guide agent for Istanbul. You plan a short visit for one person, using tools.",
    `The person's confirmed favourites: ${taste.map((t) => `${t.name}${t.type ? ` (${t.type.replace("urn:entity:", "")})` : ""}`).join("; ")}.`,
    mood ? `Their mood for today, in their words: "${mood}".` : "",
    "Steps:",
    "1. Call rank_landmarks first. Its order is Qloo's taste ranking and is the ground truth for fit.",
    `2. Choose exactly ${PICKS} landmarks from its top 6. Keep Qloo's order unless the mood clearly calls for a swap. Never choose a landmark rank_landmarks did not return.`,
    "3. Call story_outline for each chosen landmark and pick the one section whose subject best connects to the favourites (prefer a section Qloo's credits point to).",
    "4. Call restaurants_near and gatherings_near for the first chosen landmark only.",
    "5. Call submit_plan once. Hooks: one sentence each, second person, at most 28 words, name one favourite and the chosen section's subject.",
    "Never state facts that are not in tool results, never mention affinity numbers, and never say Qloo recommended something it did not return.",
  ]
    .filter(Boolean)
    .join("\n");
}

function sectionExists(landmarkId: string, title: string | undefined) {
  const landmark = landmarkById.get(landmarkId);
  if (!landmark || !title) return undefined;
  const sections = getLandmarkStory(landmark).sections;
  const found = sections.find((s) => s.title.toLowerCase() === title.trim().toLowerCase());
  return found?.title;
}

function trimHook(hook: string | undefined): string | undefined {
  if (!hook) return undefined;
  const words = hook.trim().split(/\s+/);
  return words.length > 40 ? `${words.slice(0, 40).join(" ")}…` : hook.trim();
}

export async function runGuideAgent(input: {
  db: Db;
  taste: TasteEntity[];
  mood?: string;
}): Promise<GuidePlan> {
  const { db, taste, mood } = input;
  const trace: GuideTraceStep[] = [];
  const collected: Collected = {
    ranked: null,
    unmatched: [],
    restaurants: new Map(),
    gatherings: new Map(),
    submitted: null,
  };
  const { tools, rank, restaurants, gatherings } = makeTools(db, taste, collected, trace);

  let mode: GuidePlan["mode"] = "fixed";
  let model: string | undefined;
  let notice: string | undefined;

  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) {
    notice = "The AI agent is not configured on this server, so Agora used its fixed plan.";
  } else {
    const gateway = createLovableAiGatewayProvider(apiKey);
    for (const candidate of MODELS) {
      const started = Date.now();
      try {
        const agent = new ToolLoopAgent({
          model: gateway(candidate),
          instructions: instructions(taste, mood),
          tools,
          stopWhen: [hasToolCall("submit_plan"), stepCountIs(10)],
        });
        const result = await agent.generate({
          prompt: "Plan my visit.",
          abortSignal: AbortSignal.timeout(AGENT_TIMEOUT_MS),
        });
        trace.push({
          kind: "agent",
          name: "agent",
          label: `Agent finished in ${result.steps.length} step(s) with ${candidate}`,
          ms: Date.now() - started,
          source: "ai",
        });
        if (collected.submitted) {
          mode = "agent";
          model = candidate;
        } else {
          notice =
            "The agent stopped without submitting a plan, so Agora completed it with its fixed plan.";
        }
        break;
      } catch (error) {
        const message = error instanceof Error ? error.message.slice(0, 160) : "unknown error";
        trace.push({
          kind: "agent",
          name: "agent",
          label: `Agent with ${candidate} failed: ${message}`,
          ms: Date.now() - started,
          source: "ai",
        });
        console.error("[guide-agent]", candidate, message);
        // A Qloo failure inside a tool will fail every model the same way; stop here.
        if (
          collected.ranked === null &&
          trace.some((t) => t.name === "rank_landmarks" && t.label.startsWith("failed"))
        )
          break;
        // Only retry with the next model when the failure was quick (rejected model, bad request).
        if (Date.now() - started > 8_000) break;
      }
    }
    if (mode === "fixed" && !notice) {
      notice = "The AI agent did not answer in time, so Agora used its fixed plan.";
    }
  }

  // Ground truth: Qloo's ranking. Recompute if the agent never got that far (cached per isolate).
  if (collected.ranked === null) await rank();
  const ranked = collected.ranked ?? [];
  const qlooRankOf = new Map(ranked.map((p, i) => [p.landmarkId, i + 1]));

  // Picks: the agent's choice if it is valid, otherwise Qloo's top three.
  const chosen: { landmarkId: string; storySection?: string; hook?: string }[] = [];
  if (mode === "agent" && collected.submitted) {
    for (const p of collected.submitted.picks) {
      const position = qlooRankOf.get(p.landmarkId);
      if (!position || position > 6 || chosen.some((c) => c.landmarkId === p.landmarkId)) continue;
      chosen.push({ landmarkId: p.landmarkId, storySection: p.storySection, hook: p.hook });
    }
  }
  for (const p of ranked) {
    if (chosen.length >= PICKS) break;
    if (!chosen.some((c) => c.landmarkId === p.landmarkId))
      chosen.push({ landmarkId: p.landmarkId });
  }

  const byLandmark = new Map(ranked.map((p) => [p.landmarkId, p]));
  const picks: GuidePick[] = chosen.map((c) => {
    const p = byLandmark.get(c.landmarkId);
    return {
      landmarkId: c.landmarkId,
      qlooRank: qlooRankOf.get(c.landmarkId) ?? 0,
      affinity: p?.affinity,
      drivers: explainDrivers(p?.explainability, taste).map((d) => d.name),
      storySectionTitle: sectionExists(c.landmarkId, c.storySection),
      hook:
        c.storySection && sectionExists(c.landmarkId, c.storySection)
          ? trimHook(c.hook)
          : undefined,
    };
  });

  // Dining and gatherings for the first pick, looked up now if the agent did not.
  const first = picks[0]?.landmarkId;
  let dining: GuidePlan["dining"] = null;
  let gatheringsOut: GuidePlan["gatherings"] = null;
  if (first) {
    try {
      const r = collected.restaurants.get(first) ?? (await restaurants(first));
      dining = {
        ...r,
        landmarkId: first,
        drivers: Object.fromEntries(
          r.restaurants.map((x) => [
            x.qlooEntityId,
            explainDrivers(x.explainability, taste).map((d) => d.name),
          ]),
        ),
      };
    } catch {
      notice = notice ?? "Qloo did not return restaurants for this neighbourhood just now.";
    }
    try {
      const events = collected.gatherings.get(first) ?? (await gatherings(first));
      gatheringsOut = { landmarkId: first, events };
    } catch {
      gatheringsOut = null;
    }
  }

  if (picks.length === 0) {
    notice =
      ranked.length === 0
        ? "Qloo could not rank any of Agora's landmarks for these favourites. Try different ones."
        : notice;
  }

  return {
    mode,
    model,
    taste,
    mood,
    picks,
    dining,
    gatherings: gatheringsOut,
    unmatchedLandmarkIds: collected.unmatched,
    summary: mode === "agent" ? collected.submitted?.summary : undefined,
    notice,
    trace,
  };
}
