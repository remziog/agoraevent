import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const OrgInput = z.object({
  name: z.string().min(1).max(120),
  category: z.string().min(1).max(60),
  city: z.string().min(1).max(120),
  description: z.string().max(800).optional().nullable(),
});

export const createOrganization = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => OrgInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("organizations")
      .insert({ ...data, owner_id: context.userId })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { organization: row };
  });

export const listMyOrganizations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("organizations")
      .select("*")
      .eq("owner_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { organizations: data ?? [] };
  });

const EventInput = z.object({
  org_id: z.string().uuid(),
  title: z.string().min(1).max(140),
  description: z.string().max(2000).optional().nullable(),
  category: z.string().min(1).max(60),
  starts_at: z.string(),
  ends_at: z.string().optional().nullable(),
  city: z.string().max(120).optional().nullable(),
  venue: z.string().max(160).optional().nullable(),
  capacity: z.number().int().positive().max(100000).optional().nullable(),
  price: z.number().nonnegative().max(100000).optional().nullable(),
  tags: z.array(z.string().max(40)).max(20),
});

export const createEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => EventInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("events")
      .insert(data)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { event: row };
  });

export const listOrgEvents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ org_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("events")
      .select("*, rsvps(count)")
      .eq("org_id", data.org_id)
      .order("starts_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { events: rows ?? [] };
  });

export const listLeads = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ org_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("rsvps")
      .select("id, created_at, status, events!inner(id, title, starts_at, org_id), profiles:user_id(display_name, city, bio)")
      .eq("events.org_id", data.org_id)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return { leads: rows ?? [] };
  });

const CustomerInput = z.object({
  org_id: z.string().uuid(),
  name: z.string().min(1).max(120),
  email: z.string().email().max(200).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  tags: z.array(z.string().max(40)).max(20).default([]),
});

export const upsertCustomer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CustomerInput.parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("customers").insert(data);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listCustomers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ org_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("customers")
      .select("*")
      .eq("org_id", data.org_id)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { customers: rows ?? [] };
  });

export const getDemandInsights = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ org_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: org, error: oErr } = await context.supabase
      .from("organizations")
      .select("city, owner_id")
      .eq("id", data.org_id)
      .maybeSingle();
    if (oErr) throw new Error(oErr.message);
    if (!org || org.owner_id !== context.userId) {
      throw new Error("Not authorized");
    }
    const { data: prompts } = await context.supabase
      .from("prompts")
      .select("tags, created_at, city")
      .gte("created_at", new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString())
      .limit(500);

    const counts = new Map<string, number>();
    (prompts ?? []).forEach((p) => {
      if (org.city && p.city && p.city !== org.city) return;
      (p.tags ?? []).forEach((t: string) => {
        counts.set(t, (counts.get(t) ?? 0) + 1);
      });
    });
    const top = [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([tag, count]) => ({ tag, count }));
    return { top, total: prompts?.length ?? 0 };
  });
