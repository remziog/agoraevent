import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { CalendarDays, Coins, MapPin, Sparkles, Users, UtensilsCrossed, X } from "lucide-react";
import type { TFunction } from "i18next";
import type { Constraints, Intent, WhenLabel } from "@/lib/discovery";
import { windowFor } from "@/lib/discovery";
import type { DiscoveryStatus, Turn } from "@/lib/discovery-store";

const INTENT_OPTIONS: Intent[] = ["restaurant", "place", "event"];

export function intentLabel(t: TFunction, c: Pick<Constraints, "intent" | "placeKind">): string {
  if (c.intent === "restaurant") return t("discover.intent.restaurant", "Restaurant");
  if (c.intent === "place")
    return c.placeKind
      ? t("discover.intent.placeKind", { kind: c.placeKind, defaultValue: "Place · {{kind}}" })
      : t("discover.intent.place", "Place");
  return t("discover.intent.event", "Gathering");
}

export function whenLabel(t: TFunction, when: Constraints["when"]): string {
  if (!when) return t("discover.when.any", "Any time");
  const base = t(`discover.when.${when.label}`, {
    defaultValue: {
      tonight: "Tonight",
      today: "Today",
      tomorrow: "Tomorrow",
      "tomorrow-evening": "Tomorrow evening",
      weekend: "This weekend",
      "this-week": "Next 7 days",
      custom: "Custom dates",
    }[when.label],
  });
  return when.assumed ? `${base} · ${t("discover.assumed", "assumed")}` : base;
}

const WHEN_OPTIONS: WhenLabel[] = ["tonight", "tomorrow", "weekend", "this-week"];

