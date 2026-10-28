import { useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, Pause, Play, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import type { Landmark } from "@/lib/istanbul-landmarks";
import { getLandmarkStory } from "@/lib/landmark-stories";

function speechAvailable() {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

/**
 * The landmark's narrated story. History and legend are separate, labelled
 * sections — on screen and in the narration ("Legend." is spoken before a
 * legend). `startWith` moves the section the guide agent chose to the top.
 */
export function LandmarkStory({
  landmark,
  startWith,
}: {
  landmark: Pick<Landmark, "id" | "description" | "title">;
  startWith?: string;
}) {
  const { t } = useTranslation();
  const story = useMemo(() => getLandmarkStory(landmark), [landmark]);
  const sections = useMemo(() => {
    if (!startWith) return story.sections;
    const first = story.sections.find((s) => s.title === startWith);
    return first ? [first, ...story.sections.filter((s) => s !== first)] : story.sections;
  }, [story, startWith]);

  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState<number | null>(null);
  const cancelled = useRef(false);

  useEffect(() => {
    return () => {
      cancelled.current = true;
      if (speechAvailable()) window.speechSynthesis.cancel();
    };
  }, []);

  function stop() {
    cancelled.current = true;
    if (speechAvailable()) window.speechSynthesis.cancel();
    setPlaying(false);
    setCurrent(null);
  }

  function play() {
    if (!speechAvailable()) return;
    const synth = window.speechSynthesis;
    synth.cancel();
    cancelled.current = false;
    setPlaying(true);
    const voice = synth.getVoices().find((v) => v.lang?.toLowerCase().startsWith("en"));
    const speakFrom = (index: number) => {
      if (cancelled.current || index >= sections.length) {
        setPlaying(false);
        setCurrent(null);
        return;
      }
      const section = sections[index];
      const utterance = new SpeechSynthesisUtterance(
        `${section.kind === "legend" ? "Legend" : "History"}. ${section.title}. ${section.text}`,
      );
      utterance.lang = voice?.lang ?? "en-GB";
      if (voice) utterance.voice = voice;
      utterance.rate = 0.98;
      utterance.onstart = () => setCurrent(index);
      utterance.onend = () => speakFrom(index + 1);
      utterance.onerror = () => {
        setPlaying(false);
        setCurrent(null);
      };
      synth.speak(utterance);
    };
    speakFrom(0);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-xs uppercase tracking-[0.25em] text-primary">
          <BookOpen className="h-3.5 w-3.5" />
          {story.authored ? t("story.theStory", "The story") : t("story.shortIntro", "Short intro")}
        </p>
        {speechAvailable() && (
          <Button
            type="button"
            size="sm"
            variant={playing ? "default" : "outline"}
            className="gap-1.5 rounded-full"
            onClick={playing ? stop : play}
            aria-pressed={playing}
          >
            {playing ? (
              <Pause className="h-3.5 w-3.5" aria-hidden />
            ) : (
              <Play className="h-3.5 w-3.5" aria-hidden />
            )}
            {playing ? t("story.stop", "Stop") : t("story.listen", "Listen")}
          </Button>
        )}
      </div>

      {sections.map((section, i) => (
        <section
          key={section.title}
          className={`rounded-2xl border p-4 transition ${
            current === i ? "border-primary/60 bg-primary/5" : "bg-card/60"
          }`}
        >
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-widest ${
                section.kind === "legend"
                  ? "bg-accent/15 text-accent-foreground ring-1 ring-accent/40"
                  : "bg-primary/10 text-primary"
              }`}
            >
              {section.kind === "legend" && <Sparkles className="mr-1 inline h-3 w-3" />}
              {section.kind === "legend"
                ? t("story.legend", "Legend")
                : t("story.history", "History")}
            </span>
            {startWith === section.title && i === 0 && (
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                {t("story.chosenForTaste", "Chosen for your taste")}
              </span>
            )}
          </div>
          <h3 className="mt-2 font-display text-xl leading-snug">{section.title}</h3>
          <p className="mt-1.5 text-[15px] leading-relaxed text-foreground/90">{section.text}</p>
        </section>
      ))}

      {story.sources && story.sources.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {t("story.sources", "Sources")}:{" "}
          {story.sources.map((src, i) => (
            <span key={src}>
              {i > 0 ? " · " : ""}
              <a
                href={src}
                target="_blank"
                rel="noreferrer"
                className="underline-offset-4 hover:underline"
              >
                {new URL(src).hostname.replace(/^www\./, "")}
              </a>
            </span>
          ))}
          . {t("story.legendNote", "Legends are traditions, not history.")}
        </p>
      )}
    </div>
  );
}
