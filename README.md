# WAFFAR Team Workspace

Private internal workspace for WAFFAR. The MVP keeps team coordination lightweight: a shared dashboard, task management, persistent time tracking, team visibility, activity history, and task comments.

## What is included

- Dashboard with team pulse, workload, activity, and time summaries
- My Tasks and All Tasks views with search, filtering, sorting, and creation
- Task detail drawer with status changes, editing, deletion, comments, and timer controls
- Team directory with current work and activity summaries
- Time Tracking and Activity pages
- Responsive desktop, tablet, and mobile browser layouts
- Seeded development members and tasks
- PostgreSQL persistence through the shared API server
- Supabase-compatible schema and RLS policy reference in `supabase/schema.sql`

## Run locally

```bash
pnpm install
pnpm --filter @workspace/db run push
pnpm --filter @workspace/api-server run dev
pnpm --filter @workspace/waffar-workspace run dev
```

The Replit workflows already provide the required `PORT` and `BASE_PATH` values.

## Environment

Copy `.env.example` when connecting an external Supabase project:

```bash
cp .env.example .env
```

The browser must only receive public Supabase values. Never put a Supabase service-role key in frontend code.

## Data model

The development app uses the workspace PostgreSQL database through Drizzle:

- `profiles`
- `tasks`
- `time_sessions`
- `task_comments`
- `activity_logs`

The equivalent Supabase SQL schema, indexes, and authenticated-user RLS policies are in `supabase/schema.sql`.

## API

The API contract lives in `lib/api-spec/openapi.yaml`. After changing it, regenerate the typed clients:

```bash
pnpm --filter @workspace/api-spec run codegen
```

The main endpoints are:

- `GET /api/workspace`
- `GET|POST /api/tasks`
- `PATCH|DELETE /api/tasks/:taskId`
- `GET|POST /api/tasks/:taskId/comments`
- `POST /api/tasks/:taskId/timer`
- `POST /api/tasks/:taskId/timer/stop`
- `GET /api/activity`

## Quality checks

```bash
pnpm run typecheck
pnpm --filter @workspace/waffar-workspace run build
pnpm --filter @workspace/api-server run build
```

## Seed data

The API seeds three team members, five representative tasks, recent activity, and historical time sessions on the first workspace request. Remove development data from the database before connecting a production workspace.