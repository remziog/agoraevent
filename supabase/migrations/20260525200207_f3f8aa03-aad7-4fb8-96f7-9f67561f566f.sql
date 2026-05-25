-- Per-user OAuth tokens for taste integrations
CREATE TABLE public.oauth_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  provider TEXT NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at TIMESTAMPTZ,
  scope TEXT,
  provider_user_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, provider)
);

ALTER TABLE public.oauth_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "oauth_tokens own all"
ON public.oauth_tokens
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER oauth_tokens_touch_updated_at
BEFORE UPDATE ON public.oauth_tokens
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Letterboxd has no OAuth — store username for public RSS scrape
ALTER TABLE public.social_integrations
ADD COLUMN IF NOT EXISTS handle TEXT;