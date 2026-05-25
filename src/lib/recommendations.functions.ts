import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";
import { generateText, Output } from "ai";
import { z } from "zod";

export const getRecommendations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const [{ data: socials }, { data: taste }, { data: events }] = await Promise.all([
      supabase.from("social_integrations").select("provider, tags").eq("user_id", userId),
      supabase.from("taste_profiles").select("*").eq("user_id", userId).maybeSingle(),
      supabase
        .from("events")
        .select("*, organizations(name, category, city)")
        .gte("starts_at", new Date().toISOString())
        .order("starts_at", { ascending: true })
        .limit(60),
    ]);

    const userTags = Array.from(
      new Set(
        [
          ...((socials ?? []).flatMap((s) => s.tags ?? []) as string[]),
          ...((taste?.music ?? []) as string[]),
          ...((taste?.sports ?? []) as string[]),
          ...((taste?.films ?? []) as string[]),
          ...((taste?.interests ?? []) as string[]),
        ].map((t) => String(t).toLowerCase()),
      ),
    );

    const list = events ?? [];
    if (list.length === 0) return { recommendations: [], userTags };

    // Quick local score as fallback / baseline
    type Ev = (typeof list)[number];
    const baseline = list.map((e: Ev) => {
      const et = (e.tags ?? []).map((t: string) => t.toLowerCase());
      const overlap = et.filter((t) => userTags.some((u) => t.includes(u) || u.includes(t))).length;
      return { event: e, score: overlap };
    });

    const apiKey = process.env.LOVABLE_API_KEY;
    let ranked: { id: string; reason: string; score: number }[] = [];

    if (apiKey && userTags.length > 0) {
      try {
        const gateway = createLovableAiGatewayProvider(apiKey);
        const model = gateway("google/gemini-3-flash-preview");
        const summary = list.slice(0, 30).map((e: Ev) => ({
          id: e.id,
          title: e.title,
          category: e.category,
          city: e.city,
          tags: e.tags ?? [],
        }));
        const { output } = await generateText({
          model,
          output: Output.object({
            schema: z.object({
              picks: z
                .array(
                  z.object({
                    id: z.string(),
                    reason: z.string().max(120),
                    score: z.number().min(0).max(10),
                  }),
                )
                .max(6),
            }),
          }),
          system:
            "You are a taste-aware event recommender. Given a user's interest tags and a list of upcoming events, pick up to 6 that best match. Reason should be one short sentence in second person, mentioning the matching interest. Never invent events outside the provided list.",
          prompt: `User tags: ${userTags.slice(0, 40).join(", ")}\n\nEvents:\n${JSON.stringify(summary)}`,
        });
        ranked = output.picks;
      } catch (e) {
        console.error("AI recommendation failed", e);
      }
    }

    const byId = new Map(list.map((e: Ev) => [e.id, e]));
    let final: { event: Ev; reason: string; score: number }[];
    if (ranked.length > 0) {
      final = ranked
        .map((r) => {
          const ev = byId.get(r.id);
          return ev ? { event: ev, reason: r.reason, score: r.score } : null;
        })
        .filter((x): x is { event: Ev; reason: string; score: number } => !!x);
    } else {
      final = baseline
        .filter((b) => b.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 6)
        .map((b) => ({
          event: b.event,
          reason: `Matches ${b.score} of your interests`,
          score: b.score,
        }));
    }

    return { recommendations: final, userTags };
  });
