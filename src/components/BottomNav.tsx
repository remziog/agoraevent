import { Link, useRouterState } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Bookmark, CalendarDays, Compass, User } from "lucide-react";
import { useSavedIds } from "@/lib/use-saved";

/**
 * The phone navigation (design: Naz Paşalı): an ink pill resting on the
 * bottom edge — Discover, Calendar, Saved, Profile. Hidden where a screen has
 * its own bottom action (the results stage's field, an event's actions).
 */
const HIDDEN = [/^\/app\/map/, /^\/app\/event\//, /^\/biz/, /^\/onboarding/];

export function useBottomNavVisible() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  return path.startsWith("/app") && !HIDDEN.some((re) => re.test(path));
}

export function BottomNav() {
  const { t } = useTranslation();
  const visible = useBottomNavVisible();
  const saved = useSavedIds();
  if (!visible) return null;
  const count = (saved.data?.places.length ?? 0) + (saved.data?.events.length ?? 0);

  const items = [
    { to: "/app", exact: true, label: t("bnav.discover", "Discover"), Icon: Compass },
    {
      to: "/app/calendar",
      exact: false,
      label: t("bnav.calendar", "Calendar"),
      Icon: CalendarDays,
    },
    {
      to: "/app/plans",
      exact: false,
      label: t("bnav.saved", "Saved"),
      Icon: Bookmark,
      badge: count,
    },
    { to: "/app/profile", exact: false, label: t("bnav.profile", "Profile"), Icon: User },
  ] as const;

  return (
    <nav
      aria-label={t("bnav.label", "Main")}
      className="fixed inset-x-4 bottom-[max(1.25rem,env(safe-area-inset-bottom))] z-40 isolate flex h-16 rounded-full bg-[#100f0e] p-1.5 text-[#a39c92] shadow-[0_20px_40px_-18px_rgb(8_4_16/0.7),inset_0_0_0_1px_rgb(243_235_221/0.08)] sm:hidden"
    >
      {items.map(({ to, exact, label, Icon, ...rest }) => {
        const badge = "badge" in rest ? rest.badge : 0;
        return (
          <Link
            key={to}
            to={to}
            activeOptions={{ exact }}
            className="group relative flex flex-1 flex-col items-center justify-center gap-0.5 rounded-full text-[10.5px] font-semibold tracking-[0.01em] transition-colors hover:text-[#f4efe7] aria-[current=page]:text-[#f4efe7]"
          >
            <span
              aria-hidden
              className="pointer-events-none absolute left-1/2 top-1 -z-10 hidden h-[30px] w-[30px] -translate-x-1/2 rounded-full bg-[linear-gradient(140deg,#ff5b1f,#ff4fa8)] opacity-90 blur-[10px] group-aria-[current=page]:block"
            />
            <Icon className="h-[21px] w-[21px]" aria-hidden />
            {label}
            {badge > 0 && (
              <span className="absolute left-1/2 top-1 ml-1.5 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#ffd23c] px-1 text-[10.5px] font-bold text-[#100f0e]">
                {badge}
                <span className="sr-only"> {t("bnav.savedCount", "saved")}</span>
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
