import { extractIntent } from "@/lib/discovery";

/**
 * Naz's experience categories (design v3). Each is a ready-made request in the
 * reader's language, sent through the same discovery context as typed text —
 * not a separate engine. "word" is what joins a written request when the
 * category is selected and the request doesn't name a kind of place itself
 * ("writing personalises"). The angle only turns the needle.
 */
export type CategoryKey =
  | "surprise"
  | "food"
  | "coffee"
  | "music"
  | "night"
  | "exhibit"
  | "concert"
  | "workshop"
  | "event"
  | "shop";

export const CATEGORIES: { key: CategoryKey; color: string; angle: number }[] = [
  { key: "surprise", color: "#f2a43a", angle: -90 },
  { key: "food", color: "#e8573f", angle: -20 },
  { key: "coffee", color: "#f2a43a", angle: 20 },
  { key: "music", color: "#e57ca8", angle: 60 },
  { key: "night", color: "#a08bdd", angle: 100 },
  { key: "exhibit", color: "#9ccbff", angle: 140 },
  { key: "concert", color: "#e57ca8", angle: 180 },
  { key: "workshop", color: "#d9c2a0", angle: -140 },
  { key: "event", color: "#e8573f", angle: -110 },
  { key: "shop", color: "#d9c2a0", angle: -55 },
];

export const categoryOf = (key: string | null | undefined) =>
  CATEGORIES.find((c) => c.key === key) ?? null;

/**
 * The request a category sends. With nothing written, the category's own
 * prompt; with a written request, the request — plus the category's word when
 * the request names no intent of its own (a request that clearly names another
 * kind of place wins).
 */
export function composeRequest(
  written: string,
  key: CategoryKey | null,
  t: (k: string) => string,
): string {
  const text = written.trim();
  if (!key) return text;
  if (!text) return t(`cat.${key}.prompt`);
  const said = extractIntent(text);
  if (said.intent || said.placeKind) return text;
  return `${text} — ${t(`cat.${key}.word`)}`;
}
