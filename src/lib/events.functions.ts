import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";
import { generateText, Output } from "ai";

const SearchInput = z.object({
  prompt: z.string().min(1).max(500),
  city: z.string().max(120).optional().nullable(),
});

function extractTagsFallback(prompt: string): string[] {
  return Array.from(
    new Set(
      prompt
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length > 3)
        .slice(0, 8),
    ),
  );
}

export const searchEvents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SearchInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Extract tags from prompt via Lovable AI
    let tags: string[] = [];
    const apiKey = process.env.LOVABLE_API_KEY;
    if (apiKey) {
      try {
        const gateway = createLovableAiGatewayProvider(apiKey);
        const model = gateway("google/gemini-3-flash-preview");
        const { output } = await generateText({
          model,
          output: Output.object({
            schema: z.object({
              tags: z.array(z.string()).min(1).max(10),
              vibe: z.string().max(80),
            }),
          }),
          prompt: `Extract 3-8 short lowercase interest tags from this request to find a real-world event or gathering. Tags should be single words or short phrases like "indie-music", "running", "coffee", "film-club", "boardgames", "techno", "yoga". Request: "${data.prompt}"`,
        });
        tags = output.tags.map((t) => t.toLowerCase().trim()).filter(Boolean);
      } catch (e) {
        console.error("AI tag extraction failed", e);
        tags = extractTagsFallback(data.prompt);
      }
    } else {
      tags = extractTagsFallback(data.prompt);
    }

    // Persist prompt for demand insights
    await supabase.from("prompts").insert({
      user_id: userId,
      text: data.prompt,
      tags,
      city: data.city ?? null,
    });

    // Pull upcoming events
    let q = supabase
      .from("events")
      .select("*, organizations(name, category, city)")
      .gte("starts_at", new Date().toISOString())
      .order("starts_at", { ascending: true })
      .limit(100);
    if (data.city) q = q.eq("city", data.city);

    const { data: events, error } = await q;
    if (error) throw new Error(error.message);

    type EventRow = NonNullable<typeof events>[number];
    const scored = (events ?? [])
      .map((e: EventRow) => {
        const eventTags = (e.tags ?? []).map((t: string) => t.toLowerCase());
        const overlap = eventTags.filter((t: string) =>
          tags.some((q) => t.includes(q) || q.includes(t)),
        ).length;
        return { ...e, _score: overlap };
      })
      .sort((a, b) => b._score - a._score || +new Date(a.starts_at) - +new Date(b.starts_at))
      .slice(0, 25);

    return { events: scored, tags };
  });

export const listUpcomingEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("events")
      .select("*, organizations(name, category, city)")
      .gte("starts_at", new Date().toISOString())
      .order("starts_at", { ascending: true })
      .limit(50);
    if (error) throw new Error(error.message);
    return { events: data ?? [] };
  });

export const getEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: event, error } = await context.supabase
      .from("events")
      .select("*, organizations(name, category, city, description)")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    const { data: rsvp } = await context.supabase
      .from("rsvps")
      .select("status")
      .eq("event_id", data.id)
      .eq("user_id", context.userId)
      .maybeSingle();
    return { event, rsvp };
  });

export const rsvpEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ event_id: z.string().uuid(), going: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    if (data.going) {
      const { error } = await context.supabase
        .from("rsvps")
        .upsert({ event_id: data.event_id, user_id: context.userId, status: "going" });
      if (error) throw new Error(error.message);
    } else {
      const { error } = await context.supabase
        .from("rsvps")
        .delete()
        .eq("event_id", data.event_id)
        .eq("user_id", context.userId);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const listMyRsvps = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("rsvps")
      .select("event_id, status, events(*, organizations(name, city))")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { rsvps: data ?? [] };
  });
