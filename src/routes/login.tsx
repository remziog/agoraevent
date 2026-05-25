import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/login")({
  beforeLoad: async () => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return;

    const { data: profile } = await supabase
      .from("profiles")
      .select("onboarded")
      .eq("id", auth.user.id)
      .maybeSingle();

    throw redirect({ to: profile?.onboarded ? "/app" : "/onboarding" });
  },
  head: () => ({
    meta: [
      { title: "Sign in — Agora" },
      { name: "description", content: "Sign in to Agora to discover events near you that match your taste." },
      { property: "og:title", content: "Sign in — Agora" },
      { property: "og:description", content: "Sign in to Agora to discover events near you that match your taste." },
      { property: "og:url", content: "/login" },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "/login" }],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }

    const { data: auth } = await supabase.auth.getUser();
    const { data: profile } = auth.user
      ? await supabase
          .from("profiles")
          .select("onboarded")
          .eq("id", auth.user.id)
          .maybeSingle()
      : { data: null };

    toast.success("Welcome back");
    navigate({ to: profile?.onboarded ? "/app" : "/onboarding" });
  }

  async function onGoogle() {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error(result.error.message ?? "Google sign-in failed");
      return;
    }
    if (result.redirected) return;

    const { data: auth } = await supabase.auth.getUser();
    const { data: profile } = auth.user
      ? await supabase
          .from("profiles")
          .select("onboarded")
          .eq("id", auth.user.id)
          .maybeSingle()
      : { data: null };

    navigate({ to: profile?.onboarded ? "/app" : "/onboarding" });
  }

  return (
    <AuthShell title="Welcome back" subtitle="Your people are nearby.">
      <GoogleButton onClick={onGoogle} label="Continue with Google" />
      <Divider />
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Signing in…" : "Sign in"}
        </Button>
      </form>
      <div className="mt-4 text-center text-sm">
        <Link to="/forgot-password" className="text-muted-foreground hover:text-foreground underline underline-offset-4">
          Forgot password?
        </Link>
      </div>
      <p className="mt-4 text-center text-sm text-muted-foreground">
        New here?{" "}
        <Link to="/signup" className="text-foreground underline underline-offset-4">
          Create an account
        </Link>
      </p>
    </AuthShell>
  );
}

export function GoogleButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-center gap-2 rounded-md border bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent"
    >
      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
        <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"/>
        <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
        <path fill="#FBBC05" d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.997 8.997 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332z"/>
        <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 7.294C4.672 5.167 6.656 3.58 9 3.58z"/>
      </svg>
      {label}
    </button>
  );
}

export function Divider() {
  return (
    <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
      <div className="h-px flex-1 bg-border" />
      or
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}

export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="mx-auto w-full max-w-6xl px-6 py-6">
        <Link to="/">
          <Logo />
        </Link>
      </header>
      <main className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-md rounded-2xl border bg-card p-8 shadow-sm">
          <h1 className="font-display text-3xl">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </div>
      </main>
    </div>
  );
}
