import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { CalendarDays, Check, Heart, HeartOff, MapPin, Users } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { EventVisual } from "@/components/EventVisual";
import { Button } from "@/components/ui/button";
import { formatWhenLocalized } from "@/components/guide/guide-format";
import { getCommunity } from "@/lib/community.functions";
import { eventDistrict } from "@/lib/discovery";
import { useFollowToggle } from "@/lib/use-follow";

export const Route = createFileRoute("/_authenticated/app/community/$id")({
  head: () => ({
    meta: [{ title: "Community — Agora" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: CommunityPage,
});

function CommunityPage() {
  const { id } = Route.useParams();
  const { t, i18n } = useTranslation();
  const get = useServerFn(getCommunity);
  const q = useQuery({ queryKey: ["community", id], queryFn: () => get({ data: { id } }) });
  const c = q.data?.community;
  const mine = new Set(q.data?.myRsvps ?? []);
  const following = Boolean(q.data?.following);
  const follow = useFollowToggle();

  return (
    <div className="min-h-screen bg-background">
      <AppHeader variant="member" />
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <Link to="/app" className="text-sm text-muted-foreground hover:text-foreground">
          ← {t("common.backToDiscover", "Back to discover")}
        </Link>

        {q.isLoading && (
          <div className="mt-6 space-y-3" aria-busy="true" aria-live="polite">
            <div className="h-8 w-2/3 animate-pulse rounded bg-muted" />
            <div className="h-24 animate-pulse rounded-2xl bg-muted/60" />
          </div>
        )}

        {!q.isLoading && !c && (
          <p className="mt-6 rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">
            {t("community.notFound", "This community isn't on Agora (any more).")}
          </p>
        )}

        {c && (
          <>
            <header className="mt-6">
              <p className="text-xs uppercase tracking-[0.3em] text-primary">
                <Users className="mr-1 inline h-3 w-3" aria-hidden />
                {t("community.kicker", "Community")} · {c.category}
              </p>
              <h1 className="mt-2 font-display text-4xl leading-tight">{c.name}</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                <MapPin className="mr-1 inline h-3 w-3" aria-hidden />
                {c.city ?? "Istanbul"}
                {" · "}
                {t("community.pastCount", {
                  count: q.data?.pastCount ?? 0,
                  defaultValue: "{{count}} past gathering(s) on Agora",
                })}
              </p>
              {c.description ? (
                <p className="mt-4 whitespace-pre-wrap text-base leading-relaxed">
                  {c.description}
                </p>
              ) : (
                <p className="mt-4 text-sm text-muted-foreground">
                  {t("community.noDescription", "The organiser hasn't written a description yet.")}
                </p>
              )}
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant={following ? "secondary" : "default"}
                  className="min-h-11"
                  disabled={follow.isPending}
                  aria-pressed={following}
                  onClick={() => follow.mutate({ orgId: c.id, follow: !following })}
                >
                  {following ? (
                    <>
                      <HeartOff className="h-4 w-4" aria-hidden />{" "}
                      {t("community.unfollow", "Unfollow")}
                    </>
                  ) : (
                    <>
                      <Heart className="h-4 w-4" aria-hidden /> {t("community.follow", "Follow")}
                    </>
                  )}
                </Button>
                <Link
                  to="/app/communities"
                  className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                >
                  {t("community.myCommunities", "My communities →")}
                </Link>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                {t(
                  "community.honesty",
                  "Agora shows only what the organiser listed. Member counts, welcome style and first-timer friendliness are not shown unless the organiser says so.",
                )}
              </p>
            </header>

            <section className="mt-10">
              <h2 className="font-display text-2xl">
                {t("community.upcoming", "Next gatherings")}
              </h2>
              {q.data?.upcoming.length === 0 ? (
                <p className="mt-3 rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">
                  {t(
                    "community.noUpcoming",
                    "No upcoming gatherings listed yet. Check back — or tell Agora what you're looking for.",
                  )}
                </p>
              ) : (
                <ul className="mt-4 grid gap-4 sm:grid-cols-2">
                  {q.data?.upcoming.map((e) => {
                    const going = mine.has(e.id);
                    const demo = (e.tags ?? []).includes("demo");
                    return (
                      <li key={e.id} className="overflow-hidden rounded-2xl border bg-card">
                        <Link to="/app/event/$id" params={{ id: e.id }} className="block">
                          <EventVisual
                            title={e.title}
                            category={e.category}
                            tags={e.tags}
                            size="sm"
                          />
                        </Link>
                        <div className="p-4">
                          <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.25em]">
                            {going && (
                              <span className="inline-flex items-center gap-1 text-primary">
                                <Check className="h-3 w-3" aria-hidden />{" "}
                                {t("event.youreGoing", "You're going")}
                              </span>
                            )}
                            {demo && (
                              <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
                                {t("common.demo", "Demo")}
                              </span>
                            )}
                          </div>
                          <Link
                            to="/app/event/$id"
                            params={{ id: e.id }}
                            className="mt-1 block font-display text-lg leading-tight hover:underline"
                          >
                            {e.title}
                          </Link>
                          <p className="mt-1 text-sm text-muted-foreground">
                            <CalendarDays className="mr-1 inline h-3 w-3" aria-hidden />
                            {formatWhenLocalized(e.starts_at, i18n.language)}
                            {" · "}
                            {[eventDistrict({ ...e, tags: e.tags ?? [] }), e.venue]
                              .filter(Boolean)
                              .join(" · ") || e.city}
                          </p>
                          <Button asChild size="sm" className="mt-3">
                            <Link to="/app/event/$id" params={{ id: e.id }}>
                              {going
                                ? t("event.details", "Event details")
                                : t("event.lookAndJoin", "See details & join")}
                            </Link>
                          </Button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
