import { useTranslation } from "react-i18next";
import { Compass, Sparkles } from "lucide-react";
import type { DiscoveryStatus } from "@/lib/discovery-store";
import { AskBox, MicButton } from "@/components/discover/AskBox";
import { useSpeechInput } from "@/lib/use-speech-input";
import { useState } from "react";

/**
 * The four directions sit on the intercardinal points (NE, SE, SW, NW), in
 * the ring band, so the centre — where the person types or speaks — is never
 * covered (UI-29-02). Each is a preference added to the same discovery
 * context as typed text, not a separate search engine; the prompts name a
 * gathering explicitly and carry no date or district.
 */
export const DIRECTIONS = [
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

const CARDINALS = [
  { l: "N", a: -90 },
  { l: "E", a: 0 },
  { l: "S", a: 90 },
  { l: "W", a: 180 },
];

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
  const { t, i18n } = useTranslation();
  const searching = status === "searching";
  const [voiceNote, setVoiceNote] = useState<string | null>(null);
  // Mobile: the microphone is the dial's centre; the text field sits below the dial.
  const speech = useSpeechInput(i18n.language, (text, final) => {
    setPrompt(text);
    if (final) setVoiceNote(t("voice.heard", "Here's what I heard — edit it, then send."));
  });

  function onMic() {
    if (!speech.supported) {
      setVoiceNote(
        t(
          "voice.unsupported",
          "This browser has no speech recognition (try Chrome, Edge or Safari). Typing works everywhere.",
        ),
      );
      return;
    }
    if (speech.status === "listening") {
      speech.stop();
      return;
    }
    setVoiceNote(t("voice.listening", "Listening… speak, then tap stop or just pause."));
    speech.start();
  }

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
            : "Agora";

  return (
    <div className={`w-full ${className}`}>
      <div
        className="agora-compass relative mx-auto aspect-square w-full max-w-[18rem] sm:max-w-[34rem]"
        data-state={status}
        role="group"
        aria-label={t(
          "discover.compassLabel",
          "Compass: pick a direction or tell Agora what you want",
        )}
      >
        {/* Bezel: slow turn at rest, quick while searching (still under reduced motion).
            The rotating ring sits inside a clipped circle so its corners never widen the page. */}
        <div
          className={`absolute inset-0 overflow-hidden rounded-full border transition-colors shadow-[0_30px_80px_-30px_color-mix(in_oklab,var(--primary)_45%,transparent),inset_0_0_60px_color-mix(in_oklab,var(--primary)_8%,transparent)] ${
            status === "error"
              ? "border-destructive/60"
              : searching
                ? "border-primary/70"
                : "border-primary/30"
          }`}
        >
          <div
            className={`absolute inset-0 rounded-full bg-[radial-gradient(circle_at_30%_20%,_color-mix(in_oklab,_var(--primary)_18%,_transparent),_transparent_55%),radial-gradient(circle_at_70%_80%,_color-mix(in_oklab,_var(--primary)_10%,_transparent),_transparent_55%)] ${
              searching
                ? "motion-safe:animate-[spin_6s_linear_infinite]"
                : "motion-safe:animate-[spin_90s_linear_infinite]"
            }`}
          >
            <svg viewBox="0 0 200 200" className="absolute inset-0 h-full w-full" aria-hidden>
              <g stroke="currentColor" className="text-primary/40">
                {Array.from({ length: 72 }).map((_, i) => {
                  const long = i % 9 === 0;
                  const a = (i / 72) * Math.PI * 2;
                  const r1 = 96;
                  const r2 = long ? 88 : 92;
                  return (
                    <line
                      key={i}
                      x1={100 + Math.cos(a) * r1}
                      y1={100 + Math.sin(a) * r1}
                      x2={100 + Math.cos(a) * r2}
                      y2={100 + Math.sin(a) * r2}
                      strokeWidth={long ? 0.8 : 0.4}
                      opacity={long ? 1 : 0.55}
                    />
                  );
                })}
              </g>
            </svg>
          </div>
        </div>

        {/* Inner face */}
        <div className="absolute inset-[9%] rounded-full border border-border/60 bg-card/80 shadow-[inset_0_0_80px_color-mix(in_oklab,var(--primary)_6%,transparent)] backdrop-blur-sm" />

        {/* Needle: spins while searching, settles on the chosen direction (clipped to the dial) */}
        <div
          className="pointer-events-none absolute inset-0 overflow-hidden rounded-full"
          aria-hidden
        >
          <div
            className={`absolute inset-0 flex items-center justify-center ${
              searching
                ? "motion-safe:animate-[spin_1.4s_cubic-bezier(0.45,0,0.55,1)_infinite]"
                : ""
            }`}
            style={
              searching
                ? undefined
                : {
                    transform: `rotate(${needleAngle + 90}deg)`,
                    transition: "transform 1.1s cubic-bezier(0.22, 1, 0.36, 1)",
                  }
            }
            aria-hidden
          >
            <svg viewBox="0 0 200 200" className="h-full w-full">
              <defs>
                <linearGradient id="needleN" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--primary)" />
                  <stop
                    offset="100%"
                    stopColor="color-mix(in oklab, var(--primary) 50%, transparent)"
                  />
                </linearGradient>
              </defs>
              <polygon points="100,38 105,92 95,92" fill="url(#needleN)" />
              <polygon
                points="100,162 105,108 95,108"
                fill="color-mix(in oklab, var(--foreground) 30%, transparent)"
              />
            </svg>
          </div>
        </div>

        {/* Cardinal letters */}
        {CARDINALS.map((c) => {
          const rad = (c.a * Math.PI) / 180;
          const rPct = 42;
          return (
            <div
              key={c.l}
              aria-hidden
              className="absolute -translate-x-1/2 -translate-y-1/2 font-display text-lg tracking-[0.2em] text-primary/70 sm:text-xl"
              style={{
                left: `${50 + Math.cos(rad) * rPct}%`,
                top: `${50 + Math.sin(rad) * rPct}%`,
              }}
            >
              {c.l}
            </div>
          );
        })}

        {/* Directions on the intercardinal points (desktop); listed under the dial on phones */}
        {DIRECTIONS.map((d) => {
          const rad = (d.angle * Math.PI) / 180;
          const rPct = 36;
          return (
            <button
              key={d.key}
              type="button"
              disabled={disabled}
              onClick={() => onPickDirection(d)}
              className="absolute hidden min-h-11 -translate-x-1/2 -translate-y-1/2 items-center whitespace-nowrap rounded-full border border-primary/30 bg-background/85 px-3.5 py-2 text-xs text-foreground backdrop-blur transition hover:border-primary hover:bg-primary hover:text-primary-foreground focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50 sm:inline-flex"
              style={{
                left: `${50 + Math.cos(rad) * rPct}%`,
                top: `${50 + Math.sin(rad) * rPct}%`,
              }}
            >
              {t(`discover.direction.${d.key}`)}
            </button>
          );
        })}

        {/* Centre: state, microphone, and (from sm up) the text field */}
        <div className="absolute left-1/2 top-1/2 z-10 flex w-[58%] -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-2">
          <div className="flex items-center justify-center gap-1.5" aria-live="polite">
            {found && !searching ? (
              <Sparkles className="h-3 w-3 text-primary" aria-hidden />
            ) : (
              <Compass
                className={`h-3 w-3 text-primary ${searching ? "motion-safe:animate-pulse" : ""}`}
                aria-hidden
              />
            )}
            <span className="text-[10px] uppercase tracking-[0.3em] text-primary">
              {stateLabel}
            </span>
          </div>
          <div className="sm:hidden">
            <MicButton
              status={speech.status}
              onClick={onMic}
              onCancel={speech.cancel}
              disabled={disabled}
              size="lg"
            />
          </div>
          <div className="hidden w-full sm:block">
            <AskBox
              value={prompt}
              onChange={setPrompt}
              onSend={onSubmit}
              disabled={disabled}
              variant="compass"
              inputId="compass-ask"
              placeholder={t("discover.compassPlaceholderShort", "Tell Agora… or tap the mic")}
            />
          </div>
        </div>
      </div>

      {/* Phones: text field under the dial (never over the directions), then the four directions */}
      <div className="mx-auto mt-4 w-full max-w-md sm:hidden">
        <AskBox
          value={prompt}
          onChange={setPrompt}
          onSend={onSubmit}
          disabled={disabled}
          inputId="compass-ask-mobile"
          showMic={false}
          placeholder={t("discover.compassPlaceholderShort", "Tell Agora… or tap the mic")}
        />
        {voiceNote && (
          <p className="mt-1.5 text-center text-xs text-muted-foreground" role="status">
            {voiceNote}
          </p>
        )}
        <div className="mt-3 grid grid-cols-2 gap-2">
          {DIRECTIONS.map((d) => (
            <button
              key={d.key}
              type="button"
              disabled={disabled}
              onClick={() => onPickDirection(d)}
              className="min-h-11 rounded-full border border-primary/30 bg-background px-3 py-2 text-sm text-foreground transition hover:border-primary hover:bg-primary hover:text-primary-foreground disabled:opacity-50"
            >
              {t(`discover.direction.${d.key}`)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
