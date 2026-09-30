# WAFFAR Team Workspace

Private internal workspace for WAFFAR to coordinate tasks, track team time, and make current work visible.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/waffar-workspace` — React + Vite application
- `artifacts/api-server/src/routes/workspace.ts` — workspace API handlers and development seed
- `lib/api-spec/openapi.yaml` — API contract source of truth
- `lib/db/src/schema/waffar.ts` — Drizzle schema for development PostgreSQL
- `supabase/schema.sql` — Supabase-compatible schema and RLS reference
- `artifacts/waffar-workspace/src/components/workspace.tsx` — reusable workspace UI primitives
- `artifacts/waffar-workspace/src/pages/workspace-pages.tsx` — routed workspace pages

## Architecture decisions

- The web app uses the shared API server and PostgreSQL for a runnable Replit MVP; `supabase/schema.sql` keeps the external Supabase migration path explicit.
- The dashboard reads a single workspace snapshot for fast initial rendering while tasks, comments, activity, and timer mutations use dedicated endpoints and invalidate the relevant React Query caches.
- Time is stored as sessions with a persisted start and end; active sessions are recovered from the database and never rely only on a browser interval.
- The seed runs once on the first workspace request, making the app immediately useful in development without hiding empty-state behavior from real data.

## Product

WAFFAR team members can see current work, create and assign tasks, move tasks through TODO / IN PROGRESS / BLOCKED / DONE, start and stop persistent timers, comment on tasks, and review team activity and workload.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- After changing `lib/api-spec/openapi.yaml`, run API codegen before typechecking the app.
- The API seed is intended for development. Clear the development database before using real team data.
- `DATABASE_URL` is required by the shared Drizzle client.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
