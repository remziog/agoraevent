import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Sparkles, UtensilsCrossed, X } from "lucide-react";
import type { DiscoveryStatus } from "@/lib/discovery-store";
import { AskBox } from "@/components/discover/AskBox";
import { CATEGORIES, type CategoryKey } from "@/lib/categories";

/** Needle angles for the results stage: a category's direction (see `src/lib/categories.ts`). */
export const DIRECTIONS = CATEGORIES.map((c) => ({ key: c.key, angle: c.angle }));

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
  selected,
  onCategoryTap,
  onCategoryClear,
  heard,
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
  /** Naz's categories: the first tap selects, the second tap discovers. */
  selected: CategoryKey | null;
  onCategoryTap: (key: CategoryKey) => void;
  onCategoryClear: () => void;
  /** What Agora understood from the text so far (rendered under the field). */
  heard?: ReactNode;
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

      {heard}

      <div
        className="chip-scroll -mx-5 mt-3 flex gap-2 overflow-x-auto px-5 py-0.5 sm:mx-auto sm:max-w-xl sm:flex-wrap sm:justify-center sm:px-0"
        role="group"
        aria-label={t("cat.group", "Categories")}
      >
        {CATEGORIES.map((c) => {
          const on = selected === c.key;
          const label = t(`cat.${c.key}.label`);
          const base =
            "relative inline-flex min-h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-3.5 text-[14.5px] font-semibold transition disabled:opacity-50";
          const look =
            c.key === "food"
              ? `bg-[color:var(--nt)] text-[color:var(--nt-ink)] ${on ? "shadow-[0_0_0_2px_#e9a23b]" : "hover:shadow-[0_0_0_3px_rgb(232_87_63/0.35)]"}`
              : c.key === "surprise"
                ? `border border-transparent text-[color:var(--nt)] [background:linear-gradient(#17121f,#17121f)_padding-box,linear-gradient(120deg,#f2a43a,#e57ca8_55%,#9ccbff)_border-box] ${on ? "shadow-[0_0_0_2px_#e9a23b]" : ""}`
                : `text-[color:var(--nt)] ${on ? "bg-[rgb(233_162_59/0.16)] shadow-[inset_0_0_0_1.5px_#e9a23b]" : "shadow-[inset_0_0_0_1px_var(--nt-line)] hover:shadow-[inset_0_0_0_1px_var(--nt)]"}`;
          return (
            <button
              key={c.key}
              type="button"
              disabled={disabled}
              aria-pressed={on}
              aria-label={on ? t("cat.selected", { name: label }) : label}
              onClick={(e) => {
                if (on && (e.target as HTMLElement).closest("[data-clear]")) onCategoryClear();
                else onCategoryTap(c.key);
              }}
              className={`${base} ${look}`}
            >
              {c.key === "food" ? (
                <UtensilsCrossed className="h-4 w-4 text-[color:var(--ember)]" aria-hidden />
              ) : c.key === "surprise" ? (
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden
                  className="h-3.5 w-3.5 text-[color:var(--amber)] motion-safe:animate-[agora-twinkle_3.2s_ease-in-out_infinite]"
                >
                  <path
                    d="M12 2l2.2 6.6L21 11l-6.8 2.4L12 20l-2.2-6.6L3 11l6.8-2.4z"
                    fill="currentColor"
                  />
                </svg>
              ) : (
                <i
                  aria-hidden
                  className="h-[7px] w-[7px] rounded-full"
                  style={{ background: c.color, boxShadow: `0 0 9px ${c.color}` }}
                />
              )}
              {label}
              {on && (
                <span
                  data-clear
                  aria-hidden
                  className={`-mr-1.5 ml-0.5 inline-grid h-6 w-6 place-items-center rounded-full ${
                    c.key === "food"
                      ? "bg-[rgb(233_162_59/0.28)] text-[#9a5f12]"
                      : "bg-[rgb(233_162_59/0.22)] text-[#e9a23b]"
                  }`}
                >
                  <X className="h-3 w-3" strokeWidth={2.6} />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
