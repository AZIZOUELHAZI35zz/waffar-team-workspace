-- Add workspace_id to tasks
alter table public.tasks
  add column if not exists workspace_id uuid references public.workspaces(id);

-- Add workspace_id to activity_logs
alter table public.activity_logs
  add column if not exists workspace_id uuid references public.workspaces(id);

-- Backfill all existing rows to the default workspace
update public.tasks
  set workspace_id = '00000000-0000-0000-0000-000000000001'
  where workspace_id is null;

update public.activity_logs
  set workspace_id = '00000000-0000-0000-0000-000000000001'
  where workspace_id is null;

-- Indexes
create index if not exists tasks_workspace_id_idx on public.tasks(workspace_id);
create index if not exists activity_logs_workspace_id_idx on public.activity_logs(workspace_id);

-- Profile stats columns
alter table public.profiles
  add column if not exists tasks_completed integer not null default 0;
alter table public.profiles
  add column if not exists tasks_in_progress integer not null default 0;
alter table public.profiles
  add column if not exists time_today_seconds integer not null default 0;
alter table public.profiles
  add column if not exists time_week_seconds integer not null default 0;

select 'Done' as status;
