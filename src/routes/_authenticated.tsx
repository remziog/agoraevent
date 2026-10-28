import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { CompassLoader } from "@/components/CompassLoader";

// Per-user cache of the onboarding flag so in-app navigations don't re-query
// `profiles` on every route change (beforeLoad runs for each navigation under
// this layout).
const onboardedByUser = new Map<string, boolean>();

export const Route = createFileRoute("/_authenticated")({
  // The Supabase session lives in localStorage, which the server never sees.
  // With SSR on, every server render of /app/* and /biz/* answered 307 → /login
  // and the client then bounced back to /app — a login flash on each refresh
  // and lost deep links. Rendering this subtree client-only removes that round
  // trip; the root shell (fonts, meta, manifest) is still server-rendered.
  ssr: false,
  pendingComponent: () => <CompassLoader message="Opening Agora…" />,
  beforeLoad: async ({ location }) => {
    // getSession() is local (no network); server functions verify the JWT on
    // every call anyway, so this is only a routing decision.
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) {
      throw redirect({ to: "/login", search: { redirect: location.href } });
    }

    // Skip onboarding check when already on the onboarding page
    if (location.pathname.startsWith("/onboarding")) return;
    if (onboardedByUser.get(user.id)) return;

    const { data: profile } = await supabase
      .from("profiles")
      .select("onboarded")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile?.onboarded) throw redirect({ to: "/onboarding", search: { next: location.href } });
    onboardedByUser.set(user.id, true);
  },
  component: () => <Outlet />,
});
