// Bookmarks ("Save" — never an RSVP) as React Query hooks shared by cards,
// detail pages and "My plans". One list query for the ids, one mutation that
// refreshes every screen showing a bookmark.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { listSavedIds, saveItem, unsaveItem, type SavedPlacePayload } from "./plans.functions";

export function useSavedIds() {
  const list = useServerFn(listSavedIds);
  return useQuery({ queryKey: ["saved", "ids"], queryFn: () => list() });
}

export type SaveTarget =
  | { kind: "event"; refId: string }
  | { kind: "place"; refId: string; payload: SavedPlacePayload };

export function useSaveToggle() {
  const qc = useQueryClient();
  const save = useServerFn(saveItem);
  const unsave = useServerFn(unsaveItem);
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async (input: { target: SaveTarget; saved: boolean }) => {
      if (input.saved) {
        await unsave({ data: { kind: input.target.kind, refId: input.target.refId } });
        return { saved: false };
      }
      await save({ data: input.target });
      return { saved: true };
    },
    onSuccess: async (res) => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["saved"], refetchType: "all" }),
        qc.invalidateQueries({ queryKey: ["plans"], refetchType: "all" }),
      ]);
      toast.success(
        res.saved
          ? t("save.added", "Saved to your plans")
          : t("save.removed", "Removed from your plans"),
      );
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
