-- ==============================================================================
-- MARSWALK EXPLORER: SUPABASE SCHEMA (v2 - Full AI Copilot Integration)
-- Copy and paste this entirely into your Supabase SQL Editor and hit "Run"
-- ==============================================================================

-- 1. (UUIDs use the built-in gen_random_uuid(), so no extension is required)

-- ==========================================
-- 2. CREATE TABLES
-- ==========================================

-- PROFILES: Stores personalized astronaut data, gamification ranks, and stats
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade not null primary key,
  username text unique,
  avatar_url text,
  rank text default 'Trainee Explorer',
  total_distance_km numeric default 0,
  samples_collected integer default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- MISSIONS: Stores saved EVA routes (waypoints). 
create table if not exists public.missions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  title text not null,
  description text,
  waypoints jsonb not null, -- Stores the Lat/Lon arrays
  total_distance numeric,
  estimated_duration_hours numeric,
  is_public boolean default false, -- Allow users to publish routes to a community board
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- SCIENCE_LOGS: Tracks the samples hermetically sealed in the Science Lab
create table if not exists public.science_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  target_id text not null,
  target_name text not null,
  mineralogy text,
  ph_level numeric,
  notes text,
  discovered_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- AI_CHAT_MESSAGES: Stores conversation history with A.R.E.S. Autonomous Copilot
create table if not exists public.ai_chat_messages (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  role text not null check (role in ('user', 'model', 'system')),
  content text not null,
  action_data jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ==========================================
-- 3. ROW LEVEL SECURITY (RLS) POLICIES
-- ==========================================

alter table public.profiles enable row level security;
alter table public.missions enable row level security;
alter table public.science_logs enable row level security;
alter table public.ai_chat_messages enable row level security;

-- Profiles: Anyone can view, only the user can update their own profile
drop policy if exists "Public profiles are viewable by everyone." on public.profiles;
create policy "Public profiles are viewable by everyone." on public.profiles for select using (true);

drop policy if exists "Users can insert their own profile." on public.profiles;
create policy "Users can insert their own profile." on public.profiles for insert with check (auth.uid() = id);

drop policy if exists "Users can update own profile." on public.profiles;
create policy "Users can update own profile." on public.profiles for update using (auth.uid() = id);

-- Missions: You can see your own missions, OR missions others have marked 'is_public'
drop policy if exists "Missions are viewable by owner or if public." on public.missions;
create policy "Missions are viewable by owner or if public." on public.missions for select using (auth.uid() = user_id or is_public = true);

drop policy if exists "Users can create missions." on public.missions;
create policy "Users can create missions." on public.missions for insert with check (auth.uid() = user_id);

drop policy if exists "Users can update own missions." on public.missions;
create policy "Users can update own missions." on public.missions for update using (auth.uid() = user_id);

drop policy if exists "Users can delete own missions." on public.missions;
create policy "Users can delete own missions." on public.missions for delete using (auth.uid() = user_id);

-- Science Logs: Strictly private to the user
drop policy if exists "Science logs viewable by owner." on public.science_logs;
create policy "Science logs viewable by owner." on public.science_logs for select using (auth.uid() = user_id);

drop policy if exists "Users can create science logs." on public.science_logs;
create policy "Users can create science logs." on public.science_logs for insert with check (auth.uid() = user_id);

drop policy if exists "Users can update own science logs." on public.science_logs;
create policy "Users can update own science logs." on public.science_logs for update using (auth.uid() = user_id);

-- AI Chat Messages: Strictly private to the user
drop policy if exists "Chat messages viewable by owner." on public.ai_chat_messages;
create policy "Chat messages viewable by owner." on public.ai_chat_messages for select using (auth.uid() = user_id);

drop policy if exists "Users can insert chat messages." on public.ai_chat_messages;
create policy "Users can insert chat messages." on public.ai_chat_messages for insert with check (auth.uid() = user_id);

drop policy if exists "Users can delete own chat messages." on public.ai_chat_messages;
create policy "Users can delete own chat messages." on public.ai_chat_messages for delete using (auth.uid() = user_id);

-- ==========================================
-- 3b. PROTECT SERVER-MANAGED PROFILE COLUMNS
-- Clients may only edit their own username/avatar. Rank and stats are written by the
-- triggers below, so users can't award themselves distance, samples or ranks.
-- ==========================================
revoke update on public.profiles from anon, authenticated;
grant update (username, avatar_url) on public.profiles to authenticated;

create or replace function public.apply_mission_stats()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.profiles
      set total_distance_km = coalesce(total_distance_km, 0) + round(coalesce(new.total_distance, 0))
      where id = new.user_id;
  elsif tg_op = 'DELETE' then
    update public.profiles
      set total_distance_km = greatest(0, coalesce(total_distance_km, 0) - round(coalesce(old.total_distance, 0)))
      where id = old.user_id;
  end if;
  return null;
end;
$$;

drop trigger if exists missions_stats on public.missions;
create trigger missions_stats
  after insert or delete on public.missions
  for each row execute procedure public.apply_mission_stats();

create or replace function public.apply_science_stats()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.profiles
      set samples_collected = coalesce(samples_collected, 0) + 1
      where id = new.user_id;
  elsif tg_op = 'DELETE' then
    update public.profiles
      set samples_collected = greatest(0, coalesce(samples_collected, 0) - 1)
      where id = old.user_id;
  end if;
  return null;
end;
$$;

drop trigger if exists science_logs_stats on public.science_logs;
create trigger science_logs_stats
  after insert or delete on public.science_logs
  for each row execute procedure public.apply_science_stats();

-- ==========================================
-- 4. AUTOMATIC AUTH TRIGGER
-- Automatically creates a profile row when a new user signs up
-- ==========================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base_name text := coalesce(
    nullif(trim(new.raw_user_meta_data->>'username'), ''),
    'Explorer-' || substr(new.id::text, 1, 6)
  );
begin
  begin
    insert into public.profiles (id, username, avatar_url)
    values (new.id, base_name, new.raw_user_meta_data->>'avatar_url')
    on conflict (id) do nothing;
  exception when unique_violation then
    -- Username already taken: keep the signup working by making the callsign unique
    insert into public.profiles (id, username, avatar_url)
    values (new.id, base_name || '-' || substr(new.id::text, 1, 4), new.raw_user_meta_data->>'avatar_url')
    on conflict (id) do nothing;
  end;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
