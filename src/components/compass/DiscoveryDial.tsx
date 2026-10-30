import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { DISTRICTS } from "@/lib/discovery";

/**
 * The discovery moment (design: Naz Paşalı): the compass becomes a small map.
 * The centre is the district Agora searched (or the city centre), Istanbul's
 * coastline is drawn around it, and the top three answers sit where they are —
 * true bearing, distance compressed on a log scale. The needle points to #1.
 * Coastlines are stylised, hand-placed outlines, not survey data.
 */

export type DialPoint = {
  id: string;
  name: string;
  lat: number;
  lng: number;
};

const KM_LAT = 111.32;
const CITY = { name: "Istanbul", lat: 41.0082, lng: 28.9784 };
const MARK = ["#f2a43a", "#e8573f", "#9ccbff"] as const;

/* Stylised coastlines (lat, lng) from Naz's prototype — hand-placed, not survey data. */
const COAST: Record<"eu1" | "eu2" | "as", [number, number][]> = {
  eu1: [
    [40.976, 28.86],
    [40.981, 28.882],
    [40.986, 28.902],
    [40.991, 28.918],
    [40.996, 28.931],
    [41.0, 28.944],
    [40.999, 28.955],
    [41.003, 28.962],
    [41.003, 28.971],
    [41.004, 28.98],
    [41.007, 28.986],
    [41.0125, 28.987],
    [41.0155, 28.984],
    [41.017, 28.979],
    [41.0185, 28.9705],
    [41.0215, 28.965],
    [41.0245, 28.9585],
    [41.028, 28.953],
    [41.031, 28.9495],
    [41.0345, 28.946],
    [41.039, 28.942],
    [41.044, 28.9375],
    [41.049, 28.933],
    [41.056, 28.9345],
    [41.063, 28.94],
  ],
  eu2: [
    [41.064, 28.9465],
    [41.0565, 28.942],
    [41.0505, 28.9425],
    [41.0455, 28.947],
    [41.0405, 28.9515],
    [41.036, 28.956],
    [41.032, 28.961],
    [41.0285, 28.966],
    [41.025, 28.9705],
    [41.0225, 28.975],
    [41.024, 28.981],
    [41.027, 28.985],
    [41.031, 28.99],
    [41.035, 28.995],
    [41.039, 29.0],
    [41.0415, 29.0055],
    [41.0435, 29.013],
    [41.0465, 29.024],
    [41.0505, 29.03],
    [41.056, 29.033],
    [41.062, 29.037],
    [41.068, 29.042],
    [41.0755, 29.044],
    [41.0825, 29.052],
    [41.093, 29.056],
    [41.105, 29.059],
    [41.117, 29.065],
    [41.13, 29.062],
  ],
  as: [
    [41.13, 29.083],
    [41.115, 29.075],
    [41.1, 29.068],
    [41.085, 29.066],
    [41.074, 29.06],
    [41.063, 29.056],
    [41.054, 29.051],
    [41.045, 29.041],
    [41.037, 29.031],
    [41.031, 29.021],
    [41.0265, 29.0125],
    [41.021, 29.0075],
    [41.013, 29.0095],
    [41.004, 29.014],
    [40.997, 29.019],
    [40.992, 29.0225],
    [40.986, 29.021],
    [40.9795, 29.0225],
    [40.9775, 29.029],
    [40.975, 29.0355],
    [40.969, 29.037],
    [40.965, 29.044],
    [40.9655, 29.054],
    [40.962, 29.067],
    [40.958, 29.083],
    [40.952, 29.099],
    [40.943, 29.117],
    [40.932, 29.133],
  ],
};
const FAR_EU: [number, number][] = [
  [41.3, 29.06],
  [41.3, 28.6],
  [40.9, 28.6],
];
const FAR_AS: [number, number][] = [
  [40.85, 29.4],
  [41.3, 29.4],
  [41.3, 29.083],
];
const WATER = [
  { k: "bosphorus", lat: 41.06, lng: 29.0455 },
  { k: "goldenHorn", lat: 41.0375, lng: 28.948 },
  { k: "marmara", lat: 40.993, lng: 28.982 },
] as const;

type V = { x: number; y: number };

