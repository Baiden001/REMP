# REMP — Resilience Estate Management Portal

Phase 1 (Foundation) scaffold per the PRD: authentication, database schema, and the
executive dashboard shell. Built with Next.js (App Router) + Supabase, matching the
navy/blue brand from the original prototype.

## What's in this build

- `supabase/schema.sql` — full Postgres schema for every entity in PRD section 10
  (users/roles, projects, units, media, CRM, leads, viewings, sales, payments,
  campaigns, marketing content, documents, notifications, audit log), with Row Level
  Security policies scoped to the six PRD roles (CEO, management, sales, marketing,
  finance, IT).
- `src/app/login` — email/password sign-in against Supabase Auth.
- `src/app/(dashboard)` — protected route group with the sidebar shell and an
  executive dashboard page that reads live counts (active projects, available units,
  new leads, upcoming viewings, revenue) straight from Supabase.
- `src/middleware.ts` — redirects signed-out users away from `/dashboard` and signed-in
  users away from `/login`.

- The visual design (sidebar, topbar, cards, tables) is now ported directly from the
  static prototype's CSS, so it should look like the original mockup.
- `src/app/(dashboard)/projects` — live Projects grid + an "Add project" modal that
  inserts straight into Supabase.
- `src/app/(dashboard)/units` — live Units table and inventory summary.

CRM, Viewings, Sales, Marketing, Documents, and Team pages are still nav links only —
next build pass wires those up the same way Projects and Units were.

## Setup

1. Create a Supabase project.
2. In the Supabase SQL editor, run `supabase/schema.sql` top to bottom.
3. Copy `.env.example` to `.env.local` and fill in your project's URL and anon key
   (Project Settings → API in Supabase).
4. Install dependencies and run locally:
   ```
   npm install
   npm run dev
   ```
5. Create your first user in Supabase Auth (or add a sign-up page), then in the SQL
   editor update their role, e.g.:
   ```sql
   update public.profiles set role = 'ceo' where id = '<user-uuid>';
   ```

> Note: this was hand-built without a live install/test — first `npm run dev` may
> surface a small type or import fix, most likely in the Supabase SSR cookie handling
> if you're on a different Next.js patch version. Flag me the exact error and I'll fix
> it fast.

## Next steps (Phase 1 remainder → Phase 2)

- Build out Projects and Units pages (list + create/edit) against the schema.
- Port the CRM kanban and lead-capture modal from the static prototype, wiring the
  form to insert into `clients` + `leads` instead of local state.
- Viewings calendar backed by the `viewings` table.
- Sales & payments views backed by `sales` + `payments`.
- Storage buckets for `property_media`, `documents`, `marketing_content`.
