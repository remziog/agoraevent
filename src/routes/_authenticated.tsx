import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async ({ location }) => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/login" });

    // Skip onboarding check when already on the onboarding page
    if (location.pathname.startsWith("/onboarding")) return;

    const { data: profile } = await supabase
      .from("profiles")
      .select("onboarded")
      .eq("id", data.user.id)
      .maybeSingle();

    if (!profile?.onboarded) throw redirect({ to: "/onboarding" });
  },
  component: () => <Outlet />,
});
