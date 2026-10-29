// Voice input for the compass: the browser's own SpeechRecognition (Web Speech
// API), started by the person, transcribed into the same text field they can
// edit before sending. No audio is recorded, stored or sent to Agora's server
// or to Qloo — the browser hands back text only. Not every browser offers
// this (Firefox and some embedded views don't), so the hook reports that and
// the text path stays.
import { useCallback, useEffect, useRef, useState } from "react";

type RecognitionResultEvent = {
  resultIndex: number;
  results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>;
};
type RecognitionErrorEvent = { error: string };
type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: RecognitionResultEvent) => void) | null;
  onerror: ((e: RecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};
type RecognitionCtor = new () => Recognition;

function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export type SpeechStatus = "unsupported" | "idle" | "listening" | "denied" | "error";

const LANGS: Record<string, string> = { tr: "tr-TR", en: "en-US", de: "de-DE", ru: "ru-RU" };

/**
 * @param language UI language ("tr", "en"…) → recognition language.
 * @param onTranscript Called with the running transcript (interim + final) while listening,
 *                     and once more with the final text when listening ends.
 */
export function useSpeechInput(
  language: string,
  onTranscript: (text: string, final: boolean) => void,
) {
  const [status, setStatus] = useState<SpeechStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<Recognition | null>(null);
  const finalRef = useRef("");
  const cb = useRef(onTranscript);
  cb.current = onTranscript;

  useEffect(() => {
    setStatus(recognitionCtor() ? "idle" : "unsupported");
  }, []);

  const stop = useCallback(() => {
    recRef.current?.stop();
  }, []);

  const cancel = useCallback(() => {
    const r = recRef.current;
    recRef.current = null;
    if (r) {
      r.onresult = null;
      r.onend = null;
      r.onerror = null;
      r.abort();
    }
    finalRef.current = "";
    setStatus(recognitionCtor() ? "idle" : "unsupported");
  }, []);

  const start = useCallback(() => {
    const Ctor = recognitionCtor();
    if (!Ctor) {
      setStatus("unsupported");
      return;
    }
    cancel();
    const r = new Ctor();
    r.lang = LANGS[language.slice(0, 2)] ?? "en-US";
    r.continuous = false;
    r.interimResults = true;
    r.maxAlternatives = 1;
    finalRef.current = "";
    setError(null);
    r.onstart = () => setStatus("listening");
    r.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        const text = res[0]?.transcript ?? "";
        if (res.isFinal) finalRef.current += text;
        else interim += text;
      }
      cb.current((finalRef.current + interim).trim(), false);
    };
    r.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") setStatus("denied");
      else if (e.error === "aborted") setStatus("idle");
      else {
        setStatus("error");
        setError(e.error);
      }
    };
    r.onend = () => {
      recRef.current = null;
      const text = finalRef.current.trim();
      if (text) cb.current(text, true);
      setStatus((s) => (s === "listening" ? "idle" : s));
    };
    recRef.current = r;
    try {
      r.start();
    } catch {
      setStatus("error");
      setError("start_failed");
    }
  }, [language, cancel]);

  useEffect(() => () => cancel(), [cancel]);

  return { status, error, start, stop, cancel, supported: status !== "unsupported" };
}
