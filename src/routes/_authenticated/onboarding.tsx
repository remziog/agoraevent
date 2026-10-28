import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { z } from "zod";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { autoCompleteOnboarding } from "@/lib/profile.functions";
import { CompassLoader } from "@/components/CompassLoader";
import { safeRedirect } from "@/lib/safe-redirect";

export const Route = createFileRoute("/_authenticated/onboarding")({
  validateSearch: (s) => z.object({ next: z.string().optional() }).parse(s),
  component: Onboarding,
});

// Sign-in-and-go: no questions, no picklists. We finish onboarding on the
// server with sensible defaults (display name from the auth account, city
// = Istanbul) and drop the user straight on the discover screen.
function Onboarding() {
  const navigate = useNavigate();
  const { next } = Route.useSearch();
  const finish = useServerFn(autoCompleteOnboarding);
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;
    (async () => {
      try {
        await finish({});
        const target = safeRedirect(next);
        if (target) navigate({ href: target, replace: true });
        else navigate({ to: "/app", replace: true });
      } catch (err) {
        toast.error((err as Error).message);
        navigate({ to: "/login", replace: true });
      }
    })();
  }, [finish, navigate, next]);

  return <CompassLoader message="Calibrating your compass…" />;
}
