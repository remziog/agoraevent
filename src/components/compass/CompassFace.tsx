import { useTranslation } from "react-i18next";
import { Sparkles, UtensilsCrossed } from "lucide-react";
import type { DiscoveryStatus } from "@/lib/discovery-store";
import { AskBox } from "@/components/discover/AskBox";

/**
 * Compass directions. Each is a ready-made request sent through the same
 * discovery context as typed text — not a separate search engine. "food" asks
 * for a restaurant (Qloo ranks it; Agora asks for the district once); the
 * other four name a gathering explicitly and carry no date or district.
 * The angle only turns the needle.
 */
export const DIRECTIONS = [
  { key: "food", angle: -20, prompt: "Recommend a restaurant that fits my taste" },
  {
    key: "quiet",
    angle: -135,
    prompt: "A quiet gathering with a small group, vinyl and slow conversation",
  },
  { key: "loud", angle: -45, prompt: "A loud gathering with a big crowd, live music or dancing" },
  {
    key: "move",
    angle: 45,
    prompt: "A run, a swim or a workout gathering with strangers, outdoors",
  },
  { key: "cinema", angle: 135, prompt: "An indie film club night with wine" },
] as const;

export type Direction = (typeof DIRECTIONS)[number];

const DOT: Record<string, string> = {
  quiet: "#9ccbff",
  loud: "#e57ca8",
  move: "#f2a43a",
  cinema: "#a08bdd",
};

/** Point on the dial: 0° = north, clockwise; r in viewBox units (centre 160,160). */
function pt(deg: number, r: number) {
  const a = (deg * Math.PI) / 180;
  return [160 + Math.sin(a) * r, 160 - Math.cos(a) * r] as const;
}

const TICKS = Array.from({ length: 72 }, (_, i) => {
  const major = i % 18 === 0;
  const mid = i % 9 === 0;
  const [x1, y1] = pt(i * 5, 150);
  const [x2, y2] = pt(i * 5, major ? 136 : mid ? 141.5 : 145.5);
  return { i, x1, y1, x2, y2, o: major ? 1 : mid ? 0.7 : 0.42 };
});

const AXIS = [0, 90, 180, 270].map((deg) => {
  const [x1, y1] = pt(deg, 15);
  const [x2, y2] = pt(deg, 116);
  return { deg, x1, y1, x2, y2 };
});

/**
 * The night compass (design: Naz Paşalı): white hairlines, an open centre and
 * a needle that spins while Agora searches and settles on the answer. Below
 * it, one field for typing or speaking, then the directions as chips.
 */
