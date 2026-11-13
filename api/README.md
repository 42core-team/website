# API Service

Main backend API service for the CORE game website.

## Overview

This NestJS service serves as the primary backend, handling:

- User authentication and management
- Team and event/tournament management
- Match results and statistics
- Database operations (PostgreSQL)
- RabbitMQ microservice communication

## Getting Started

### Prerequisites

Use Node.js 26 or newer. TypeScript stays on the 6.0 release line because the
Nest CLI, ts-jest, and typescript-eslint require its JavaScript compiler API.

Install pnpm:

```bash
corepack enable && corepack prepare pnpm@latest --activate
```

or

```bash
brew install pnpm
```

### Installation & Setup

1. Install dependencies:

   ```bash
   pnpm install
   ```

2. Set up environment variables:

   ```bash
   cp .env.example .env
   ```

   Edit `.env.local` with your configuration (see [Environment Variables](#environment-variables) below).

3. Run database migrations:

   ```bash
   pnpm migration:run-local
   ```

4. Run development server:

   ```bash
   pnpm start:dev
   ```

### Production

- **Build:** `pnpm build`
- **Start:** `pnpm start:prod`

## Session concurrency tests

`pnpm test` runs the unit and HTTP tests. To also run the PostgreSQL session
race regression tests, provide `SESSION_TEST_DATABASE_URL` pointing at a test
PostgreSQL database. The suite creates and drops its own randomly named schema;
it needs permission to create schemas. CI runs these tests against PostgreSQL 17.

```bash
SESSION_TEST_DATABASE_URL=postgresql://postgres:session-tests@localhost:55439/postgres pnpm test --runInBand
```

The tests overlap rotation with logout, logout-all and reuse detection, and
verify that concurrent refreshes share one successor and failed rotations roll
back. They also overlap an old GitHub grant check with a new login to ensure
the new session survives. They are skipped when the test database URL is absent.

## Environment Variables

### Database (Required)

- `DB_HOST` - PostgreSQL host
- `DB_PORT` - PostgreSQL port
- `DB_USER` - Database username
- `DB_PASSWORD` - Database password
- `DB_NAME` - Database name
- `DB_SCHEMA` - Database schema
- `DB_URL` - Alternative database connection URL overwrites the other database connection variables
- `DB_SSL_REQUIRED` - Enable SSL connection (true/false)

### External Services (Required)

- `RABBITMQ_URL` - RabbitMQ connection URL
- `API_SECRET_ENCRYPTION_KEY` - Key for encrypting sensitive data

### Optional

- `PORT` - Server port (default: 4000)
- `NODE_ENV` - Environment (development/production)

## Database Management

### Migrations

- **Generate:** `pnpm migration:generate migration_name`
  Compares your current TypeScript entities with the database and automatically generates the necessary SQL (e.g., adding or removing columns). **Use this for most schema changes.**
- **Create:** `pnpm migration:create migration_name`
  Creates an empty migration template. **Use this only for manual SQL changes** (e.g., seeding data, creating complex views, or custom indexes) that TypeORM cannot detect automatically.
- **Run:** `pnpm migration:run-local` (local) / `pnpm migration:run` (production)
- **Revert:** `pnpm migration:revert-local` (local) / `pnpm migration:revert` (production)

### Seeding

- **Seed Users and Teams:** `pnpm seed:users <eventId>`
  Generates 90 users and 30 teams (3 members each) and assigns them to the specified event. This is useful for testing group phases and bracket logic.
  Each seeded team gets a simulated repository named `sim-<teamId>` in READY state, so no repository is ever created for it. When `NODE_ENV` is `development`, github-service reports permission, lock, unlock and delete operations on these repositories as successful without calling GitHub, so closing submissions locks the seeded teams and the tournament can start. `RANDOM_GAME_RESULTS=true` is required, because real matches cannot clone `sim-*` repositories. Tilt sets both.

### Backfilling 42 campuses

- **Backfill campus names:** `pnpm backfill:campus [--apply] [--all]`
  Looks up every linked 42 account without a campus on the 42 intra API (`/v2/users/:id`) and stores its primary campus. Without `--apply` it only prints what would change; `--all` also re-checks accounts that already have a campus. Set the `DB_*` variables of the target database and read the token without echoing it:

  ```bash
  read -rs FORTYTWO_ACCESS_TOKEN && export FORTYTWO_ACCESS_TOKEN
  pnpm backfill:campus          # dry run
  pnpm backfill:campus --apply
  ```

  An application token works: `curl -X POST https://api.intra.42.fr/oauth/token -d grant_type=client_credentials -d client_id=<uid> -d client_secret=<secret>`. Requests are spaced to stay within the default limit of 2 per second, and the run stops at once if the token is rejected.

## Roles and authorization

Roles live in `user_roles`: ADMIN, MODERATOR, PUBLIC_EVENT_CREATOR and
PRIVATE_EVENT_CREATOR globally (no `eventId`), ADMIN and MODERATOR also for a
single event. Policies in `src/authz` decide every route;
`src/authz/route-coverage.spec.ts` pins each route's decision.

The frontend only hides what the caller may not do: `/auth/me` reports the
global abilities and `GET /event/:id/abilities` the abilities within one event
(`administer`, `viewUnrevealedResults`, `publish`). Each route still checks
its own ability.

Private events are unlisted: any signed-in user can view one by id and join
while registration is open. A populated whitelist restricts joins to its users;
an empty whitelist allows anyone signed in to join. Guests get 404, as for an
unknown id. Version routes (`/event/:id/version`,
`/event/:id/templates/:templateId/version` and `/check/:id`) stay public.
Public listings exclude private events; the overview includes private events
only among the user's own events.

### Bootstrapping the first global admin

Global admins grant every other role through `/admin/roles`, so the first one
is inserted by hand, once the user has signed in with GitHub:

```sql
INSERT INTO user_roles ("userId", role) SELECT id, 'ADMIN' FROM users WHERE username = '<github-login>';
```

The role API never removes the last global admin, nor the last admin of an
event.

### The user_roles migration is forward-only

`UserRoles1793050000000` copies `users.canCreateEvent` and the ADMIN rows of
`user_event_permissions` into `user_roles`. Do not revert it once roles have
been granted: reverting drops `user_roles`, so the old code reads the legacy
permissions again and every grant made since the migration is lost.

## Event presets

Global admins manage presets of event settings at `/admin/event-presets`.
`POST /event` needs only a `name`: the request's other fields are merged onto
the named preset (`presetId`) or the default one, and the result must pass
`EventSettingsDto`. Creating copies the values, so editing a preset never
changes existing events; they keep `presetId` and `presetVersion` for
provenance. `POST /event` no longer takes an organizer token (`githubOrg`,
`githubOrgSecret`); the token of existing events still works.

A preset's schedule is relative: the start is `startTime` (Europe/Berlin
wall-clock time) `startOffsetDays` after the day of creation, and the other
dates are hours after the start. `EventPresets1793200000000` seeds the
"Default" preset with the create form's former defaults and the official
`42core-team/config` game/server JSON at commit `54f501a`, embedded in the
migration. It keeps `basePath: bots/c/bot`. Node 26 provides Temporal without
a flag (there is no `.nvmrc`; engines, Docker and CI specify Node 26).
If create overrides `startDate`, omitted dates move by the same delta;
explicit dates are kept. `scheduledEndDate` controls the lifecycle, while
`endDate` is also stored as sent. `repoLockDate` follows the submission deadline.

Global admins can share a GitHub App installation at
`/admin/github-installations`, after passing the owner check once. Any event
creator may then link it, from a preset, on create or from the dashboard,
without owning its organization. Unshared installations require a fresh owner
check when linked, including on create; suspended or uninstalled installations
are rejected with 400. Unsharing leaves linked events alone.

The create picker uses signed-in `GET /github/installations`, returning
`[{ id, accountLogin, accountType, shared }]`. `id` is our UUID; owned and shared
installations are deduplicated. The existing event dashboard routes still use
GitHub's numeric `installationId`, and their list now includes `shared`.
Presets may only save a shared, active installation. If it later stops being
shared or active, resolve returns `githubInstallation: null` and omitted links
on create resolve to none. Resolve, the admin list and the admin detail then
report it in `warnings: string[]`, and a PUT may send the unchanged stale id
back so other edits still save.

Admins set the default with `POST /admin/event-presets/:id/default` (200,
the same detail shape as GET). It clears the old default and bumps both
versions in one transaction. Archived presets return 409; setting the current
default again is a no-op. PUT, POST with `isDefault`, and this endpoint serialize
default changes together. A stale PUT returns exactly
`{ "message": "Preset was changed by someone else" }` with status 409.
Archive/unarchive and losing default status also bump the version when changed.

Create treats omitted `githubInstallationId`/`starterTemplates` as the preset's;
`null` installation means none, and `[]` templates means none. Unknown body
properties and null settings return 400. `isPrivate` remains accepted for old
clients but every event starts private. PUT requires name, settings and version;
omitted optional fields keep their values. Clear description or installation
with null and templates with []. Duplicates are named `X (copy)`, then
`X (copy 2)`, etc.

The admin installation rows additionally expose `status` (`active`, `suspended`,
`uninstalled`). Preset schedule hour fields are capped at 8784; a resolved
submission deadline must follow the start. Missing deadline/end offsets fall
back to `endAfterHours`, then 1h/2h respectively; `endDate` falls back to the
scheduled end. Saving presets checks public tagged ghcr images. Requests are
time-bounded, never follow redirects, and skip validation on network errors,
rate limits and registry outages. Private or unsupported image references are
left unchecked.

## API Documentation

When running in development mode, Swagger documentation is available at:
`http://localhost:4000/api`

## Architecture

This service runs as both:

- **REST API** - HTTP endpoints for frontend communication
- **Microservice** - RabbitMQ message consumer for:
  - `game_results` - Match result processing
  - `github-service-results` - GitHub operation results

## Environment Variables

### GitHub OAuth (Required)

1. Go to GitHub → Settings → Developer settings → OAuth Apps
2. Register a new OAuth app
3. Set Authorization callback URL: `http://localhost:4000/auth/github/callback`
4. Add Client ID and Secret to `.env.local`

### 42 School OAuth (Optional)

For testing account linking functionality:

1. Go to 42 School → Settings → API → Applications
2. Create a new application
3. Set Redirect URI: `http://localhost:4000/auth/42/callback`
4. Add Client ID and Client Secret to `.env.local`
