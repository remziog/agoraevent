import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const getDemandInsightsAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ org_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: org, error: oErr } = await context.supabase
      .from("organizations")
      .select("city, owner_id")
      .eq("id", data.org_id)
      .maybeSingle();
    if (oErr) throw new Error(oErr.message);
    if (!org || org.owner_id !== context.userId) throw new Error("Not authorized");

    // Aggregate only — never read raw prompt text across users (privacy).
    const { data: prompts } = await supabaseAdmin
      .from("prompts")
      .select("tags, city, created_at")
      .gte("created_at", new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString())
      .limit(1000);

    const counts = new Map<string, number>();
    const bundleCounts = new Map<string, number>();
    (prompts ?? []).forEach((p) => {
      if (org.city && p.city && p.city !== org.city) return;
      const tagList = (p.tags ?? []).filter(Boolean) as string[];
      tagList.forEach((t) => counts.set(t, (counts.get(t) ?? 0) + 1));
      if (tagList.length >= 2) {
        const bundle = [...tagList].sort().slice(0, 4).join(" + ");
        bundleCounts.set(bundle, (bundleCounts.get(bundle) ?? 0) + 1);
      }
    });
    const top = [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 25)
      .map(([tag, count]) => ({ tag, count }));
    const samples = [...bundleCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([bundle]) => bundle);
    return { top, total: prompts?.length ?? 0, samples };
  });
