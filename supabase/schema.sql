-- Kaveri — Supabase schema
--
-- Run this once in your Supabase project's SQL editor (Database > SQL Editor
-- > New query) after creating the project. Then copy the project's URL and
-- anon public key into js/config.js.
--
-- Design, on purpose:
--   - `profiles` holds each user's own data and is locked to owner-only
--     access (RLS). Nobody but you can read your origin/destination.
--   - `quest_completions` is one row per completed quest, also owner-only —
--     nobody else can see *which* quests you've done.
--   - The `leaderboard` view exposes only name + total_points to everyone
--     (including anonymous visitors), which is the minimum needed for a
--     leaderboard and nothing more. Views in Supabase run with the definer's
--     privileges by default, so this view can read every row of `profiles`
--     while `profiles` itself stays locked down — that's intentional, not a
--     hole.
--   - `total_points` is kept in sync automatically by a trigger, so the
--     client never has to (and can't) write its own score.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null,
  origin text,
  destination text,
  total_points integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "Users can view their own profile" on public.profiles;
create policy "Users can view their own profile"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "Users can insert their own profile" on public.profiles;
create policy "Users can insert their own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

create table if not exists public.quest_completions (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  quest_key text not null,
  quest_category text not null check (quest_category in ('legal', 'social', 'cultural', 'food')),
  points integer not null check (points >= 0),
  completed_at timestamptz not null default now(),
  unique (user_id, quest_key)
);

alter table public.quest_completions enable row level security;

drop policy if exists "Users can view their own quest completions" on public.quest_completions;
create policy "Users can view their own quest completions"
  on public.quest_completions for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own quest completions" on public.quest_completions;
create policy "Users can insert their own quest completions"
  on public.quest_completions for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own quest completions" on public.quest_completions;
create policy "Users can delete their own quest completions"
  on public.quest_completions for delete
  using (auth.uid() = user_id);

-- Keeps profiles.total_points equal to the sum of that user's completed
-- quest points, so the client never computes or writes its own score.
create or replace function public.recalc_total_points()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
    set total_points = (
      select coalesce(sum(points), 0)
      from public.quest_completions
      where user_id = coalesce(new.user_id, old.user_id)
    )
    where id = coalesce(new.user_id, old.user_id);
  return null;
end;
$$;

drop trigger if exists quest_completions_points_sync on public.quest_completions;
create trigger quest_completions_points_sync
  after insert or delete on public.quest_completions
  for each row execute function public.recalc_total_points();

-- Public leaderboard: name + score only, nothing private.
drop view if exists public.leaderboard;
create view public.leaderboard as
  select id, name, total_points
  from public.profiles
  order by total_points desc, name asc;

grant select on public.leaderboard to anon, authenticated;
