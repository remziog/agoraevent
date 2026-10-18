import { dbError } from "./db-error";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { awardXp } from "./gamification.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Resolve the object path inside the `memories` bucket from a public/signed URL
// produced by `supabase.storage.from("memories").getPublicUrl(path)`.
function memoryObjectPath(photoUrl: string): string | null {
  const base = process.env.SUPABASE_URL ?? "";
  if (!base) return null;
  for (const prefix of [
    `${base}/storage/v1/object/public/memories/`,
    `${base}/storage/v1/object/sign/memories/`,
  ]) {
    if (photoUrl.startsWith(prefix)) {
      const rest = photoUrl.slice(prefix.length).split("?")[0];
      try {
        return decodeURIComponent(rest);
      } catch {
        return rest;
      }
    }
  }
  return null;
}

export const listMyMemories = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("event_memories")
      .select("id, photo_url, caption, created_at, event_id, events(title, starts_at, city)")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw dbError(error);
    return { memories: data ?? [] };
  });

export const listEventMemories = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ event_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: mems, error } = await context.supabase
      .from("event_memories")
      .select("id, photo_url, caption, created_at, user_id")
      .eq("event_id", data.event_id)
      .order("created_at", { ascending: false })
      .limit(60);
    if (error) throw dbError(error);
    const list = mems ?? [];
    const userIds = Array.from(new Set(list.map((m) => m.user_id)));
    const profilesById = new Map<string, { display_name: string | null }>();
    if (userIds.length > 0) {
      const { data: profs } = await context.supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", userIds);
      (profs ?? []).forEach((p) => profilesById.set(p.id, { display_name: p.display_name }));
    }
    const memories = list.map((m) => ({
      ...m,
      profiles: profilesById.get(m.user_id) ?? { display_name: null },
    }));
    return { memories };
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
    // Only accept URLs from this project's `memories` storage bucket so a
    // malicious client can't inject arbitrary external URLs that other users
    // would then load (IP-tracking / pixel-leak).
    const base = process.env.SUPABASE_URL ?? "";
    const prefix = `${base}/storage/v1/object/public/memories/`;
    const signedPrefix = `${base}/storage/v1/object/sign/memories/`;
    if (!base || (!data.photo_url.startsWith(prefix) && !data.photo_url.startsWith(signedPrefix))) {
      throw new Error("Invalid photo URL");
    }
    const { error } = await context.supabase.from("event_memories").insert({
      event_id: data.event_id,
      user_id: context.userId,
      photo_url: data.photo_url,
      caption: data.caption ?? null,
    });
    if (error) throw dbError(error);
    await awardXp(context.userId, 50);
    return { ok: true };
  });

export const deleteMemory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    // RLS restricts the delete to the caller's own rows; `.select()` tells us
    // whether a row was actually removed and gives us the photo URL so the
    // storage object can be removed too. The bucket is public, so leaving the
    // file behind would keep a "deleted" photo reachable by URL.
    const { data: removed, error } = await context.supabase
      .from("event_memories")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .select("id, photo_url");
    if (error) throw dbError(error);
    const row = removed?.[0];
    if (!row) return { ok: true };

    const objectPath = memoryObjectPath(row.photo_url);
    if (objectPath) {
      // Best-effort: the DB row is already gone; log but don't fail the request.
      const { error: storageErr } = await supabaseAdmin.storage
        .from("memories")
        .remove([objectPath]);
      if (storageErr) console.error("[memories] storage remove failed", storageErr);
    }

    // Revert the XP granted on upload so add → delete → add can't farm XP.
    await awardXp(context.userId, -50);
    return { ok: true };
  });
