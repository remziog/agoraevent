// Discovery: the one search context shared by the compass, the conversation
// and the filters. Pure, client-safe logic — no network, no credentials.
//
// A request ("Bu akşam Kadıköy'de 700 TL'yi geçmeden elektronik müzik…") is
// turned into explicit, editable constraints. Every constraint is a hard
// filter: an event that misses one is never an exact match, and an unknown
// value (price not listed) never counts as satisfied. Follow-ups ("yarın da
// olur ama bütçe aynı") change only what they mention; nothing is relaxed
// unless the person says so.

/**
 * What the person is asking for. "event": an Agora gathering (Agora data).
 * "restaurant" / "place": somewhere to eat, drink or visit — ranked by Qloo
 * for the person's taste. The intent decides which path answers, never a
 * silent conversion of one into the other (DISC-29-01).
 */
export type Intent = "event" | "restaurant" | "place";

export type Constraints = {
  intent: Intent;
  /** For "place": the kind of place in Qloo-searchable English ("bar", "cafe", "museum"), else null. */
  placeKind: string | null;
  /** Interest tags, lowercase ("techno", "electronic-music", "film"). */
  tags: string[];
  /** Absolute window in Europe/Istanbul time. `assumed` = Agora's visible default, not the person's words. */
  when: { from: string; to: string; label: WhenLabel; assumed?: boolean } | null;
  /** Canonical district name from DISTRICTS, e.g. "Kadıköy". */
  district: string | null;
  /** Upper price bound in TRY. */
  budgetMax: number | null;
  groupSize: "small" | "large" | null;
  /** Wants to meet new people. */
  social: boolean;
};

export type WhenLabel =
  | "tonight"
  | "today"
  | "tomorrow"
  | "tomorrow-evening"
  | "weekend"
  | "this-week"
  | "custom";

export type Violation = "date" | "district" | "budget" | "interest" | "group";
export type Unverified = "price" | "capacity";

export type DiscoveryEvent = {
  id: string;
  title: string;
  starts_at: string;
  ends_at?: string | null;
  city: string | null;
  venue: string | null;
  category: string;
  price: number | string | null;
  capacity: number | null;
  latitude: number | null;
  longitude: number | null;
  tags: string[];
  description?: string | null;
  org_id?: string;
  organizations?: { name?: string; category?: string; city?: string } | null;
};

export type ScoredEvent<E extends DiscoveryEvent = DiscoveryEvent> = E & {
  /** Interest overlap count (0 when no tags were requested). */
  _score: number;
  /** Hard constraints this event misses. Empty + nothing unverified = exact match. */
  violations: Violation[];
  /** Constraints Agora could not check because the listing lacks the data. */
  unverified: Unverified[];
  /** Resolved district of the event (text or coordinates), when known. */
  district: string | null;
  /** The event is a seeded demo listing (tag "demo"). */
  demo: boolean;
};

export const EMPTY_CONSTRAINTS: Constraints = {
  intent: "event",
  placeKind: null,
  tags: [],
  when: null,
  district: null,
  budgetMax: null,
  groupSize: null,
  social: false,
};

/** Istanbul is UTC+3 all year (no DST since 2016). */
const TZ_OFFSET = "+03:00";

