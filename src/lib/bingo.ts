// Agora Bingo + Deneyimlerim (design and rules: Naz Paşalı, prototype v3).
// Pure and client-safe: no storage, no network, no React. Unit tests:
//   node --test tests/bingo.test.mjs
//
// Three separate meanings, never mixed:
//   Kaydet (save)           = I want to
//   Takvime ekle (calendar) = I plan to
//   Katıldım / Buraya gittim = I did — a SELF-REPORTED experience record.
// Only a verification (partner QR, partner code, organiser check-in) can make a
// record "verified", and only verified squares can make a reward usable. This app
// has no verifier and no partner yet, so every record is "self" and every reward
// stays "not available". Matching is structured — kind, categories, tags and
// district only — never free-text similarity on names or descriptions.

export type ExperienceKind = "event" | "place" | "challenge";

export type ExperienceRecord = {
  id: string;
  kind: ExperienceKind;
  /** Event id, place id, or — for kind "challenge" — the Bingo square id. */
  refId: string;
  name: string;
  categories: string[];
  tags: string[];
  district?: string;
  /** Istanbul calendar day, YYYY-MM-DD. */
  date: string;
  /** Always "self": a record kept on the device can never be verified. */
  status: "self";
  /** ISO time the record was written (orders records on the same day). */
  at: string;
};

export type ExperienceInput = {
  kind: "event" | "place";
  refId: string;
  name: string;
  categories?: string[];
  tags?: string[];
  district?: string | null;
};

export const EVENT_TZ = "Europe/Istanbul";

/* ---------- squares, lines, rewards, badges ---------- */

export const SQUARE_IDS = [
  "coffee",
  "exhibit",
  "music",
  "hood",
  "free",
  "shop",
  "cuisine",
  "park",
  "surprise",
] as const;
export type SquareId = (typeof SQUARE_IDS)[number];
export type ChallengeId = Exclude<SquareId, "free">;
export const CHALLENGE_IDS = SQUARE_IDS.filter((s) => s !== "free") as ChallengeId[];

export const BINGO_LINES = {
  r0: [0, 1, 2],
  r1: [3, 4, 5],
  r2: [6, 7, 8],
  c0: [0, 3, 6],
  c1: [1, 4, 7],
  c2: [2, 5, 8],
  d0: [0, 4, 8],
  d1: [2, 4, 6],
} as const;
export type LineKey = keyof typeof BINGO_LINES;
export const LINE_KEYS = Object.keys(BINGO_LINES) as LineKey[];

/** Reward tiers. Partner, validity, inventory, eligibility and terms stay empty until a real agreement exists. */
export const REWARD_TIERS = [1, 2, 3] as const;
export type RewardTier = (typeof REWARD_TIERS)[number];
export type Reward = {
  tier: RewardTier;
  partner: null;
  validity: null;
  inventory: null;
  eligibility: null;
  terms: null;
  /** No partner agreement and no verifier: never usable in this app. */
  available: false;
};
export const REWARDS: Reward[] = REWARD_TIERS.map((tier) => ({
  tier,
  partner: null,
  validity: null,
  inventory: null,
  eligibility: null,
  terms: null,
  available: false,
}));

export type BadgeId = "coffee" | "art" | "night" | "nomad" | "culture";
export const BADGES: { id: BadgeId; name: string; goal: number; needsVerification: boolean }[] = [
  { id: "coffee", name: "Coffee Explorer", goal: 5, needsVerification: false },
  { id: "art", name: "Art Wanderer", goal: 5, needsVerification: false },
  { id: "night", name: "Night Owl", goal: 5, needsVerification: false },
  { id: "nomad", name: "Urban Nomad", goal: 10, needsVerification: false },
  { id: "culture", name: "Culture Collector", goal: 5, needsVerification: true },
];

/* ---------- Istanbul days ---------- */

