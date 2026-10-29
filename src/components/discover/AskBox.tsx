import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowUp, Mic, Square, X } from "lucide-react";
import { useSpeechInput, type SpeechStatus } from "@/lib/use-speech-input";

/**
 * The one way to ask Agora: type or speak into the same field, edit, send.
 * Speech is the browser's own recognition (text only, nothing recorded);
 * where it isn't available the microphone says so and typing stays.
 */
export function AskBox({
  value,
  onChange,
  onSend,
  disabled,
  autoFocus,
  placeholder,
  variant = "docked",
  inputId = "agora-ask",
  showMic = true,
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: (text: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
  placeholder?: string;
  /** "docked": full-width bar (results stage, mobile bottom). "compass": compact, inside the dial. */
  variant?: "docked" | "compass";
  inputId?: string;
  /** False when another microphone owns this field (the dial's centre on phones). */
  showMic?: boolean;
}) {
  const { t, i18n } = useTranslation();
  const [note, setNote] = useState<string | null>(null);
  const typedBefore = useRef("");
  const speech = useSpeechInput(i18n.language, (text, final) => {
    // The transcript lands in the same field, after whatever was typed; the person edits, then sends.
    const prefix = typedBefore.current.trim();
    onChange(prefix ? `${prefix} ${text}` : text);
    if (final) setNote(t("voice.heard", "Here's what I heard — edit it, then send."));
  });

  useEffect(() => {
    if (speech.status === "denied")
      setNote(t("voice.denied", "Microphone access was refused. You can still type."));
    else if (speech.status === "error")
      setNote(t("voice.error", "Voice input stopped unexpectedly. You can still type."));
  }, [speech.status, t]);

  function submit() {
    const text = value.trim();
    if (!text || disabled) return;
    if (speech.status === "listening") speech.cancel();
    onSend(text);
    onChange("");
    setNote(null);
  }

  function onMic() {
    if (!speech.supported) {
      setNote(
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
    typedBefore.current = value;
    setNote(t("voice.listening", "Listening… speak, then tap stop or just pause."));
    speech.start();
  }

  const listening = speech.status === "listening";
  const compact = variant === "compass";

  return (
    <div className={compact ? "w-full" : "w-full"}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className={`flex items-end gap-1.5 rounded-2xl border bg-background/95 shadow-sm backdrop-blur transition-colors focus-within:border-primary/60 ${
          listening ? "border-primary/70 ring-2 ring-primary/20" : "border-border"
        } ${compact ? "p-1" : "p-1.5"}`}
        data-listening={listening || undefined}
      >
        <label className="sr-only" htmlFor={inputId}>
          {t("discover.askLabel", "Tell Agora what you're looking for")}
        </label>
        <textarea
          id={inputId}
          value={value}
          autoFocus={autoFocus}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder={
            listening
              ? t("voice.placeholder", "Listening…")
              : (placeholder ??
                t("discover.askPlaceholder", "Tell Agora… e.g. “tomorrow works too, same budget”"))
          }
          rows={compact ? 2 : 1}
          disabled={disabled}
          enterKeyHint="send"
          className={`min-h-[2.75rem] w-full resize-none bg-transparent px-2 py-2 leading-snug placeholder:text-muted-foreground focus:outline-none ${
            compact ? "max-h-24 text-sm" : "max-h-32 text-sm sm:text-base"
          }`}
        />
        {showMic && (
          <MicButton
            status={speech.status}
            onClick={onMic}
            onCancel={speech.cancel}
            disabled={disabled}
          />
        )}
        <button
          type="submit"
          disabled={disabled || !value.trim()}
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition hover:opacity-90 disabled:opacity-40"
          aria-label={t("discover.send", "Send")}
        >
          <ArrowUp className="h-4 w-4" aria-hidden />
        </button>
      </form>
      {note && (
        <p
          className={`mt-1.5 px-2 text-xs ${compact ? "text-center" : ""} ${
            speech.status === "denied" || speech.status === "error"
              ? "text-destructive"
              : "text-muted-foreground"
          }`}
          role="status"
        >
          {note}
        </p>
      )}
    </div>
  );
}

export function MicButton({
  status,
  onClick,
  onCancel,
  disabled,
  size = "md",
}: {
  status: SpeechStatus;
  onClick: () => void;
  onCancel: () => void;
  disabled?: boolean;
  size?: "md" | "lg";
}) {
  const { t } = useTranslation();
  const listening = status === "listening";
  const dim = size === "lg" ? "h-14 w-14" : "h-11 w-11";
  return (
    <span className="relative inline-flex shrink-0 items-center">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-pressed={listening}
        aria-label={
          listening
            ? t("voice.stop", "Stop listening")
            : status === "unsupported"
              ? t("voice.unsupportedShort", "Voice input not available in this browser")
              : t("voice.start", "Speak to Agora")
        }
        title={
          status === "unsupported"
            ? t("voice.unsupportedShort", "Voice input not available in this browser")
            : undefined
        }
        className={`inline-flex ${dim} items-center justify-center rounded-full border transition disabled:opacity-40 ${
          listening
            ? "border-primary bg-primary text-primary-foreground motion-safe:animate-pulse"
            : status === "unsupported"
              ? "border-dashed border-border text-muted-foreground"
              : "border-primary/40 bg-background text-primary hover:bg-primary/10"
        }`}
      >
        {listening ? (
          <Square className="h-4 w-4 fill-current" aria-hidden />
        ) : (
          <Mic className={size === "lg" ? "h-6 w-6" : "h-4 w-4"} aria-hidden />
        )}
      </button>
      {listening && (
        <button
          type="button"
          onClick={onCancel}
          className="absolute -right-1 -top-1 inline-flex h-5 w-5 items-center justify-center rounded-full border bg-background text-muted-foreground hover:text-foreground"
          aria-label={t("voice.cancel", "Cancel voice input")}
        >
          <X className="h-3 w-3" aria-hidden />
        </button>
      )}
    </span>
  );
}