/** Districts and neighbourhoods Agora understands, with a centre and a radius (km) for events that only have coordinates. */
export const DISTRICTS: {
  name: string;
  aliases: string[];
  lat: number;
  lng: number;
  radiusKm: number;
}[] = [
  {
    name: "Kadıköy",
    aliases: ["kadikoy", "moda", "yeldegirmeni", "caferaga"],
    lat: 40.99,
    lng: 29.03,
    radiusKm: 2.5,
  },
  {
    name: "Karaköy",
    aliases: ["karakoy", "galata", "bereketzade", "tophane"],
    lat: 41.024,
    lng: 28.975,
    radiusKm: 1.2,
  },
  {
    name: "Beyoğlu",
    aliases: ["beyoglu", "taksim", "istiklal", "cihangir", "cukurcuma", "asmalimescit", "tunel"],
    lat: 41.033,
    lng: 28.98,
    radiusKm: 1.8,
  },
  {
    name: "Sultanahmet",
    aliases: ["sultanahmet", "cankurtaran", "alemdar", "gulhane"],
    lat: 41.007,
    lng: 28.978,
    radiusKm: 1.3,
  },
  {
    name: "Eminönü",
    aliases: ["eminonu", "sirkeci", "rustempasa"],
    lat: 41.017,
    lng: 28.972,
    radiusKm: 1,
  },
  {
    name: "Beşiktaş",
    aliases: ["besiktas", "visnezade", "kabatas"],
    lat: 41.043,
    lng: 29.006,
    radiusKm: 1.6,
  },
  { name: "Ortaköy", aliases: ["ortakoy", "mecidiye"], lat: 41.047, lng: 29.027, radiusKm: 1.2 },
  {
    name: "Üsküdar",
    aliases: ["uskudar", "salacak", "kuzguncuk"],
    lat: 41.026,
    lng: 29.015,
    radiusKm: 2,
  },
  {
    name: "Fatih",
    aliases: ["fatih", "suleymaniye", "vefa", "aksaray"],
    lat: 41.015,
    lng: 28.95,
    radiusKm: 2.5,
  },
  {
    name: "Balat",
    aliases: ["balat", "fener", "ayvansaray"],
    lat: 41.03,
    lng: 28.949,
    radiusKm: 1.2,
  },
  { name: "Beyazıt", aliases: ["beyazit", "laleli"], lat: 41.01, lng: 28.965, radiusKm: 1 },
  {
    name: "Şişli",
    aliases: ["sisli", "nisantasi", "osmanbey", "bomonti", "mecidiyekoy"],
    lat: 41.055,
    lng: 28.99,
    radiusKm: 2,
  },
  { name: "Bakırköy", aliases: ["bakirkoy", "yesilkoy"], lat: 40.98, lng: 28.87, radiusKm: 2.5 },
  {
    name: "Bebek",
    aliases: ["bebek", "arnavutkoy", "etiler"],
    lat: 41.077,
    lng: 29.043,
    radiusKm: 1.8,
  },
  {
    name: "Sarıyer",
    aliases: ["sariyer", "emirgan", "istinye", "tarabya"],
    lat: 41.13,
    lng: 29.05,
    radiusKm: 4,
  },
  { name: "Ataşehir", aliases: ["atasehir"], lat: 40.99, lng: 29.12, radiusKm: 3 },
  { name: "Maltepe", aliases: ["maltepe"], lat: 40.93, lng: 29.13, radiusKm: 3 },
  {
    name: "Bostancı",
    aliases: ["bostanci", "suadiye", "caddebostan", "erenkoy", "goztepe"],
    lat: 40.963,
    lng: 29.09,
    radiusKm: 2.5,
  },
];

