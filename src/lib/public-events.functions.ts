import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Public slug → event id mapping. Add new entries as concerts are announced.
export const PUBLIC_EVENT_SLUGS: Record<string, string> = {
  "kanye-west-istanbul-2026": "0d3101bb-cccc-4001-8000-000000000530",
};

export type PublicEvent = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string | null;
  city: string | null;
  venue: string | null;
  latitude: number | null;
  longitude: number | null;
  category: string;
  tags: string[];
};

export const getPublicEvent = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) =>
    z.object({ slug: z.string().min(1).max(120).regex(/^[a-z0-9-]+$/) }).parse(d),
  )
  .handler(async ({ data }) => {
    const id = PUBLIC_EVENT_SLUGS[data.slug];
    if (!id) return { event: null as PublicEvent | null };
    const { data: row, error } = await supabaseAdmin
      .from("events")
      .select(
        "id, title, description, starts_at, ends_at, city, venue, latitude, longitude, category, tags",
      )
      .eq("id", id)
      .maybeSingle();
    if (error || !row) return { event: null as PublicEvent | null };
    return { event: { ...row, slug: data.slug } satisfies PublicEvent };
  });

// Reverse map: event id → public slug (for linking from the /today index)
const ID_TO_SLUG: Record<string, string> = Object.fromEntries(
  Object.entries(PUBLIC_EVENT_SLUGS).map(([slug, id]) => [id, slug]),
);

export const listTodayPublicEvents = createServerFn({ method: "GET" }).handler(async () => {
  const ids = Object.values(PUBLIC_EVENT_SLUGS);
  if (ids.length === 0) return { events: [] as PublicEvent[], date: new Date().toISOString().slice(0, 10) };

  // "Today" in Europe/Istanbul (operating market).
  // `day` must be "2-digit": with "numeric" en-CA yields "2026-10-8", which is
  // not valid ISO and makes `new Date(...)` below Invalid → toISOString throws.
  const istanbulDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const startUtc = new Date(`${istanbulDate}T00:00:00+03:00`).toISOString();
  const endUtc = new Date(`${istanbulDate}T23:59:59+03:00`).toISOString();

  const { data: rows, error } = await supabaseAdmin
    .from("events")
    .select("id, title, description, starts_at, ends_at, city, venue, latitude, longitude, category, tags")
    .in("id", ids)
    .gte("starts_at", startUtc)
    .lte("starts_at", endUtc)
    .order("starts_at", { ascending: true });

  if (error || !rows) return { events: [] as PublicEvent[], date: istanbulDate };
  const events = rows
    .map((r) => ({ ...r, slug: ID_TO_SLUG[r.id] }))
    .filter((r): r is PublicEvent => !!r.slug);
  return { events, date: istanbulDate };
});
