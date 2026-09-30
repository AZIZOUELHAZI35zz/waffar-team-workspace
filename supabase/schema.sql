-- WAFFAR Team Workspace schema for Supabase PostgreSQL.
-- Run this in the Supabase SQL editor after enabling email/password Auth.

create extension if not exists "pgcrypto";

-- Workspaces table (for team isolation with invite codes)
create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null unique,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

-- Default workspace
insert into public.workspaces (id, name, code)
values ('00000000-0000-0000-0000-000000000001', 'WAFFAR Main Workspace', 'WAFFAR-MAIN')
on conflict (code) do nothing;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  workspace_id uuid references public.workspaces(id),
  full_name text not null,
  email text not null unique,
  avatar_url text,
  avatar_initials text not null,
  role text not null,
  department text not null check (department in ('CEO','CTO','CMO','CFO','Operations','Product','Marketing','Sales','Other')),
  status text not null default 'offline' check (status in ('working','online','offline')),
  created_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id),
  title text not null,
  description text not null default '',
  status text not null default 'todo' check (status in ('todo','in_progress','blocked','done')),
  priority text not null default 'medium' check (priority in ('low','medium','high','urgent')),
  assignee_id uuid not null references public.profiles(id),
  creator_id uuid not null references public.profiles(id),
  department text not null,
  due_date date,
  created_at timestamptz not null default now()
);

