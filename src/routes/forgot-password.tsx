import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AuthShell } from "./login";
import { publicSiteUrl } from "@/lib/site";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { title: "Reset your password — Agora" },
      { name: "description", content: "Forgot your Agora password? Enter your email and we'll send you a secure link to set a new one in seconds." },
      { name: "robots", content: "noindex, follow" },
      { property: "og:title", content: "Reset your password — Agora" },
      { property: "og:description", content: "Forgot your Agora password? Enter your email and we'll send you a secure link to set a new one in seconds." },
      { property: "og:url", content: "https://ago-ra.life/forgot-password" },
    ],
    links: [{ rel: "canonical", href: "https://ago-ra.life/forgot-password" }],
  }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setFormError(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      // From the iOS/Android app the reset link must open the public site.
      redirectTo: `${publicSiteUrl()}/reset-password`,
    });
    setLoading(false);
    if (error) {
      setFormError(error.message);
      toast.error(error.message);
      return;
    }
    setSent(true);
  }

  return (
    <AuthShell title={t("forgot.title")} subtitle={t("forgot.subtitle")}>
      {formError && (
        <div
          role="alert"
          className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {formError}
        </div>
      )}
      {sent ? (
        <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          {t("forgot.sent", { email })}
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">{t("common.email")}</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? t("forgot.submitting") : t("forgot.submit")}
          </Button>
        </form>
      )}
      <p className="mt-6 text-center text-sm text-muted-foreground">
        {t("common.rememberedIt")}{" "}
        <Link to="/login" className="text-foreground underline underline-offset-4">
          {t("common.backToSignIn")}
        </Link>
      </p>
    </AuthShell>
  );
}
