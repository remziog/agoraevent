import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft } from "lucide-react";
import { ArtBlock, artInk } from "@/components/ArtBlock";
import { eventPhoto } from "@/components/EventVisual";

/**
 * The tall poster at the top of an event page (design: Naz Paşalı, v3 "d-hero"):
 * category and demo pills at the top, the event name set huge at the bottom.
 * A real organiser photo wins; otherwise Naz's generative art — never a stock
 * or AI image. The paper body sheet overlaps its lower edge.
 */
export function EventHero({
  title,
  category,
  tags,
  demo,
  onBack,
}: {
  title: string;
  category: string;
  tags?: readonly string[] | null;
  demo: boolean;
  onBack: () => void;
}) {
  const { t } = useTranslation();
  const [failed, setFailed] = useState(false);
  const photo = eventPhoto(tags);
  const showPhoto = Boolean(photo) && !failed;
  const ink = showPhoto ? "#f7f2ea" : artInk(title);
  const len = title.length;
  const size =
    len > 48
      ? "text-[clamp(2.25rem,9.5vw,3.5rem)]"
      : len > 22
        ? "text-[clamp(2.75rem,12.5vw,4.5rem)]"
        : "text-[clamp(3.4rem,17vw,5.75rem)]";

  return (
    <div className="relative isolate flex min-h-[440px] flex-col sm:min-h-[520px]">
      <div aria-hidden className="absolute inset-0 -z-10">
        {showPhoto && photo ? (
          <>
            <img
              src={photo.url}
              alt=""
              onError={() => setFailed(true)}
              className="h-full w-full object-cover"
            />
            <span className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-black/10" />
          </>
        ) : (
          <ArtBlock seed={title} className="h-full" />
        )}
      </div>

      <div className="flex flex-1 flex-col justify-between gap-8 px-5 pb-12 pt-4 sm:px-8 sm:pb-14 sm:pt-6">
        <div className="flex flex-col items-start gap-4">
          <button
            type="button"
            onClick={onBack}
            aria-label={t("common.back", "Back")}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-[#f7f2ea]/85 text-[#100f0e] backdrop-blur transition hover:bg-[#f7f2ea] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff5b1f]"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden />
          </button>
          <div className="flex flex-wrap gap-1.5">
            {/* Category values are English data: keep English casing even in Turkish (no dotted İ). */}
            <span
              lang="en"
              className="rounded-full bg-[#f7f2ea]/85 px-2.5 py-1 font-mono text-[10.5px] uppercase tracking-[0.08em] text-[#100f0e] backdrop-blur"
            >
              {category}
            </span>
            {demo && (
              <span className="rounded-full bg-[#100f0e]/80 px-2.5 py-1 font-mono text-[10.5px] uppercase tracking-[0.08em] text-[#f7f2ea] backdrop-blur">
                {t("common.demo", "Demo")}
              </span>
            )}
          </div>
        </div>
        <h1
          className={`font-display ${size} font-[900] leading-[0.84] tracking-[-0.02em] [font-stretch:62%] [overflow-wrap:anywhere] [text-wrap:balance]`}
          style={{ color: ink }}
        >
          {title}
        </h1>
      </div>

      {showPhoto && photo?.credit && (
        <span className="absolute right-3 top-4 rounded-full bg-background/70 px-2 py-0.5 text-[10px] text-muted-foreground backdrop-blur">
          {t("common.photo", "Photo")}: {photo.credit}
        </span>
      )}
    </div>
  );
}