const DAY_FMT = new Intl.DateTimeFormat("en-CA", {
  timeZone: EVENT_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** The Istanbul calendar day of an instant, YYYY-MM-DD. */
export function istanbulDay(d: Date | string | number = new Date()): string {
  const date = d instanceof Date ? d : new Date(d);
  const parts = DAY_FMT.formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}
/** The card period (Istanbul month) of a day, YYYY-MM. */
export const periodOf = (day: string) => day.slice(0, 7);
export const isDay = (s: unknown): s is string =>
  typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T12:00:00Z`));

/* ---------- structured matching ---------- */

/** Lower-case, strip accents (ç→c, ğ→g, ı/İ→i, é→e), separators to spaces. */
export function fold(s: string): string {
  return String(s ?? "")
    .replace(/[İI]/g, "i")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ı/g, "i")
    .replace(/[_\-:/.,;|()]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** True when one of the record's category/tag values contains `term` as whole words. */
function entriesHave(entries: string[], terms: readonly string[]): boolean {
  return entries.some((e) => {
    const padded = ` ${e} `;
    return terms.some((t) => padded.includes(` ${t} `));
  });
}

const COFFEE = ["coffee", "coffee shop", "cafe", "kafe", "kahve", "kahveci", "kahvecisi", "kahve evi", "espresso", "espresso bar", "roastery"];
const EXHIBIT = ["exhibition", "exhibitions", "exhibit", "gallery", "art gallery", "galeri", "galerisi", "sergi", "sergisi", "museum", "muze", "muzesi", "vernissage"];
const MUSIC = ["concert", "konser", "live music", "canli muzik", "gig", "music", "muzik", "jazz", "caz", "recital", "resital"];
const FOOD = ["restaurant", "restoran", "restorani", "lokanta", "lokantasi", "food", "yemek", "dining", "eatery", "meyhane", "meyhanesi", "bistro", "brasserie", "kebab", "kebap", "ocakbasi", "pizzeria", "trattoria"];
const SHOP = ["shop", "store", "boutique", "butik", "magaza", "magazasi", "dukkan", "dukkani", "bookstore", "bookshop", "kitapci", "record store", "plakci", "concept store", "sahaf"];
const INDEPENDENT = ["independent", "bagimsiz", "boutique", "butik", "vintage", "thrift", "second hand", "secondhand", "ikinci el", "concept store", "antique", "antika", "sahaf", "handmade", "el yapimi", "local", "yerel"];
const PARK = ["park", "parki", "koru", "korusu", "grove", "botanical garden", "botanik bahcesi", "nature reserve", "tabiat parki", "millet bahcesi"];
const PARK_NOT = ["car park", "theme park", "amusement park", "water park", "otopark", "lunapark", "aquapark", "parking"];
const SURPRISE = ["surprise", "surpriz"];

/** A restaurant counts as a "new cuisine" only when its record names one. */
const CUISINES: [string, string][] = [
  ["sushi", "japanese"], ["ramen", "japanese"], ["izakaya", "japanese"], ["japanese", "japanese"], ["japon", "japanese"],
  ["italian", "italian"], ["italyan", "italian"], ["pizza", "italian"], ["pizzeria", "italian"], ["pasta", "italian"], ["makarna", "italian"], ["trattoria", "italian"],
  ["vegan", "vegan"], ["vegetarian", "vegan"], ["vejetaryen", "vegan"],
  ["burger", "burger"],
  ["seafood", "seafood"], ["fish", "seafood"], ["balik", "seafood"], ["deniz urunleri", "seafood"],
  ["kebab", "kebab"], ["kebap", "kebab"], ["ocakbasi", "kebab"],
  ["meyhane", "meyhane"], ["fasil", "meyhane"],
  ["aegean", "aegean"], ["ege mutfagi", "aegean"],
  ["anatolian", "anatolian"], ["anadolu mutfagi", "anatolian"],
  ["turkish", "turkish"], ["turk mutfagi", "turkish"],
  ["home cooking", "homestyle"], ["ev yemegi", "homestyle"], ["esnaf lokantasi", "homestyle"],
  ["korean", "korean"], ["kore", "korean"],
  ["chinese", "chinese"], ["cin mutfagi", "chinese"],
  ["indian", "indian"], ["hint", "indian"],
  ["mexican", "mexican"], ["meksika", "mexican"],
  ["thai", "thai"], ["tayland", "thai"],
  ["french", "french"], ["fransiz", "french"],
  ["greek", "greek"], ["yunan", "greek"],
  ["georgian", "georgian"], ["gurcu", "georgian"],
  ["lebanese", "lebanese"], ["lubnan", "lebanese"],
  ["middle eastern", "middle-eastern"], ["ortadogu", "middle-eastern"],
  ["bistro", "bistro"],
];

type Facts = {
  entries: string[];
  coffee: boolean;
  exhibit: boolean;
  music: boolean;
  food: boolean;
  cuisine: string | null;
  shop: boolean;
  independent: boolean;
  park: boolean;
  surprise: boolean;
  district: string;
};

function factsOf(x: Pick<ExperienceRecord, "categories" | "tags" | "district">): Facts {
  const entries = [...(x.categories ?? []), ...(x.tags ?? [])].map(fold).filter(Boolean);
  const food = entriesHave(entries, FOOD);
  const cuisineHit = CUISINES.find(([k]) => entriesHave(entries, [k]));
  // "coffee shop" is a café, never a shop
  const shopEntries = entries.map((e) => ` ${e} `.replace(/ coffee shop /g, " coffee ").trim());
  const parkEntries = entries.filter((e) => !PARK_NOT.some((n) => ` ${e} `.includes(` ${n} `)));
  return {
    entries,
    coffee: entriesHave(entries, COFFEE),
    exhibit: entriesHave(entries, EXHIBIT),
    music: entriesHave(entries, MUSIC),
    food,
    cuisine: food && cuisineHit ? cuisineHit[1] : null,
    shop: entriesHave(shopEntries, SHOP),
    independent: entriesHave(shopEntries, INDEPENDENT),
    park: entriesHave(parkEntries, PARK),
    surprise: entriesHave(entries, SURPRISE),
    district: fold(x.district ?? ""),
  };
}

/** Squares one experience can fill as its single "activity"; first match wins. */
const PRIMARY: ChallengeId[] = ["exhibit", "music", "coffee", "cuisine", "shop", "park"];
/** Squares that stack on top of the activity square. */
const STACKING: ChallengeId[] = ["hood", "surprise"];

type Prior = { rec: ExperienceRecord; f: Facts; squares: ChallengeId[] };

function ruleHit(id: ChallengeId, x: ExperienceRecord, f: Facts, prior: Prior[]): boolean {
  switch (id) {
    case "exhibit":
      return f.exhibit;
    case "music":
      // a concert-type event; a venue alone never counts (there is no "I heard live music" question yet)
      return x.kind === "event" && f.music;
    case "coffee":
      return x.kind === "place" && f.coffee && !prior.some((p) => p.rec.kind === "place" && p.rec.refId === x.refId);
    case "cuisine":
      return !!f.cuisine && !prior.some((p) => p.f.cuisine === f.cuisine);
    case "shop":
      return x.kind === "place" && f.shop && f.independent;
    case "park":
      return f.park;
    case "hood":
      return !!f.district && !prior.some((p) => p.f.district === f.district);
    case "surprise":
      return f.surprise;
  }
}

/** Which squares one record fills, given every record before it (in date order). */
function matchOne(x: ExperienceRecord, f: Facts, prior: Prior[]): ChallengeId[] {
  if (x.kind === "challenge") {
    return (CHALLENGE_IDS as string[]).includes(x.refId) ? [x.refId as ChallengeId] : [];
  }
  // the same event or venue never counts twice toward the same square
  const hit = (id: ChallengeId) =>
    ruleHit(id, x, f, prior) &&
    !prior.some((p) => p.rec.kind === x.kind && p.rec.refId === x.refId && p.squares.includes(id));
  const out: ChallengeId[] = [];
  const prim = PRIMARY.find(hit);
  if (prim) out.push(prim);
  for (const id of STACKING) if (hit(id)) out.push(id);
  return out;
}

export const recordOrder = (a: ExperienceRecord, b: ExperienceRecord) =>
  a.date.localeCompare(b.date) || a.at.localeCompare(b.at) || a.id.localeCompare(b.id);

/** Every record's squares, keyed by record id. Order-independent input; derived, never stored. */
export function matchRecords(records: readonly ExperienceRecord[]): Record<string, ChallengeId[]> {
  const sorted = records.slice().sort(recordOrder);
  const prior: Prior[] = [];
  const out: Record<string, ChallengeId[]> = {};
  for (const rec of sorted) {
    const f = factsOf(rec);
    const squares = matchOne(rec, f, prior);
    out[rec.id] = squares;
    prior.push({ rec, f, squares });
  }
  return out;
}

/** Preview: which squares a new experience would fill today (nothing is written). */
export function previewMatch(
  records: readonly ExperienceRecord[],
  input: ExperienceInput,
  date: string,
): ChallengeId[] {
  const probe = buildRecord(input, date, "9999-12-31T23:59:59.999Z", "__preview__");
  const all = matchRecords([...records.filter((r) => recordOrder(r, probe) < 0), probe]);
  return all[probe.id] ?? [];
}

/* ---------- the monthly card ---------- */

export type CellStatus = "locked" | "progress" | "done" | "free";
export type Cell = { id: SquareId; index: number; status: CellStatus; recordIds: string[] };
export type Card = {
  period: string;
  cells: Cell[];
  /** Complete lines. All of them are self-reported (provisional) in this app. */
  lines: LineKey[];
  /** Squares filled, the free centre included (1/9 on a fresh card). */
  filled: number;
  matches: Record<string, ChallengeId[]>;
};

const cellFilled = (c: Cell) => c.status === "done" || c.status === "free";

/** Re-derive the card of `period` (YYYY-MM) from the records; `started` marks squares opened from the card. */
export function deriveCard(
  records: readonly ExperienceRecord[],
  period: string,
  started: readonly string[] = [],
): Card {
  const matches = matchRecords(records);
  const sorted = records.slice().sort(recordOrder);
  const cells: Cell[] = SQUARE_IDS.map((id, index) => {
    if (id === "free") return { id, index, status: "free", recordIds: [] };
    const recordIds = sorted
      .filter((r) => periodOf(r.date) === period && (matches[r.id] ?? []).includes(id))
      .map((r) => r.id);
    const status: CellStatus = recordIds.length ? "done" : started.includes(id) ? "progress" : "locked";
    return { id, index, status, recordIds };
  });
  const lines = LINE_KEYS.filter((k) => BINGO_LINES[k].every((i) => cellFilled(cells[i])));
  return { period, cells, lines, filled: cells.filter(cellFilled).length, matches };
}

/** For a square: each line through it and how many squares that line still needs. */
export function linesThrough(card: Card, index: number): { key: LineKey; left: number; done: boolean }[] {
  return LINE_KEYS.filter((k) => (BINGO_LINES[k] as readonly number[]).includes(index)).map((k) => {
    const left = BINGO_LINES[k].filter((i) => !cellFilled(card.cells[i])).length;
    return { key: k, left, done: left === 0 };
  });
}

/** The fewest squares any unfinished line still needs (0 when all eight are done). */
export function squaresToNextLine(card: Card): number {
  const open = LINE_KEYS.filter((k) => !card.lines.includes(k));
  if (!open.length) return 0;
  return Math.min(...open.map((k) => BINGO_LINES[k].filter((i) => !cellFilled(card.cells[i])).length));
}

/* ---------- badges: long-term, never reset by a new card ---------- */

export type BadgeItem = { key: string; title: string; date: string };
export type BadgeProgress = {
  id: BadgeId;
  name: string;
  goal: number;
  count: number;
  done: boolean;
  /** Culture Collector counts verified squares only: not possible until a verifier exists. */
  needsVerification: boolean;
  items: BadgeItem[];
};

export function badgeProgress(records: readonly ExperienceRecord[]): BadgeProgress[] {
  const matches = matchRecords(records);
  const sorted = records.slice().sort(recordOrder);
  return BADGES.map((b) => {
    const m = new Map<string, BadgeItem>();
    const add = (key: string, title: string, date: string) => {
      if (!m.has(key)) m.set(key, { key, title, date });
    };
    for (const x of sorted) {
      const sq = matches[x.id] ?? [];
      const rk = `${x.kind}:${x.kind === "challenge" ? x.id : x.refId}`;
      if (b.id === "coffee" && (sq.includes("coffee") || (x.kind === "place" && factsOf(x).coffee))) add(rk, x.name, x.date);
      if (b.id === "art" && sq.includes("exhibit")) add(rk, x.name, x.date);
      if (b.id === "night" && sq.includes("music")) add(rk, x.name, x.date);
      if (b.id === "nomad" && x.district && fold(x.district)) add(`d:${fold(x.district)}`, x.district.trim(), x.date);
      // culture: verified squares only — no record here is ever verified
    }
    const items = [...m.values()];
    const count = Math.min(b.goal, items.length);
    return { ...b, count, done: count >= b.goal, items };
  });
}

/* ---------- writing records: attendance rules enforced here, not only in the interface ---------- */

export type AttendCheck =
  | { ok: true; date: string }
  | { ok: false; reason: "future-event" | "already-event" | "already-today" | "bad-date" | "future-date" };

/**
 * Can this experience be recorded? Events: only once, and only after they start (their day is the
 * event's Istanbul day). Places: one record per day, never in the future.
 */
export function checkAttendance(
  records: readonly ExperienceRecord[],
  input: ExperienceInput & { startsAt?: string | null },
  now: Date = new Date(),
  visitDay?: string,
): AttendCheck {
  const today = istanbulDay(now);
  if (input.kind === "event") {
    if (input.startsAt) {
      const t = new Date(input.startsAt).getTime();
      if (!Number.isFinite(t)) return { ok: false, reason: "bad-date" };
      if (t > now.getTime()) return { ok: false, reason: "future-event" };
    }
    if (records.some((r) => r.kind === "event" && r.refId === input.refId)) return { ok: false, reason: "already-event" };
    return { ok: true, date: input.startsAt ? istanbulDay(input.startsAt) : today };
  }
  const day = visitDay ?? today;
  if (!isDay(day)) return { ok: false, reason: "bad-date" };
  if (day > today) return { ok: false, reason: "future-date" };
  if (records.some((r) => r.kind === "place" && r.refId === input.refId && r.date === day)) {
    return { ok: false, reason: "already-today" };
  }
  return { ok: true, date: day };
}

const clean = (a: unknown): string[] =>
  Array.isArray(a)
    ? a.filter((s): s is string => typeof s === "string" && s.trim().length > 0).map((s) => s.trim().slice(0, 80)).slice(0, 40)
    : [];

export function buildRecord(input: ExperienceInput, date: string, at: string, id: string): ExperienceRecord {
  const district = typeof input.district === "string" && input.district.trim() ? input.district.trim().slice(0, 60) : undefined;
  return {
    id,
    kind: input.kind,
    refId: String(input.refId),
    name: String(input.name ?? "").trim().slice(0, 140),
    categories: clean(input.categories),
    tags: clean(input.tags),
    ...(district ? { district } : {}),
    date,
    status: "self",
    at,
  };
}

/** A self-marked square from the Bingo screen ("I did it, mark it"). */
export function buildChallengeRecord(square: ChallengeId, name: string, date: string, at: string, id: string): ExperienceRecord {
  return { id, kind: "challenge", refId: square, name, categories: [], tags: [], date, status: "self", at };
}

/** Records read back from device storage: keep only well-formed ones and force them to "self". */
export function sanitizeRecords(raw: unknown): ExperienceRecord[] {
  if (!Array.isArray(raw)) return [];
  const out: ExperienceRecord[] = [];
  const seen = new Set<string>();
  for (const r of raw) {
    if (!r || typeof r !== "object") continue;
    const x = r as Record<string, unknown>;
    if (typeof x.id !== "string" || seen.has(x.id)) continue;
    if (x.kind !== "event" && x.kind !== "place" && x.kind !== "challenge") continue;
    if (typeof x.refId !== "string" || !isDay(x.date)) continue;
    if (x.kind === "challenge" && !(CHALLENGE_IDS as string[]).includes(x.refId)) continue;
    seen.add(x.id);
    const district = typeof x.district === "string" && x.district.trim() ? x.district.trim().slice(0, 60) : undefined;
    out.push({
      id: x.id,
      kind: x.kind,
      refId: x.refId,
      name: typeof x.name === "string" ? x.name.slice(0, 140) : "",
      categories: clean(x.categories),
      tags: clean(x.tags),
      ...(district ? { district } : {}),
      date: x.date,
      // a record on the device can never be verified, whatever the stored value says
      status: "self",
      at: typeof x.at === "string" && !Number.isNaN(Date.parse(x.at)) ? x.at : `${x.date}T12:00:00.000Z`,
    });
  }
  return out;
}

/** Filter groups for "Deneyimlerim". */
export type ExperienceGroup = "art" | "music" | "food" | "other";
export function groupOf(x: ExperienceRecord, squares: readonly ChallengeId[] = []): ExperienceGroup {
  if (x.kind === "challenge") {
    if (x.refId === "exhibit") return "art";
    if (x.refId === "music") return "music";
    if (x.refId === "coffee" || x.refId === "cuisine") return "food";
    return "other";
  }
  if (squares.includes("exhibit")) return "art";
  if (squares.includes("music")) return "music";
  if (squares.includes("coffee") || squares.includes("cuisine")) return "food";
  const f = factsOf(x);
  if (f.exhibit || entriesHave(f.entries, ["art", "sanat", "theatre", "theater", "tiyatro", "film", "cinema", "sinema", "workshop", "atolye", "history", "tarih"])) return "art";
  if (f.music) return "music";
  if (f.food || f.coffee || entriesHave(f.entries, ["bar", "wine", "sarap", "bakery", "firin", "pastane", "tea", "cay"])) return "food";
  return "other";
}