/** Lowercase, diacritics folded (ş→s, ı→i, ö→o…), punctuation → spaces. */
export function fold(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .replace(/ı/g, "i")
    .replace(/İ/g, "i")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function tokens(value: string): string[] {
  return fold(value).split(" ").filter(Boolean);
}

function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number) {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

// ---------------------------------------------------------------------------
// Dates in Istanbul time
// ---------------------------------------------------------------------------

/** Y/M/D of `now` in Istanbul. */
function istanbulDate(now: Date): { y: number; m: number; d: number; hour: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { y: get("year"), m: get("month"), d: get("day"), hour: get("hour") % 24 };
}

/** ISO timestamp for a wall-clock time in Istanbul (fixed UTC+3). */
function iso(y: number, m: number, d: number, hh: number, mm: number): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${y}-${pad(m)}-${pad(d)}T${pad(hh)}:${pad(mm)}:00${TZ_OFFSET}`;
}

function addDays(
  y: number,
  m: number,
  d: number,
  days: number,
): { y: number; m: number; d: number } {
  const t = new Date(Date.UTC(y, m - 1, d) + days * 86400e3);
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
}

/** Build the window for a label, relative to `now`. `from` never lies in the past. */
export function windowFor(label: WhenLabel, now: Date): NonNullable<Constraints["when"]> {
  const t = istanbulDate(now);
  const nowIso = now.toISOString();
  // Compare instants, not strings: "+03:00" and "Z" texts don't sort by time (DATE-17-02).
  const clamp = (from: string) => (Date.parse(from) < now.getTime() ? nowIso : from);
  switch (label) {
    case "tonight": {
      return { from: clamp(iso(t.y, t.m, t.d, 17, 0)), to: iso(t.y, t.m, t.d, 23, 59), label };
    }
    case "today": {
      return { from: clamp(iso(t.y, t.m, t.d, 0, 0)), to: iso(t.y, t.m, t.d, 23, 59), label };
    }
    case "tomorrow": {
      const n = addDays(t.y, t.m, t.d, 1);
      return { from: iso(n.y, n.m, n.d, 0, 0), to: iso(n.y, n.m, n.d, 23, 59), label };
    }
    case "tomorrow-evening": {
      const n = addDays(t.y, t.m, t.d, 1);
      return { from: iso(n.y, n.m, n.d, 17, 0), to: iso(n.y, n.m, n.d, 23, 59), label };
    }
    case "weekend": {
      // Next Saturday 00:00 → Sunday 23:59 (today if it is the weekend).
      const dow = new Date(Date.UTC(t.y, t.m - 1, t.d)).getUTCDay(); // 0 Sun … 6 Sat
      const toSat = dow === 6 ? 0 : dow === 0 ? -1 : 6 - dow;
      const sat = addDays(t.y, t.m, t.d, toSat);
      const sun = addDays(sat.y, sat.m, sat.d, 1);
      return {
        from: clamp(iso(sat.y, sat.m, sat.d, 0, 0)),
        to: iso(sun.y, sun.m, sun.d, 23, 59),
        label,
      };
    }
    case "this-week":
    case "custom":
    default: {
      const n = addDays(t.y, t.m, t.d, 7);
      return { from: nowIso, to: iso(n.y, n.m, n.d, 23, 59), label: "this-week" };
    }
  }
}

// ---------------------------------------------------------------------------
// Rule-based extraction (Turkish + English). Deterministic and testable; the
// model only adds interest tags on top.
// ---------------------------------------------------------------------------

// Order matters (first match wins): the specific "tomorrow evening" before the
// generic evening words, so "yarın akşam" is never read as tonight (DATE-17-01).
const WHEN_PATTERNS: { re: RegExp; label: WhenLabel }[] = [
  {
    re: /\b(yarin aksam\w*|yarin gece|tomorrow evening|tomorrow night)\b/,
    label: "tomorrow-evening",
  },
  { re: /\b(yarin|tomorrow)\b/, label: "tomorrow" },
  { re: /\b(bu aksam|bu gece|tonight|this evening|aksam)\b/, label: "tonight" },
  { re: /\b(bugun|today)\b/, label: "today" },
  {
    re: /\b(hafta sonu|haftasonu|weekend|cumartesi|pazar gunu|saturday|sunday)\b/,
    label: "weekend",
  },
  { re: /\b(bu hafta|this week|onumuzdeki gunlerde|next few days)\b/, label: "this-week" },
];

const SMALL_RE =
  /\b(kucuk (?:bir )?grup\w*|small group|intimate|samimi|az kisi\w*|kalabalik olmasin|kalabalik istemiyorum|not crowded|no crowds?|quiet|sakin|sessiz|(?:iki|uc|dort|bes|alti|[2-6]) kisi(?:lik|yiz|yle)?|for (?:two|three|four|five|six|[2-6])|table for)\b/;
const LARGE_RE =
  /\b(kalabalik\w*|buyuk (?:bir )?grup\w*|big group|crowds?|crowded|loud|sweaty|festival)\b/;
const SOCIAL_RE =
  /\b(yeni insanlar|insanlarla tanis|tanismak|meet (new )?people|new people|make friends|arkadas edin)\b/;
const RELAX_BUDGET_SAME_RE = /\b(butce ayni|same budget|butce degismesin)\b/;

const BUDGET_RE =
  /(?:(?:en fazla|max(?:imum)?|up to|under|altinda|gecmeden|gecmesin|kadar)\s*)?(\d{2,6})\s*(tl|try|lira|₺)|(?:₺)\s*(\d{2,6})/;

// ---------------------------------------------------------------------------
// Intent: restaurant / place / event. Deterministic word lists (folded), so a
// restaurant request is never silently answered with gatherings. An explicit
// gathering word wins over a place word ("a concert in a bar" is a gathering);
// otherwise a restaurant word wins over a generic place word ("dinner in a
// meyhane" is a restaurant request with kind "meyhane").
// ---------------------------------------------------------------------------

/** Place words → the English kind Agora asks Qloo's tag search for. */
const PLACE_KINDS: { re: RegExp; kind: string }[] = [
  { re: /\b(meyhane\w*)\b/, kind: "meyhane" },
  {
    re: /\b(bar|bara|barda|barlar\w*|pub|pubs|puba|pubda|birahane\w*|kokteyl\w*|cocktail\w*)\b/,
    kind: "bar",
  },
  { re: /\b(kafe\w*|cafe\w*|coffee( shop)?|kahve\w*|kahveci\w*)\b/, kind: "cafe" },
  { re: /\b(muze\w*|museum\w*)\b/, kind: "museum" },
  { re: /\b(galeri\w*|galler(y|ies)|sergi\w*|exhibition\w*)\b/, kind: "art gallery" },
  { re: /\b(park\w*|bahce\w*|garden\w*)\b/, kind: "park" },
  { re: /\b(sahaf\w*|kitapci\w*|bookshop\w*|bookstore\w*)\b/, kind: "bookstore" },
  { re: /\b(plakci\w*|plak dukkan\w*|record (shop|store)\w*)\b/, kind: "record store" },
  { re: /\b(kulup\w*|kulub\w*|club\w*|gece kulubu|nightclub\w*)\b/, kind: "night club" },
  { re: /\b(hamam\w*|bath(house)?s?)\b/, kind: "hammam" },
  { re: /\b(cay bahcesi|tea garden\w*)\b/, kind: "tea house" },
  { re: /\b(pastane\w*|firin\w*|bakery|bakeries|tatli\w*|dessert\w*)\b/, kind: "bakery" },
  { re: /\b(mekan\w*|venue\w*|yer|yerler\w*|spot|spots|place|places)\b/, kind: "place" },
];

const RESTAURANT_RE =
  /\b(restoran\w*|restaurant\w*|lokanta\w*|yemek\w*|aksam yemegi|ogle yemegi|dinner\w*|lunch\w*|brunch\w*|kahvalti\w*|breakfast\w*|bistro\w*|ocakbasi\w*|kebap\w*|kebab\w*|balikci\w*|seafood|esnaf lokantasi|yiyelim|yemege|eat(ing)?|food\b|cuisine|mutfag\w*|meze\w*|pizza\w*|burger\w*|sushi\w*|ramen\w*|steak\w*|vegan\w*|vejetaryen\w*|vegetarian\w*)\b/;

const EVENT_RE =
  /\b(etkinlik\w*|event\w*|bulusma\w*|meetup\w*|gathering\w*|konser\w*|concert\w*|gig\w*|film kulub\w*|film club\w*|film gecesi|movie night|gosterim\w*|screening\w*|atolye\w*|workshop\w*|kosu\w*|run\b|running|yoga|parti\w*|party|partie\w*|festival\w*|okuma grubu|book club|kitap kulub\w*|sohbet\w*|dans gecesi|dj set|open mic|acik mikrofon|turnuva\w*|tournament\w*|antrenman\w*|training|yuruyus\w*|hike\w*|hiking|topluluk\w*|communit(y|ies)|katil\w*|join\b|insanlarla tanis\w*|yeni insanlar|meet (new )?people|new people)\b/;

export type IntentExtract = { intent?: Intent; placeKind?: string | null };

/** Which path should answer: a gathering, a restaurant or a kind of place. Returns nothing when the prompt doesn't say. */
export function extractIntent(prompt: string): IntentExtract {
  const text = ` ${fold(prompt)} `;
  const event = EVENT_RE.test(text);
  const restaurant = RESTAURANT_RE.test(text);
  const place = PLACE_KINDS.find((p) => p.re.test(text));
  if (event) return { intent: "event", placeKind: null };
  if (restaurant)
    return { intent: "restaurant", placeKind: place && place.kind !== "place" ? place.kind : null };
  if (place) return { intent: "place", placeKind: place.kind === "place" ? null : place.kind };
  return {};
}

/** Words that are part of the constraint grammar and never count as interest tags. */
const CONSTRAINT_STOPWORDS = new Set(
  [
    "bu",
    "aksam",
    "gece",
    "bugun",
    "yarin",
    "hafta",
    "sonu",
    "haftasonu",
    "olur",
    "ama",
    "ve",
    "ile",
    "icin",
    "en",
    "fazla",
    "kadar",
    "tl",
    "lira",
    "try",
    "gecmeden",
    "gecmesin",
    "istiyorum",
    "istemiyorum",
    "olsun",
    "olmasin",
    "bir",
    "biraz",
    "cok",
    "da",
    "de",
    "mi",
    "mu",
    "ayni",
    "butce",
    "degismesin",
    "kucuk",
    "buyuk",
    "grup",
    "grupta",
    "kisi",
    "insan",
    "insanlarla",
    "yeni",
    "tanismak",
    "tanisip",
    "dinleyip",
    "dinlemek",
    "the",
    "a",
    "an",
    "and",
    "or",
    "to",
    "for",
    "with",
    "in",
    "at",
    "on",
    "of",
    "tonight",
    "today",
    "tomorrow",
    "evening",
    "night",
    "week",
    "weekend",
    "this",
    "next",
    "same",
    "budget",
    "max",
    "maximum",
    "under",
    "up",
    "want",
    "wanna",
    "like",
    "something",
    "some",
    "people",
    "new",
    "meet",
    "small",
    "big",
    "group",
    "crowd",
    "crowded",
    "not",
    "no",
    "but",
    "also",
    "fine",
    "ok",
    "okay",
    "would",
    "be",
    "is",
    "it",
    "my",
    "me",
    "i",
    "semt",
    "semtinde",
    "semtte",
    "yakin",
    "yakinlarda",
    "nearby",
    "near",
    "around",
    "istanbul",
    // intent grammar — handled by extractIntent, never an interest tag
    "restoran",
    "restaurant",
    "lokanta",
    "mekan",
    "mekanlar",
    "venue",
    "yer",
    "yerler",
    "place",
    "places",
    "spot",
    "oner",
    "onerir",
    "onersene",
    "onerebilir",
    "onerin",
    "tavsiye",
    "recommend",
    "suggest",
    "find",
    "bul",
    "bulalim",
    "goster",
    "show",
    "sakin",
    "sessiz",
    "kisilik",
    "iki",
    "uc",
    "dort",
    "bes",
    "alti",
    "two",
    "three",
    "four",
    "seviyorum",
    "severim",
    "sever",
    "seviyoruz",
    "love",
    "loves",
    "loved",
    "likes",
    "liked",
    "fan",
    "faniyim",
    "dinliyorum",
    "dinlerim",
    "izledim",
    "izlerim",
    "okudum",
    "okurum",
    "listen",
    "watched",
    "read",
    "enjoy",
    "into",
  ].map(fold),
);

export type Extracted = Partial<Constraints> & {
  /** The prompt mentioned "same budget" / "bütçe aynı" explicitly. */
  keepBudget?: boolean;
};

/** Deterministic constraint extraction. Returns only the fields the prompt mentions. */
export function extractConstraints(prompt: string, now: Date): Extracted {
  const text = ` ${fold(prompt)} `;
  const out: Extracted = {};

  const intent = extractIntent(prompt);
  if (intent.intent) {
    out.intent = intent.intent;
    out.placeKind = intent.placeKind ?? null;
  }

  for (const { re, label } of WHEN_PATTERNS) {
    if (re.test(text)) {
      out.when = windowFor(label, now);
      break;
    }
  }

  for (const d of DISTRICTS) {
    if (
      d.aliases.some((a) =>
        new RegExp(`\\b${a}(?:\\b|'|de\\b|da\\b|te\\b|ta\\b|deki\\b|daki\\b|nin\\b|in\\b)`).test(
          text,
        ),
      )
    ) {
      out.district = d.name;
      break;
    }
  }

  // Budget on the raw lowercase text: folding would turn "₺" into a space.
  const budget = ` ${prompt.toLowerCase().replace(/[’']/g, " ")} `.match(BUDGET_RE);
  if (budget) {
    const n = Number(budget[1] ?? budget[3]);
    if (Number.isFinite(n) && n > 0) out.budgetMax = n;
  }
  if (RELAX_BUDGET_SAME_RE.test(text)) out.keepBudget = true;

  if (SMALL_RE.test(text)) out.groupSize = "small";
  else if (LARGE_RE.test(text)) out.groupSize = "large";

  if (SOCIAL_RE.test(text)) out.social = true;

  return out;
}

