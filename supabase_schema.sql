-- ==============================================================================
-- MARSWALK EXPLORER: SUPABASE SCHEMA (v2 - Full AI Copilot Integration)
-- Copy and paste this entirely into your Supabase SQL Editor and hit "Run"
-- ==============================================================================

-- 1. Enable UUID extension
create extension if not exists "uuid-ossp";

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
  id uuid default uuid_generate_v4() primary key,
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
  id uuid default uuid_generate_v4() primary key,
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
  id uuid default uuid_generate_v4() primary key,
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
-- 4. AUTOMATIC AUTH TRIGGER
-- Automatically creates a profile row when a new user signs up
-- ==========================================
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username, avatar_url)
  values (
    new.id, 
    coalesce(new.raw_user_meta_data->>'username', 'Explorer-' || substr(new.id::text, 1, 6)), 
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
