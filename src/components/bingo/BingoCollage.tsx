// The Bingo intro collage (design: Naz Paşalı): monochrome art tiles, a torn paper strip, a
// marigold sticker and a ticket stub. Decorative only; the art is Agora's generative ArtBlock.
import { useTranslation } from "react-i18next";
import { ArtBlock } from "@/components/ArtBlock";
import { periodLabel } from "./text";

export function BingoCollage({ period }: { period: string }) {
  const { t, i18n } = useTranslation();
  return (
    <div className="nb-collage" aria-hidden>
      <div className="tile t1">
        <ArtBlock seed="bingo-intro-a" className="h-full w-full" shade={false} />
      </div>
      <div className="tile t2">
        <ArtBlock seed="bingo-intro-b" className="h-full w-full" shade={false} />
      </div>
      <div className="tile t3">
        <ArtBlock seed="bingo-intro-c" className="h-full w-full" shade={false} />
      </div>
      <div className="strip nb-paper">{t("bingo.tag")}</div>
      <div className="sticker">
        <span>
          {t("bingo.sticker")
            .split(" · ")
            .map((s, i) => (
              <span key={i} className="block">
                {s}
              </span>
            ))}
        </span>
      </div>
      <div className="stub">{periodLabel(period, i18n.language).toLocaleUpperCase(i18n.language)} · No. 001</div>
    </div>
  );
}
