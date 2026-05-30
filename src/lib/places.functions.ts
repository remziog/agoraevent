import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";


const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_maps";

const Input = z.object({
  input: z.string().min(1).max(200),
  sessionToken: z.string().min(1).max(128),
});

type Suggestion = {
  placeId: string;
  primary: string;
  secondary: string;
  text: string;
};

/**
 * Places API (New) autocomplete proxied through the connector gateway so the
 * Lovable-managed API key isn't exposed to the browser (and works on custom
 * domains where the browser key referrer allowlist doesn't apply).
 *
 * Biased toward Istanbul since that's where the app's landmarks live, but
 * still returns global matches when nothing local fits.
 */
export const autocompletePlaces = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data }): Promise<{ suggestions: Suggestion[] }> => {
    const lovableKey = process.env.LOVABLE_API_KEY;
    const mapsKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!lovableKey) throw new Error("Missing LOVABLE_API_KEY");
    if (!mapsKey) throw new Error("Missing GOOGLE_MAPS_API_KEY");

    const res = await fetch(`${GATEWAY_URL}/places/v1/places:autocomplete`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": mapsKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input: data.input,
        sessionToken: data.sessionToken,
        // Bias toward Istanbul (~50km circle around the city center) but
        // don't strictly restrict, so users can still type addresses outside.
        locationBias: {
          circle: {
            center: { latitude: 41.0082, longitude: 28.9784 },
            radius: 50000,
          },
        },
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Places autocomplete failed (${res.status}): ${body}`);
    }

    const json = (await res.json()) as {
      suggestions?: Array<{
        placePrediction?: {
          placeId: string;
          text?: { text: string };
          structuredFormat?: {
            mainText?: { text: string };
            secondaryText?: { text: string };
          };
        };
      }>;
    };

    const suggestions: Suggestion[] = (json.suggestions ?? [])
      .map((s) => s.placePrediction)
      .filter((p): p is NonNullable<typeof p> => Boolean(p?.placeId))
      .map((p) => ({
        placeId: p.placeId,
        primary: p.structuredFormat?.mainText?.text ?? p.text?.text ?? "",
        secondary: p.structuredFormat?.secondaryText?.text ?? "",
        text: p.text?.text ?? p.structuredFormat?.mainText?.text ?? "",
      }))
      .filter((s) => s.text.length > 0);

    return { suggestions };
  });
