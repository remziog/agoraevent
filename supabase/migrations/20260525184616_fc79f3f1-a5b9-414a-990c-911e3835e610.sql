
-- Event memories (photo uploads tied to an event a user attended)
CREATE TABLE public.event_memories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  event_id uuid NOT NULL,
  photo_url text NOT NULL,
  caption text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_event_memories_event ON public.event_memories(event_id);
CREATE INDEX idx_event_memories_user ON public.event_memories(user_id);
ALTER TABLE public.event_memories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "memories read auth" ON public.event_memories
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "memories own insert" ON public.event_memories
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "memories own delete" ON public.event_memories
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Badges earned
CREATE TABLE public.user_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  badge_code text NOT NULL,
  earned_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, badge_code)
);
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "badges read auth" ON public.user_badges
  FOR SELECT TO authenticated USING (true);

-- User gamification stats
CREATE TABLE public.user_stats (
  user_id uuid PRIMARY KEY,
  xp integer NOT NULL DEFAULT 0,
  level integer NOT NULL DEFAULT 1,
  current_streak integer NOT NULL DEFAULT 0,
  longest_streak integer NOT NULL DEFAULT 0,
  last_event_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.user_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "stats read auth" ON public.user_stats
  FOR SELECT TO authenticated USING (true);

-- Storage bucket for memory photos (public read)
INSERT INTO storage.buckets (id, name, public) VALUES ('memories', 'memories', true);

CREATE POLICY "memory photos public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'memories');

CREATE POLICY "users upload own memory photos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'memories' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "users delete own memory photos"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'memories' AND auth.uid()::text = (storage.foldername(name))[1]);
