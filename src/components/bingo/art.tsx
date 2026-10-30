// Naz Paşalı's original line artwork (prototype v3): one fine line drawing per Bingo square on an
// 80 × 56 grid, status marks, and the five badge geometries on a 96 × 96 grid. Static, trusted
// markup only — no user data is ever interpolated here.
import type { BadgeId, CellStatus, ChallengeId } from "@/lib/bingo";

const BQ_ART: Record<ChallengeId, string> = {
  coffee: `<ellipse class="s" cx="40" cy="44.5" rx="23" ry="4.6"/><ellipse class="s" cx="40" cy="44" rx="13.5" ry="2.3"/><path d="M28 24.5C28 35.5 32.5 42 40 42S52 35.5 52 24.5"/><ellipse cx="40" cy="24.5" rx="12" ry="3"/><ellipse class="s" cx="40" cy="25" rx="9.4" ry="1.8"/><path d="M51.6 27.4C57.4 26.6 58.4 34 50.4 35.4"/><path class="s" d="M35.5 18.5c-2.2-3 2.2-4.6 0-8M40.5 17.5c-2.4-3.4 2.4-5.4 0-10M45.5 18.5c-2.2-3 2.2-4.6 0-8"/><path class="s" d="M40 2.5v2.5"/>`,
  exhibit: `<path class="s" d="M7 52L17 41H63L73 52M7 4.5L17 8H63L73 4.5"/><path class="s" d="M17 8V41M63 8V41"/><path class="s" d="M28 52l3-11M40 52V41M52 52l-3-11"/><rect x="21" y="15" width="14" height="18" rx=".3"/><rect class="s" x="23.4" y="17.4" width="9.2" height="13.2"/><rect x="39" y="18.5" width="9.5" height="9.5" rx=".3"/><rect x="52.5" y="13.5" width="6" height="21" rx=".3"/><path class="s" d="M28 8v3.5M43.75 8v5.5M55.5 8v2.5"/><path class="s" d="M24 36h8M39 31h9.5"/>`,
  music: `<path d="M8 46.5H72"/><path class="s" d="M12 50.5H68M8 46.5L12 50.5M72 46.5L68 50.5"/><path d="M42 46.5V24.5"/><path class="s" d="M42 40.5L35.5 46.5M42 40.5L48.5 46.5"/><path d="M42 28L51 19.5"/><rect x="49.6" y="10.2" width="6.4" height="10.6" rx="3.2" transform="rotate(46.6 52.8 15.5)"/><path class="s" d="M51.3 13.2l3.6 3.4M50.2 14.6l3.6 3.4"/><path class="s" d="M59.5 9.5a8 8 0 0 1 1.6 9.6M63.2 6.6a12.5 12.5 0 0 1 2.4 15"/><path d="M21.5 33V18.2l9-2.4V30"/><path class="s" d="M21.5 22.2l9-2.4"/><ellipse cx="18.9" cy="33.4" rx="2.8" ry="2" transform="rotate(-20 18.9 33.4)"/><ellipse cx="27.9" cy="30.4" rx="2.8" ry="2" transform="rotate(-20 27.9 30.4)"/>`,
  hood: `<path class="s" d="M5 50.5H76"/><path d="M7 50.5V13h20v37.5"/><path class="s" d="M7 17.5h20"/><path class="s" d="M10.5 22h4v5h-4zM19.5 22h4v5h-4zM10.5 32h4v5h-4zM19.5 32h4v5h-4z"/><path d="M15 50.5v-8h4v8"/><path d="M27 13L50 22.5V44L27 50.5"/><path class="s" d="M33 18.5v28.6M39 21v24.4M45 23.5v21.7M27 30l23 1.2M27 40.5l23 -2"/><path class="s" d="M27 50.5L70 46M50 44l20 2"/><path d="M55 44V33.5a5.5 5.5 0 0 1 11 0V44"/><path class="s" d="M53.5 44H67.5M60.5 28v-2.2"/><path d="M71.5 44V17"/><path class="s" d="M70.5 19.5L71.5 13.5L72.5 19.5M70.4 25h2.2"/>`,
  shop: `<path class="s" d="M6 50.5H74"/><path d="M17 50.5V11.5H63V50.5"/><path class="s" d="M17 17H63"/><path class="s" d="M33 14.25H47"/><path d="M14.5 21H65.5L62.5 28H17.5Z"/><path class="s" d="M17.5 28q2.75 2.4 5.5 0q2.75 2.4 5.5 0q2.75 2.4 5.5 0q2.75 2.4 5.5 0q2.75 2.4 5.5 0q2.75 2.4 5.5 0q2.75 2.4 5.5 0q2.75 2.4 5.5 0M24 21l-1 7M32.5 21l-.5 7M40 21v7M47.5 21l.5 7M56 21l1 7"/><rect x="21.5" y="33" width="18" height="13.5" rx=".3"/><path class="s" d="M30.5 33v13.5M21.5 41h18"/><path class="s" d="M25 41v-3.2a1.6 1.6 0 0 1 3.2 0V41M34 41l1.6-4.5 1.6 4.5"/><path d="M45 50.5V33h12v17.5"/><rect class="s" x="47.3" y="35.3" width="7.4" height="8.4"/><circle class="d" cx="47.4" cy="45.6" r=".55"/>`,
  cuisine: `<circle cx="40" cy="28" r="19"/><circle class="s" cx="40" cy="28" r="14"/><path class="s" d="M29.5 33C35.5 36.6 44.5 36.6 50.5 33"/><circle cx="34.6" cy="30" r="3.4"/><circle cx="40.6" cy="28.6" r="3.4"/><circle cx="46.4" cy="30.4" r="3.4"/><path class="s" d="M41.5 25.2l2.6-4.4M43.2 22.4c1.6-.9 3.4-.6 4.2.4c-1.4 1-3.2 1-4.2-.4ZM42.4 23.8c-1.7-.6-3.3 0-3.9 1.1c1.5.7 3.2.4 3.9-1.1Z"/><path d="M12.5 10.5V18.5Q12.5 21.8 15 21.8T17.5 18.5V10.5M15 10.5V21.8M15 21.8V46"/><path d="M65 46V10.5C68.4 12.6 69.4 21 66.4 25.6H65"/>`,
  park: `<path class="s" d="M3 44.5H24M33 41.5H77"/><path d="M22 51.5C34 44 52 40.6 76 39.8"/><path class="s" d="M36 54.5C45 48.6 59 45.2 77 44.4"/><path d="M18 47V30"/><path class="s" d="M18 36.5l-4.5-4.5M18 33.5l5-5"/><circle cx="18" cy="21" r="11"/><path class="s" d="M10.5 19a7.6 7.6 0 0 1 9.5-6.8M14 26.8a8 8 0 0 0 11-3"/><path d="M47 32.5H63"/><path class="s" d="M47 28.2H63M49 28.2V36.5M61 28.2V36.5"/><circle class="s" cx="64" cy="10" r="3.6"/>`,
  surprise: `<path d="M28 25.5V39.5L40 45.5L52 39.5V25.5"/><path d="M40 31.5V45.5"/><path d="M28 25.5L40 31.5L52 25.5"/><path class="s" d="M28 25.5L40 19.5L52 25.5"/><path d="M40 19.5L52 25.5L57.5 14.5L45.5 8.5Z"/><path class="s" d="M46.5 12.5l6 3"/><path d="M28 6l1.4 4.6L34 12l-4.6 1.4L28 18l-1.4-4.6L22 12l4.6-1.4Z"/><path class="s" d="M28 1.5V3M28 21v1.5M17.5 12H19M37 12h1.5M20.6 4.6l1 1M35.4 19.4l-1-1M35.4 4.6l-1 1M20.6 19.4l1-1"/><path class="s" d="M34 27.2l-3.2-2.6M40 27.5V23.5M46 27.2l2.6-2.2"/>`,
};

