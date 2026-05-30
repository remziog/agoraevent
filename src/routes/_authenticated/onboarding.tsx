import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { autoCompleteOnboarding } from "@/lib/profile.functions";
import { CompassLoader } from "@/components/CompassLoader";

export const Route = createFileRoute("/_authenticated/onboarding")({
  component: Onboarding,
});

// Sign-in-and-go: no questions, no picklists. We finish onboarding on the
// server with sensible defaults (display name from the auth account, city
// = Istanbul) and drop the user straight on the discover screen.
function Onboarding() {
  const navigate = useNavigate();
  const finish = useServerFn(autoCompleteOnboarding);
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;
    (async () => {
      try {
        await finish({});
        navigate({ to: "/app", replace: true });
      } catch (err) {
        toast.error((err as Error).message);
        navigate({ to: "/login", replace: true });
      }
    })();
  }, [finish, navigate]);

  return <CompassLoader message="Calibrating your compass…" />;
}
