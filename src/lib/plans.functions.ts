// "My plans" and "My communities": private bookmarks (saved gatherings and
// Qloo places), the gatherings the person is going to, the communities behind
// them and the ones they follow. Saving is never an RSVP: it writes only to
// `saved_items`, so organisers, the calendar and XP never see it (29 Oct scope).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { dbError } from "./db-error";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SavedPlacePayload = z.object({
  name: z.string().min(1).max(160),
  district: z.string().max(60),
  kind: z.string().max(40).nullable().optional(),
  address: z.string().max(240).optional(),
  rating: z.number().min(0).max(5).optional(),
  priceLevel: z.number().min(0).max(5).optional(),
  geocode: z.object({ latitude: z.number(), longitude: z.number() }).optional(),
  /** Favourites Qloo credited for this pick, at the time it was saved. */
  drivers: z.array(z.string().max(120)).max(6).optional(),
  cuisineTags: z.array(z.string().max(60)).max(6).optional(),
  /** The request it answered (for "why did I save this?"). */
  prompt: z.string().max(200).optional(),
});
export type SavedPlacePayload = z.infer<typeof SavedPlacePayload>;

const SaveInput = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("event"), refId: z.string().uuid() }),
  z.object({
    kind: z.literal("place"),
    refId: z.string().min(1).max(120),
    payload: SavedPlacePayload,
  }),
]);

/** Bookmark a gathering or a place. Idempotent; never touches rsvps or stats. */
export const saveItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SaveInput.parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("saved_items").upsert(
      {
        user_id: context.userId,
        kind: data.kind,
        ref_id: data.refId,
        payload: data.kind === "place" ? data.payload : {},
      },
      { onConflict: "user_id,kind,ref_id", ignoreDuplicates: true },
    );
    if (error) throw dbError(error);
    return { ok: true as const };
  });

/** Remove a bookmark. Leaves any RSVP for the same gathering untouched. */
export const unsaveItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ kind: z.enum(["event", "place"]), refId: z.string().min(1).max(120) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("saved_items")
      .delete()
      .eq("user_id", context.userId)
      .eq("kind", data.kind)
      .eq("ref_id", data.refId);
    if (error) throw dbError(error);
    return { ok: true as const };
  });

export type SavedPlace = { refId: string; savedAt: string; place: SavedPlacePayload };

/**
 * Everything on "My plans": gatherings I'm going to (rsvps), gatherings I saved
 * (saved_items, read live from events) and places I saved (snapshot).
 */
export const getMyPlans = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [{ data: saved, error: sErr }, { data: rsvps, error: rErr }] = await Promise.all([
      supabase
        .from("saved_items")
        .select("kind, ref_id, payload, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false }),
      supabase
        .from("rsvps")
        .select(
          "event_id, status, created_at, events(id, title, starts_at, ends_at, venue, city, category, price, capacity, tags, latitude, longitude, org_id, organizations(name, city))",
        )
        .eq("user_id", userId)
        .order("created_at", { ascending: false }),
    ]);
    if (sErr) throw dbError(sErr);
    if (rErr) throw dbError(rErr);

    const savedEventIds = (saved ?? []).filter((s) => s.kind === "event").map((s) => s.ref_id);
    const { data: savedEvents, error: eErr } =
      savedEventIds.length > 0
        ? await supabase
            .from("events")
            .select(
              "id, title, starts_at, ends_at, venue, city, category, price, capacity, tags, latitude, longitude, org_id, organizations(name, city)",
            )
            .in("id", savedEventIds)
        : { data: [], error: null };
    if (eErr) throw dbError(eErr);

    const places: SavedPlace[] = (saved ?? [])
      .filter((s) => s.kind === "place")
      .map((s) => {
        const parsed = SavedPlacePayload.safeParse(s.payload);
        return parsed.success
          ? { refId: s.ref_id, savedAt: s.created_at, place: parsed.data }
          : null;
      })
      .filter((x): x is SavedPlace => x !== null);

    const goingIds = new Set((rsvps ?? []).map((r) => r.event_id));
    return {
      going: (rsvps ?? []).map((r) => r.events).filter(Boolean),
      savedEvents: (savedEvents ?? []).map((e) => ({ ...e, going: goingIds.has(e.id) })),
      savedPlaces: places,
      savedEventIds,
    };
  });

