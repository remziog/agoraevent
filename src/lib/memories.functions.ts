import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { awardXp } from "./gamification.functions";

export const listMyMemories = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("event_memories")
      .select("id, photo_url, caption, created_at, event_id, events(title, starts_at, city)")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { memories: data ?? [] };
  });

export const listEventMemories = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ event_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: mems, error } = await context.supabase
      .from("event_memories")
      .select("id, photo_url, caption, created_at, user_id, profiles(display_name)")
      .eq("event_id", data.event_id)
      .order("created_at", { ascending: false })
      .limit(60);
    if (error) throw new Error(error.message);
    return { memories: mems ?? [] };
  });

export const addMemory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        event_id: z.string().uuid(),
        photo_url: z.string().url().max(1024),
        caption: z.string().max(280).optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("event_memories").insert({
      event_id: data.event_id,
      user_id: context.userId,
      photo_url: data.photo_url,
      caption: data.caption ?? null,
    });
    if (error) throw new Error(error.message);
    await awardXp(context.userId, 50);
    return { ok: true };
  });

export const deleteMemory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("event_memories")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
