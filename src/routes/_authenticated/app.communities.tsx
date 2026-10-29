import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import { CalendarDays, Heart, HeartOff, Users } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { formatWhenLocalized } from "@/components/guide/guide-format";
import { getMyCommunities, type MyCommunity } from "@/lib/plans.functions";
import { useFollowToggle } from "@/lib/use-follow";

export const Route = createFileRoute("/_authenticated/app/communities")({
  head: () => ({
    meta: [{ title: "My communities — Agora" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: CommunitiesPage,
});

/**
 * "My communities": the organisers behind the gatherings I joined — that is
 * the real relationship Agora can see (not a membership) — and the
 * communities I chose to follow.
 */
function CommunitiesPage() {
  const { t } = useTranslation();
  const fetch = useServerFn(getMyCommunities);
  const q = useQuery({
    queryKey: ["communities"],
    queryFn: () => fetch(),
    refetchOnMount: "always",
  });
  const toggle = useFollowToggle();
  const joined = q.data?.joined ?? [];
  const following = (q.data?.following ?? []).filter((c) => c.joinedCount === 0);
  const empty = !q.isLoading && joined.length === 0 && following.length === 0;

  return (
    <div className="min-h-screen bg-background">
      <AppHeader variant="member" />
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <p className="text-[11px] uppercase tracking-[0.35em] text-primary">
          {t("communities.kicker", "Meet again")}
        </p>
        <h1 className="mt-1 font-display text-3xl sm:text-4xl">
          {t("communities.title", "My communities")}
        </h1>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          {t(
            "communities.intro",
            "The people behind the gatherings you joined, and the communities you follow — with their next real gathering.",
          )}
        </p>

        {q.isLoading && (
          <div className="mt-8 grid gap-4 sm:grid-cols-2" aria-busy="true">
            {[0, 1].map((i) => (
              <div key={i} className="h-36 animate-pulse rounded-2xl border bg-card/40" />
            ))}
          </div>
        )}
        {q.isError && (
          <p className="mt-8 rounded-2xl border border-destructive/50 p-5 text-sm" role="alert">
            {t("communities.error", "Couldn't load your communities just now.")}
          </p>
        )}
        {empty && (
          <div className="mt-8 rounded-3xl border border-dashed border-primary/30 bg-card/60 p-8 text-center">
            <p className="font-display text-2xl">
              {t("communities.emptyTitle", "No community yet — it starts with one gathering.")}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {t(
                "communities.emptyBody",
                "Join a gathering and its organiser appears here with their next dates. You can also follow a community from its page.",
              )}
            </p>
            <Button asChild className="mt-4 min-h-11">
              <Link to="/app">{t("plans.openCompass", "Open the compass")}</Link>
            </Button>
          </div>
        )}

        {joined.length > 0 && (
          <section className="mt-10" aria-label={t("communities.joinedTitle", "Where you've been")}>
            <h2 className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-primary">
              <Users className="h-3.5 w-3.5" aria-hidden />{" "}
              {t("communities.joinedTitle", "Where you've been")}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {t(
                "communities.joinedNote",
                "Organisers of gatherings you joined. This is Agora's record of your RSVPs, not a membership.",
              )}
            </p>
            <div className="stage-stagger mt-3 grid gap-4 sm:grid-cols-2">
              {joined.map((c, i) => (
                <CommunityCard key={c.id} community={c} index={i} toggle={toggle} />
              ))}
            </div>
          </section>
        )}

        {following.length > 0 && (
          <section className="mt-10" aria-label={t("communities.followingTitle", "Following")}>
            <h2 className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-primary">
              <Heart className="h-3.5 w-3.5" aria-hidden />{" "}
              {t("communities.followingTitle", "Following")}
            </h2>
            <div className="stage-stagger mt-3 grid gap-4 sm:grid-cols-2">
              {following.map((c, i) => (
                <CommunityCard key={c.id} community={c} index={i} toggle={toggle} />
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

function CommunityCard({
  community: c,
  index,
  toggle,
}: {
  community: MyCommunity;
  index: number;
  toggle: ReturnType<typeof useFollowToggle>;
}) {
  const { t, i18n } = useTranslation();
  return (
    <article
      className="flex min-w-0 flex-col gap-2 overflow-hidden rounded-3xl border bg-card p-5 transition hover:border-primary/40"
      style={{ "--i": index } as React.CSSProperties}
    >
      <p className="text-[10px] uppercase tracking-[0.25em] text-primary">
        <span lang="en">{c.category}</span>
        {c.city ? ` · ${c.city}` : ""}
      </p>
      <Link
        to="/app/community/$id"
        params={{ id: c.id }}
        className="font-display text-2xl leading-tight hover:underline"
      >
        {c.name}
      </Link>
      {c.description && (
        <p className="line-clamp-2 text-sm text-muted-foreground">{c.description}</p>
      )}
      <p className="text-xs text-muted-foreground">
        {c.joinedCount > 0 &&
          t("communities.joinedCount", {
            count: c.joinedCount,
            defaultValue: "You joined {{count}} of their gatherings",
          })}
      </p>
      {c.next ? (
        <Link
          to="/app/event/$id"
          params={{ id: c.next.id }}
          className="mt-1 flex items-center gap-2 rounded-2xl border border-primary/30 bg-primary/5 px-3 py-2 text-sm hover:border-primary"
        >
          <CalendarDays className="h-4 w-4 shrink-0 text-primary" aria-hidden />
          <span className="min-w-0">
            <span className="block truncate">{c.next.title}</span>
            <span className="block text-xs text-muted-foreground">
              {formatWhenLocalized(c.next.starts_at, i18n.language)}
              {c.next.venue ? ` · ${c.next.venue}` : ""}
            </span>
          </span>
        </Link>
      ) : (
        <p className="mt-1 text-xs text-muted-foreground">
          {t("communities.noNext", "No upcoming gathering listed yet.")}
        </p>
      )}
      <div className="mt-auto flex gap-2 pt-2">
        <Button asChild size="sm" variant="outline" className="min-h-11 flex-1">
          <Link to="/app/community/$id" params={{ id: c.id }}>
            {t("communities.open", "Open community")}
          </Link>
        </Button>
        <Button
          size="sm"
          variant={c.following ? "secondary" : "default"}
          className="min-h-11"
          disabled={toggle.isPending}
          aria-pressed={c.following}
          onClick={() => toggle.mutate({ orgId: c.id, follow: !c.following })}
        >
          {c.following ? (
            <>
              <HeartOff className="h-4 w-4" aria-hidden /> {t("community.unfollow", "Unfollow")}
            </>
          ) : (
            <>
              <Heart className="h-4 w-4" aria-hidden /> {t("community.follow", "Follow")}
            </>
          )}
        </Button>
      </div>
    </article>
  );
}
