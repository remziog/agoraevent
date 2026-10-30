import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ArtBlock, artInk } from "@/components/ArtBlock";

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

  const words = title.split(/\s+/).slice(0, 4);
  const titleSize =
    size === "lg"
      ? "text-[3rem] sm:text-[3.75rem]"
      : size === "sm"
        ? "text-[1.6rem]"
        : "text-[2.25rem]";
  return (
    <ArtBlock seed={title} className={`${height} ${className}`}>
      <div aria-hidden className="flex h-full flex-col justify-between p-4">
        {/* Category values are English data: keep English casing even when the UI is Turkish (no dotted İ). */}
        <span
          lang="en"
          className="self-start rounded-full bg-[#f7f2ea]/85 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.08em] text-[#100f0e] backdrop-blur"
        >
          {category}
        </span>
        <span
          className={`font-display ${titleSize} font-[900] leading-[0.86] tracking-[-0.02em] [font-stretch:62%] line-clamp-2`}
          style={{ color: artInk(title) }}
        >
          {words.join(" ")}
        </span>
      </div>
    </ArtBlock>
  );
}
