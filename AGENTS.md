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

- **`AppShell.tsx`** — Main chrome: desktop sidebar (orange active items, MSA branding), light gray main background (`zinc-200`), white cards, mobile bottom navigation with orange active state. **Page titles** go in the sticky top header via `PageHeaderContext` / `SetPageHeader` / `useSetPageHeader`. **Filters/search** (`filters`) and **page actions** (`actions`) render in a content toolbar above the page body (left / right); do not put those in the sticky nav and do not duplicate section `<h1>` in page bodies. Layout breadcrumbs can use `usePageHeaderFilters` so they sit in the toolbar without overwriting page title/actions.
- **Work orders** — Kanban-style board in `app/(app)/tareas/WorkOrderList.tsx`; detail in `WorkOrderDetail.tsx`. When a task transitions to **completed**, the creator (`requesterId`) receives an in-app notification (“Tarea completada”) via `lib/work-order-completion-notifications.ts`. Optional **fecha de inicio** (`work_orders.start_date`) can be set from `/tareas` or calendar «Crear tarea»; the **mobile app** only lists tasks whose start date (or due date if start is empty) is **today or earlier** (America/Monterrey)—future-dated tareas stay hidden. Distinct from `startedAt` (when work actually began). Apply migration `0026_work_order_start_date.sql` / `npm run db:migrate`.
- **Checklist revisions** — Checklist edits create named proposed revisions (starting from baseline revision `0`). Revisions are reviewed in the right-side panel on checklist detail, and users with role **calidad** can approve/reject proposals.
- **Checklist folders** — Optional hierarchy (`checklist_folders` + `checklist_templates.folder_id`). List UI supports creating/moving folders and moving templates between folders (admin/tecnico only for mutations). Apply migration `0008_checklist_folders.sql` / `npm run db:migrate`.
- **Asset areas** — Flat (non-nested) areas for machines (`asset_groups` + `assets.group_id`; UI label: «Área»). List UI on `/assets` (explorer) supports creating/renaming/deleting areas and moving machines between them. Apply migration `0022_asset_groups.sql` / `npm run db:migrate`.
- **Machine photos** — Optional hero image on assets (`assets.image_url` stores the S3 public object URL). Browser loads via `GET /api/assets/{id}/image`, which redirects to a short-lived **presigned** S3 URL (same pattern as asset documents). Upload/delete: `POST`/`DELETE` on that route (images only). Shown as thumbnails on `/assets` and asset detail. Apply migration `0025_asset_image_url.sql` / `npm run db:migrate`.
- **Calendars** — Named calendars for areas/teams (`calendars` + `maintenance_schedules.calendar_id`). Built-in default **Mantenimiento** (`cal_mantenimiento`); new/orphan schedules are assigned there. `/calendario` sidebar switches views (Todos / each calendar); dashboard «Próximos eventos» still aggregates all calendars. Apply migrations `0023_calendars.sql` + `0024_default_mantenimiento_calendar.sql` / `npm run db:migrate`.
- **Touch** — `.tap-target` in globals for minimum touch size on coarse pointers

### Data layer

- **Drizzle + PostgreSQL** (`pg` connection pool) — schema in `lib/db/schema.ts` (users, assets, work orders, checklists, notifications, maintenance schedules, audit logs, etc.)
- **Migrations / push** — `drizzle/` (PostgreSQL only; no SQLite); scripts: `npm run db:*` at repo root; `DATABASE_URL` must be a `postgresql://` URL

### Testing (required for agents)

