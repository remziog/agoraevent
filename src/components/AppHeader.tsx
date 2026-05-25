import { Link, useNavigate } from "@tanstack/react-router";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function AppHeader({ variant }: { variant: "member" | "organizer" }) {
  const navigate = useNavigate();
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
      : [
          { to: "/biz", label: "Dashboard" },
        ];

  return (
    <header className="border-b border-border/60 bg-background/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-6 py-4">
        <Link to={variant === "member" ? "/app" : "/biz"}><Logo /></Link>
        <nav className="hidden flex-1 items-center gap-5 sm:flex">
          {navLinks.map((l) => (
            <Link key={l.to} to={l.to} className="text-sm text-muted-foreground hover:text-foreground" activeProps={{ className: "text-foreground font-medium" }}>
              {l.label}
            </Link>
          ))}
        </nav>
        <Button size="sm" variant="ghost" onClick={signOut}>Sign out</Button>
      </div>
    </header>
  );
}