/** Is this gathering / place saved? (one round-trip for a detail page) */
export const getSavedState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ kind: z.enum(["event", "place"]), refId: z.string().min(1).max(120) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("saved_items")
      .select("id")
      .eq("user_id", context.userId)
      .eq("kind", data.kind)
      .eq("ref_id", data.refId)
      .maybeSingle();
    if (error) throw dbError(error);
    return { saved: Boolean(row) };
  });

/** Ids of everything saved, for marking cards in lists. */
export const listSavedIds = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("saved_items")
      .select("kind, ref_id")
      .eq("user_id", context.userId);
    if (error) throw dbError(error);
    return {
      events: (data ?? []).filter((s) => s.kind === "event").map((s) => s.ref_id),
      places: (data ?? []).filter((s) => s.kind === "place").map((s) => s.ref_id),
    };
  });

// ---------------------------------------------------------------------------
// Communities
// ---------------------------------------------------------------------------

export const followCommunity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ orgId: z.string().uuid(), follow: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    if (data.follow) {
      const { error } = await context.supabase
        .from("community_follows")
        .upsert(
          { user_id: context.userId, org_id: data.orgId },
          { onConflict: "user_id,org_id", ignoreDuplicates: true },
        );
      if (error) throw dbError(error);
    } else {
      const { error } = await context.supabase
        .from("community_follows")
        .delete()
        .eq("user_id", context.userId)
        .eq("org_id", data.orgId);
      if (error) throw dbError(error);
    }
    return { ok: true as const, following: data.follow };
  });

export type MyCommunity = {
  id: string;
  name: string;
  category: string;
  city: string | null;
  description: string | null;
  /** Gatherings of this community the person has joined (RSVP), upcoming or past. */
  joinedCount: number;
  following: boolean;
  next: {
    id: string;
    title: string;
    starts_at: string;
    venue: string | null;
    tags: string[] | null;
  } | null;
};

/**
 * "My communities": the organisers of gatherings I joined (that is what the
 * relationship is — not a membership) and the communities I follow, with the
 * next real gathering of each.
 */
export const getMyCommunities = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [{ data: rsvps, error: rErr }, { data: follows, error: fErr }] = await Promise.all([
      supabase.from("rsvps").select("event_id, events(org_id)").eq("user_id", userId),
      supabase.from("community_follows").select("org_id").eq("user_id", userId),
    ]);
    if (rErr) throw dbError(rErr);
    if (fErr) throw dbError(fErr);

    const joinedCount = new Map<string, number>();
    for (const r of rsvps ?? []) {
      const orgId = (r.events as { org_id: string | null } | null)?.org_id;
      if (orgId) joinedCount.set(orgId, (joinedCount.get(orgId) ?? 0) + 1);
    }
    const followed = new Set((follows ?? []).map((f) => f.org_id));
    const ids = Array.from(new Set([...joinedCount.keys(), ...followed]));
    if (ids.length === 0) return { joined: [] as MyCommunity[], following: [] as MyCommunity[] };

    const now = new Date().toISOString();
    const [{ data: orgs, error: oErr }, { data: upcoming, error: uErr }] = await Promise.all([
      supabase.from("organizations").select("id, name, category, city, description").in("id", ids),
      supabase
        .from("events")
        .select("id, title, starts_at, venue, tags, org_id")
        .in("org_id", ids)
        .neq("category", "landmark")
        .gte("starts_at", now)
        .order("starts_at", { ascending: true })
        .limit(200),
    ]);
    if (oErr) throw dbError(oErr);
    if (uErr) throw dbError(uErr);

    const nextByOrg = new Map<string, NonNullable<MyCommunity["next"]>>();
    for (const e of upcoming ?? []) {
      if (e.org_id && !nextByOrg.has(e.org_id)) nextByOrg.set(e.org_id, e);
    }
    const toCommunity = (o: NonNullable<typeof orgs>[number]): MyCommunity => ({
      id: o.id,
      name: o.name,
      category: o.category,
      city: o.city,
      description: o.description,
      joinedCount: joinedCount.get(o.id) ?? 0,
      following: followed.has(o.id),
      next: nextByOrg.get(o.id) ?? null,
    });
    const all = (orgs ?? []).map(toCommunity);
    return {
      joined: all.filter((c) => c.joinedCount > 0).sort((a, b) => b.joinedCount - a.joinedCount),
      following: all.filter((c) => c.following),
    };
  });
