import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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

// `awardXp` lives in ./gamification.server.ts (service-role writes, server-only).