/** The editable conditions Agora understood. Every chip is a real constraint; removing one is the person's choice. */
export function ConstraintChips({
  constraints,
  onEdit,
  disabled,
}: {
  constraints: Constraints;
  onEdit: (edits: Partial<Constraints>, label: string) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const [whenOpen, setWhenOpen] = useState(false);
  const [intentOpen, setIntentOpen] = useState(false);
  const chip =
    "inline-flex min-h-11 items-center gap-1.5 rounded-full border border-primary/30 bg-background px-3 py-1.5 text-xs text-foreground disabled:opacity-50 sm:min-h-9";

  return (
    <div
      className="flex flex-wrap items-center gap-2"
      aria-label={t("discover.conditions", "Your conditions")}
    >
      {/* What is being asked for — the one chip that decides who answers (Qloo or Agora). */}
      <div className="relative">
        <button
          type="button"
          className={`${chip} border-primary/60 bg-primary/5`}
          disabled={disabled}
          aria-expanded={intentOpen}
          aria-haspopup="listbox"
          onClick={() => setIntentOpen((o) => !o)}
        >
          {constraints.intent === "event" ? (
            <Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden />
          ) : (
            <UtensilsCrossed className="h-3.5 w-3.5 text-primary" aria-hidden />
          )}
          {intentLabel(t, constraints)}
        </button>
        {intentOpen && (
          <ul
            role="listbox"
            aria-label={t("discover.pickIntent", "What are you looking for?")}
            className="absolute left-0 top-full z-20 mt-1 min-w-44 rounded-xl border bg-background p-1 shadow-lg"
          >
            {INTENT_OPTIONS.map((intent) => (
              <li key={intent} role="option" aria-selected={constraints.intent === intent}>
                <button
                  type="button"
                  className="min-h-10 w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-muted"
                  onClick={() => {
                    setIntentOpen(false);
                    if (intent === constraints.intent) return;
                    onEdit(
                      { intent, placeKind: null },
                      t("discover.switchIntent", {
                        kind: intentLabel(t, { intent, placeKind: null }).toLowerCase(),
                        defaultValue: "Show me a {{kind}} instead",
                      }),
                    );
                  }}
                >
                  {intentLabel(t, { intent, placeKind: null })}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="relative">
        <button
          type="button"
          className={chip}
          disabled={disabled}
          aria-expanded={whenOpen}
          aria-haspopup="listbox"
          onClick={() => setWhenOpen((o) => !o)}
        >
          <CalendarDays className="h-3.5 w-3.5 text-primary" aria-hidden />
          {whenLabel(t, constraints.when)}
        </button>
        {whenOpen && (
          <ul
            role="listbox"
            aria-label={t("discover.pickWhen", "Pick a time")}
            className="absolute left-0 top-full z-20 mt-1 min-w-44 rounded-xl border bg-background p-1 shadow-lg"
          >
            {WHEN_OPTIONS.map((label) => (
              <li key={label} role="option" aria-selected={constraints.when?.label === label}>
                <button
                  type="button"
                  className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-muted"
                  onClick={() => {
                    setWhenOpen(false);
                    const when = windowFor(label, new Date());
                    onEdit({ when }, whenLabel(t, when));
                  }}
                >
                  {whenLabel(t, { ...windowFor(label, new Date()), assumed: false })}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <button
        type="button"
        className={chip}
        disabled={disabled}
        onClick={() =>
          constraints.district
            ? onEdit({ district: null }, t("discover.anyDistrict", "Any district"))
            : undefined
        }
        aria-label={
          constraints.district
            ? t("discover.removeDistrict", {
                name: constraints.district,
                defaultValue: "Remove district {{name}}",
              })
            : undefined
        }
      >
        <MapPin className="h-3.5 w-3.5 text-primary" aria-hidden />
        {constraints.district ?? t("discover.anyDistrict", "Any district")}
        {constraints.district && <X className="h-3 w-3 text-muted-foreground" aria-hidden />}
      </button>

      {constraints.budgetMax !== null && (
        <button
          type="button"
          className={chip}
          disabled={disabled}
          onClick={() => onEdit({ budgetMax: null }, t("discover.anyBudget", "No budget limit"))}
          aria-label={t("discover.removeBudget", "Remove the budget limit")}
        >
          <Coins className="h-3.5 w-3.5 text-primary" aria-hidden />≤ {constraints.budgetMax} TL
          <X className="h-3 w-3 text-muted-foreground" aria-hidden />
        </button>
      )}

      {constraints.groupSize && (
        <button
          type="button"
          className={chip}
          disabled={disabled}
          onClick={() => onEdit({ groupSize: null }, t("discover.anyGroup", "Any group size"))}
          aria-label={t("discover.removeGroup", "Remove the group-size condition")}
        >
          <Users className="h-3.5 w-3.5 text-primary" aria-hidden />
          {constraints.groupSize === "small"
            ? t("discover.smallGroup", "Small group")
            : t("discover.largeGroup", "Big crowd")}
          <X className="h-3 w-3 text-muted-foreground" aria-hidden />
        </button>
      )}

      {constraints.social && (
        <span className={chip}>
          <Users className="h-3.5 w-3.5 text-primary" aria-hidden />
          {t("discover.social", "Meet new people")}
        </span>
      )}

      {constraints.tags.map((tag) => (
        <button
          key={tag}
          type="button"
          className={chip}
          disabled={disabled}
          onClick={() =>
            onEdit(
              { tags: constraints.tags.filter((x) => x !== tag) },
              t("discover.removeTag", { tag, defaultValue: "Without “{{tag}}”" }),
            )
          }
          aria-label={t("discover.removeTagLabel", {
            tag,
            defaultValue: "Remove interest {{tag}}",
          })}
        >
          #{tag}
          <X className="h-3 w-3 text-muted-foreground" aria-hidden />
        </button>
      ))}
    </div>
  );
}

/** The conversation so far: the person's words and Agora's one-line answers. */
export function TurnList({
  turns,
  status,
  intent = "event",
}: {
  turns: Turn[];
  status: DiscoveryStatus;
  intent?: Intent;
}) {
  const { t } = useTranslation();
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [turns.length, status]);
  if (turns.length === 0 && status !== "searching") return null;
  return (
    <ol
      className="space-y-2"
      aria-live="polite"
      aria-label={t("discover.conversation", "Conversation")}
    >
      {turns.slice(-6).map((turn) => (
        <li
          key={turn.id}
          className={
            turn.role === "user"
              ? "ml-auto max-w-[85%] rounded-2xl rounded-br-sm bg-primary/10 px-3 py-2 text-sm"
              : `max-w-[92%] rounded-2xl rounded-bl-sm border px-3 py-2 text-sm ${
                  turn.kind === "error" ? "border-destructive/50 text-destructive" : "bg-card"
                }`
          }
        >
          {turn.role === "agora" && (
            <span className="mb-0.5 block text-[10px] uppercase tracking-[0.25em] text-primary">
              Agora
            </span>
          )}
          {turn.text}
        </li>
      ))}
      {status === "searching" && (
        <li className="max-w-[92%] rounded-2xl rounded-bl-sm border bg-card px-3 py-2 text-sm text-muted-foreground">
          <span className="mb-0.5 block text-[10px] uppercase tracking-[0.25em] text-primary">
            Agora
          </span>
          {intent === "event"
            ? t("discover.searching", "Checking real gatherings against your conditions…")
            : t("discover.searchingQloo", "Asking Qloo to rank places for your taste…")}
        </li>
      )}
      <div ref={endRef} />
    </ol>
  );
}