function kmFrom(o: { lat: number; lng: number }, p: { lat: number; lng: number }): V {
  const kx = KM_LAT * Math.cos((o.lat * Math.PI) / 180);
  return { x: (p.lng - o.lng) * kx, y: (p.lat - o.lat) * KM_LAT };
}
export function bearingDeg(o: { lat: number; lng: number }, p: { lat: number; lng: number }) {
  const v = kmFrom(o, p);
  return ((Math.atan2(v.x, v.y) * 180) / Math.PI + 360) % 360;
}
export function distanceKm(o: { lat: number; lng: number }, p: { lat: number; lng: number }) {
  const v = kmFrom(o, p);
  return Math.hypot(v.x, v.y);
}

function projector(center: { lat: number; lng: number }, radiusKm: number, Rpx = 112, c = 160) {
  const scr = (v: V): V => {
    const d = Math.hypot(v.x, v.y);
    if (d < 1e-6) return { x: c, y: c };
    const r = (Rpx * Math.log(1 + d)) / Math.log(1 + radiusKm);
    return { x: c + (r * v.x) / d, y: c - (r * v.y) / d };
  };
  return { kmOf: (lat: number, lng: number) => kmFrom(center, { lat, lng }), scr };
}

function catmull(pts: V[], seg = 6): V[] {
  const out: V[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)],
      p1 = pts[i],
      p2 = pts[i + 1],
      p3 = pts[Math.min(pts.length - 1, i + 2)];
    for (let s = 0; s < seg; s++) {
      const t = s / seg,
        t2 = t * t,
        t3 = t2 * t;
      const f = (a: number, b: number, c2: number, d: number) =>
        0.5 *
        (2 * b +
          (-a + c2) * t +
          (2 * a - 5 * b + 4 * c2 - d) * t2 +
          (-a + 3 * b - 3 * c2 + d) * t3);
      out.push({ x: f(p0.x, p1.x, p2.x, p3.x), y: f(p0.y, p1.y, p2.y, p3.y) });
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}
const pathOf = (pts: V[]) =>
  pts.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join("");

const DIR_KEYS = ["n", "ne", "e", "se", "s", "sw", "w", "nw"] as const;
export function dir8(deg: number) {
  return DIR_KEYS[Math.round((((deg % 360) + 360) % 360) / 45) % 8];
}

