import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Logo } from "@/components/Logo";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

export function SiteFooter() {
  const { t } = useTranslation();
  return (
    <footer className="border-t border-border/60 bg-background">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-6 py-8 text-sm text-muted-foreground sm:flex-row sm:justify-between">
        <div className="flex items-center gap-3">
          <Logo showWordmark className="opacity-70" />
          <span className="hidden sm:inline">·</span>
          <span className="hidden sm:inline">{t("footer.tagline")}</span>
        </div>
        <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
          <Link to="/privacy" className="hover:text-foreground">
            {t("common.privacy")}
          </Link>
          <Link to="/terms" className="hover:text-foreground">
            {t("common.terms")}
          </Link>
          <span>© {new Date().getFullYear()} Agora</span>
          <LanguageSwitcher />
        </nav>
      </div>
    </footer>
  );
}
