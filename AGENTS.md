# Agent context — MSA

This file is **living documentation** for coding agents and humans. **You may edit, replace, or extend this file whenever you learn something durable about the project** (new folders, env vars, auth rules, deploy steps). Keep it accurate and reasonably concise; remove stale sections rather than appending noise.

---

## What this project is

**MSA** (branding: **MSA** — Maintenance Software / Support Assistant) is a maintenance-management web app for AMISSA: work orders (tareas), assets, calendar, checklists, knowledge base, analytics, requests, and technician tooling. UI copy is mostly **Spanish**.

---

## Repository layout (two apps)

| Area | Path | Role |
|------|------|------|
| **Web app** | Repo root (`app/`, `components/`, `lib/`) | Next.js 14 (App Router), primary product |
| **Mobile app** | `mobile/` | Expo (React Native) client that talks to the **same HTTP API** as the web app |
| **Database** | `lib/db/`, `drizzle/` | PostgreSQL via Drizzle ORM (`pg`) |
| **Scripts** | `scripts/` | Seed, reset, etc. |
| **Tests** | `tests/` | Vitest unit tests (`npm test`, `npm run test:watch`) |

Root `package.json` is for the **Next.js** app only. The mobile app has its **own** `mobile/package.json` and must be run from `mobile/` (e.g. `npm run start`).

---

## Web application

### Stack

- **Next.js 14** (App Router), **React 18**, **TypeScript**
- **Tailwind CSS** — brand colors in `tailwind.config.ts` (primary blue `#02257D`, accent orange `#F14C03`, neutral `#9E9F9F`, surfaces)
- **Global styles** — `app/globals.css`: CSS variables (`--color-*`), light/dark via `.dark` on `<html>`, optional **HMI** terminal-like overrides under `.hmi` (dark shell, remapped grays)
- **Auth** — session cookie + JWT payload; helpers in `lib/auth.ts`, shared types in `lib/auth-shared.ts`

### Route groups (`app/`)

- **`app/page.tsx`** — Public landing (MSA); links to login and public order form (`/orden`)
- **`app/(auth)/`** — Login, signup (unauthenticated flows)
- **`app/(app)/`** — Authenticated shell: layout loads session and wraps children in **`components/AppShell.tsx`** (sidebar, mobile header, bottom nav, notifications)
- **`app/orden/`** — Public maintenance order form and folio lookup (`/orden`, `/orden/consultar`); **`/solicitud`** redirects here. API remains **`/api/solicitud`** (POST create, GET lookup by folio)
- **`app/api/*`** — Route handlers (JSON APIs, file uploads, auth)

### Roles and access

- **`admin`** — Full app routes and APIs (see `middleware.ts` for the full picture)
- **`tecnico`** — Restricted to **app paths** like `/tareas`, `/knowledge-base`, `/profile` and a **whitelist of API prefixes** (work orders, knowledge base, notifications, users list for assignees, assets, checklists, avatars, etc.). Anything else is **403** or redirect to `/tareas`
- **`calidad`** — Restricted to **checklists/revisions** only (`/checklists` and checklist template/revision APIs). Calidad can approve/reject proposed checklist revisions.

**Middleware** (`middleware.ts`) enforces auth and técnico scope; keep it in sync when adding new técnico-facing pages or APIs.

### Notable UI patterns

- **`AppShell.tsx`** — Main chrome: desktop sidebar (orange active items, MSA branding), light gray main background (`zinc-200`), white cards, mobile bottom navigation with orange active state
- **Work orders** — Kanban-style board in `app/(app)/tareas/WorkOrderList.tsx`; detail in `WorkOrderDetail.tsx`. When a task transitions to **completed**, the creator (`requesterId`) receives an in-app notification (“Tarea completada”) via `lib/work-order-completion-notifications.ts`.
- **Checklist revisions** — Checklist edits create named proposed revisions (starting from baseline revision `0`). Revisions are reviewed in the right-side panel on checklist detail, and users with role **calidad** can approve/reject proposals.
- **Checklist folders** — Optional hierarchy (`checklist_folders` + `checklist_templates.folder_id`). List UI supports creating/moving folders and moving templates between folders (admin/tecnico only for mutations). Apply migration `0008_checklist_folders.sql` / `npm run db:migrate`.
- **Touch** — `.tap-target` in globals for minimum touch size on coarse pointers

### Data layer

