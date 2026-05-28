import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

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
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<"google" | null>(null);
  const [showEmail, setShowEmail] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function routeAfterAuth() {
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

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setFormError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setFormError(error.message || t("login.errorGeneric"));
      toast.error(error.message);
      return;
    }
    toast.success(t("login.welcomeBack"));
    await routeAfterAuth();
  }

  async function onOAuth(provider: "google") {
    setOauthLoading(provider);
    setFormError(null);
    const result = await lovable.auth.signInWithOAuth(provider, {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setOauthLoading(null);
      const msg = result.error.message ?? `${provider} sign-in failed`;
      setFormError(msg);
      toast.error(msg);
      return;
    }
    if (result.redirected) return;
    await routeAfterAuth();
  }

  return (
    <AuthShell title={t("login.title")} subtitle={t("login.subtitle")}>
      {formError && (
        <div
          role="alert"
          className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {formError}
        </div>
      )}

      <div className="space-y-3">
        <GoogleButton
          onClick={() => onOAuth("google")}
          label={oauthLoading === "google" ? t("common.loading") : t("login.continueGoogle")}
          disabled={oauthLoading !== null || loading}
        />
        {!showEmail && (
          <EmailToggleButton onClick={() => setShowEmail(true)} label={t("login.continueEmail")} />
        )}
      </div>

      {showEmail && (
        <>
          <Divider />
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">{t("common.email")}</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t("common.password")}</Label>
              <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <Button type="submit" className="w-full" disabled={loading || oauthLoading !== null}>
              {loading ? t("login.submitting") : t("login.submit")}
            </Button>
          </form>
          <div className="mt-4 text-center text-sm">
            <Link to="/forgot-password" className="text-muted-foreground hover:text-foreground underline underline-offset-4">
              {t("common.forgotPassword")}
            </Link>
          </div>
        </>
      )}

      <p className="mt-6 text-center text-sm text-muted-foreground">
        {t("common.newHere")}{" "}
        <Link to="/signup" className="text-foreground underline underline-offset-4">
          {t("common.createAccount")}
        </Link>
      </p>
    </AuthShell>
  );
}

const providerButtonClass =
  "flex w-full items-center justify-center gap-2.5 rounded-full border border-border bg-background px-4 py-2.5 text-sm font-medium transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60";

export function GoogleButton({
  onClick,
  label,
  disabled,
}: {
  onClick: () => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={providerButtonClass}>
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

export function EmailToggleButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button type="button" onClick={onClick} className={providerButtonClass}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="5" width="18" height="14" rx="2"/>
        <path d="m3 7 9 6 9-6"/>
      </svg>
      {label}
    </button>
  );
}

export function Divider() {
  const { t } = useTranslation();
  return (
    <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
      <div className="h-px flex-1 bg-border" />
      {t("common.or")}
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
  const { t } = useTranslation();
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
        <Link to="/">
          <Logo />
        </Link>
        <LanguageSwitcher />
      </header>
      <main className="flex flex-1 items-center justify-center px-4 py-8 sm:px-6 sm:py-12">
        <div className="w-full max-w-md rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
          <h1 className="font-display text-3xl">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </div>
      </main>
      <footer className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-center gap-x-5 gap-y-2 px-6 py-6 text-xs text-muted-foreground">
        <Link to="/privacy" className="hover:text-foreground">{t("common.privacy")}</Link>
        <Link to="/terms" className="hover:text-foreground">{t("common.terms")}</Link>
        <span>© {new Date().getFullYear()} Agora</span>
      </footer>
    </div>
  );
}
