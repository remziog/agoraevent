// Server-only gamification writes. Uses the service-role client, so this module
// must never reach the browser bundle. The marker import below makes the
// TanStack import-protection plugin fail the build if a client module imports it
// (previously `awardXp` lived next to the server functions as a plain export and
// got bundled into the client chunk together with the admin-client factory).
import "@tanstack/react-start/server-only";

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { levelForXp } from "./gamification.functions";

/**
 * Award (or revert, with a negative delta) XP, update the streak, and grant
 * badges for a user.
 *
 * Streak rules: `eventDate` is the start of the event the user just RSVP'd to.
 * The streak grows only when the event is a *different* one from the last
 * counted event (same timestamp = same event re-RSVP'd → no change), and only
 * when it falls within two weeks of the previous one.
 */
export async function awardXp(userId: string, delta: number, eventDate?: Date) {
  const { data: existing } = await supabaseAdmin
    .from("user_stats")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  const prevXp = existing?.xp ?? 0;
  const newXp = Math.max(0, prevXp + delta);
  const { level } = levelForXp(newXp);

  let currentStreak = existing?.current_streak ?? 0;
  let longestStreak = existing?.longest_streak ?? 0;
  let lastEventAt = existing?.last_event_at ? new Date(existing.last_event_at) : null;

  if (eventDate && delta > 0) {
    const oneWeekMs = 7 * 24 * 3600 * 1000;
    const sameEvent = lastEventAt !== null && lastEventAt.getTime() === eventDate.getTime();
    if (!sameEvent) {
      if (!lastEventAt) {
        currentStreak = 1;
      } else {
        const diff = Math.abs(eventDate.getTime() - lastEventAt.getTime());
        if (diff <= oneWeekMs * 2) currentStreak = currentStreak + 1;
        else currentStreak = 1;
      }
      longestStreak = Math.max(longestStreak, currentStreak);
      lastEventAt = eventDate;
    }
  }

  await supabaseAdmin.from("user_stats").upsert({
    user_id: userId,
    xp: newXp,
    level,
    current_streak: currentStreak,
    longest_streak: longestStreak,
    last_event_at: lastEventAt?.toISOString() ?? null,
    updated_at: new Date().toISOString(),
  });

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
