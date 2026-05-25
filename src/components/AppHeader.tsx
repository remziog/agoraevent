import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Menu } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function AppHeader({ variant }: { variant: "member" | "organizer" }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  async function signOut() {
    await supabase.auth.signOut();
    toast.success("Signed out");
    navigate({ to: "/" });
  }

  const navLinks =
    variant === "member"
      ? [
          { to: "/app", label: "Discover" },
          { to: "/app/profile", label: "Taste" },
          { to: "/app/integrations", label: "Integrations" },
        ]
      : [{ to: "/biz", label: "Dashboard" }];

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

        <div className="hidden sm:block">
          <Button size="sm" variant="ghost" onClick={signOut}>
            Sign out
          </Button>
        </div>

        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button size="icon" variant="ghost" className="sm:hidden" aria-label="Open menu">
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
              <button
                onClick={() => {
                  setOpen(false);
                  signOut();
                }}
                className="rounded-md px-3 py-3 text-left text-base text-muted-foreground hover:bg-muted"
              >
                Sign out
              </button>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
