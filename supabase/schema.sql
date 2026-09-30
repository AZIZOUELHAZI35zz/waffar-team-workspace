-- WAFFAR Team Workspace schema for Supabase PostgreSQL.
-- Run this in the Supabase SQL editor after enabling email/password Auth.

create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
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
  user_id uuid not null references public.profiles(id),
  task_id uuid references public.tasks(id) on delete cascade,
  action text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

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
create policy "ceo can manage profiles"
  on public.profiles for all to authenticated
  using (public.is_ceo()) with check (public.is_ceo());

create policy "authenticated users can read tasks"
  on public.tasks for select to authenticated using (true);
create policy "authenticated users can create tasks"
  on public.tasks for insert to authenticated with check (creator_id = auth.uid());
create policy "assignees can update tasks"
  on public.tasks for update to authenticated
  using (assignee_id = auth.uid() or creator_id = auth.uid() or public.is_ceo())
  with check (assignee_id = auth.uid() or creator_id = auth.uid() or public.is_ceo());
create policy "ceo can delete tasks"
  on public.tasks for delete to authenticated using (public.is_ceo());

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