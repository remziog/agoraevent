import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ProfileInput = z.object({
  display_name: z.string().min(1).max(80),
  city: z.string().min(1).max(120),
  bio: z.string().max(500).optional().nullable(),
  role: z.enum(["member", "organizer"]),
});

export const completeOnboarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ProfileInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error: pErr } = await supabase
      .from("profiles")
      .upsert({
        id: userId,
        display_name: data.display_name,
        city: data.city,
        bio: data.bio ?? null,
        onboarded: true,
      });
    if (pErr) throw new Error(pErr.message);
    const { error: rErr } = await supabase
      .from("user_roles")
      .upsert({ user_id: userId, role: data.role }, { onConflict: "user_id,role" });
    if (rErr) throw new Error(rErr.message);
    return { ok: true };
  });

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [{ data: profile }, { data: roles }, { data: taste }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId),
      supabase.from("taste_profiles").select("*").eq("user_id", userId).maybeSingle(),
    ]);
    return {
      profile,
      roles: (roles ?? []).map((r) => r.role) as ("member" | "organizer")[],
      taste,
    };
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
    if (error) throw new Error(error.message);
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
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listSocials = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("social_integrations")
      .select("*")
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { socials: data ?? [] };
  });
