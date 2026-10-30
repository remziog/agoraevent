import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Flame, Sparkles, Trophy } from "lucide-react";
import { getMyProfile, updateTaste } from "@/lib/profile.functions";
import { getMyStats, BADGES } from "@/lib/gamification.functions";
import { useSavedIds } from "@/lib/use-saved";
import { useExperiences } from "@/lib/use-experiences";
import { AppHeader } from "@/components/AppHeader";
import { BadgeBand } from "@/components/bingo/Badges";
import { BingoStyles } from "@/components/bingo/styles";
import { BingoPassport } from "@/components/profile/BingoPassport";
import { ExperienceList } from "@/components/profile/ExperienceList";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/profile")({
  component: ProfilePage,
});

function TagInput({ label, value, onChange }: { label: string; value: string[]; onChange: (v: string[]) => void }) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState("");
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex flex-wrap gap-2">
        {value.map((tag, i) => (
          <span key={i} className="flex items-center gap-1 rounded-full bg-secondary py-1 pl-3 pr-1 text-sm">
            {tag}
            <button
              type="button"
              onClick={() => onChange(value.filter((_, j) => j !== i))}
              aria-label={t("profile3.edit.removeTag", { tag })}
              className="-my-2 grid h-11 w-11 place-items-center rounded-full opacity-60 hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-ring"
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={t("profile3.edit.addPh")}
          aria-label={label}
          onKeyDown={(e) => {
            if (e.key === "Enter" && draft.trim()) {
              e.preventDefault();
              onChange([...value, draft.trim().toLowerCase()]);
              setDraft("");
            }
          }}
        />
      </div>
    </div>
  );
}

/**
 * Profile — "a personal archive of the city" (design: Naz Paşalı): identity, this month at a glance,
 * the Bingo passport, Deneyimlerim (kept on this device), tastes and the badge collection; then the
 * existing activity panel (XP, streak, Agora badges) and the taste editor, unchanged in behaviour.
 */
function ProfilePage() {
  const { t } = useTranslation();
  const get = useServerFn(getMyProfile);
  const save = useServerFn(updateTaste);
  const fetchStats = useServerFn(getMyStats);
  const q = useQuery({ queryKey: ["me"], queryFn: () => get() });
  const stats = useQuery({ queryKey: ["my-stats"], queryFn: () => fetchStats() });
  const saved = useSavedIds();
  const xp = useExperiences();

  const [music, setMusic] = useState<string[]>([]);
  const [sports, setSports] = useState<string[]>([]);
  const [films, setFilms] = useState<string[]>([]);
  const [interests, setInterests] = useState<string[]>([]);
  const [freeText, setFreeText] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (q.data?.taste) {
      setMusic(q.data.taste.music ?? []);
      setSports(q.data.taste.sports ?? []);
      setFilms(q.data.taste.films ?? []);
      setInterests(q.data.taste.interests ?? []);
      setFreeText(q.data.taste.free_text ?? "");
    }
  }, [q.data]);

  async function onSave() {
    setLoading(true);
    try {
      await save({ data: { music, sports, films, interests, free_text: freeText || null } });
      toast.success(t("profile3.edit.saved"));
    } catch (e) { toast.error((e as Error).message); }
    finally { setLoading(false); }
  }

  const hasAnyTaste = music.length + sports.length + films.length + interests.length > 0 || freeText.length > 0;
  const name = q.data?.profile?.display_name?.trim() || t("profile3.member");
  const initial = name.charAt(0).toLocaleUpperCase();
  const unlocked = xp.badges.filter((b) => b.done).length;
  const wantCount = saved.data ? saved.data.events.length + saved.data.places.length : null;
  // the saved taste, shown as chips (what is stored, not what is being edited)
  const savedTaste = q.data?.taste;
  const tasteChips: [string, string][] = savedTaste
    ? [
        ...(savedTaste.music ?? []).map((v: string) => [v, t("profile3.taste.music")] as [string, string]),
        ...(savedTaste.films ?? []).map((v: string) => [v, t("profile3.taste.films")] as [string, string]),
        ...(savedTaste.sports ?? []).map((v: string) => [v, t("profile3.taste.sports")] as [string, string]),
        ...(savedTaste.interests ?? []).map((v: string) => [v, t("profile3.taste.interests")] as [string, string]),
      ]
    : [];

  return (
    <div className="min-h-screen bg-background">
      <BingoStyles />
      <AppHeader variant="member" />
      <main className="nb-scope mx-auto max-w-2xl px-4 pb-16 pt-6 sm:px-6 sm:pt-10">
        <p className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-muted-foreground">{t("profile3.kicker")}</p>
        <h1 className="mt-1 text-[clamp(52px,17vw,76px)] font-[900] leading-[0.84] tracking-[-0.02em] [font-stretch:62%]">
          {t("profile3.title")}
        </h1>

        {/* identity */}
        <div className="mt-5 flex items-center gap-3.5">
          <span
            aria-hidden
            className="grid h-14 w-14 shrink-0 place-items-center rounded-full p-[3px]"
            style={{ background: "conic-gradient(from 200deg, #E9A23B, #e57ca8, #e8573f, #E9A23B)" }}
          >
            <span className="grid h-full w-full place-items-center rounded-full bg-background text-[22px] font-[850] [font-stretch:70%]">
              {initial}
            </span>
          </span>
          <p className="m-0 min-w-0">
            <b className="block truncate text-[17px] font-semibold">{q.isLoading ? "…" : name}</b>
            {q.data?.profile?.city ? (
              <span className="text-[13px] text-muted-foreground">{q.data.profile.city}</span>
            ) : null}
          </p>
        </div>

        {/* this month at a glance */}
        <div className="mt-5 grid grid-cols-3 border-t-2 border-foreground" aria-label={t("profile3.statsAria")} role="group">
          {(
            [
              [`${xp.card.filled}/9`, t("profile3.stats.squares")],
              [String(xp.card.lines.length), t("profile3.stats.lines")],
              [`${unlocked}/${xp.badges.length}`, t("profile3.stats.badges")],
            ] as const
          ).map(([n, label], i) => (
            <div key={i} className={`grid gap-0.5 pt-2.5 ${i ? "border-l border-border pl-3" : ""}`}>
              <b className="text-[34px] font-[850] leading-[0.9] tabular-nums [font-stretch:70%]">{n}</b>
              <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">{label}</span>
            </div>
          ))}
        </div>

        <div className="mt-6">
          <BingoPassport card={xp.card} />
        </div>

        <ExperienceList
          records={xp.records}
          matches={xp.card.matches}
          wantCount={wantCount}
          thisYear={xp.today.slice(0, 4)}
          onRemove={(id) => xp.remove(id)}
        />

        {/* tastes */}
        <section className="mt-8 border-t border-border pt-3" aria-labelledby="taste-t">
          <h2 id="taste-t" className="m-0 font-mono text-[10.5px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            {t("profile3.taste.title")}
          </h2>
          {tasteChips.length ? (
            <ul className="m-0 mt-3 flex list-none flex-wrap gap-1.5 p-0">
              {tasteChips.map(([v, k], i) => (
                <li key={`${k}-${v}-${i}`} className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13.5px] shadow-[inset_0_0_0_1px_var(--border)]">
                  <span>{v}</span>
                  <small className="font-mono text-[9.5px] uppercase tracking-[0.06em] text-muted-foreground">{k}</small>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-[13px] text-muted-foreground">{q.isLoading ? "…" : t("profile3.taste.empty")}</p>
          )}
          <p className="mt-2 text-[12px] leading-snug text-muted-foreground">{t("profile3.taste.note")}</p>
        </section>

        <div className="mt-8">
          <BadgeBand badges={xp.badges} />
        </div>

        {/* Gamification panel (existing: level, XP, streak, Agora badges) */}
        {stats.data && (
          <section className="mt-10 rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/10 via-card to-card p-6" aria-label={t("profile3.activity.title")}>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-primary">{t("profile3.activity.level")}</p>
                <p className="mt-1 font-display text-5xl">{stats.data.progress.level}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("profile3.activity.xp", { n: stats.data.stats.xp })}
                </p>
              </div>
              <div className="flex gap-4 text-center">
                <div>
                  <Flame className="mx-auto h-5 w-5 text-orange-400" />
                  <p className="mt-1 font-display text-2xl">{stats.data.stats.current_streak}</p>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {t("profile3.activity.streak")}
                  </p>
                </div>
                <div>
                  <Trophy className="mx-auto h-5 w-5 text-yellow-400" />
                  <p className="mt-1 font-display text-2xl">{stats.data.badges.length}</p>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {t("profile3.activity.badges")}
                  </p>
                </div>
                <div>
                  <Sparkles className="mx-auto h-5 w-5 text-primary" />
                  <p className="mt-1 font-display text-2xl">{stats.data.stats.longest_streak}</p>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {t("profile3.activity.best")}
                  </p>
                </div>
              </div>
            </div>

            {/* XP bar */}
            <div className="mt-5">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>L{stats.data.progress.level}</span>
                <span className="tabular-nums">
                  {stats.data.progress.xpInLevel} / {stats.data.progress.xpToNext} XP
                </span>
                <span>L{stats.data.progress.level + 1}</span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-gradient-to-r from-primary to-primary/60 transition-all"
                  style={{
                    width: `${Math.min(100, Math.round((stats.data.progress.xpInLevel / stats.data.progress.xpToNext) * 100))}%`,
                  }}
                />
              </div>
            </div>

            {/* Agora badges (server) */}
            <div className="mt-6">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">{t("profile3.activity.agoraBadges")}</p>
              <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
                {Object.entries(BADGES).map(([code, b]) => {
                  const earned = stats.data!.badges.some((x: any) => x.badge_code === code);
                  return (
                    <div
                      key={code}
                      className={`rounded-xl border p-3 text-center transition ${
                        earned
                          ? "border-primary/50 bg-primary/10"
                          : "border-dashed opacity-40 grayscale"
                      }`}
                      title={b.description}
                    >
                      <div className="text-2xl">{b.icon}</div>
                      <p className="mt-1 text-[10px] font-medium leading-tight">{b.name}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        <h2 className="mt-10 font-display text-3xl">{t("profile3.edit.title")}</h2>
        <p className="mt-2 text-muted-foreground">{t("profile3.edit.lead")}</p>

        {q.isLoading ? (
          <div className="mt-8 space-y-6">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="space-y-2">
                <div className="h-4 w-24 animate-pulse rounded bg-muted" />
                <div className="flex flex-wrap gap-2">
                  <div className="h-7 w-20 animate-pulse rounded-full bg-muted" />
                  <div className="h-7 w-16 animate-pulse rounded-full bg-muted" />
                  <div className="h-7 w-24 animate-pulse rounded-full bg-muted" />
                </div>
                <div className="h-10 w-full animate-pulse rounded-md bg-muted/60" />
              </div>
            ))}
          </div>
        ) : (
          <>
            {!hasAnyTaste && (
              <div className="mt-6 rounded-xl border border-dashed p-5 text-sm text-muted-foreground">
                <p className="font-medium text-foreground">{t("profile3.edit.blankT")}</p>
                <p className="mt-1">{t("profile3.edit.blankD")}</p>
              </div>
            )}
            <div className="mt-8 space-y-6">
              <TagInput label={t("profile3.edit.music")} value={music} onChange={setMusic} />
              <TagInput label={t("profile3.edit.sports")} value={sports} onChange={setSports} />
              <TagInput label={t("profile3.edit.films")} value={films} onChange={setFilms} />
              <TagInput label={t("profile3.edit.interests")} value={interests} onChange={setInterests} />
              <div className="space-y-2">
                <Label htmlFor="taste-else">{t("profile3.edit.else")}</Label>
                <Textarea id="taste-else" rows={3} value={freeText} onChange={(e) => setFreeText(e.target.value)} placeholder={t("profile3.edit.elsePh")} />
              </div>
              <Button onClick={onSave} disabled={loading} className="min-h-11">
                {loading ? t("profile3.edit.saving") : t("profile3.edit.save")}
              </Button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
