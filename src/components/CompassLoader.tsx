import { Compass } from "lucide-react";

export function CompassLoader({ message }: { message?: string }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/95 backdrop-blur-xl">
      <div className="relative">
        <div className="absolute inset-0 animate-ping rounded-full bg-primary/20" />
        <div className="absolute inset-2 animate-pulse rounded-full bg-primary/10" />
        <div
          className="relative flex h-32 w-32 items-center justify-center rounded-full border-2 border-primary/40 bg-card shadow-[0_0_60px_-10px_hsl(var(--primary))]"
          style={{ animation: "spin 2.4s linear infinite" }}
        >
          <Compass className="h-14 w-14 text-primary" strokeWidth={1.5} />
        </div>
        <div
          className="pointer-events-none absolute inset-0 rounded-full"
          style={{
            background:
              "conic-gradient(from 0deg, transparent 0deg, hsl(var(--primary)/0.4) 60deg, transparent 120deg)",
            animation: "spin 1.6s linear infinite",
          }}
        />
      </div>
      <p className="mt-10 font-display text-lg tracking-wide text-foreground">
        {message ?? "Finding your night…"}
      </p>
      <p className="mt-1 text-xs uppercase tracking-[0.3em] text-muted-foreground">
        Reading the room
      </p>
    </div>
  );
}
