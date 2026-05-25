import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Flame, Sparkles } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { getMyStats } from "@/lib/gamification.functions";

export function XpChip() {
  const fetchStats = useServerFn(getMyStats);
  const { data } = useQuery({ queryKey: ["my-stats"], queryFn: () => fetchStats() });

  if (!data) return null;
  const { stats, progress } = data;
  const pct = Math.min(100, Math.round((progress.xpInLevel / progress.xpToNext) * 100));

  return (
    <Link
      to="/app/profile"
      className="group flex items-center gap-3 rounded-full border border-border bg-card/60 px-3 py-1.5 text-xs transition hover:border-primary/50"
      title={`${stats.xp} XP · Level ${progress.level}`}
    >
      <span className="flex items-center gap-1.5 font-display">
        <Sparkles className="h-3.5 w-3.5 text-primary" />
        <span className="tabular-nums">L{progress.level}</span>
      </span>
      <span className="hidden h-1.5 w-20 overflow-hidden rounded-full bg-muted sm:block">
        <span
          className="block h-full bg-gradient-to-r from-primary to-primary/60 transition-all"
          style={{ width: `${pct}%` }}
        />
      </span>
      {stats.current_streak > 0 && (
        <span className="flex items-center gap-0.5 text-orange-400">
          <Flame className="h-3.5 w-3.5" />
          <span className="tabular-nums">{stats.current_streak}</span>
        </span>
      )}
    </Link>
  );
}
