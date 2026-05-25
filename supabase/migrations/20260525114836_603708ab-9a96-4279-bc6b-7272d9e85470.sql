DROP POLICY IF EXISTS "users insert own roles" ON public.user_roles;

CREATE POLICY "users self-insert member role only"
  ON public.user_roles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id AND role = 'member'::public.app_role);