# AmiMaint

Mobile-first maintenance management (CMMS-style) with web support. UI inspired by Nimble: clear, efficient, consistent.

## Color palette

The UI follows a corporate-modern palette with deep blue as the main brand color and orange as the CTA accent.

- **Primary**
  - Deep Blue: `#1F3C88` (headers, sections, primary buttons)
  - White / Off-white: `#FFFFFF`, `#F5F5F5` (backgrounds and content areas)
- **Secondary**
  - Orange: `#F36C21` (highlights, stats, CTA actions)
  - Light Gray: `#E6E6E6` (section backgrounds, separators)
  - Dark Gray: `#4A4A4A` (body text, subtle UI elements)
- **Supporting**
  - Muted Green: `#6FAF6F` (subtle highlights)
  - Near Black: `#222222` (strong text, footer emphasis)

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

   Demo login: `demo@amimaint.local` / `demo1234`

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
