import { dbError } from "./db-error";
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
    if (error) throw dbError(error);
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
    if (error) throw dbError(error);
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
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
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
    if (error) throw dbError(error);
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
    if (error) throw dbError(error);
    return { events: rows ?? [] };
  });

export const listLeads = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ org_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("rsvps")
      .select("id, created_at, status, user_id, events!inner(id, title, starts_at, org_id), profiles:user_id(display_name, city, bio)")
      .eq("events.org_id", data.org_id)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw dbError(error);
    return { leads: rows ?? [] };
  });

export const exportLeadsCsv = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ org_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: org } = await context.supabase
      .from("organizations").select("owner_id").eq("id", data.org_id).maybeSingle();
    if (!org || org.owner_id !== context.userId) throw new Error("Not authorized");
    const { data: rows, error } = await context.supabase
      .from("rsvps")
      .select("created_at, status, events!inner(title, starts_at, org_id), profiles:user_id(display_name, city)")
      .eq("events.org_id", data.org_id)
      .order("created_at", { ascending: false })
      .limit(2000);
    if (error) throw dbError(error);
    const esc = (v: unknown) => {
      const s = v == null ? "" : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const header = ["created_at", "status", "event_title", "event_starts_at", "member_name", "member_city"];
    const lines = [header.join(",")];
    for (const r of rows ?? []) {
      const ev = (r as any).events;
      const pr = (r as any).profiles;
      lines.push([r.created_at, r.status, ev?.title, ev?.starts_at, pr?.display_name, pr?.city].map(esc).join(","));
    }
    return { csv: lines.join("\n"), filename: `leads-${new Date().toISOString().slice(0,10)}.csv` };
  });

const CustomerInput = z.object({
  org_id: z.string().uuid(),
  name: z.string().min(1).max(120),
  email: z.string().email().max(200).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  tags: z.array(z.string().max(40)).max(20).default([]),
  // Set when the customer is created from a lead (RSVP) so the same member
  // can't be added twice.
  user_id: z.string().uuid().optional().nullable(),
});

export const upsertCustomer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CustomerInput.parse(d))
  .handler(async ({ data, context }) => {
    // Dedupe within the org: same member (user_id) or same email → update the
    // existing record instead of inserting a duplicate. RLS scopes everything
    // to organizations the caller owns.
    let existing: { id: string; tags: string[] | null; notes: string | null; email: string | null } | null = null;
    if (data.user_id || data.email) {
      let q = context.supabase
        .from("customers")
        .select("id, tags, notes, email")
        .eq("org_id", data.org_id);
      // Case-insensitive exact match: escape ilike's wildcards so an address
      // like "ali_veli@x.com" can't match "alixveli@x.com".
      q = data.user_id
        ? q.eq("user_id", data.user_id)
        : q.ilike("email", data.email!.replace(/[\\%_]/g, (c) => `\\${c}`));
      const { data: rows, error } = await q.limit(1);
      if (error) throw dbError(error);
      existing = rows?.[0] ?? null;
    }

    if (existing) {
      const tags = Array.from(new Set([...(existing.tags ?? []), ...data.tags]));
      const notes =
        data.notes && !(existing.notes ?? "").includes(data.notes)
          ? [existing.notes, data.notes].filter(Boolean).join("\n")
          : existing.notes;
      const { error } = await context.supabase
        .from("customers")
        .update({
          name: data.name,
          email: existing.email ?? data.email ?? null,
          notes,
          tags,
          last_seen: new Date().toISOString(),
        })
        .eq("id", existing.id);
      if (error) throw dbError(error);
      return { ok: true, created: false, id: existing.id };
    }

    const { data: row, error } = await context.supabase
      .from("customers")
      .insert({ ...data, last_seen: new Date().toISOString() })
      .select("id")
      .single();
    if (error) throw dbError(error);
    return { ok: true, created: true, id: row.id };
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
    if (error) throw dbError(error);
    return { customers: rows ?? [] };
  });

