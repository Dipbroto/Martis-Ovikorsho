-- ==============================================================================
-- MARTIS: SUPABASE SCHEMA (v2 - Full AI Copilot Integration)
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
-- 3b. PROTECT SERVER-MANAGED DATA
-- Clients may only write their own username/avatar. Mission distance is recomputed from the
-- waypoints on the server, and profile stats are maintained by triggers, so nobody can award
-- themselves distance, samples or ranks by sending made-up numbers.
-- ==========================================
revoke update on public.profiles from anon, authenticated;
grant update (username, avatar_url) on public.profiles to authenticated;
revoke insert on public.profiles from anon, authenticated;
grant insert (id, username, avatar_url) on public.profiles to authenticated;

-- Great-circle length of a waypoint list on Mars (km). Waypoints are objects with lat/lon.
create or replace function public.mission_distance_km(points jsonb)
returns numeric
language plpgsql
immutable
set search_path = public
as $$
declare
  total double precision := 0;
  prev_lat double precision;
  prev_lon double precision;
  cur_lat double precision;
  cur_lon double precision;
  h double precision;
  wp jsonb;
begin
  if points is null or jsonb_typeof(points) <> 'array' then
    return 0;
  end if;
  for wp in select value from jsonb_array_elements(points) loop
    cur_lat := radians((wp->>'lat')::double precision);
    cur_lon := radians(coalesce(wp->>'lon', wp->>'lng')::double precision);
    if prev_lat is not null then
      h := sin((cur_lat - prev_lat) / 2) ^ 2 + cos(prev_lat) * cos(cur_lat) * sin((cur_lon - prev_lon) / 2) ^ 2;
      total := total + 2 * 3389.5 * asin(least(1, sqrt(h)));
    end if;
    prev_lat := cur_lat;
    prev_lon := cur_lon;
  end loop;
  return round(total::numeric, 3);
end;
$$;

-- Missions: validate the waypoint list and overwrite the client-supplied distance
create or replace function public.prepare_mission()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if jsonb_typeof(new.waypoints) <> 'array' or jsonb_array_length(new.waypoints) < 2 then
    raise exception 'A mission needs at least two waypoints';
  end if;
  if jsonb_array_length(new.waypoints) > 500 then
    raise exception 'A mission can have at most 500 waypoints';
  end if;
  new.total_distance := public.mission_distance_km(new.waypoints);
  return new;
end;
$$;

drop trigger if exists missions_prepare on public.missions;
create trigger missions_prepare
  before insert or update of waypoints, total_distance on public.missions
  for each row execute procedure public.prepare_mission();

create or replace function public.apply_mission_stats()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op in ('INSERT', 'UPDATE') then
    update public.profiles
      set total_distance_km = greatest(0, coalesce(total_distance_km, 0) + coalesce(new.total_distance, 0)
        - case when tg_op = 'UPDATE' then coalesce(old.total_distance, 0) else 0 end)
      where id = new.user_id;
  elsif tg_op = 'DELETE' then
    update public.profiles
      set total_distance_km = greatest(0, coalesce(total_distance_km, 0) - coalesce(old.total_distance, 0))
      where id = old.user_id;
  end if;
  return null;
end;
$$;

drop trigger if exists missions_stats on public.missions;
create trigger missions_stats
  after insert or update of total_distance or delete on public.missions
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

-- Science logs: let users remove their own entries (the stats trigger keeps counts right)
drop policy if exists "Users can delete own science logs." on public.science_logs;
create policy "Users can delete own science logs." on public.science_logs for delete using (auth.uid() = user_id);

-- Size limits so a single client can't store unbounded text
alter table public.ai_chat_messages drop constraint if exists ai_chat_messages_content_length;
alter table public.ai_chat_messages add constraint ai_chat_messages_content_length check (char_length(content) <= 20000) not valid;
alter table public.missions drop constraint if exists missions_title_length;
alter table public.missions add constraint missions_title_length check (char_length(title) <= 200) not valid;
alter table public.science_logs drop constraint if exists science_logs_notes_length;
alter table public.science_logs add constraint science_logs_notes_length check (notes is null or char_length(notes) <= 2000) not valid;
alter table public.profiles drop constraint if exists profiles_username_length;
alter table public.profiles add constraint profiles_username_length check (username is null or char_length(username) between 2 and 64) not valid;

-- Indexes for the queries the app runs ("my missions / logs / chat, newest first")
create index if not exists missions_user_created_idx on public.missions (user_id, created_at desc);
create index if not exists science_logs_user_discovered_idx on public.science_logs (user_id, discovered_at desc);
create index if not exists ai_chat_messages_user_created_idx on public.ai_chat_messages (user_id, created_at desc);

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
  base_name text := left(coalesce(
    nullif(trim(new.raw_user_meta_data->>'username'), ''),
    'Explorer-' || substr(new.id::text, 1, 6)
  ), 32);
begin
  begin
    insert into public.profiles (id, username, avatar_url)
    values (new.id, base_name, new.raw_user_meta_data->>'avatar_url')
    on conflict (id) do nothing;
  exception when unique_violation then
    -- Username already taken: keep the signup working with a unique callsign
    insert into public.profiles (id, username, avatar_url)
    values (new.id, left(base_name, 24) || '-' || replace(new.id::text, '-', ''), new.raw_user_meta_data->>'avatar_url')
    on conflict (id) do nothing;
  end;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ==========================================
