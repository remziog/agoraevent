// The taste guide's agent entry point. Same pattern as the other *.functions.ts
// files: Supabase auth + zod; only server functions are exported.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { runGuideAgent } from "./guide-agent.server";
import type { GuidePlan, QlooErrorCode } from "./guide.types";
import { qlooErrorCode } from "./qloo.server";

const Taste = z
  .array(
    z.object({
      entityId: z.string().min(1).max(120),
      name: z.string().trim().min(1).max(120),
      type: z.string().max(60).optional(),
    }),
  )
  .min(1)
  .max(5);

export type PlanVisitResult = { ok: true; plan: GuidePlan } | { ok: false; error: QlooErrorCode };

/**
 * Plan a visit: the agent ranks Agora's landmarks with Qloo for the confirmed
 * favourites, picks three, chooses which story to open with, and looks up
 * Qloo-ranked restaurants and Agora gatherings near the first one.
 */
export const planVisit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ taste: Taste, mood: z.string().trim().max(160).optional() }).parse(d),
  )
  .handler(async ({ data, context }): Promise<PlanVisitResult> => {
    try {
      const plan = await runGuideAgent({
        db: context.supabase,
        taste: data.taste,
        mood: data.mood || undefined,
      });
      return { ok: true, plan };
    } catch (error) {
      console.error(
        "[planVisit]",
        error instanceof Error ? `${error.name}: ${error.message}` : error,
      );
      return { ok: false, error: qlooErrorCode(error) };
    }
  });
