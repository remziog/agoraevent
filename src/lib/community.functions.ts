// A community (organisation) as members see it: who they are, what they
// gather around, and their next real gatherings — the path from one
// recommendation to meeting the same people again.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { dbError } from "./db-error";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getCommunity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: org, error } = await supabase
      .from("organizations")
      .select("id, name, description, category, city, latitude, longitude, created_at")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw dbError(error);
    if (!org)
      return {
        community: null,
        upcoming: [],
        pastCount: 0,
        myRsvps: [] as string[],
        following: false,
      };

    const now = new Date().toISOString();
    const [
      { data: upcoming, error: upErr },
      { count: pastCount },
      { data: mine },
      { data: follow },
    ] = await Promise.all([
      supabase
        .from("events")
        .select(
          "id, title, starts_at, ends_at, venue, city, category, price, capacity, tags, latitude, longitude",
        )
        .eq("org_id", data.id)
        .neq("category", "landmark")
        .gte("starts_at", now)
        .order("starts_at", { ascending: true })
        .limit(20),
      supabase
        .from("events")
        .select("id", { count: "exact", head: true })
        .eq("org_id", data.id)
        .neq("category", "landmark")
        .lt("starts_at", now),
      supabase.from("rsvps").select("event_id").eq("user_id", userId),
      supabase
        .from("community_follows")
        .select("org_id")
        .eq("user_id", userId)
        .eq("org_id", data.id)
        .maybeSingle(),
    ]);
    if (upErr) throw dbError(upErr);
    return {
      community: org,
      upcoming: upcoming ?? [],
      pastCount: pastCount ?? 0,
      myRsvps: (mine ?? []).map((r) => r.event_id),
      following: Boolean(follow),
    };
  });