create table if not exists public.time_sessions (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  duration_seconds integer not null default 0 check (duration_seconds >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  content text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id),
  user_id uuid not null references public.profiles(id),
  task_id uuid references public.tasks(id) on delete cascade,
  action text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Chat Channels & Messages
create table if not exists public.chat_channels (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  description text default '',
  created_at timestamptz not null default now()
);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.chat_channels(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);

-- Meeting Rooms & Participants
create table if not exists public.meeting_rooms (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  title text not null,
  description text default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.meeting_participants (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.meeting_rooms(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  is_muted boolean not null default false,
  is_video_on boolean not null default false,
  is_screen_sharing boolean not null default false,
  joined_at timestamptz not null default now(),
  constraint meeting_room_user_uniq unique (room_id, user_id)
);

-- Seed default channels and rooms
insert into public.chat_channels (workspace_id, name, description)
values 
  ('00000000-0000-0000-0000-000000000001', 'general', 'Company-wide workroom chatter & announcements'),
  ('00000000-0000-0000-0000-000000000001', 'engineering', 'Product architecture, technical sync & bugs'),
  ('00000000-0000-0000-0000-000000000001', 'growth-marketing', 'Campaigns, merchant acquisition & traction')
on conflict do nothing;

insert into public.meeting_rooms (workspace_id, title, description)
values
  ('00000000-0000-0000-0000-000000000001', 'Daily Standup & Sync', '15-min daily updates on what moved today'),
  ('00000000-0000-0000-0000-000000000001', 'Product & Design Review', 'Figma walkthroughs and user story discussions'),
  ('00000000-0000-0000-0000-000000000001', 'Open Lounge / Coworking', 'Drop in anytime with mic or camera on')
on conflict do nothing;

create index if not exists tasks_assignee_id_idx on public.tasks(assignee_id);
create index if not exists tasks_status_idx on public.tasks(status);
create index if not exists time_sessions_task_id_idx on public.time_sessions(task_id);
create index if not exists time_sessions_user_id_idx on public.time_sessions(user_id);
create index if not exists activity_logs_created_at_idx on public.activity_logs(created_at desc);
create index if not exists task_comments_task_id_idx on public.task_comments(task_id);

alter table public.profiles enable row level security;
alter table public.tasks enable row level security;
alter table public.time_sessions enable row level security;
alter table public.task_comments enable row level security;
alter table public.activity_logs enable row level security;

create or replace function public.is_ceo()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and department = 'CEO'
  );
$$;

create policy "authenticated users can read profiles"
  on public.profiles for select to authenticated using (true);
create policy "users can update own profile"
  on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
create policy "users can insert own profile"
  on public.profiles for insert to authenticated
  with check (id = auth.uid());
create policy "ceo can manage profiles"
  on public.profiles for all to authenticated
  using (public.is_ceo()) with check (public.is_ceo());

create policy "authenticated users can read tasks"
  on public.tasks for select to authenticated using (true);
create policy "authenticated users can create tasks"
  on public.tasks for insert to authenticated with check (creator_id = auth.uid());
create policy "assignees and creators can update tasks"
  on public.tasks for update to authenticated
  using (assignee_id = auth.uid() or creator_id = auth.uid() or public.is_ceo())
  with check (assignee_id = auth.uid() or creator_id = auth.uid() or public.is_ceo());
create policy "creators and ceo can delete tasks"
  on public.tasks for delete to authenticated
  using (creator_id = auth.uid() or public.is_ceo());

create policy "authenticated users can read time sessions"
  on public.time_sessions for select to authenticated using (true);
create policy "users can start their own sessions"
  on public.time_sessions for insert to authenticated with check (user_id = auth.uid());
create policy "users can stop their own sessions"
  on public.time_sessions for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "authenticated users can read comments"
  on public.task_comments for select to authenticated using (true);
create policy "users can add comments"
  on public.task_comments for insert to authenticated with check (user_id = auth.uid());

create policy "authenticated users can read activity"
  on public.activity_logs for select to authenticated using (true);
create policy "users can write activity"
  on public.activity_logs for insert to authenticated with check (user_id = auth.uid());

-- Trigger to automatically create a profile when a new user signs up in auth.users
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  user_full_name text;
  user_initials text;
  user_role text;
  user_dept text;
begin
  user_full_name := coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1));
  user_initials := upper(substring(user_full_name from 1 for 2));
  user_role := coalesce(new.raw_user_meta_data->>'role', 'Member');
  user_dept := coalesce(new.raw_user_meta_data->>'department', 'Other');

  insert into public.profiles (id, full_name, email, avatar_url, avatar_initials, role, department, status)
  values (
    new.id,
    user_full_name,
    new.email,
    new.raw_user_meta_data->>'avatar_url',
    user_initials,
    user_role,
    user_dept,
    'online'
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = coalesce(excluded.full_name, public.profiles.full_name);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Enable RLS on new tables
alter table public.workspaces enable row level security;
alter table public.chat_channels enable row level security;
alter table public.chat_messages enable row level security;
alter table public.meeting_rooms enable row level security;
alter table public.meeting_participants enable row level security;

create policy "authenticated users can read workspaces"
  on public.workspaces for select to authenticated using (true);
create policy "authenticated users can create workspaces"
  on public.workspaces for insert to authenticated with check (true);
create policy "workspace creator can update workspaces"
  on public.workspaces for update to authenticated using (created_by = auth.uid() or public.is_ceo());

create policy "authenticated users can read channels"
  on public.chat_channels for select to authenticated using (true);
create policy "authenticated users can create channels"
  on public.chat_channels for insert to authenticated with check (true);

create policy "authenticated users can read messages"
  on public.chat_messages for select to authenticated using (true);
create policy "authenticated users can send messages"
  on public.chat_messages for insert to authenticated with check (user_id = auth.uid());

create policy "authenticated users can read meeting rooms"
  on public.meeting_rooms for select to authenticated using (true);
create policy "authenticated users can create meeting rooms"
  on public.meeting_rooms for insert to authenticated with check (true);

create policy "authenticated users can read participants"
  on public.meeting_participants for select to authenticated using (true);
create policy "users can join meetings"
  on public.meeting_participants for insert to authenticated with check (user_id = auth.uid());
create policy "users can update meeting presence"
  on public.meeting_participants for update to authenticated using (user_id = auth.uid());
create policy "users can leave meetings"
  on public.meeting_participants for delete to authenticated using (user_id = auth.uid());

-- Enable Realtime subscriptions for all tables
do $$
begin
  alter publication supabase_realtime add table public.profiles;
exception when others then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.tasks;
exception when others then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.time_sessions;
exception when others then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.task_comments;
exception when others then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.activity_logs;
exception when others then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.workspaces;
exception when others then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.chat_channels;
exception when others then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.chat_messages;
exception when others then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.meeting_rooms;
exception when others then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.meeting_participants;
exception when others then null;
end $$;

-- Sync any existing users from auth.users into public.profiles
insert into public.profiles (id, full_name, email, avatar_initials, role, department, status, workspace_id)
select 
  id,
  coalesce(raw_user_meta_data->>'full_name', split_part(email, '@', 1)),
  email,
  upper(substring(coalesce(raw_user_meta_data->>'full_name', split_part(email, '@', 1)) from 1 for 2)),
  coalesce(raw_user_meta_data->>'role', 'CEO'),
  'CEO',
  'online',
  '00000000-0000-0000-0000-000000000001'
from auth.users
on conflict (id) do nothing;