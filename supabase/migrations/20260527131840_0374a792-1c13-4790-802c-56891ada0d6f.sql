CREATE POLICY "prompts own update" ON public.prompts FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "prompts own delete" ON public.prompts FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "users delete own roles" ON public.user_roles FOR DELETE TO authenticated USING (auth.uid() = user_id);