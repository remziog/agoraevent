import { useState } from "react";
import { useTranslation } from "react-i18next";

/**
 * The visual block of a gathering card. Agora shows a real photo only when the
 * organiser supplied one (tag `photo:<url>`, credited with `photo_credit:<text>`);
 * otherwise an honest typographic block in the brand palette — never a stock
 * crowd, never an AI image.
 */
export function eventPhoto(
  tags: readonly string[] | null | undefined,
): { url: string; credit?: string } | null {
  const url = (tags ?? []).find((t) => t.startsWith("photo:"))?.slice("photo:".length);
  if (!url || !/^https:\/\//.test(url)) return null;
  const credit = (tags ?? [])
    .find((t) => t.startsWith("photo_credit:"))
    ?.slice("photo_credit:".length);
  return { url, credit };
}

const PALETTES = [
  "from-primary/25 via-primary/10 to-transparent",
  "from-accent/30 via-accent/10 to-transparent",
  "from-secondary via-secondary/40 to-transparent",
];

export function EventVisual({
  title,
  category,
  tags,
  size = "md",
  className = "",
}: {
  title: string;
  category: string;
  tags?: readonly string[] | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const { t } = useTranslation();
  const [failed, setFailed] = useState(false);
  const photo = eventPhoto(tags);
  const height = size === "lg" ? "h-56 sm:h-72" : size === "sm" ? "h-24" : "h-40";
  const palette = PALETTES[Math.abs(hash(title)) % PALETTES.length];

  if (photo && !failed) {
    return (
      <div className={`relative overflow-hidden bg-muted ${height} ${className}`}>
        <img
          src={photo.url}
          alt=""
          loading="lazy"
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
        />
        {photo.credit && (
          <span className="absolute bottom-2 right-3 rounded-full bg-background/70 px-2 py-0.5 text-[10px] text-muted-foreground backdrop-blur">
            {t("common.photo", "Photo")}: {photo.credit}
          </span>
        )}
      </div>
    );
  }

  const words = title.split(/\s+/).slice(0, 3);
  return (
    <div
      aria-hidden
      className={`relative flex ${height} flex-col justify-end overflow-hidden bg-gradient-to-br ${palette} bg-card p-4 ${className}`}
    >
      <span className="absolute -right-4 -top-6 select-none font-display text-[7rem] leading-none text-primary/10 sm:text-[9rem]">
        {title.trim().charAt(0).toUpperCase()}
      </span>
      {/* Category values are English data: keep English casing even when the UI is Turkish (no dotted İ). */}
      <span lang="en" className="relative text-[10px] uppercase tracking-[0.3em] text-primary">
        {category}
      </span>
      <span className="relative mt-1 font-display text-2xl leading-tight text-foreground/90 sm:text-3xl">
        {words.join(" ")}
      </span>
    </div>
  );
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}