- **Drizzle + PostgreSQL** (`pg` connection pool) — schema in `lib/db/schema.ts` (users, assets, work orders, checklists, notifications, maintenance schedules, audit logs, etc.)
- **Migrations / push** — `drizzle/` (PostgreSQL only; no SQLite); scripts: `npm run db:*` at repo root; `DATABASE_URL` must be a `postgresql://` URL

### Testing (required for agents)

- **Runner:** **Vitest** (`vitest.config.ts`), **`npm test`** / **`npm run test:watch`**
- **Layout:** `tests/unit/*.test.ts` — prefer **pure logic** in `lib/` (easy to cover); API routes may use **integration tests** with a test DB or HTTP mocks when added later.
- **Policy:** When you **add or change behavior** (new API, new `lib/` helper, business rules, auth/middleware rules, recurrence, work-order UX logic, etc.), **add or update tests in the same change** so `npm test` stays green. If something is too coupled to run quickly, extract testable helpers into `lib/` first, then test them.
- **Coverage map (extend as features grow):**
  - Work orders / UI strings: `lib/work-order-kind.ts`, `lib/work-order-duration.ts`, `lib/machine-downtime.ts` (paro de máquina en tareas y total por activo)
  - Calendar / maintenance: `lib/maintenance-recurrence.ts`
  - Access control: `lib/middleware-rules.ts` (used by `middleware.ts`)
  - Profile / avatars: `lib/avatar-helpers.ts`
  - IDs: `lib/id.ts`
  - Roles: `lib/auth-shared.ts`
  - Checklists (plantillas, cierre de tarea): `lib/checklist-items-from-payload.ts`, `lib/checklist-completion.ts`
  - Work-order completion notifications: `lib/work-order-completion-notifications.ts`
- **CI / pre-merge:** Run **`npm test`** before considering work done (same bar as `npm run lint`).

---

## Mobile application (`mobile/`)

### Stack

- **Expo** (~SDK 54), **React Native**, **TypeScript**
- Single main UI file: **`mobile/App.tsx`** (login, work order board/detail, knowledge base, notifications, profile)
- **Styling** — `StyleSheet` with a `theme` object aligned to the **light web shell** (zinc neutrals, primary blue, accent orange)

### API usage

- Base URL from **`EXPO_PUBLIC_API_HOST`** (no trailing slash), e.g. `https://your-server.com`
- Uses **`fetch`** with **`credentials: "include"`** so session cookies work against the Next.js backend
- Login: `POST /api/auth/login`; logout: `POST /api/auth/logout-json`
- Changing técnico API allowlists on the web may **break the app** until the mobile client or middleware list is updated
- **Media attachments** — checklist photo fields and comment attachments support **camera + gallery** via `expo-image-picker` (`POST /api/work-orders/{id}/attachments`)

### Run

```bash
cd mobile && npm install && npm run start
```

### CI build output

- GitHub Actions builds an Android release APK from Expo (`expo prebuild` + Gradle `assembleRelease`)
- CI sets `EXPO_PUBLIC_API_HOST=https://msa.saimco.mx` for the Android build job
- APK is copied to `/downloads/android` when available (falls back to `downloads/android` in workspace if root path is unavailable), then uploaded as workflow artifact
- Deploy job downloads the APK artifact and syncs it to server path `/var/www/msa/downloads/android/msa-release.apk`

---

## Environment and tooling

- Web: standard Next env (e.g. `NODE_ENV`); **`DATABASE_URL`** for PostgreSQL (`lib/db/`)
- Mobile: **`EXPO_PUBLIC_API_HOST`** required for real devices/simulators to reach the API
- Timezone: app display/runtime is pinned to Saltillo using `America/Monterrey` (`lib/timezone.ts` on web, and `TZ=America/Monterrey` in Docker runtime)

---

## Conventions worth preserving

- Prefer **existing patterns** in the same area (Tailwind + components on web; `theme` + StyleSheet on mobile)
- **Do not** edit `.pen` design files with normal file tools — Pencil MCP only, if applicable
- Keep **tecnico vs admin** behavior correct whenever you add routes under `(app)` or new `/api` handlers

---

## Maintenance of this file

**Agents:** When you finish work that changes architecture, env requirements, role limits, folder layout, or **behavior**, **update `AGENTS.md`** as needed and **add/update tests** (see **Testing** above). You may **override, shorten, or restructure** this document if that improves clarity—this is not a legal spec, it is operational context.

**Humans:** Treat this as a quick orientation; the code and `middleware.ts` remain authoritative for security behavior.
