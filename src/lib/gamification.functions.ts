import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// XP needed for next level grows quadratically: 100, 300, 600, 1000, 1500...
export function levelForXp(xp: number): { level: number; xpInLevel: number; xpToNext: number } {
  let level = 1;
  let acc = 0;
  while (true) {
    const need = level * 100;
    if (xp < acc + need) {
      return { level, xpInLevel: xp - acc, xpToNext: need };
    }
    acc += need;
    level += 1;
    if (level > 99) return { level: 99, xpInLevel: 0, xpToNext: 1 };
  }
}

export const BADGES: Record<string, { name: string; description: string; icon: string }> = {
  first_night: { name: "First Night Out", description: "RSVP'd to your first event", icon: "✨" },
  explorer_3: { name: "Explorer", description: "RSVP'd to 3 different categories", icon: "🧭" },
  regular_5: { name: "Regular", description: "5 events attended", icon: "🍷" },
  streak_2: { name: "On a Roll", description: "2-week streak", icon: "🔥" },
  streak_4: { name: "Unstoppable", description: "4-week streak", icon: "🚀" },
  memory_keeper: { name: "Memory Keeper", description: "Uploaded your first memory", icon: "📸" },
  storyteller: { name: "Storyteller", description: "5 memories shared", icon: "📚" },
};

export const getMyStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: stats } = await supabase
      .from("user_stats")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    const { data: badges } = await supabase
      .from("user_badges")
      .select("badge_code, earned_at")
      .eq("user_id", userId)
      .order("earned_at", { ascending: false });
    const xp = stats?.xp ?? 0;
    return {
      stats: stats ?? {
        user_id: userId,
        xp: 0,
        level: 1,
        current_streak: 0,
        longest_streak: 0,
        last_event_at: null,
      },
      progress: levelForXp(xp),
      badges: badges ?? [],
    };
  });

/** Award XP, update streak, and grant badges for a given user. Server-side only. */
export async function awardXp(userId: string, delta: number, eventDate?: Date) {
  const { data: existing } = await supabaseAdmin
    .from("user_stats")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  const prevXp = existing?.xp ?? 0;
  const newXp = prevXp + delta;
  const { level } = levelForXp(newXp);

  let currentStreak = existing?.current_streak ?? 0;
  let longestStreak = existing?.longest_streak ?? 0;
  let lastEventAt = existing?.last_event_at ? new Date(existing.last_event_at) : null;

  if (eventDate) {
    const oneWeekMs = 7 * 24 * 3600 * 1000;
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
  const rsvps = (rsvpCount ?? []) as Array<{ event_id: string; events: { category: string } | null }>;
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
    await supabaseAdmin
      .from("user_badges")
      .upsert(
        toGrant.map((badge_code) => ({ user_id: userId, badge_code })),
        { onConflict: "user_id,badge_code", ignoreDuplicates: true },
      );
  }
}
