
-- 1. Fix oauth_tokens: add explicit UPDATE policy with WITH CHECK
DROP POLICY IF EXISTS "oauth_tokens own all" ON public.oauth_tokens;

CREATE POLICY "oauth_tokens own select" ON public.oauth_tokens
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "oauth_tokens own insert" ON public.oauth_tokens
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "oauth_tokens own update" ON public.oauth_tokens
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "oauth_tokens own delete" ON public.oauth_tokens
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 2. Memories storage bucket: add UPDATE policy and restrict listing to own folder
DROP POLICY IF EXISTS "memories read auth" ON storage.objects;
DROP POLICY IF EXISTS "memories public read" ON storage.objects;
DROP POLICY IF EXISTS "memories select" ON storage.objects;

CREATE POLICY "memories own update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'memories' AND (auth.uid())::text = (storage.foldername(name))[1])
  WITH CHECK (bucket_id = 'memories' AND (auth.uid())::text = (storage.foldername(name))[1]);

-- Restrict listing/SELECT through the API to own folder; public URLs still serve files
-- because the bucket is public (object retrieval via public URL bypasses RLS).
CREATE POLICY "memories own list"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'memories' AND (auth.uid())::text = (storage.foldername(name))[1]);
