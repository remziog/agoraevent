import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthShell, GoogleButton, EmailToggleButton, Divider } from "./login";
import { IS_NATIVE_APP, publicSiteUrl } from "@/lib/site";

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [
      { title: "Join Agora — Find your people" },
      { name: "description", content: "Create your Agora account and start finding nearby events that match your taste in music, sport, and film." },
      { property: "og:title", content: "Join Agora — Find your people" },
      { property: "og:description", content: "Create your account and start finding nearby events that match your taste." },
      { property: "og:url", content: "https://ago-ra.life/signup" },
      { name: "robots", content: "index, follow" },
    ],
    links: [{ rel: "canonical", href: "https://ago-ra.life/signup" }],
  }),
  component: SignupPage,
});

function SignupPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<"google" | null>(null);
  // No Google sign-in in the iOS/Android app yet (see login.tsx).
  const [showEmail, setShowEmail] = useState(IS_NATIVE_APP);
  const [formError, setFormError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setFormError(null);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        // The confirmation link opens in a browser; from the app it must point
        // at the public site, not the app's local origin.
        emailRedirectTo: publicSiteUrl() + "/onboarding",
        data: { display_name: name },
      },
    });
    setLoading(false);
    if (error) {
      setFormError(error.message || t("signup.errorGeneric"));
      toast.error(error.message);
      return;
    }
    toast.success(t("signup.created"));
    navigate({ to: "/onboarding" });
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
    navigate({ to: "/onboarding" });
  }

  return (
    <AuthShell title={t("signup.title")} subtitle={t("signup.subtitle")}>
      {formError && (
        <div
          role="alert"
          className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {formError}
        </div>
      )}

      {!IS_NATIVE_APP && (
        <div className="space-y-3">
          <GoogleButton
            onClick={() => onOAuth("google")}
            label={oauthLoading === "google" ? t("common.loading") : t("signup.continueGoogle")}
            disabled={oauthLoading !== null || loading}
          />
          {!showEmail && (
            <EmailToggleButton onClick={() => setShowEmail(true)} label={t("signup.signUpEmail")} />
          )}
        </div>
      )}

      {showEmail && (
        <>
          {!IS_NATIVE_APP && <Divider />}
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">{t("common.name")}</Label>
              <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} autoFocus />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">{t("common.email")}</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t("common.password")}</Label>
              <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <Button type="submit" className="w-full" disabled={loading || oauthLoading !== null}>
              {loading ? t("signup.submitting") : t("signup.submit")}
            </Button>
          </form>
        </>
      )}

      <p className="mt-6 text-center text-sm text-muted-foreground">
        {t("common.alreadyMember")}{" "}
        <Link to="/login" className="text-foreground underline underline-offset-4">
          {t("common.signIn")}
        </Link>
      </p>
    </AuthShell>
  );
}