/** Turkish interest words → the English tags organisers use. Used by the rules fallback only. */
const TR_TAGS: Record<string, string[]> = {
  muzik: ["music", "live-music"],
  elektronik: ["electronic-music", "techno"],
  tekno: ["techno"],
  caz: ["jazz"],
  rock: ["rock"],
  konser: ["live-music", "concert"],
  film: ["film"],
  sinema: ["film", "cinema"],
  dizi: ["tv", "film"],
  kitap: ["books", "reading"],
  okuma: ["books", "reading"],
  kosu: ["running", "run"],
  kosmak: ["running", "run"],
  yuzme: ["swim", "swimming"],
  bisiklet: ["cycling"],
  yoga: ["yoga"],
  spor: ["sport", "sports"],
  dans: ["dance", "dancing"],
  tiyatro: ["theatre"],
  fotograf: ["photography"],
  yuruyus: ["walk", "hiking"],
  kahve: ["coffee"],
  yemek: ["food", "dinner"],
  sarap: ["wine"],
  oyun: ["games", "board-games"],
  tirmanis: ["climbing", "boulder"],
  sanat: ["art"],
  tarih: ["history"],
  mimari: ["architecture"],
  sohbet: ["conversation", "talk"],
  plak: ["vinyl"],
};

/** Rules-only tags: folded words plus English equivalents of common Turkish interest words. */
export function fallbackTags(prompt: string): string[] {
  const words = interestWords(prompt);
  const out: string[] = [];
  for (const w of words) {
    for (const tag of TR_TAGS[w] ?? [w]) if (!out.includes(tag)) out.push(tag);
  }
  return out.slice(0, 10);
}

