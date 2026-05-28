import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Camera, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { addMemory, listEventMemories } from "@/lib/memories.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function MemorySection({ eventId, canPost }: { eventId: string; canPost: boolean }) {
  const fetchMems = useServerFn(listEventMemories);
  const add = useServerFn(addMemory);
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["memories", "event", eventId],
    queryFn: () => fetchMems({ data: { event_id: eventId } }),
  });

  const [open, setOpen] = useState(false);
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const mutate = useMutation({
    mutationFn: async (file: File) => {
      const { data: session } = await supabase.auth.getUser();
      const userId = session.user?.id;
      if (!userId) throw new Error("Sign in required");
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
      const path = `${userId}/${eventId}/${Date.now()}.${ext}`;
      const up = await supabase.storage.from("memories").upload(path, file, {
        contentType: file.type,
        upsert: false,
      });
      if (up.error) throw new Error(up.error.message);
      const { data: pub } = supabase.storage.from("memories").getPublicUrl(path);
      await add({
        data: {
          event_id: eventId,
          photo_url: pub.publicUrl,
          caption: caption.trim() || null,
        },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["memories", "event", eventId] });
      qc.invalidateQueries({ queryKey: ["memories", "mine"] });
      qc.invalidateQueries({ queryKey: ["my-stats"] });
      toast.success("Memory saved · +50 XP");
      setOpen(false);
      setCaption("");
      if (fileRef.current) fileRef.current.value = "";
    },
    onError: (e: Error) => toast.error(e.message),
    onSettled: () => setBusy(false),
  });

  const memories = q.data?.memories ?? [];

  return (
    <div className="mt-10">
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-2xl">Memories</h2>
        {canPost && (
          <Button size="sm" variant="outline" onClick={() => setOpen(true)} className="gap-1.5">
            <Camera className="h-4 w-4" />
            Add memory
          </Button>
        )}
      </div>

      {memories.length === 0 ? (
        <p className="mt-3 rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          Be the first to capture a moment from this event.
        </p>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {memories.map((m: any) => (
            <a
              key={m.id}
              href={m.photo_url}
              target="_blank"
              rel="noreferrer"
              className="group relative block overflow-hidden rounded-lg border bg-card"
            >
              <img
                src={m.photo_url}
                alt={m.caption ?? `Memory shared by ${m.profiles?.display_name ?? "an attendee"} from this event`}
                className="aspect-square w-full object-cover transition group-hover:scale-105"
                loading="lazy"
              />
              {(m.caption || m.profiles?.display_name) && (
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                  {m.caption && (
                    <p className="line-clamp-2 text-[11px] text-white">{m.caption}</p>
                  )}
                  {m.profiles?.display_name && (
                    <p className="text-[10px] text-white/60">— {m.profiles.display_name}</p>
                  )}
                </div>
              )}
            </a>
          ))}
        </div>
      )}

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
          onClick={() => !busy && setOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border bg-card p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-display text-xl">Add a memory</h3>
              <button onClick={() => !busy && setOpen(false)} className="text-muted-foreground" aria-label="Close add memory dialog">
                <X className="h-4 w-4" />
              </button>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="mt-4 block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-primary-foreground"
              disabled={busy}
            />
            <Input
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="A line about the night… (optional)"
              maxLength={280}
              className="mt-3"
              disabled={busy}
            />
            <Button
              className="mt-4 w-full"
              disabled={busy}
              onClick={() => {
                const f = fileRef.current?.files?.[0];
                if (!f) {
                  toast.error("Pick a photo first");
                  return;
                }
                if (f.size > 10 * 1024 * 1024) {
                  toast.error("Photo must be under 10 MB");
                  return;
                }
                setBusy(true);
                mutate.mutate(f);
              }}
            >
              {busy ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Uploading…
                </>
              ) : (
                "Save memory"
              )}
            </Button>
            <p className="mt-2 text-center text-xs text-muted-foreground">+50 XP</p>
          </div>
        </div>
      )}
    </div>
  );
}
