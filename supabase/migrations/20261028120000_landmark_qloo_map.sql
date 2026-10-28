-- Qloo entity mapping for Agora's curated Istanbul landmarks.
--
-- Filled at runtime by the server (src/lib/qloo-landmarks.server.ts): each
-- landmark is looked up once with Qloo /search, the candidate is accepted only
-- when its name matches and its address/geocode places it in Istanbul, and the
-- result is cached here. Qloo identifiers and responses live in the database,
-- not in the (public) repository.
--
-- RLS is on with no policies: only the service role (server) reads and writes.
create table if not exists public.landmark_qloo_map (
  landmark_id text primary key,
  entity_id text,
  entity_name text,
  entity_address text,
  confidence text not null check (confidence in ('exact', 'likely', 'none')),
  note text,
  candidates jsonb not null default '[]'::jsonb,
  resolved_at timestamptz not null default now()
);

alter table public.landmark_qloo_map enable row level security;
