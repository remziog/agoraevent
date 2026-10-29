-- "Save" is not "RSVP" (29 Oct scope). A saved gathering or place is a private
-- bookmark: it never appears in an organiser's attendee list, never counts in
-- the calendar and never awards XP. RSVPs stay in `rsvps`; the two are read and
-- written on separate paths, so removing one never cancels the other.
create table if not exists public.saved_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  -- 'event': ref_id is an events.id; 'place': ref_id is a Qloo entity id (never stored in the repo).
  kind text not null check (kind in ('event', 'place')),
  ref_id text not null,
  -- Snapshot for places (name, district, address, rating…) so the plan survives
  -- a Qloo outage; empty for events, which are read live.
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, kind, ref_id)
);

alter table public.saved_items enable row level security;

drop policy if exists "saved own select" on public.saved_items;
create policy "saved own select" on public.saved_items
  for select using (auth.uid() = user_id);
drop policy if exists "saved own insert" on public.saved_items;
create policy "saved own insert" on public.saved_items
  for insert with check (auth.uid() = user_id);
drop policy if exists "saved own delete" on public.saved_items;
create policy "saved own delete" on public.saved_items
  for delete using (auth.uid() = user_id);

create index if not exists saved_items_user_idx on public.saved_items (user_id, created_at desc);

-- Following a community is a real per-user record (not inferred from RSVPs),
-- with unfollow as a delete.
create table if not exists public.community_follows (
  user_id uuid not null,
  org_id uuid not null references public.organizations (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, org_id)
);

alter table public.community_follows enable row level security;

drop policy if exists "follow own select" on public.community_follows;
create policy "follow own select" on public.community_follows
  for select using (auth.uid() = user_id);
drop policy if exists "follow own insert" on public.community_follows;
create policy "follow own insert" on public.community_follows
  for insert with check (auth.uid() = user_id);
drop policy if exists "follow own delete" on public.community_follows;
create policy "follow own delete" on public.community_follows
  for delete using (auth.uid() = user_id);
