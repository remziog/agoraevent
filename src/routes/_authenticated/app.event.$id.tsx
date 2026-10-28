import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { CalendarDays, Coins, Info, MapPin, Users } from "lucide-react";
import { getEvent, rsvpEvent } from "@/lib/events.functions";
import { eventDistrict } from "@/lib/discovery";
import { AppHeader } from "@/components/AppHeader";
import { EventVisual } from "@/components/EventVisual";
import { MemorySection } from "@/components/MemorySection";
import { GettingThere } from "@/components/GettingThere";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { getOfflineSummary } from "@/lib/concert-weekend";
import { formatWhenLocalized } from "@/components/guide/guide-format";

export const Route = createFileRoute("/_authenticated/app/event/$id")({
  loader: async ({ params, context }) => {
    try {
      const data = await context.queryClient.ensureQueryData({
        queryKey: ["event", params.id],
        queryFn: () => getEvent({ data: { id: params.id } }),
      });
      return { event: data?.event ?? null };
    } catch {
      return { event: null };
    }
  },
  head: ({ loaderData }) => {
    const ev = loaderData?.event;
    const title = ev?.title ? `${ev.title} — Agora` : "Event — Agora";
    const description = ev?.description
      ? ev.description.slice(0, 180)
      : ev?.title
        ? `${ev.title} on Agora — see details, RSVP, and find your people.`
        : "Event details on Agora — RSVP and meet your people in real life.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { name: "robots", content: "noindex, nofollow" },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
      ],
    };
  },
  component: EventDetail,
});

function EventDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const get = useServerFn(getEvent);
  const rsvp = useServerFn(rsvpEvent);
  const qc = useQueryClient();
  const { t, i18n } = useTranslation();
  const [confirm, setConfirm] = useState<"join" | "cancel" | null>(null);

  const q = useQuery({ queryKey: ["event", id], queryFn: () => get({ data: { id } }) });
  const mutate = useMutation({
    mutationFn: (going: boolean) => rsvp({ data: { event_id: id, going } }),
    // The button stays busy until every screen that shows this RSVP (detail,
    // calendar, stats, community) has fresh data — so no screen shows a stale
    // state after the toast (F-05 / AG-03). `refetchType: "all"` also refreshes
    // the calendar's cached query while that page is not mounted.
    onSuccess: async (res, wasGoing) => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["event", id], refetchType: "all" }),
        qc.invalidateQueries({ queryKey: ["rsvps"], refetchType: "all" }),
        qc.invalidateQueries({ queryKey: ["my-stats"], refetchType: "all" }),
        qc.invalidateQueries({ queryKey: ["community"], refetchType: "all" }),
      ]);
      if (!wasGoing) toast.success(t("event.rsvpCancelled", "RSVP cancelled"));
      else
        toast.success(
          res?.awarded ? t("event.savedXp", "Saved · +25 XP") : t("event.saved", "Saved"),
        );
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const event = q.data?.event;
  const going = !!q.data?.rsvp;
  const demo = !!event?.tags?.includes("demo");
  const price = event?.price === null || event?.price === undefined ? null : Number(event.price);
  const priceText =
    price === null || !Number.isFinite(price)
      ? t("event.priceUnknown", "Price not listed")
      : price === 0
        ? t("event.free", "Free")
        : `${price} TL`;
  const district = event ? eventDistrict({ ...event, tags: event.tags ?? [] }) : null;

  return (
    <div className="min-h-screen bg-background">
      <AppHeader variant="member" />
      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        <button
          onClick={() =>
            window.history.length > 1 ? window.history.back() : navigate({ to: "/app" })
          }
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← {t("common.back", "Back")}
        </button>

        {q.isLoading && (
          <div className="mt-6 space-y-3" aria-busy="true" aria-live="polite">
            <div className="h-56 animate-pulse rounded-3xl bg-muted/60" />
            <div className="h-8 w-2/3 animate-pulse rounded bg-muted" />
          </div>
        )}
        {!q.isLoading && !event && (
          <p className="mt-6 rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">
            {t("event.notFound", "This gathering isn't on Agora (any more).")}
          </p>
        )}

        {event && (
          <article className="mt-6 overflow-hidden rounded-3xl border bg-card">
            <EventVisual
              title={event.title}
              category={event.category}
              tags={event.tags}
              size="lg"
            />
            <div className="p-6 sm:p-8">
              <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                <span>{event.category}</span>
                {demo && (
                  <span className="rounded-full bg-muted px-2 py-0.5">
                    {t("common.demo", "Demo")}
                  </span>
                )}
              </div>
              <h1 className="mt-2 font-display text-4xl leading-tight">{event.title}</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {t("event.hostedBy", "Hosted by")}{" "}
                {event.org_id ? (
                  <Link
                    to="/app/community/$id"
                    params={{ id: event.org_id }}
                    className="text-primary underline-offset-4 hover:underline"
                  >
                    {event.organizations?.name}
                  </Link>
                ) : (
                  event.organizations?.name
                )}
              </p>

              <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
                <div className="flex items-start gap-2">
                  <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                  <div>
                    <dt className="text-xs uppercase tracking-widest text-muted-foreground">
                      {t("event.when", "When")}
                    </dt>
                    <dd>
                      {formatWhenLocalized(event.starts_at, i18n.language)}
                      {event.ends_at
                        ? ` – ${formatWhenLocalized(event.ends_at, i18n.language)}`
                        : ""}
                      <span className="block text-xs text-muted-foreground">Europe/Istanbul</span>
                    </dd>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                  <div>
                    <dt className="text-xs uppercase tracking-widest text-muted-foreground">
                      {t("event.where", "Where")}
                    </dt>
                    <dd>
                      {[event.venue, district ?? event.city].filter(Boolean).join(" · ") || "—"}
                    </dd>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Coins className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                  <div>
                    <dt className="text-xs uppercase tracking-widest text-muted-foreground">
                      {t("event.price", "Price")}
                    </dt>
                    <dd>{priceText}</dd>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Users className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                  <div>
                    <dt className="text-xs uppercase tracking-widest text-muted-foreground">
                      {t("event.groupSize", "Group size")}
                    </dt>
                    <dd>
                      {typeof event.capacity === "number"
                        ? t("event.capacity", {
                            n: event.capacity,
                            defaultValue: "up to {{n}} people",
                          })
                        : t("event.capacityUnknown", "Not listed")}
                    </dd>
                  </div>
                </div>
              </dl>

              {event.description && (
                <p className="mt-6 whitespace-pre-wrap text-base">{event.description}</p>
              )}
              {event.tags?.length > 0 && (
                <div className="mt-6 flex flex-wrap gap-2">
                  {event.tags
                    .filter((tag: string) => !tag.includes(":") && tag !== "demo")
                    .map((tag: string) => (
                      <span key={tag} className="rounded-full border px-3 py-1 text-xs">
                        {tag}
                      </span>
                    ))}
                </div>
              )}

              <p className="mt-6 flex items-start gap-2 rounded-xl border border-dashed p-3 text-xs text-muted-foreground">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                <span>
                  {demo
                    ? t(
                        "event.sourceDemo",
                        "Sample gathering created for the Qloo Agentic Hackathon demo — the venue is real, the meeting is not.",
                      )
                    : t(
                        "event.sourceReal",
                        "Listed on Agora by the organiser; date, price and group size are as they entered them.",
                      )}{" "}
                  {t(
                    "event.rsvpKind",
                    "Joining here is a free RSVP, not a ticket or a reservation.",
                  )}
                </span>
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Button
                  size="lg"
                  variant={going ? "outline" : "default"}
                  disabled={mutate.isPending}
                  aria-busy={mutate.isPending}
                  onClick={() => setConfirm(going ? "cancel" : "join")}
                >
                  {mutate.isPending
                    ? t("event.saving", "Saving…")
                    : going
                      ? t("event.goingCancel", "You're going — cancel?")
                      : t("event.imGoing", "I'm going")}
                </Button>
                {going && (
                  <Button asChild variant="ghost" size="lg">
                    <Link to="/app/calendar">
                      {t("event.seeCalendar", "See it in your calendar")}
                    </Link>
                  </Button>
                )}
              </div>
            </div>
          </article>
        )}

        {event &&
          (() => {
            const tipTag = (event.tags ?? []).find((tag: string) => tag.startsWith("tip:"));
            const label = [event.venue, event.city].filter(Boolean).join(", ") || event.title;
            if (event.latitude == null || event.longitude == null) return null;
            return (
              <GettingThere
                destination={{ lat: event.latitude, lng: event.longitude }}
                destinationLabel={label}
                tip={tipTag ? tipTag.slice("tip:".length) : undefined}
                offlineSummary={getOfflineSummary(event.id, i18n.language) ?? undefined}
              />
            );
          })()}
        {event && (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "Event",
                name: event.title,
                startDate: event.starts_at,
                description: event.description ?? undefined,
                location: {
                  "@type": "Place",
                  name: event.venue ?? event.city ?? "TBD",
                  address: event.city ?? undefined,
                },
                organizer: event.organizations?.name
                  ? { "@type": "Organization", name: event.organizations.name }
                  : undefined,
              })
                .replace(/<\/(script)/gi, "<\\/$1")
                .replace(/<!--/g, "<\\!--"),
            }}
          />
        )}

        {event && <MemorySection eventId={id} canPost={going} />}

        {/* The person confirms with the real event, date and price in view; nothing joins on its own. */}
        <AlertDialog open={confirm !== null} onOpenChange={(o) => !o && setConfirm(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {confirm === "cancel"
                  ? t("event.confirmCancelTitle", "Cancel your RSVP?")
                  : t("event.confirmJoinTitle", "Join this gathering?")}
              </AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-1 text-sm">
                  <p className="font-medium text-foreground">{event?.title}</p>
                  {event && (
                    <p>
                      {formatWhenLocalized(event.starts_at, i18n.language)} ·{" "}
                      {[event.venue, district ?? event.city].filter(Boolean).join(" · ")}
                    </p>
                  )}
                  <p>
                    {priceText} ·{" "}
                    {confirm === "cancel"
                      ? t(
                          "event.confirmCancelBody",
                          "Your spot is released and the XP from joining is taken back.",
                        )
                      : t(
                          "event.confirmJoinBody",
                          "Free RSVP — no payment, no ticket. The organiser sees you're coming.",
                        )}
                  </p>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("common.keep", "Keep as is")}</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  const join = confirm === "join";
                  setConfirm(null);
                  mutate.mutate(join);
                }}
              >
                {confirm === "cancel"
                  ? t("event.confirmCancelAction", "Cancel RSVP")
                  : t("event.confirmJoinAction", "Yes, I'm going")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </main>
    </div>
  );
}