/** Interest words left after removing constraint grammar; empty for a pure follow-up like "yarın da olur ama bütçe aynı". */
export function interestWords(prompt: string): string[] {
  const districtWords = new Set(DISTRICTS.flatMap((d) => d.aliases));
  return Array.from(
    new Set(
      tokens(prompt).filter(
        (w) =>
          w.length > 2 && !/^\d+$/.test(w) && !CONSTRAINT_STOPWORDS.has(w) && !districtWords.has(w),
      ),
    ),
  );
}

/**
 * Merge a new turn into the previous constraints: only mentioned fields change.
 * `newTags` are the interest tags found for this turn (model or rules); when the
 * turn carries no interest words at all, previous tags are kept.
 */
export function mergeConstraints(
  prev: Constraints | null,
  extracted: Extracted,
  newTags: string[],
  hasInterestWords: boolean,
): Constraints {
  const base = prev ?? EMPTY_CONSTRAINTS;
  const { keepBudget, ...fields } = extracted;
  const next: Constraints = { ...base };
  if (fields.intent !== undefined) {
    next.intent = fields.intent;
    next.placeKind = fields.placeKind ?? null;
  } else if (fields.placeKind !== undefined && fields.placeKind !== null) {
    next.placeKind = fields.placeKind;
  }
  if (fields.when !== undefined) next.when = fields.when;
  if (fields.district !== undefined) next.district = fields.district;
  if (fields.budgetMax !== undefined) next.budgetMax = fields.budgetMax;
  else if (keepBudget) next.budgetMax = base.budgetMax;
  if (fields.groupSize !== undefined) next.groupSize = fields.groupSize;
  if (fields.social !== undefined) next.social = fields.social || base.social;
  if (hasInterestWords && newTags.length > 0) next.tags = newTags;
  else if (!prev) next.tags = newTags;
  return next;
}

