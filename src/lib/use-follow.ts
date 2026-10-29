// Follow / unfollow a community as a real per-user record (community_follows).
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { followCommunity } from "./plans.functions";

/** Follow / unfollow as a real per-user record; every screen that shows it refreshes. */
export function useFollowToggle() {
  const qc = useQueryClient();
  const follow = useServerFn(followCommunity);
  const { t } = useTranslation();
  return useMutation({
    mutationFn: (input: { orgId: string; follow: boolean }) => follow({ data: input }),
    onSuccess: async (res) => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["communities"], refetchType: "all" }),
        qc.invalidateQueries({ queryKey: ["community"], refetchType: "all" }),
      ]);
      toast.success(
        res.following
          ? t("community.followed", "Following — their next gatherings show in My communities")
          : t("community.unfollowed", "Unfollowed"),
      );
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
