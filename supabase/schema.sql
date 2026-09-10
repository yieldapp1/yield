-- Yield: saved profiles (balances + trip preferences)
--
-- Run this once in your Supabase project's SQL Editor
-- (Project -> SQL Editor -> New query -> paste -> Run).
--
-- One row per signed-in user, holding whatever they last saved. Row Level
-- Security ensures a user can only ever read or write their own row --
-- there is no policy allowing access to anyone else's data, and no
-- server-side code path that bypasses it either (the app only ever uses
-- the public "anon" key, which is subject to these policies).

create table if not exists public.saved_profiles (
  user_id         uuid primary key references auth.users(id) on delete cascade,
  balances        jsonb not null default '{}'::jsonb,
  cabin_pref      text,
  origin_city     jsonb,
  destination_city jsonb,
  updated_at      timestamptz not null default now()
);

alter table public.saved_profiles enable row level security;

create policy "Users can view their own profile"
  on public.saved_profiles for select
  using (auth.uid() = user_id);

create policy "Users can insert their own profile"
  on public.saved_profiles for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own profile"
  on public.saved_profiles for update
  using (auth.uid() = user_id);

-- Optional but recommended while testing: Supabase requires email
-- confirmation by default, which means signUp() won't return a session
-- (and the app will ask the user to check their email) until they click
-- the confirmation link. To skip that during testing:
--   Authentication -> Providers -> Email -> turn off "Confirm email"
-- Turn it back on before letting real users sign up.