export function formatKm(
  d: number,
  lang: string,
  t: (k: string, o?: Record<string, unknown>) => string,
) {
  if (d < 0.975) return t("dial.meters", { n: Math.max(50, Math.round((d * 1000) / 50) * 50) });
  const v = new Intl.NumberFormat(lang, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(d);
  return t("dial.km", { v });
}

export function originFor(district: string | null | undefined) {
  const d = district ? DISTRICTS.find((x) => x.name === district) : undefined;
  return d
    ? { name: d.name, lat: d.lat, lng: d.lng, isDistrict: true }
    : { ...CITY, isDistrict: false };
}

export function DiscoveryDial({
  district,
  points,
  searching,
  onPick,
  className = "",
}: {
  district: string | null | undefined;
  /** The answers in rank order; only the first three with coordinates are drawn. */
  points: DialPoint[];
  searching: boolean;
  onPick?: (id: string, rank: number) => void;
  className?: string;
}) {
  const { t, i18n } = useTranslation();
  const origin = originFor(district);
  const top = points.slice(0, 3);

  const geo = useMemo(() => {
    const far = Math.max(1.2, ...top.map((p) => distanceKm(origin, p)));
    const radiusKm = far * 1.25;
    const proj = projector(origin, radiusKm);
    const km = (arr: [number, number][]) => arr.map(([a, b]) => proj.kmOf(a, b));
    const eu1 = catmull(km(COAST.eu1)),
      eu2 = catmull(km(COAST.eu2)),
      as = catmull(km(COAST.as));
    const land = [
      pathOf([...eu1, ...eu2, ...km(FAR_EU)].map(proj.scr)) + "Z",
      pathOf([...as, ...km(FAR_AS)].map(proj.scr)) + "Z",
    ];
    const shore = [eu1, eu2, as].map((pts) => pathOf(pts.map(proj.scr)));
    const water = WATER.map((w) => ({ ...w, ...proj.scr(proj.kmOf(w.lat, w.lng)) })).filter(
      (w) => Math.hypot(w.x - 160, w.y - 160) < 112,
    );
    const marks = top.map((p, i) => {
      const s = proj.scr(proj.kmOf(p.lat, p.lng));
      return { ...p, i, x: s.x, y: s.y, b: bearingDeg(origin, p), d: distanceKm(origin, p) };
    });
    // keep the three name chips from sitting on each other
    const labels = marks.map((m) => ({ id: m.id, x: m.x, y: m.y }));
    for (let a = 0; a < labels.length; a++)
      for (let b = 0; b < a; b++)
        if (Math.abs(labels[a].y - labels[b].y) < 18 && Math.abs(labels[a].x - labels[b].x) < 90)
          labels[a].y = labels[b].y + (labels[a].y >= labels[b].y ? 18 : -18);
    return { land, shore, water, marks, labels };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [origin.lat, origin.lng, top.map((p) => `${p.id}:${p.lat},${p.lng}`).join("|")]);

  const lead = geo.marks[0];
  const needle = lead ? lead.b : 0;

  return (
    <div className={className}>
      <div
        className="agora-compass night-dial relative mx-auto aspect-square w-full max-w-[19rem]"
        role="img"
        aria-label={
          lead
            ? t("dial.aria", {
                origin: origin.isDistrict ? origin.name : t("discover.city", "Istanbul"),
                name: lead.name,
                dir: t(`dial.dirFull.${dir8(lead.b)}`),
                dist: formatKm(lead.d, i18n.language, t),
                defaultValue: "Compass centred on {{origin}}: #1 {{name}} is {{dist}} {{dir}}",
              })
            : t("discover.compassLabel", "Compass")
        }
      >
        <div
          aria-hidden
          className={`pointer-events-none absolute inset-[3%] rounded-full bg-[conic-gradient(from_0deg,transparent_0deg_290deg,rgb(243_235_221/0.14)_359deg,transparent_360deg)] ${
            searching ? "motion-safe:animate-[spin_1.9s_linear_infinite]" : "hidden"
          }`}
        />
        <svg
          viewBox="0 0 320 320"
          className="absolute inset-0 h-full w-full overflow-visible"
          aria-hidden
        >
          <defs>
            <clipPath id="dd-clip">
              <circle cx="160" cy="160" r="122" />
            </clipPath>
          </defs>
          <circle cx="160" cy="160" r="150" fill="rgb(13 11 26 / 0.16)" />
          <g clipPath="url(#dd-clip)">
            {geo.land.map((d, i) => (
              <path key={i} d={d} fill="#fff8ef" fillOpacity="0.07" />
            ))}
            {geo.shore.map((d, i) => (
              <path
                key={i}
                d={d}
                fill="none"
                stroke="#fff8ef"
                strokeOpacity="0.2"
                strokeWidth="0.9"
                strokeLinejoin="round"
              />
            ))}
            {geo.water.map((w) => (
              <text
                key={w.k}
                x={w.x}
                y={w.y}
                textAnchor="middle"
                fontSize="8"
                fill="var(--nt)"
                opacity="0.35"
                fontStyle="italic"
              >
                {t(`dial.water.${w.k}`)}
              </text>
            ))}
          </g>
          <circle cx="160" cy="160" r="150" fill="none" stroke="var(--nt)" strokeWidth="1.15" />
          <circle
            cx="160"
            cy="160"
            r="124"
            fill="none"
            stroke="var(--nt)"
            strokeWidth="1.15"
            opacity="0.38"
          />
          <g stroke="var(--nt)" strokeWidth="1.15">
            {Array.from({ length: 72 }, (_, i) => {
              const major = i % 18 === 0,
                mid = i % 9 === 0;
              const a = (i * 5 * Math.PI) / 180;
              const r2 = major ? 136 : mid ? 141.5 : 145.5;
              return (
                <line
                  key={i}
                  x1={160 + Math.sin(a) * 150}
                  y1={160 - Math.cos(a) * 150}
                  x2={160 + Math.sin(a) * r2}
                  y2={160 - Math.cos(a) * r2}
                  opacity={major ? 1 : mid ? 0.7 : 0.42}
                />
              );
            })}
          </g>
          <path d="M160 0.5 L164 7.5 L156 7.5 Z" fill="var(--nt)" />
          {geo.marks.map((m) => (
            <g key={m.id}>
              <line
                x1="160"
                y1="160"
                x2={m.x}
                y2={m.y}
                stroke={MARK[m.i]}
                strokeWidth="1.15"
                strokeDasharray="1.5 4"
                strokeLinecap="round"
              />
              <circle cx={m.x} cy={m.y} r="9" fill={MARK[m.i]} opacity="0.25" />
              <circle
                cx={m.x}
                cy={m.y}
                r="4.2"
                fill={MARK[m.i]}
                stroke="#0d0b1a"
                strokeWidth="1.2"
              />
            </g>
          ))}
          <g
            className={
              searching
                ? "motion-safe:animate-[spin_1.4s_cubic-bezier(0.45,0,0.55,1)_infinite]"
                : ""
            }
            style={{
              transformOrigin: "160px 160px",
              transformBox: "view-box",
              ...(searching
                ? {}
                : {
                    transform: `rotate(${needle}deg)`,
                    transition: "transform 1.1s cubic-bezier(0.22, 1, 0.36, 1)",
                  }),
            }}
          >
            <path
              d="M160 160 L165.5 148 L160 42 L154.5 148 Z"
              fill="none"
              stroke="var(--nt)"
              strokeWidth="1.15"
              strokeLinejoin="round"
            />
            <path d="M160 42 L162.5 90 L157.5 90 Z" fill="var(--nt)" />
            <path
              d="M160 160 L163.5 171 L160 222 L156.5 171 Z"
              fill="none"
              stroke="var(--nt)"
              strokeWidth="1.15"
              strokeLinejoin="round"
              opacity="0.5"
            />
            <circle cx="160" cy="160" r="2.8" fill="var(--nt)" />
          </g>
        </svg>
        {/* name chips over the markers */}
        {geo.marks.map((m, k) => (
          <button
            key={m.id}
            type="button"
            onClick={() => onPick?.(m.id, m.i + 1)}
            className="absolute z-[2] inline-flex max-w-[9.5rem] -translate-x-1/2 -translate-y-1/2 items-center gap-1.5 rounded-full bg-[rgb(14_11_26/0.68)] py-1 pl-1 pr-2.5 text-[11.5px] font-semibold text-[color:var(--nt)] backdrop-blur-sm transition hover:bg-[color:var(--c)] hover:text-[color:var(--nt-ink)] focus-visible:outline-2"
            style={
              {
                left: `${(geo.labels[k].x / 320) * 100}%`,
                top: `${(geo.labels[k].y / 320) * 100}%`,
                boxShadow: `inset 0 0 0 1px ${MARK[m.i]}`,
                "--c": MARK[m.i],
              } as React.CSSProperties
            }
            aria-label={t("dial.pick", {
              n: m.i + 1,
              name: m.name,
              defaultValue: "Show #{{n}} {{name}}",
            })}
          >
            <b
              className="inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full font-mono text-[10px] text-[color:var(--nt-ink)]"
              style={{ background: MARK[m.i] }}
            >
              {m.i + 1}
            </b>
            <span className="truncate">{m.name}</span>
          </button>
        ))}
      </div>

      <p className="mt-2 text-center font-mono text-[10.5px] uppercase tracking-[0.1em] text-[color:var(--nt-2)]">
        {origin.isDistrict
          ? t("dial.fromDistrict", {
              district: origin.name,
              defaultValue: "From the centre of {{district}}",
            })
          : t("dial.fromCity", "From the city centre")}
      </p>

      {geo.marks.length > 0 && (
        <ol
          className="chip-scroll -mx-5 mt-3 flex gap-2 overflow-x-auto px-5 pb-1 sm:mx-0 sm:flex-wrap sm:justify-center sm:px-0"
          aria-label={t("dial.legend", "The first three, by direction and distance")}
        >
          {geo.marks.map((m) => (
            <li key={m.id} className="shrink-0">
              <button
                type="button"
                onClick={() => onPick?.(m.id, m.i + 1)}
                className="grid min-h-[52px] max-w-[14rem] grid-cols-[12px_1fr] gap-x-2 rounded-2xl bg-[var(--nt-glass)] px-3 py-2 text-left shadow-[inset_0_0_0_1px_var(--nt-line)] backdrop-blur transition hover:shadow-[inset_0_0_0_1px_var(--nt)]"
              >
                <i
                  aria-hidden
                  className="row-span-2 mt-1 h-3 w-3 rounded-full"
                  style={{ background: MARK[m.i], boxShadow: `0 0 10px ${MARK[m.i]}` }}
                />
                <b className="truncate text-[13px] font-semibold text-[color:var(--nt)]">
                  {m.i + 1}. {m.name}
                </b>
                <small className="font-mono text-[10px] uppercase tracking-[0.06em] text-[color:var(--nt-2)]">
                  {t(`dial.dir.${dir8(m.b)}`)} · {formatKm(m.d, i18n.language, t)}
                </small>
              </button>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
