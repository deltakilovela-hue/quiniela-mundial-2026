-- Enable UUID extension
create extension if not exists "pgcrypto";

-- Participants
create table participants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  pin text not null, -- 4-digit PIN stored as plain text (low-stakes family app)
  created_at timestamptz default now()
);

-- Matches
create table matches (
  id text primary key, -- e.g. 'A1', 'B3'
  "group" text not null,
  match_date timestamptz not null,
  home_team text not null,
  away_team text not null,
  home_flag text default '',
  away_flag text default '',
  home_goals_real integer,
  away_goals_real integer,
  is_locked boolean default false,
  created_at timestamptz default now()
);

-- Predictions
create table predictions (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid references participants(id) on delete cascade,
  match_id text references matches(id) on delete cascade,
  home_goals integer not null,
  away_goals integer not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(participant_id, match_id)
);

-- RLS policies
alter table participants enable row level security;
alter table matches enable row level security;
alter table predictions enable row level security;

-- Matches: public read
create policy "matches_public_read" on matches for select using (true);

-- Participants: public read
create policy "participants_public_read" on participants for select using (true);

-- Predictions: public read
create policy "predictions_public_read" on predictions for select using (true);

-- Predictions: insert/update by anyone (PIN validation in app layer)
create policy "predictions_insert" on predictions for insert with check (true);
create policy "predictions_update" on predictions for update using (true);

-- Admin can do everything via service role (bypasses RLS)
