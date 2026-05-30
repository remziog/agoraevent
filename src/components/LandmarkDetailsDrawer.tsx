import { useState } from "react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
  DrawerClose,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { LocationPreviewDialog } from "@/components/LocationPreviewDialog";
import { Clock, MapPin, Navigation, ImageOff } from "lucide-react";
import type { Landmark } from "@/lib/istanbul-landmarks";

type Props = {
  landmark: (Landmark & { id: string }) | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function LandmarkDetailsDrawer({ landmark, open, onOpenChange }: Props) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[88vh]">
        {landmark && (
          <div className="mx-auto w-full max-w-3xl overflow-y-auto">
            <DrawerHeader className="text-left">
              <p className="text-xs uppercase tracking-[0.25em] text-primary">
                {landmark.venue} · {landmark.category}
              </p>
              <DrawerTitle className="font-display text-3xl leading-tight">
                {landmark.title}
              </DrawerTitle>
              <DrawerDescription className="text-sm text-muted-foreground">
                {landmark.blurb}
              </DrawerDescription>
            </DrawerHeader>

            {/* Photos */}
            <div className="px-4">
              {landmark.photos.length > 0 ? (
                <div className="-mx-1 flex gap-2 overflow-x-auto pb-2 snap-x snap-mandatory">
                  {landmark.photos.map((src, i) => (
                    <LandmarkPhoto
                      key={src}
                      src={src}
                      alt={`${landmark.title} — photo ${i + 1}`}
                    />
                  ))}
                </div>
              ) : (
                <div className="flex h-40 items-center justify-center rounded-xl border border-dashed text-xs text-muted-foreground">
                  No photos available
                </div>
              )}
            </div>

            {/* Body */}
            <div className="space-y-4 px-4 pt-4">
              <p className="text-[15px] leading-relaxed text-foreground/90">
                {landmark.description}
              </p>

              <div className="grid gap-2 rounded-2xl border bg-card/60 p-4 text-sm">
                <div className="flex items-start gap-2">
                  <Clock className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <div>
                    <p className="text-xs uppercase tracking-widest text-muted-foreground">
                      Opening hours
                    </p>
                    <p>{landmark.hours}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <div>
                    <p className="text-xs uppercase tracking-widest text-muted-foreground">
                      Location
                    </p>
                    <p>
                      {landmark.venue}, {landmark.city}
                    </p>
                  </div>
                </div>
              </div>

              {landmark.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {landmark.tags.map((t) => (
                    <span
                      key={t}
                      className="rounded-full border bg-background/60 px-2.5 py-1 text-xs text-muted-foreground"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <DrawerFooter className="flex-row gap-2">
              <LocationPreviewDialog
                place={landmark}
                trigger={
                  <Button className="flex-1 gap-1.5">
                    <Navigation className="h-4 w-4" />
                    Take me there
                  </Button>
                }
              />
              <DrawerClose asChild>
                <Button variant="outline" className="flex-1">
                  Close
                </Button>
              </DrawerClose>
            </DrawerFooter>
          </div>
        )}
      </DrawerContent>
    </Drawer>
  );
}

function LandmarkPhoto({ src, alt }: { src: string; alt: string }) {
  const [errored, setErrored] = useState(false);
  if (errored) {
    return (
      <div className="flex h-52 w-72 shrink-0 snap-start items-center justify-center rounded-xl border border-dashed bg-muted/40 text-muted-foreground">
        <ImageOff className="h-5 w-5" />
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setErrored(true)}
      className="h-52 w-72 shrink-0 snap-start rounded-xl object-cover"
    />
  );
}
