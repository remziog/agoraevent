import type { CSSProperties, ReactNode } from "react";

/**
 * A generative placeholder in Agora's palette (design: Naz Paşalı): a base
 * colour, two blurred light leaks, one geometric motif and a fine grain. It is
 * deterministic per seed and never pretends to be a photo — Agora shows a real
 * photo only when one exists, and never an AI image.
 */
const ARTS = [
  { b: "#1b1613", c1: "#ff5b1f", c2: "#ff4fa8", fg: "#ffd23c" },
  { b: "#e2431b", c1: "#ff9b3d", c2: "#6e1709", fg: "#f7f2ea" },
  { b: "#47472a", c1: "#8e8b4a", c2: "#22210f", fg: "#ffe14a" },
  { b: "#efe4d3", c1: "#ff4fa8", c2: "#ffd23c", fg: "#100f0e" },
  { b: "#26163f", c1: "#7b5cff", c2: "#ff7a66", fg: "#f7f2ea" },
  { b: "#f25aa8", c1: "#ffb2d6", c2: "#ff5b1f", fg: "#100f0e" },
] as const;

export function hashSeed(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (h * 33 + s.charCodeAt(i)) >>> 0;
  return h;
}

function seeded(h: number) {
  let x = h || 1;
  return () => {
    x = (x * 1664525 + 1013904223) >>> 0;
    return x / 4294967296;
  };
}

/** The art's foreground colour (for text laid over it). */
export function artInk(seed: string): string {
  return ARTS[hashSeed(seed) % ARTS.length].fg;
}

function Motif({ k, fg }: { k: number; fg: string }) {
  const shapes = [
    <circle key="a" cx="70" cy="44" r="34" fill={fg} opacity=".9" />,
    <path key="b" d="M10 120 L52 34 L94 120 Z" fill={fg} opacity=".85" />,
    <path key="c" d="M50 30 A40 40 0 0 1 50 110 Z" fill={fg} opacity=".85" />,
    <g key="d">
      <circle cx="34" cy="40" r="22" fill="none" stroke={fg} strokeWidth="5" />
      <circle cx="70" cy="80" r="16" fill={fg} />
    </g>,
    <path key="e" d="M50 62 L90 62 A40 40 0 1 1 50 22 Z" fill={fg} opacity=".85" />,
  ];
  return (
    <svg
      viewBox="0 0 100 125"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
      className="absolute inset-x-0 top-0 z-[1] h-[62%] w-full"
    >
      {shapes[k % shapes.length]}
    </svg>
  );
}

export function ArtBlock({
  seed,
  className = "",
  children,
  shade = true,
}: {
  seed: string;
  className?: string;
  children?: ReactNode;
  /** Darken (or lighten) the lower part so overlaid text stays legible. */
  shade?: boolean;
}) {
  const h = hashSeed(seed);
  const a = ARTS[h % ARTS.length];
  const r = seeded(h);
  const style = {
    background: a.b,
    color: a.fg,
    "--x1": `${Math.round(-30 + r() * 50)}%`,
    "--y1": `${Math.round(-20 + r() * 40)}%`,
    "--x2": `${Math.round(20 + r() * 50)}%`,
    "--y2": `${Math.round(30 + r() * 50)}%`,
  } as CSSProperties;
  const sh = a.fg === "#100f0e" ? "rgb(255 255 255 / 0.3)" : "rgb(0 0 0 / 0.38)";
  return (
    <div className={`relative isolate overflow-hidden ${className}`} style={style}>
      <span
        aria-hidden
        className="absolute aspect-square w-[90%] rounded-full opacity-90 blur-[30px]"
        style={{ left: "var(--x1)", top: "var(--y1)", background: a.c1 }}
      />
      <span
        aria-hidden
        className="absolute aspect-square w-[70%] rounded-full opacity-85 blur-[30px]"
        style={{ left: "var(--x2)", top: "var(--y2)", background: a.c2 }}
      />
      <Motif k={h >> 3} fg={a.fg} />
      <span
        aria-hidden
        className="absolute inset-0 z-[2] opacity-35 mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='140' height='140'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
        }}
      />
      {shade && (
        <span
          aria-hidden
          className="absolute inset-0 z-[2]"
          style={{ background: `linear-gradient(180deg, transparent 38%, ${sh})` }}
        />
      )}
      <div className="relative z-[3] h-full">{children}</div>
    </div>
  );
}
