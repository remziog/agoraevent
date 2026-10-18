-- Product decision (2026-10-18): any member can host. The organizer role was
-- never granted anywhere and no RLS policy referenced has_role(); organizations
-- and events are protected by owner_id = auth.uid() instead. Remove the dead
-- role machinery so it can't be mistaken for an access control.
--
-- NOTE: this file is not applied automatically by a GitHub merge — run it via
-- Lovable Cloud (Database → run migration) or `supabase db push`. The app code
-- no longer references user_roles/has_role, so it works either way.

DROP POLICY IF EXISTS "users view own roles" ON public.user_roles;
DROP POLICY IF EXISTS "users self-insert member role only" ON public.user_roles;
DROP POLICY IF EXISTS "users delete own roles" ON public.user_roles;

DROP FUNCTION IF EXISTS public.has_role(UUID, public.app_role);
DROP TABLE IF EXISTS public.user_roles;
DROP TYPE IF EXISTS public.app_role;
