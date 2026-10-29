import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Menu } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { XpChip } from "@/components/XpChip";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useTranslation } from "react-i18next";

export function AppHeader({ variant }: { variant: "member" | "organizer" }) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  async function signOut() {
    await supabase.auth.signOut();
    toast.success(t("nav.signedOut", "Signed out"));
    navigate({ to: "/" });
  }

  // Any member can host: both surfaces link to each other.
  const navLinks =
    variant === "member"
      ? [
          { to: "/app", label: t("nav.compass", "Compass") },
          { to: "/app/plans", label: t("nav.plans", "My plans") },
          { to: "/app/communities", label: t("nav.communities", "My communities") },
          { to: "/app/calendar", label: t("nav.calendar", "Calendar") },
          { to: "/app/memories", label: t("nav.memories", "Memories") },
          { to: "/app/profile", label: t("nav.taste", "Taste") },
          { to: "/biz", label: t("nav.host", "Host") },
        ]
      : [
          { to: "/biz", label: t("nav.dashboard", "Dashboard") },
          { to: "/app", label: t("nav.discover", "Discover") },
        ];

  return (
    <header className="border-b border-border/60 bg-background/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <Link to={variant === "member" ? "/app" : "/biz"} className="shrink-0">
          <Logo />
        </Link>

        <nav className="hidden flex-1 items-center gap-5 sm:flex">
          {navLinks.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className="text-sm text-muted-foreground hover:text-foreground"
              activeProps={{ className: "text-foreground font-medium" }}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 sm:flex">
          {variant === "member" && <XpChip />}
          <LanguageSwitcher />
          <Button size="sm" variant="ghost" onClick={signOut}>
            {t("common.signOut", "Sign out")}
          </Button>
        </div>

        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              className="h-11 w-11 sm:hidden"
              aria-label={t("nav.openMenu", "Open menu")}
            >
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-72">
            <div className="mt-8 flex flex-col gap-1">
              {navLinks.map((l) => (
                <Link
                  key={l.to}
                  to={l.to}
                  onClick={() => setOpen(false)}
                  className="rounded-md px-3 py-3 text-base text-foreground hover:bg-muted"
                  activeProps={{ className: "bg-muted font-medium" }}
                >
                  {l.label}
                </Link>
              ))}
              <div className="my-3 h-px bg-border" />
              {/* Language is reachable on narrow screens too (UI-02). */}
              <div className="flex items-center justify-between px-3 py-2">
                <span className="text-sm text-muted-foreground">
                  {t("language.label", "Language")}
                </span>
                <LanguageSwitcher />
              </div>
              {variant === "member" && (
                <div className="px-3 py-2">
                  <XpChip />
                </div>
              )}
              <button
                onClick={() => {
                  setOpen(false);
                  signOut();
                }}
                className="rounded-md px-3 py-3 text-left text-base text-muted-foreground hover:bg-muted"
              >
                {t("common.signOut", "Sign out")}
              </button>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
