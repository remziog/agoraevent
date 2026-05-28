import { useTranslation } from "react-i18next";
import { Globe } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SUPPORTED_LANGS, STORAGE_KEY, type SupportedLang } from "@/i18n";

const LABELS: Record<SupportedLang, string> = {
  en: "EN",
  tr: "TR",
  de: "DE",
};

const FULL: Record<SupportedLang, string> = {
  en: "English",
  tr: "Türkçe",
  de: "Deutsch",
};

export function LanguageSwitcher({ className }: { className?: string }) {
  const { i18n, t } = useTranslation();
  const current = (i18n.resolvedLanguage ?? "en").slice(0, 2) as SupportedLang;
  const safe = (SUPPORTED_LANGS as readonly string[]).includes(current) ? current : "en";

  function change(lang: SupportedLang) {
    i18n.changeLanguage(lang);
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      /* ignore */
    }
    if (typeof document !== "undefined") document.documentElement.lang = lang;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t("language.label")}
        className={
          "inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground " +
          (className ?? "")
        }
      >
        <Globe className="h-3.5 w-3.5" />
        {LABELS[safe as SupportedLang]}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-32">
        {SUPPORTED_LANGS.map((l) => (
          <DropdownMenuItem
            key={l}
            onClick={() => change(l)}
            className={l === safe ? "font-medium" : ""}
          >
            {FULL[l]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