export function CompassFace({
  needleAngle,
  status,
  found,
  prompt,
  setPrompt,
  onSubmit,
  onPickDirection,
  disabled,
  className = "",
}: {
  needleAngle: number;
  status: DiscoveryStatus;
  /** Something was found (places or gatherings). */
  found: boolean;
  prompt: string;
  setPrompt: (v: string) => void;
  onSubmit: (p: string) => void;
  onPickDirection: (d: Direction) => void;
  disabled: boolean;
  className?: string;
}) {
  const { t } = useTranslation();
  const searching = status === "searching";

  const stateLabel = searching
    ? t("discover.stateSearching", "Searching")
    : status === "question"
      ? t("discover.stateQuestion", "One question")
      : found
        ? t("discover.stateFound", "Found")
        : status === "empty"
          ? t("discover.stateEmpty", "No exact match")
          : status === "error"
            ? t("discover.stateError", "Error")
            : t("discover.stateReady", "Your mood is the compass");

  const line = "var(--nt, currentColor)";

  return (
    <div className={`w-full ${className}`}>
      <div
        className="agora-compass night-dial relative mx-auto aspect-square w-full max-w-[17.5rem] sm:max-w-[20rem]"
        data-state={status}
        role="img"
        aria-label={t(
          "discover.compassLabel",
          "Compass: tell Agora what you want, or pick a direction",
        )}
      >
        {/* sheen while searching */}
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
          <circle cx="160" cy="160" r="150" fill="rgb(13 11 26 / 0.16)" />
          <circle
            className="dial-trace"
            cx="160"
            cy="160"
            r="150"
            fill="none"
            stroke={status === "error" ? "var(--ember, #e8573f)" : line}
            strokeWidth="1.2"
            pathLength={1}
            transform="rotate(-90 160 160)"
          />
          <circle
            className="dial-trace"
            style={{ animationDelay: "380ms" }}
            cx="160"
            cy="160"
            r="124"
            fill="none"
            stroke={line}
            strokeWidth="1.2"
            opacity="0.38"
            pathLength={1}
            transform="rotate(90 160 160)"
          />
          <g stroke={line} strokeWidth="1.2">
            {TICKS.map((k) => (
              <line
                key={k.i}
                className="dial-trace"
                style={{ animationDelay: `${430 + k.i * 7}ms`, animationDuration: "200ms" }}
                x1={k.x1}
                y1={k.y1}
                x2={k.x2}
                y2={k.y2}
                opacity={k.o}
                pathLength={1}
              />
            ))}
            {AXIS.map((a, i) => (
              <line
                key={a.deg}
                className="dial-trace"
                style={{ animationDelay: `${920 + i * 45}ms`, animationDuration: "440ms" }}
                x1={a.x1}
                y1={a.y1}
                x2={a.x2}
                y2={a.y2}
                opacity="0.22"
                pathLength={1}
              />
            ))}
          </g>
          <circle
            cx="160"
            cy="160"
            r="9"
            fill="none"
            stroke={line}
            strokeWidth="1.2"
            opacity="0.38"
          />
          <path d="M160 0.5 L164 7.5 L156 7.5 Z" fill={line} />
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
                    transform: `rotate(${needleAngle + 90}deg)`,
                    transition: "transform 1.1s cubic-bezier(0.22, 1, 0.36, 1)",
                  }),
            }}
          >
            <path
              d="M160 160 L165.5 148 L160 42 L154.5 148 Z"
              fill="none"
              stroke={line}
              strokeWidth="1.2"
              strokeLinejoin="round"
            />
            <path d="M160 42 L162.5 90 L157.5 90 Z" fill={line} />
            <path
              d="M160 160 L163.5 171 L160 222 L156.5 171 Z"
              fill="none"
              stroke={line}
              strokeWidth="1.2"
              strokeLinejoin="round"
              opacity="0.5"
            />
            <circle cx="160" cy="160" r="2.8" fill={line} />
          </g>
        </svg>
      </div>

      <p
        className="mt-3 flex items-center justify-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.12em] text-[color:var(--nt-2)]"
        aria-live="polite"
      >
        {found && !searching && (
          <Sparkles className="h-3 w-3 text-[color:var(--amber)]" aria-hidden />
        )}
        {stateLabel}
      </p>

      <div className="mx-auto mt-4 w-full max-w-md">
        <AskBox
          value={prompt}
          onChange={setPrompt}
          onSend={onSubmit}
          disabled={disabled}
          variant="night"
          inputId="compass-ask"
          placeholder={t("discover.compassPlaceholderNight", "Tell Agora…")}
        />
      </div>

      <div
        className="chip-scroll -mx-5 mt-3 flex gap-2 overflow-x-auto px-5 py-0.5 sm:mx-auto sm:max-w-md sm:flex-wrap sm:justify-center sm:px-0"
        role="group"
        aria-label={t("discover.directionsLabel", "Directions")}
      >
        {DIRECTIONS.map((d) =>
          d.key === "food" ? (
            <button
              key={d.key}
              type="button"
              disabled={disabled}
              onClick={() => onPickDirection(d)}
              className="inline-flex min-h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-full bg-[color:var(--nt)] px-4 text-[14.5px] font-semibold text-[color:var(--nt-ink)] transition hover:shadow-[0_0_0_3px_rgb(232_87_63/0.35)] disabled:opacity-50"
            >
              <UtensilsCrossed className="h-4 w-4 text-[color:var(--ember)]" aria-hidden />
              {t(`discover.direction.${d.key}`)}
            </button>
          ) : (
            <button
              key={d.key}
              type="button"
              disabled={disabled}
              onClick={() => onPickDirection(d)}
              className="inline-flex min-h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-3.5 text-[14.5px] font-semibold text-[color:var(--nt)] shadow-[inset_0_0_0_1px_var(--nt-line)] transition hover:shadow-[inset_0_0_0_1px_var(--nt)] disabled:opacity-50"
            >
              <i
                aria-hidden
                className="h-[7px] w-[7px] rounded-full"
                style={{ background: DOT[d.key], boxShadow: `0 0 9px ${DOT[d.key]}` }}
              />
              {t(`discover.direction.${d.key}`)}
            </button>
          ),
        )}
      </div>
    </div>
  );
}
