// Input schemas of the discovery server function, kept pure so they can be
// unit-tested. `EditsSchema` is NOT `ConstraintsSchema.partial()`: zod 4
// applies a field's `.default()` even under `.partial()`, so a chip edit that
// only carried a district would have arrived as `{ district, intent: "event",
// placeKind: null }` and silently turned a restaurant request into a
// gathering search (FLOW-17-01).
import { z } from "zod";

const WhenSchema = z
  .object({
    from: z.string().max(40),
    to: z.string().max(40),
    label: z.enum([
      "tonight",
      "today",
      "tomorrow",
      "tomorrow-evening",
      "weekend",
      "this-week",
      "custom",
    ]),
    assumed: z.boolean().optional(),
  })
  .nullable();

const IntentSchema = z.enum(["event", "restaurant", "place"]);

/** The conversation's constraints so far (always complete; older clients may lack intent). */
export const ConstraintsSchema = z.object({
  intent: IntentSchema.default("event"),
  placeKind: z.string().max(40).nullable().default(null),
  tags: z.array(z.string().max(40)).max(12),
  when: WhenSchema,
  district: z.string().max(40).nullable(),
  budgetMax: z.number().min(0).max(1_000_000).nullable(),
  groupSize: z.enum(["small", "large"]).nullable(),
  social: z.boolean(),
});

/** An explicit edit from a chip or an answer: only the fields it names, never a default. */
export const EditsSchema = z
  .object({
    intent: IntentSchema,
    placeKind: z.string().max(40).nullable(),
    tags: z.array(z.string().max(40)).max(12),
    when: WhenSchema,
    district: z.string().max(40).nullable(),
    budgetMax: z.number().min(0).max(1_000_000).nullable(),
    groupSize: z.enum(["small", "large"]).nullable(),
    social: z.boolean(),
  })
  .partial();

export type Edits = z.infer<typeof EditsSchema>;
