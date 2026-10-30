// Naz's dark bottom sheet (#1F1024) for Bingo squares and badges, on top of shadcn's Sheet.
// Its own 44 px, translated close button replaces the default one.
import type { ReactNode } from "react";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { BingoStyles } from "./styles";

export function DarkSheet({
  open,
  onOpenChange,
  title,
  description,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Accessible name (visually hidden; the sheet shows its own poster heading). */
  title: string;
  description?: string;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="nb-scope nb-dark mx-auto max-h-[88dvh] w-full max-w-xl overflow-y-auto rounded-t-[28px] border-0 bg-[#1F1024] p-0 text-[#f3ebdd] shadow-[inset_0_0_0_1px_rgb(243_235_221/0.24)] motion-reduce:!animate-none [&>button:first-child]:hidden"
      >
        <BingoStyles />
        <SheetTitle className="sr-only">{title}</SheetTitle>
        {description ? <SheetDescription className="sr-only">{description}</SheetDescription> : null}
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-[rgb(243_235_221/0.24)]" aria-hidden />
        <SheetClose
          className="absolute right-2 top-2 z-10 grid h-11 w-11 place-items-center rounded-full text-[rgb(243_235_221/0.68)] hover:text-[#f3ebdd] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E9A23B]"
          aria-label={t("bingo.close")}
        >
          <X className="h-5 w-5" aria-hidden />
        </SheetClose>
        <div className="px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-2">{children}</div>
      </SheetContent>
    </Sheet>
  );
}