// ---------------------------------------------------------------------------
// Filtering and scoring
// ---------------------------------------------------------------------------

export function eventDistrict(
  e: Pick<DiscoveryEvent, "venue" | "title" | "tags" | "latitude" | "longitude" | "city">,
): string | null {
  const text = ` ${fold([e.venue, e.title, ...(e.tags ?? [])].filter(Boolean).join(" "))} `;
  for (const d of DISTRICTS) {
    if (d.aliases.some((a) => text.includes(` ${a} `) || text.includes(` ${a}`))) return d.name;
  }
  if (typeof e.latitude === "number" && typeof e.longitude === "number") {
    let best: { name: string; km: number } | null = null;
    for (const d of DISTRICTS) {
      const km = distanceKm(e.latitude, e.longitude, d.lat, d.lng);
      if (km <= d.radiusKm && (!best || km < best.km)) best = { name: d.name, km };
    }
    if (best) return best.name;
  }
  return null;
}

function tagOverlap(eventTags: string[], wanted: string[]): number {
  const et = eventTags.map(fold);
  return et.filter((t) => wanted.some((q) => t.includes(q) || q.includes(t))).length;
}

export function scoreEvent<E extends DiscoveryEvent>(e: E, c: Constraints): ScoredEvent<E> {
  const violations: Violation[] = [];
  const unverified: Unverified[] = [];
  const wanted = c.tags.map(fold).filter(Boolean);
  const score = wanted.length > 0 ? tagOverlap(e.tags ?? [], wanted) : 0;

  if (c.when) {
    const t = Date.parse(e.starts_at);
    if (!(t >= Date.parse(c.when.from) && t <= Date.parse(c.when.to))) violations.push("date");
  }
  const district = eventDistrict(e);
  if (c.district) {
    if (district !== c.district) violations.push("district");
  }
  if (c.budgetMax !== null) {
    const price = e.price === null || e.price === undefined ? null : Number(e.price);
    if (price === null || !Number.isFinite(price)) unverified.push("price");
    else if (price > c.budgetMax) violations.push("budget");
  }
  if (wanted.length > 0 && score === 0) violations.push("interest");
  if (c.groupSize) {
    if (e.capacity === null || e.capacity === undefined) unverified.push("capacity");
    else if (c.groupSize === "small" && e.capacity > 40) violations.push("group");
    else if (c.groupSize === "large" && e.capacity < 15) violations.push("group");
  }

  return {
    ...e,
    _score: score,
    violations,
    unverified,
    district,
    demo: (e.tags ?? []).includes("demo"),
  };
}

