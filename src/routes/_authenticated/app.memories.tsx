import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Camera, Trash2, ImagePlus } from "lucide-react";
import { toast } from "sonner";
import { listMyMemories, deleteMemory } from "@/lib/memories.functions";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/app/memories")({
  component: MemoriesPage,
});

function MemoriesPage() {
  const fetchMemories = useServerFn(listMyMemories);
  const removeMemory = useServerFn(deleteMemory);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["memories", "mine"], queryFn: () => fetchMemories() });

  const del = useMutation({
    mutationFn: (id: string) => removeMemory({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["memories"] });
      toast.success("Removed");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const memories = q.data?.memories ?? [];

  return (
    <div className="min-h-screen bg-background">
      <AppHeader variant="member" />
      <main className="mx-auto max-w-5xl px-6 py-10">
        <div className="flex items-baseline justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-primary">
              <Camera className="mr-1 inline h-3 w-3" />
              Memories
            </p>
            <h1 className="mt-1 font-display text-4xl">Your nights, kept.</h1>
            <p className="mt-2 text-muted-foreground">
              Add a photo from any event you went to. +50 XP per memory.
            </p>
          </div>
        </div>

        {q.isLoading && (
          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="aspect-square animate-pulse rounded-xl bg-card" />
            ))}
          </div>
        )}

        {!q.isLoading && memories.length === 0 && (
          <div className="mt-10 rounded-2xl border border-dashed bg-card/40 p-12 text-center">
            <ImagePlus className="mx-auto h-10 w-10 text-muted-foreground" />
            <p className="mt-4 font-display text-xl">No memories yet</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Go to an event you've attended and tap "Add memory".
            </p>
            <Link to="/app/calendar">
              <Button className="mt-6">Open calendar</Button>
            </Link>
          </div>
        )}

        {memories.length > 0 && (
          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {memories.map((m: any) => (
              <div
                key={m.id}
                className="group relative overflow-hidden rounded-xl border bg-card"
              >
                <Link to="/app/event/$id" params={{ id: m.event_id }}>
                  <img
                    src={m.photo_url}
                    alt={m.caption ?? m.events?.title ?? "Memory"}
                    className="aspect-square w-full object-cover transition group-hover:scale-105"
                    loading="lazy"
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3">
                    <p className="line-clamp-1 text-xs font-medium text-white">
                      {m.events?.title}
                    </p>
                    {m.caption && (
                      <p className="line-clamp-1 text-[10px] text-white/70">{m.caption}</p>
                    )}
                  </div>
                </Link>
                <button
                  onClick={() => {
                    if (confirm("Delete this memory?")) del.mutate(m.id);
                  }}
                  className="absolute right-2 top-2 rounded-full bg-black/60 p-1.5 text-white opacity-0 transition group-hover:opacity-100"
                  aria-label="Delete memory"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

