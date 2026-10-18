import { dbError } from "./db-error";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Sign-in-and-go: derive a sensible display name from auth metadata and
// finish onboarding with no UI questions. City defaults to Istanbul since
// that's the launch city.
export const autoCompleteOnboarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId, claims } = context;
    const meta = (claims?.user_metadata ?? {}) as Record<string, unknown>;
    const fromMeta =
      (typeof meta.display_name === "string" && meta.display_name) ||
      (typeof meta.full_name === "string" && meta.full_name) ||
      (typeof meta.name === "string" && meta.name) ||
      "";
    const emailLocal =
      typeof claims?.email === "string" ? claims.email.split("@")[0] : "";
    const displayName = (fromMeta || emailLocal || "Friend")
      .toString()
      .slice(0, 80);

    const { error: pErr } = await supabase.from("profiles").upsert({
      id: userId,
      display_name: displayName,
      city: "Istanbul",
      onboarded: true,
    });
    if (pErr) throw dbError(pErr);
    return { ok: true };
  });

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [{ data: profile }, { data: taste }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase.from("taste_profiles").select("*").eq("user_id", userId).maybeSingle(),
    ]);
    return { profile, taste };
  });

const TasteInput = z.object({
  music: z.array(z.string().max(40)).max(30),
  sports: z.array(z.string().max(40)).max(30),
  films: z.array(z.string().max(40)).max(30),
  interests: z.array(z.string().max(40)).max(30),
  free_text: z.string().max(500).optional().nullable(),
});

export const updateTaste = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => TasteInput.parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("taste_profiles")
      .upsert({ user_id: context.userId, ...data });
    if (error) throw dbError(error);
    return { ok: true };
  });

const SocialInput = z.object({
  provider: z.string().min(1).max(40),
  tags: z.array(z.string().max(60)).max(20),
});

export const upsertSocial = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SocialInput.parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("social_integrations")
      .upsert(
        { user_id: context.userId, provider: data.provider, tags: data.tags },
        { onConflict: "user_id,provider" },
      );
    if (error) throw dbError(error);
    return { ok: true };
  });

export const listSocials = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("social_integrations")
      .select("*")
      .eq("user_id", context.userId);
    if (error) throw dbError(error);
    return { socials: data ?? [] };
  });
