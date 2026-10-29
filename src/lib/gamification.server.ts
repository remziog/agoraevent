// Server-only gamification writes. Uses the service-role client, so this module
// must never reach the browser bundle. The marker import below makes the
// TanStack import-protection plugin fail the build if a client module imports it
// (previously `awardXp` lived next to the server functions as a plain export and
// got bundled into the client chunk together with the admin-client factory).
import "@tanstack/react-start/server-only";

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { levelForXp } from "./gamification.functions";
import { streakFromDates } from "./streak";

/**
 * Award (or revert, with a negative delta) XP, recompute the streak and grant
 * badges for a user.
 *
 * Streak rules (STATE-29-01): the streak is never incremented by the action
 * itself. It is recomputed from the gatherings the person currently has an
 * RSVP for — distinct gatherings in a row, each within two weeks of the
 * previous one — so join → cancel nets to exactly the state before. `eventDate`
 * is kept for callers but no longer drives the number.
 */
export async function awardXp(userId: string, delta: number, _eventDate?: Date) {
  const { data: existing } = await supabaseAdmin
    .from("user_stats")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  const prevXp = existing?.xp ?? 0;
  const newXp = Math.max(0, prevXp + delta);
  const { level } = levelForXp(newXp);

  const { data: going } = await supabaseAdmin
    .from("rsvps")
    .select("events(starts_at, category)")
    .eq("user_id", userId);
  const starts = (going ?? [])
    .map((r) => r.events as { starts_at: string; category: string } | null)
    .filter(
      (e): e is { starts_at: string; category: string } => Boolean(e) && e!.category !== "landmark",
    )
    .map((e) => e.starts_at);
  const streak = streakFromDates(starts);

  await supabaseAdmin.from("user_stats").upsert({
    user_id: userId,
    xp: newXp,
    level,
    current_streak: streak.current,
    longest_streak: streak.longest,
    last_event_at: streak.lastEventAt?.toISOString() ?? null,
    updated_at: new Date().toISOString(),
  });
  const currentStreak = streak.current;

  // Evaluate badges
  const toGrant: string[] = [];
  const { data: rsvpCount } = await supabaseAdmin
    .from("rsvps")
    .select("event_id, events(category)", { count: "exact" })
    .eq("user_id", userId);
  const rsvps = (rsvpCount ?? []) as Array<{
    event_id: string;
    events: { category: string } | null;
  }>;
  if (rsvps.length >= 1) toGrant.push("first_night");
  if (rsvps.length >= 5) toGrant.push("regular_5");
  const distinctCats = new Set(rsvps.map((r) => r.events?.category).filter(Boolean));
  if (distinctCats.size >= 3) toGrant.push("explorer_3");
  if (currentStreak >= 2) toGrant.push("streak_2");
  if (currentStreak >= 4) toGrant.push("streak_4");

  const { count: memCount } = await supabaseAdmin
    .from("event_memories")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  if ((memCount ?? 0) >= 1) toGrant.push("memory_keeper");
  if ((memCount ?? 0) >= 5) toGrant.push("storyteller");

  if (toGrant.length > 0) {
    await supabaseAdmin.from("user_badges").upsert(
      toGrant.map((badge_code) => ({ user_id: userId, badge_code })),
      { onConflict: "user_id,badge_code", ignoreDuplicates: true },
    );
  }
}
