import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import en from "./locales/en.json";
import tr from "./locales/tr.json";
import de from "./locales/de.json";
import ru from "./locales/ru.json";

export const SUPPORTED_LANGS = ["en", "tr", "de", "ru"] as const;
export type SupportedLang = (typeof SUPPORTED_LANGS)[number];
export const STORAGE_KEY = "agora:lang";

if (!i18n.isInitialized) {
  i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      resources: {
        en: { translation: en },
        tr: { translation: tr },
        de: { translation: de },
        ru: { translation: ru },
      },
      fallbackLng: "en",
      supportedLngs: SUPPORTED_LANGS as unknown as string[],
      nonExplicitSupportedLngs: true, // tr-TR → tr, de-DE → de
      load: "languageOnly",
      interpolation: { escapeValue: false },
      detection: {
        order: ["localStorage", "navigator", "htmlTag"],
        lookupLocalStorage: STORAGE_KEY,
        caches: ["localStorage"],
      },
      react: { useSuspense: false },
    });
}

export default i18n;