export type Split<E extends DiscoveryEvent> = {
  matches: ScoredEvent<E>[];
  alternatives: ScoredEvent<E>[];
};

/** Exact matches (nothing missed, nothing unverified) first; alternatives ordered by how little they miss, then by date. */
export function splitEvents<E extends DiscoveryEvent>(
  events: E[],
  c: Constraints,
  limits: { matches?: number; alternatives?: number } = {},
): Split<E> {
  const scored = events.filter((e) => e.category !== "landmark").map((e) => scoreEvent(e, c));
  const byDate = (a: ScoredEvent<E>, b: ScoredEvent<E>) =>
    Date.parse(a.starts_at) - Date.parse(b.starts_at);
  const matches = scored
    .filter((e) => e.violations.length === 0 && e.unverified.length === 0)
    .sort((a, b) => b._score - a._score || byDate(a, b))
    .slice(0, limits.matches ?? 12);
  const alternatives = scored
    .filter((e) => !(e.violations.length === 0 && e.unverified.length === 0))
    .sort(
      (a, b) =>
        a.violations.length + a.unverified.length - (b.violations.length + b.unverified.length) ||
        b._score - a._score ||
        byDate(a, b),
    )
    .slice(0, limits.alternatives ?? 6);
  return { matches, alternatives };
}

/** Human labels for the constraint chips (keys for i18n). */
export function describeWhen(when: Constraints["when"]): string {
  if (!when) return "";
  return when.label;
}
