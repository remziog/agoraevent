import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { QlooMark } from "@/components/discover/PlaceResults";
import { EventMiniCard, PlaceMiniCard } from "@/components/event/MiniCard";
import { localeFor } from "@/components/calendar/cal-dates";
import { getMyPlans } from "@/lib/plans.functions";
import { useSaveToggle } from "@/lib/use-saved";

export const Route = createFileRoute("/_authenticated/app/plans")({
  head: () => ({
    meta: [{ title: "My plans — Agora" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: PlansPage,
});

type Tab = "saved" | "going";
const MONO = "font-mono text-[10.5px] uppercase tracking-[0.08em] text-muted-foreground";
const FOCUS =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff5b1f]";

/**
 * "My plans" (design: Naz Paşalı, v3 "Kaydedilenler"): what I saved
 * (bookmarks) and what I'm going to (RSVPs), kept apart on purpose. Removing a
 * bookmark never cancels an RSVP; cancelling an RSVP never removes a bookmark.
 */
function PlansPage() {
  const { t, i18n } = useTranslation();
  const locale = localeFor(i18n.language);
  const fetchPlans = useServerFn(getMyPlans);
  const plans = useQuery({
    queryKey: ["plans"],
    queryFn: () => fetchPlans(),
    refetchOnMount: "always",
  });
  const toggle = useSaveToggle();
  const now = Date.now();
  const [picked, setPicked] = useState<Tab | null>(null);

  const going = (plans.data?.going ?? [])
    .filter((e): e is NonNullable<typeof e> => Boolean(e) && Date.parse(e!.starts_at) >= now)
    .sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at));
  const savedEvents = plans.data?.savedEvents ?? [];
  const savedPlaces = plans.data?.savedPlaces ?? [];
  const savedEventIds = new Set(plans.data?.savedEventIds ?? []);
  const savedCount = savedEvents.length + savedPlaces.length;
  const empty = !plans.isLoading && !plans.isError && going.length === 0 && savedCount === 0;
  // Until the person picks a tab, open the one that has something in it.
  const tab: Tab = picked ?? (savedCount === 0 && going.length > 0 ? "going" : "saved");
  const count = tab === "saved" ? savedCount : going.length;

  return (
    <div className="min-h-screen bg-background">
      <AppHeader variant="member" />
      <main className="mx-auto max-w-3xl px-4 pb-16 pt-6 sm:px-6">
        <p className={MONO}>{t("plans.kicker", "Your plans")}</p>
        <h1 className="mt-1.5 font-display text-[clamp(3.5rem,18vw,4.75rem)] font-[900] leading-[0.84] tracking-[-0.025em] [font-stretch:62%]">
          {t("plans.title", "My plans")}
          {!plans.isLoading && !plans.isError && (
            <sup className="relative top-2 ms-1 align-top font-mono text-sm font-medium tracking-normal">
              {count}
            </sup>
          )}
        </h1>
        <p className="mt-3 max-w-xl text-sm text-muted-foreground">
          {t(
            "plans.intro",
            "Gatherings you're going to, and the gatherings and places you saved for later. Saved is not joined — only “I'm going” tells the organiser.",
          )}
        </p>

        <div
          role="group"
          aria-label={t("v3paper.plans.view", "Plans view")}
          className="mt-4 inline-flex gap-0.5 rounded-full bg-card p-[3px] shadow-[inset_0_0_0_1px_var(--border)]"
        >
          {(
            [
              ["saved", t("v3paper.plans.tabSaved", "Saved"), savedCount],
              ["going", t("v3paper.plans.tabGoing", "Going"), going.length],
            ] as const
          ).map(([value, label, n]) => (
            <button
              key={value}
              type="button"
              aria-pressed={tab === value}
              onClick={() => setPicked(value)}
              className={`min-h-11 rounded-full px-4 text-[13px] transition-colors ${FOCUS} ${
                tab === value
                  ? "bg-foreground font-semibold text-background"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
              {!plans.isLoading && !plans.isError && (
                <span className="ms-1 font-mono text-[11px] opacity-70"> {n}</span>
              )}
            </button>
          ))}
        </div>

        {plans.isLoading && (
          <div className="mt-6 grid grid-cols-2 gap-x-3 gap-y-3.5 sm:grid-cols-3" aria-busy="true">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="aspect-[4/5] motion-safe:animate-pulse rounded-[22px] bg-muted/60" />
            ))}
            <p className="sr-only">{t("common.loading", "Loading…")}</p>
          </div>
        )}
        {plans.isError && (
          <p className="mt-6 rounded-[22px] border border-destructive/50 p-5 text-sm" role="alert">
            {t("plans.error", "Couldn't load your plans just now.")}{" "}
            <button
              type="button"
              className={`min-h-11 underline ${FOCUS}`}
              onClick={() => plans.refetch()}
            >
              {t("common.tryAgain", "Try again")}
            </button>
          </p>
        )}

        {!plans.isLoading && !plans.isError && count === 0 && (
          <div className="mt-6 grid justify-items-start gap-2.5 rounded-[22px] border-2 border-dashed p-5">
            <h2 className="font-display text-[26px] font-[850] leading-none [font-stretch:72%]">
              {empty
                ? t("plans.emptyTitle", "Nothing planned yet.")
                : tab === "saved"
                  ? t("v3paper.plans.noSaved", "Nothing saved yet")
                  : t("v3paper.plans.noGoing", "You're not going to anything yet")}
            </h2>
            <p className="text-sm text-muted-foreground">
              {empty
                ? t(
                    "plans.emptyBody",
                    "Ask the compass for a restaurant, a place or a gathering — then save it here or join it.",
                  )
                : tab === "saved"
                  ? t(
                      "v3paper.plans.noSavedHint",
                      "Tap the bookmark on a gathering or a place to keep it here. Saving isn't an RSVP.",
                    )
                  : t(
                      "v3paper.plans.noGoingHint",
                      "Open a gathering and tap “I'm going” — it's a free RSVP, and it shows up here and in your calendar.",
                    )}
            </p>
            <Button asChild className="min-h-11">
              <Link to="/app">{t("plans.openCompass", "Open the compass")}</Link>
            </Button>
          </div>
        )}

        {!plans.isLoading && !plans.isError && tab === "going" && going.length > 0 && (
          <section aria-label={t("plans.going", "I'm going")}>
            <div className="mt-6 grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3">
              {going.map((e) => (
                <EventMiniCard
                  key={e.id}
                  event={e}
                  locale={locale}
                  going
                  saved={savedEventIds.has(e.id)}
                  busy={toggle.isPending}
                  onToggleSave={() =>
                    toggle.mutate({
                      target: { kind: "event", refId: e.id },
                      saved: savedEventIds.has(e.id),
                    })
                  }
                />
              ))}
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              <Link
                to="/app/calendar"
                className={`-my-3.5 inline-block py-3.5 underline-offset-4 hover:underline ${FOCUS}`}
              >
                {t("plans.seeCalendar", "See them in the calendar →")}
              </Link>
            </p>
          </section>
        )}

        {!plans.isLoading && !plans.isError && tab === "saved" && savedCount > 0 && (
          <>
            {savedEvents.length > 0 && (
              <section className="mt-6" aria-labelledby="plans-saved-events">
                <h2 id="plans-saved-events" className={`${MONO} border-t-2 border-foreground pt-2`}>
                  {t("plans.savedGatherings", "Saved gatherings")} · {savedEvents.length}
                </h2>
                <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3">
                  {savedEvents.map((e) => (
                    <EventMiniCard
                      key={e.id}
                      event={e}
                      locale={locale}
                      saved
                      going={e.going}
                      busy={toggle.isPending}
                      onToggleSave={() =>
                        toggle.mutate({ target: { kind: "event", refId: e.id }, saved: true })
                      }
                    />
                  ))}
                </div>
              </section>
            )}
            {savedPlaces.length > 0 && (
              <section className="mt-8" aria-labelledby="plans-saved-places">
                <h2
                  id="plans-saved-places"
                  className={`${MONO} flex items-center gap-1.5 border-t-2 border-foreground pt-2`}
                >
                  <QlooMark /> {t("plans.savedPlaces", "Saved places")} · {savedPlaces.length}
                </h2>
                <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3">
                  {savedPlaces.map((s) => (
                    <PlaceMiniCard
                      key={s.refId}
                      saved={s}
                      lang={i18n.language}
                      busy={toggle.isPending}
                      onUnsave={() =>
                        toggle.mutate({
                          target: { kind: "place", refId: s.refId, payload: s.place },
                          saved: true,
                        })
                      }
                    />
                  ))}
                </div>
                <p className="mt-4 text-xs text-muted-foreground">
                  {t(
                    "plans.placesNote",
                    "Places were ranked by Qloo when you saved them; details are a snapshot from that moment. No reservation was made.",
                  )}
                </p>
              </section>
            )}
          </>
        )}

        <p className="mt-10 text-xs text-muted-foreground">
          {t(
            "save.note",
            "Saving is a private bookmark: it doesn't tell the organiser, doesn't count as going and earns no XP.",
          )}
        </p>
      </main>
    </div>
  );
}
