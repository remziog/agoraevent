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