-- 5. BACKFILL
-- Accounts created before the trigger existed have no profile row, which makes every
-- mission / chat / science-log insert fail its foreign key. Create the missing rows.
-- ==========================================
insert into public.profiles (id, username)
select u.id, 'Explorer-' || replace(u.id::text, '-', '')
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id)
on conflict do nothing;

-- Recompute stored mission distances and profile totals with the server-side formula
update public.missions set waypoints = waypoints
where jsonb_typeof(waypoints) = 'array' and jsonb_array_length(waypoints) >= 2;
update public.profiles p set
  total_distance_km = coalesce((select sum(m.total_distance) from public.missions m where m.user_id = p.id), 0),
  samples_collected = (select count(*) from public.science_logs s where s.user_id = p.id);


-- ==============================================================================
-- 6. CREW COMMS & INTER-ASTRONAUT NETWORK (FRIENDSHIPS & DIRECT MESSAGES)
-- ==============================================================================

-- FRIENDSHIPS: Tracks friend requests and established connections between astronauts
create table if not exists public.friendships (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,     -- Initiator of the request
  friend_id uuid references public.profiles(id) on delete cascade not null,   -- Recipient of the request
  status text not null check (status in ('pending', 'accepted', 'declined', 'blocked')) default 'pending',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  constraint unique_friendship_pair unique (user_id, friend_id),
  constraint no_self_friendship check (user_id <> friend_id)
);

-- Ensure any legacy self-friendships are purged and constraint is enforced
delete from public.friendships where user_id = friend_id;
alter table public.friendships drop constraint if exists no_self_friendship;
alter table public.friendships add constraint no_self_friendship check (user_id <> friend_id);

create index if not exists friendships_user_id_idx on public.friendships(user_id);
create index if not exists friendships_friend_id_idx on public.friendships(friend_id);
create index if not exists friendships_status_idx on public.friendships(status);

-- DIRECT_MESSAGES: User-to-user astronaut communications & shared coordinates
create table if not exists public.direct_messages (
  id uuid default gen_random_uuid() primary key,
  sender_id uuid references public.profiles(id) on delete cascade not null,
  receiver_id uuid references public.profiles(id) on delete cascade not null,
  content text not null,
  action_data jsonb, -- e.g. shared waypoint coordinates or traverse route
  read_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  constraint no_self_message check (sender_id <> receiver_id)
);

create index if not exists direct_messages_conversation_idx on public.direct_messages(sender_id, receiver_id, created_at desc);
create index if not exists direct_messages_receiver_unread_idx on public.direct_messages(receiver_id, read_at) where read_at is null;

-- RLS FOR FRIENDSHIPS
alter table public.friendships enable row level security;

drop policy if exists "Users can view their own friendships" on public.friendships;
create policy "Users can view their own friendships" on public.friendships 
  for select using (auth.uid() = user_id or auth.uid() = friend_id);

drop policy if exists "Users can send friend requests" on public.friendships;
create policy "Users can send friend requests" on public.friendships 
  for insert with check (auth.uid() = user_id);

-- Only the person a request was sent to can answer it (accept / decline / block): the sender cannot
-- accept their own request, and nobody can move a friendship to someone else. Only the status changes.
drop policy if exists "Users can update their friendship status" on public.friendships;
drop policy if exists "Recipients can answer friend requests" on public.friendships;
create policy "Recipients can answer friend requests" on public.friendships
  for update using (auth.uid() = friend_id) with check (auth.uid() = friend_id);
revoke update on public.friendships from anon, authenticated;
grant update (status, updated_at) on public.friendships to authenticated;

drop policy if exists "Users can delete their friendships" on public.friendships;
create policy "Users can delete their friendships" on public.friendships 
  for delete using (auth.uid() = user_id or auth.uid() = friend_id);

-- RLS FOR DIRECT MESSAGES
alter table public.direct_messages enable row level security;

drop policy if exists "Users can read their direct messages" on public.direct_messages;
create policy "Users can read their direct messages" on public.direct_messages 
  for select using (auth.uid() = sender_id or auth.uid() = receiver_id);

-- Messages go only to accepted crewmates, sent as yourself
drop policy if exists "Users can insert direct messages as sender" on public.direct_messages;
create policy "Users can insert direct messages as sender" on public.direct_messages
  for insert with check (
    auth.uid() = sender_id
    and exists (
      select 1 from public.friendships f
      where f.status = 'accepted'
        and ((f.user_id = sender_id and f.friend_id = receiver_id) or (f.user_id = receiver_id and f.friend_id = sender_id))
    )
  );

-- The recipient may only mark a message as read: the text and the sender cannot be changed
drop policy if exists "Recipients can update read_at" on public.direct_messages;
create policy "Recipients can update read_at" on public.direct_messages
  for update using (auth.uid() = receiver_id) with check (auth.uid() = receiver_id);
revoke update on public.direct_messages from anon, authenticated;
grant update (read_at) on public.direct_messages to authenticated;
alter table public.direct_messages drop constraint if exists direct_messages_content_length;
alter table public.direct_messages add constraint direct_messages_content_length check (char_length(content) <= 4000) not valid;

-- ENABLE REALTIME REPLICATION FOR INSTANT CHAT & REQUESTS
do $$
begin
  if not exists (
    select 1 from pg_publication_tables 
    where pubname = 'supabase_realtime' and tablename = 'friendships'
  ) then
    alter publication supabase_realtime add table public.friendships;
  end if;

  if not exists (
    select 1 from pg_publication_tables 
    where pubname = 'supabase_realtime' and tablename = 'direct_messages'
  ) then
    alter publication supabase_realtime add table public.direct_messages;
  end if;
end $$;
