-- Sync log to track API-Football sync history
create table sync_log (
  id uuid primary key default gen_random_uuid(),
  synced_at timestamptz default now(),
  fixtures_fetched integer default 0,
  updated integer default 0,
  locked integer default 0,
  errors text[] default '{}'
);

alter table sync_log enable row level security;

-- Only service role can write; admin can read via service role
-- Public can read the latest sync time
create policy "sync_log_public_read" on sync_log for select using (true);

-- Add api_fixture_id to matches so we can map API-Football IDs directly
alter table matches add column if not exists api_fixture_id integer;
create index if not exists matches_api_fixture_id_idx on matches(api_fixture_id);
