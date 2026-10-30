import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Bookmark, BookmarkCheck, Check, Info } from "lucide-react";
import { getEvent, rsvpEvent } from "@/lib/events.functions";
import { useSaveToggle, useSavedIds } from "@/lib/use-saved";
import { eventDistrict } from "@/lib/discovery";
import { AppHeader } from "@/components/AppHeader";
import { EventHero } from "@/components/event/EventHero";
import { AddToCalendar } from "@/components/event/AddToCalendar";
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
  // Saving is a private bookmark on a separate path from the RSVP (never attendee lists, never XP).
  const savedIds = useSavedIds();
  const saveToggle = useSaveToggle();
  const isSaved = Boolean(savedIds.data?.events.includes(id));
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
          res?.awarded
            ? t("event.goingXp", "You're going · +25 XP")
            : t("event.goingConfirmed", "You're going"),
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

  const goBack = () =>
    window.history.length > 1 ? window.history.back() : navigate({ to: "/app" });
  const visibleTags = (event?.tags ?? []).filter(
    (tag: string) => !tag.includes(":") && tag !== "demo",
  );
  const where = event ? [event.venue, district ?? event.city].filter(Boolean).join(" · ") : "";
  const dt = "pt-0.5 font-mono text-[10.5px] uppercase tracking-[0.1em] text-muted-foreground";
  const dd = "min-w-0 text-[15px] font-medium tabular-nums [overflow-wrap:anywhere]";

  return (
    <div className="min-h-screen bg-background">
      <AppHeader variant="member" />
      <main className="mx-auto max-w-3xl pb-16 sm:px-6 sm:pt-6">
        {q.isLoading && (
          <div aria-busy="true" aria-live="polite">
            <div className="h-[440px] animate-pulse bg-muted/60 sm:rounded-[32px]" />
            <div className="space-y-3 px-5 pt-6 sm:px-8">
              <div className="h-4 w-1/3 animate-pulse rounded bg-muted" />
              <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
              <p className="sr-only">{t("common.loading", "Loading…")}</p>
            </div>
          </div>
        )}
        {!q.isLoading && !event && (
          <div className="px-4 pt-6 sm:px-0">
            <button
              type="button"
              onClick={goBack}
              className="min-h-11 text-sm text-muted-foreground hover:text-foreground"
            >
              ← {t("common.back", "Back")}
            </button>
            <p className="mt-4 rounded-[22px] border-2 border-dashed p-6 text-sm text-muted-foreground">
              {t("event.notFound", "This gathering isn't on Agora (any more).")}
            </p>
          </div>
        )}

        {event && (
          <article className="overflow-hidden sm:rounded-[32px]">
            <EventHero
              title={event.title}
              category={event.category}
              tags={event.tags}
              demo={demo}
              onBack={goBack}
            />
            {/* The paper sheet: overlaps the poster with a rounded top (Naz v3 "d-body"). */}
            <div className="relative z-10 -mt-7 grid gap-6 rounded-t-[28px] bg-background px-5 pb-2 pt-6 sm:px-8">
              <dl className="grid grid-cols-[max-content_minmax(0,1fr)] gap-x-4 gap-y-3 border-t-2 border-foreground pt-3.5">
                <dt className={dt}>{t("event.when", "When")}</dt>
                <dd className={dd}>
                  {formatWhenLocalized(event.starts_at, i18n.language)}
                  {event.ends_at ? ` – ${formatWhenLocalized(event.ends_at, i18n.language)}` : ""}
                  <small className="block text-xs font-normal text-muted-foreground">
                    Europe/Istanbul
                    {!event.ends_at && ` · ${t("v3paper.detail.noEnd", "no end time given")}`}
                  </small>
                </dd>
                {where && (
                  <>
                    <dt className={dt}>{t("event.where", "Where")}</dt>
                    <dd className={dd}>{where}</dd>
                  </>
                )}
                <dt className={dt}>{t("event.price", "Price")}</dt>
                <dd className={dd}>{priceText}</dd>
                {typeof event.capacity === "number" && (
                  <>
                    <dt className={dt}>{t("event.groupSize", "Group size")}</dt>
                    <dd className={dd}>
                      {t("event.capacity", {
                        n: event.capacity,
                        defaultValue: "up to {{n}} people",
                      })}
                    </dd>
                  </>
                )}
                {event.organizations?.name && (
                  <>
                    <dt className={dt}>{t("event.hostedBy", "Hosted by")}</dt>
                    <dd className={dd}>
                      {event.org_id ? (
                        <Link
                          to="/app/community/$id"
                          params={{ id: event.org_id }}
                          className="-my-3 inline-block py-3 underline decoration-[#ff5b1f] decoration-2 underline-offset-4 hover:text-brand"
                        >
                          {event.organizations.name}
                        </Link>
                      ) : (
                        event.organizations.name
                      )}
                    </dd>
                  </>
                )}
              </dl>

              {event.description && (
                <p className="whitespace-pre-wrap text-base leading-relaxed">{event.description}</p>
              )}
              {visibleTags.length > 0 && (
                <ul
                  className="flex flex-wrap gap-1.5"
                  aria-label={t("v3paper.detail.tags", "Tags")}
                >
                  {visibleTags.map((tag: string) => (
                    <li
                      key={tag}
                      className="inline-flex h-7 items-center rounded-full bg-muted px-3 text-[13px]"
                    >
                      {tag}
                    </li>
                  ))}
                </ul>
              )}

              {/* Actions (Naz v3 "d-acts"): RSVP, Save, calendar export. Save ≠ RSVP ≠ calendar. */}
              <div className="grid gap-2">
                <Button
                  size="lg"
                  variant={going ? "outline" : "default"}
                  className="min-h-12 w-full text-[15px]"
                  disabled={mutate.isPending}
                  aria-busy={mutate.isPending}
                  onClick={() => setConfirm(going ? "cancel" : "join")}
                >
                  {going && !mutate.isPending && <Check aria-hidden />}
                  {mutate.isPending
                    ? t("event.saving", "Saving…")
                    : going
                      ? t("event.goingCancel", "You're going — cancel?")
                      : t("event.imGoing", "I'm going")}
                </Button>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="lg"
                    variant="outline"
                    className="min-h-11 flex-1 basis-44 px-4"
                    disabled={saveToggle.isPending}
                    aria-pressed={isSaved}
                    onClick={() =>
                      saveToggle.mutate({ target: { kind: "event", refId: id }, saved: isSaved })
                    }
                  >
                    {isSaved ? (
                      <>
                        <BookmarkCheck aria-hidden /> {t("save.saved", "Saved to my plans")}
                      </>
                    ) : (
                      <>
                        <Bookmark aria-hidden /> {t("save.save", "Save to my plans")}
                      </>
                    )}
                  </Button>
                  {going && (
                    <Button
                      asChild
                      variant="ghost"
                      size="lg"
                      className="min-h-11 flex-1 basis-44 px-4"
                    >
                      <Link to="/app/plans">{t("event.seePlans", "See it in my plans")}</Link>
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {t(
                    "save.note",
                    "Saving is a private bookmark: it doesn't tell the organiser, doesn't count as going and earns no XP.",
                  )}
                </p>
                {/* EXPERIENCE_ACTION_SLOT */}
                <AddToCalendar event={event} demo={demo} />
              </div>

              <p className="flex items-start gap-2 rounded-[18px] border border-dashed p-3 text-xs text-muted-foreground">
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
            </div>
          </article>
        )}

        <div className="px-4 sm:px-0">
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
        </div>

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
