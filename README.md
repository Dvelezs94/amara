# MSA

Maintenance Management System (CMMS) for Amissa.

## Stack

- **Next.js 14** (App Router) — frontend + API
- **PostgreSQL** + **Drizzle ORM** — database (`pg` driver)
- **Docker / Compose** — production stack in `docker-compose.yml`; local Postgres in `docker-compose.local.yml`
- **Tailwind CSS** — styling
- **Session auth** — cookie-based (JWT-style payload)

## Color palette

The UI uses a modern dark theme centered on navy and deep slate blues, with vibrant orange for CTAs and accents.

- **Primary**
  - Navy Blue: `#232B3F` (backgrounds, sidebar, dashboard panels)
  - Slate Blue: `#25324C` (main content, card backgrounds)
  - White: `#FFFFFF` (text headers, main icons)
- **Accent**
  - Bright Orange: `#F36C21` (active sidebar, buttons, highlights)
  - Light Orange: `#FFBF8A` (hover, tags, subtle accents)
- **Secondary & Supporting**
  - Light Gray: `#A7AEC6` (muted text, icons)
  - Very Dark Gray: `#121826` (window background, panel shadows)
  - Deep Gray: `#31394B` (inner cards, status backgrounds)
  - Pastel Blue: `#C2CEEC` (labels, info chips)
- **Other**
  - Success Green: `#6FAF6F` (status chips, check icons)
  - Accent Yellow: `#FFEDB5` (alert chips)

Overall, the palette conveys clarity and contrast, with a professional dark interface and orange for primary actions—see the screenshot for reference.

## Prerequisites

- **Node.js 22**
- **PostgreSQL 16**

## Setup (local Node + PostgreSQL)

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Environment**

   Copy `.env.example` to `.env` and set:

   - `DATABASE_URL` — e.g. `postgresql://msa:msa@localhost:5432/msa`
   - `SESSION_SECRET` — at least 32 characters in production

3. **Database schema**

   With PostgreSQL running and `DATABASE_URL` set:

   ```bash
   npm run db:push
   ```

4. **Seed demo data (optional)**

   ```bash
   npm run db:seed
   ```

   Test logins:

   - `admin` / `1234aA` (email `admin@admin.com`)
   - `operador` / `operador1234` (turno A)
   - `operador.b` / `operador1234` (turno B)
   - `calidad` / `calidad1234`

   The seed is idempotent and fills calendars, maintenance events, checklists (folders + templates), work orders, notes, requests, and a proposed checklist revision for Calidad.

   Or create an admin interactively:

   ```bash
   node scripts/create-user.js
   ```

5. **Run**

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

## Setup with Docker (Ubuntu 24 and similar)

Docker provides PostgreSQL so you do not need a system-wide Postgres install for development.

**Local** (Postgres only; run Next on the host):

```bash
docker compose -f docker-compose.local.yml up -d
cp .env.example .env
# .env DATABASE_URL should match: postgresql://msa:msa@localhost:5432/msa
npm install
npm run db:push
npm run db:seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

**Production** (default file; Postgres is only on the Docker network; session cookies require HTTPS):

```bash
docker compose up --build -d
```

The local stack starts **`postgres`** — PostgreSQL 16 on port **5432** (`msa` / `msa`, database `msa`). Production also runs **`web`** on port **3000**. In production, apply schema inside the web container (`docker compose run --rm web npm run db:push`). Set `SESSION_SECRET` in `.env` next to `docker-compose.yml` (required; Compose loads it for variable substitution).

### Reset the database (Docker volume still exists)

To wipe all tables and recreate from scratch:

```bash
npm run db:reset
npm run db:push
npm run db:seed
```

To remove the Postgres **data volume** entirely:

```bash
docker compose -f docker-compose.local.yml down -v
docker compose -f docker-compose.local.yml up -d
npm run db:push
npm run db:seed
```

### 6. Run the web image alone (without Compose)

```bash
docker build -t msa-web .
docker run --rm -p 3000:3000 \
  -e DATABASE_URL="postgresql://msa:msa@host.docker.internal:5432/msa" \
  -e SESSION_SECRET="change-me-in-production-min-32-chars-long" \
  msa-web
```

On Linux, add `--add-host=host.docker.internal:host-gateway` if `host.docker.internal` is not defined.

## Scripts

| Command | Description |
|--------|-------------|
| `npm run db:push` | Apply Drizzle schema to the database (dev-friendly) |
| `npm run db:generate` | Generate SQL migrations from schema changes |
| `npm run db:migrate` | Run migrations (when using generated migrations) |
| `npm run db:studio` | Open Drizzle Studio |
| `npm run db:seed` | Seed demo users, assets, checklists, sample work orders |
| `npm run db:reset` | Drop and recreate `public` schema in PostgreSQL (destructive) |
| `npm test` | Run Vitest unit tests (`tests/**/*.test.ts`) |
| `npm run test:watch` | Vitest in watch mode |

## Features

- **Auth** — Sign up, log in, log out
- **Work orders** — List (filter by status), detail, create, edit, status flow, checklist steps
- **Assets** — List (search), detail, create; link to work orders
- **Requests** — Submit request (description + optional asset), list, detail, convert to work order
- **Profile** — View profile, log out
- **Layout** — Mobile: bottom nav + top bar; Desktop: sidebar + main content

## Project layout

- `app/` — Routes (auth, app shell, work-orders, assets, requests, profile)
- `app/api/` — API routes (auth, work-orders, assets, requests, users)
- `components/` — AppShell (nav)
- `lib/` — db (schema, client), auth, id, work-orders helper
- `scripts/seed.ts` — Demo seed
- `docker-compose.yml` — Production PostgreSQL + msa `web` service
- `docker-compose.local.yml` — Local PostgreSQL only (use `npm run dev` for the app)
- `Dockerfile` — Production Next.js (`standalone`) image
