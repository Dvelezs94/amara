# AMS

Mobile-first maintenance management (CMMS-style) with web support. UI inspired by Nimble: clear, efficient, consistent.

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

## Stack

- **Next.js 14** (App Router) — frontend + API
- **SQLite** + **Drizzle ORM** — database (MVP)
- **Tailwind CSS** — styling
- **Session auth** — cookie-based (JWT-style payload)

## Setup

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Environment**

   Copy `.env.example` to `.env` and set `SESSION_SECRET` (min 32 chars) for production.

3. **Database**

   Create tables and optional seed user:

   ```bash
   npm run db:push
   npx tsx scripts/seed.ts
   ```

   Demo login: `demo@ams.local` / `demo1234`

   Or create an admin user with `./create-user.js` and follow the prompts

4. **Run**

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000). Sign up or log in, then use Work orders, Assets, and Requests.

## Features (MVP)

- **Auth** — Sign up, log in, log out
- **Work orders** — List (filter by status), detail, create, edit, status flow (open → in progress → completed), checklist steps
- **Assets** — List (search), detail, create; link to work orders
- **Requests** — Submit request (description + optional asset), list, detail, convert to work order
- **Profile** — View profile, log out
- **Layout** — Mobile: bottom nav + top bar; Desktop: sidebar + main content

## Project layout

- `app/` — Routes (auth, app shell, work-orders, assets, requests, profile)
- `app/api/` — API routes (auth, work-orders, assets, requests, users)
- `components/` — AppShell (nav)
- `lib/` — db (schema, client), auth, id, work-orders helper
- `scripts/seed.ts` — Demo user seed

## Data model

See `PLAN.md` for full schema. Core tables: `users`, `assets`, `work_orders`, `work_order_checklist`, `checklist_templates`, `checklist_template_items`, `requests`, `notes`, `attachments`, `maintenance_schedules` (Phase 3).

## Next steps (from plan)

- Phase 2: Offline, QR scan, photos/notes on WO, checklist templates with custom fields
- Phase 3: Calendar, dashboard, preventive maintenance (schedules + checklist templates)
- Phase 4: Parts/inventory, locations, integrations, audit