/** Each square's atmosphere: the faint coloured light behind its drawing. */
export const BQ_ATMOS: Record<ChallengeId, string> = {
  coffee: "201, 140, 70",
  exhibit: "120, 160, 205",
  music: "214, 104, 138",
  hood: "160, 120, 190",
  shop: "196, 170, 120",
  cuisine: "214, 110, 80",
  park: "120, 165, 125",
  surprise: "150, 120, 220",
};

// primary lines carry the subject; ".s" lines are construction; ".d" marks are small filled points
const INK = "#F5F0E8";
const inline = (body: string) =>
  body
    .replace(/<(path|rect|circle|ellipse) /g, '<$1 vector-effect="non-scaling-stroke" ')
    .replace(/class="s"/g, 'stroke-width="0.8" stroke-opacity="0.4"')
    .replace(/class="d"/g, `fill="${INK}" fill-opacity="0.7" stroke="none"`);
const BQ_HTML = Object.fromEntries(
  Object.entries(BQ_ART).map(([k, v]) => [k, inline(v)]),
) as Record<ChallengeId, string>;

export function SquareArt({ id, className = "nb-bqa" }: { id: ChallengeId; className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 80 56"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
      focusable="false"
      fill="none"
      stroke={INK}
      strokeWidth={1.15}
      strokeOpacity={0.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      dangerouslySetInnerHTML={{ __html: BQ_HTML[id] }}
    />
  );
}

export function StatusIcon({ status }: { status: CellStatus | "verified" }) {
  if (status === "locked")
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="8" strokeDasharray="2 3" />
      </svg>
    );
  if (status === "progress")
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="8" />
        <path d="M12 7v5l3 2" />
      </svg>
    );
  if (status === "done")
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="8" />
        <path d="m8.5 12.5 2.5 2.5 4.5-5" />
      </svg>
    );
  // the free centre (and, one day, partner-verified squares)
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3l2.4 1.8 3 .1.9 2.9 2.2 2-1 2.8.4 3-2.6 1.5-1.2 2.7-3-.4L12 21l-2.3-1.6-3 .4-1.2-2.7-2.6-1.5.4-3-1-2.8 2.2-2 .9-2.9 3-.1z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