- **Requirement:** **Every feature needs tests** — web and mobile. New or changed product behavior is not done until it has automated coverage (or an existing suite is extended). Prefer unit tests on pure helpers; if UI/API logic is hard to test as-is, extract helpers into `lib/` / `mobile/lib/` and test those in the same change.
- **Runner (web):** **Vitest** (`vitest.config.ts`), **`npm test`** / **`npm run test:watch`**
- **Runner (mobile):** Vitest under `mobile/` (`mobile/vitest.config.ts`), **`cd mobile && npm test`**
- **Layout:** `tests/unit/*.test.ts` (web) and `mobile/tests/unit/*.test.ts` (mobile) — prefer **pure logic** in `lib/` / `mobile/lib/` (easy to cover); API routes may use **integration tests** with a test DB or HTTP mocks when added later.
- **Policy:** When you **add or change behavior** (new API, new `lib/` helper, business rules, auth/middleware rules, recurrence, work-order UX logic, mobile helpers, machine photos, calendars, etc.), **add or update tests in the same change** so `npm test` (and mobile `npm test` when touching `mobile/`) stays green. Do not ship feature work without tests.
- **Coverage map (extend as features grow):**
  - Work orders / UI strings: `lib/work-order-kind.ts`, `lib/work-order-duration.ts`, `lib/machine-downtime.ts` (paro de máquina en tareas y total por activo), `lib/work-order-start-date.ts` (fecha de inicio / visibilidad móvil)
  - Calendar / maintenance: `lib/maintenance-recurrence.ts`
  - Access control: `lib/middleware-rules.ts` (used by `middleware.ts`)
  - Profile / avatars: `lib/avatar-helpers.ts`, `lib/user-avatar-file.ts` (sanitize)
  - IDs / assignees / folio: `lib/id.ts`, `lib/assignee-ids.ts`, `lib/work-order-folio-helpers.ts`
  - Roles: `lib/auth-shared.ts`
  - Checklists (plantillas, cierre de tarea): `lib/checklist-items-from-payload.ts`, `lib/checklist-completion.ts`, `lib/checklist-template-revisions-ui.ts`
  - Asset areas (lista de máquinas): `lib/asset-group-helpers.ts`
  - Machine photos (proxy path / filename sanitize): `lib/asset-image-helpers.ts`
  - Calendars (filtro por calendario): `lib/calendar-helpers.ts`
  - Dashboard presets / public solicitud note URLs / file paths: `lib/dashboard-quick-presets.ts`, `lib/solicitud-public-note-urls.ts`, `lib/file-storage.ts`
  - Work-order completion notifications: `lib/work-order-completion-notifications.ts`
  - Mobile: `mobile/lib/app-update.ts`, `build-version.ts`, `wo-status.ts`, `work-order-status-colors.ts`, `work-order-start-date.ts`, `checklist-field-save.ts` (checklist PATCH payloads / draft flush), `due-format.ts`, `file-kind.ts`, `update-download.ts` / `apk-update-storage.ts` (APK update progress + cache cleanup), plus mirrored checklist helpers under `mobile/lib/`
  - Checklist PATCH body parse/normalize: `lib/work-order-checklist-patch.ts`
- **CI / pre-merge:** Run **`npm test`** (web) and **`cd mobile && npm test`** when mobile changes (same bar as `npm run lint`).

---

## Mobile application (`mobile/`)

### Stack

- **Expo** (~SDK 54), **React Native**, **TypeScript**
- Single main UI file: **`mobile/App.tsx`** (login, work order board/detail, knowledge base, notifications, profile)
- **Styling** — `StyleSheet` with shared `mobile/theme.ts` tokens aligned to web (`tailwind.config.ts` / AppShell): primary `#02257D`, accent `#F14C03`, brand neutrals, kind badges matching `.wo-kind-*` in `globals.css`

### API usage

- Base URL from **`EXPO_PUBLIC_API_HOST`** (no trailing slash), e.g. `https://your-server.com`
- Uses **`fetch`** with **`credentials: "include"`** so session cookies work against the Next.js backend
- Login: `POST /api/auth/login`; logout: `POST /api/auth/logout-json`
- Changing técnico API allowlists on the web may **break the app** until the mobile client or middleware list is updated
- **Media attachments** — checklist photo fields and comment attachments support **camera + gallery** via `expo-image-picker` (`POST /api/work-orders/{id}/attachments`)
- **Task status colors** — loaded from `GET /api/app-settings/work-order-status-colors` (same settings as the web app) and applied to status badges / list accents; defaults apply until the call succeeds

### Run

```bash
cd mobile && npm install && npm run start
```

### CI build output

- GitHub Actions builds an Android release APK from Expo (`expo prebuild` + Gradle `assembleRelease`)
- CI sets `EXPO_PUBLIC_API_HOST=https://msa.saimco.mx` for the Android build job
- APK is copied to `/downloads/android` when available (falls back to `downloads/android` in workspace if root path is unavailable), then uploaded as workflow artifact
- CI stamps Android `versionName` / `versionCode` from **day (America/Monterrey) + commit SHA** (and `GITHUB_RUN_NUMBER` for same-day monotonicity) via `mobile/scripts/stamp-android-version.ts` before prebuild — `versionName` looks like `20260728.a1b2c3d`
- CI also publishes `/downloads/android/version.json` (versionName/versionCode + APK URL) for in-app Android update checks
- In-app updater downloads the APK with progress UI, then installs via **content URI** + `expo-intent-launcher` (not `Linking.openURL(file://…)`). Needs `REQUEST_INSTALL_PACKAGES` and a native rebuild after dependency/permission changes
- Updater stores a **single** cached APK (`msa-update.apk`), deletes prior/legacy timestamped downloads before each update, removes the file after install, and refuses to download when free disk is too low (`mobile/lib/update-download.ts`, `mobile/lib/apk-update-storage.ts`)
- Deploy job syncs `downloads/android/*` to server path `/var/www/msa/downloads/android/`

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

**Agents:** When you finish work that changes architecture, env requirements, role limits, folder layout, or **behavior**, **update `AGENTS.md`** as needed and **add/update tests for that feature** on web and/or mobile (see **Testing** above — every feature needs tests). You may **override, shorten, or restructure** this document if that improves clarity—this is not a legal spec, it is operational context.

**Humans:** Treat this as a quick orientation; the code and `middleware.ts` remain authoritative for security behavior.