const BADGE_ART: Record<BadgeId, string> = {
  coffee: '<circle class="ba-ring" cx="48" cy="48" r="44"/><path class="ba-ml" d="M40 20v8M48 16v12M56 20v8"/><circle class="ba-b" cx="48" cy="54" r="22"/><circle class="ba" cx="48" cy="54" r="22"/><circle class="ba" cx="48" cy="54" r="13"/><circle class="ba-m" cx="53" cy="50" r="5.5"/><path class="ba" d="M70 54h7a4 4 0 0 1 0 8h-9"/><path class="ba" d="M20 82h56"/>',
  art: '<circle class="ba-ring" cx="48" cy="48" r="44"/><path class="ba-b" d="M26 42h44v32H26z"/><path class="ba" d="M20 40 48 22 76 40Z"/><circle class="ba-o" cx="48" cy="33" r="2.6"/><path class="ba" d="M31 42v32M40 42v32M56 42v32M65 42v32"/><rect class="ba-m" x="44" y="52" width="8" height="14"/><path class="ba" d="M18 78h60"/>',
  night: '<circle class="ba-ring" cx="48" cy="48" r="44"/><circle class="ba-b" cx="48" cy="46" r="30"/><path class="ba-m" d="M56 26a22 22 0 1 0 0 40a17 17 0 1 1 0-40z"/><circle class="ba-f" cx="68" cy="30" r="1.6"/><circle class="ba-f" cx="74" cy="48" r="1.2"/><path class="ba" d="M14 76h68"/><path class="ba" d="M30 76v-8h8v8M58 76V62h10v14"/>',
  nomad: '<circle class="ba-ring" cx="48" cy="48" r="44"/><g class="ba-f"><circle cx="30" cy="30" r="1.3"/><circle cx="48" cy="30" r="1.3"/><circle cx="30" cy="48" r="1.3"/><circle cx="66" cy="48" r="1.3"/><circle cx="30" cy="66" r="1.3"/><circle cx="48" cy="66" r="1.3"/><circle cx="66" cy="66" r="1.3"/></g><path class="ba-ml" d="M24 74V58h20"/><path class="ba" d="M44 58V40h20V30"/><circle class="ba-f" cx="24" cy="74" r="3"/><path class="ba-m" d="M64 12a9 9 0 0 1 9 9c0 7-9 15-9 15s-9-8-9-15a9 9 0 0 1 9-9z"/><circle class="ba-b" cx="64" cy="21" r="3.2"/>',
  culture: '<circle class="ba-ring" cx="48" cy="48" r="44"/><path class="ba-b" d="M16 30h46v9a5 5 0 0 0 0 10v9H16v-9a5 5 0 0 0 0-10z"/><path class="ba" d="M16 30h46v9a5 5 0 0 0 0 10v9H16v-9a5 5 0 0 0 0-10z"/><path class="ba" d="M50 32v24" stroke-dasharray="2 3"/><path class="ba" d="M23 39h18M23 45h12"/><circle class="ba-ml" cx="62" cy="62" r="16" stroke-dasharray="3 2.6"/><circle class="ba-m" cx="62" cy="62" r="9"/><path class="ba-b" d="M62 56.5 66.5 65h-9z"/>',
};

export function BadgeArt({ id, size = 96 }: { id: BadgeId; size?: number }) {
  return (
    <svg
      className="nb-bdg-art"
      style={{ width: size, height: size }}
      viewBox="0 0 96 96"
      aria-hidden="true"
      focusable="false"
      dangerouslySetInnerHTML={{ __html: BADGE_ART[id] }}
    />
  );
}
