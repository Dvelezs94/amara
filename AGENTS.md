# Agent context — AmiMaint

This file is **living documentation** for coding agents and humans. **You may edit, replace, or extend this file whenever you learn something durable about the project** (new folders, env vars, auth rules, deploy steps). Keep it accurate and reasonably concise; remove stale sections rather than appending noise.

---

## What this project is

**AmiMaint** (branding: **MSA** — Maintenance Software / Support Assistant) is a maintenance-management web app for AMISSA: work orders (tareas), assets, calendar, checklists, knowledge base, analytics, requests, and operator tooling. UI copy is mostly **Spanish**.

---

## Repository layout (two apps)

| Area | Path | Role |
|------|------|------|
| **Web app** | Repo root (`app/`, `components/`, `lib/`) | Next.js 14 (App Router), primary product |
| **Mobile app** | `mobile/` | Expo (React Native) client that talks to the **same HTTP API** as the web app |
| **Database** | `lib/db/`, `drizzle/` | SQLite via Drizzle ORM |
| **Scripts** | `scripts/` | Seed, reset, etc. |

Root `package.json` is for the **Next.js** app only. The mobile app has its **own** `mobile/package.json` and must be run from `mobile/` (e.g. `npm run start`).

---

## Web application

### Stack

- **Next.js 14** (App Router), **React 18**, **TypeScript**
- **Tailwind CSS** — brand colors in `tailwind.config.ts` (primary blue `#02257D`, accent orange `#F14C03`, neutral `#9E9F9F`, surfaces)
- **Global styles** — `app/globals.css`: CSS variables (`--color-*`), light/dark via `.dark` on `<html>`, optional **HMI** terminal-like overrides under `.hmi` (dark shell, remapped grays)
- **Auth** — session cookie + JWT payload; helpers in `lib/auth.ts`, shared types in `lib/auth-shared.ts`

### Route groups (`app/`)

- **`app/page.tsx`** — Public landing (MSA); links to login and public request form
- **`app/(auth)/`** — Login, signup (unauthenticated flows)
- **`app/(app)/`** — Authenticated shell: layout loads session and wraps children in **`components/AppShell.tsx`** (sidebar, mobile header, bottom nav, notifications)
- **`app/solicitud/`** — Public maintenance request form; related API often **`/api/solicitud`**
- **`app/api/*`** — Route handlers (JSON APIs, file uploads, auth)

### Roles and access

- **`admin`** — Full app routes and APIs (see `middleware.ts` for the full picture)
- **`operator`** — Restricted to **app paths** like `/tareas`, `/knowledge-base`, `/profile` and a **whitelist of API prefixes** (work orders, knowledge base, notifications, users list for assignees, assets, checklists, avatars, etc.). Anything else is **403** or redirect to `/tareas`

**Middleware** (`middleware.ts`) enforces auth and operator scope; keep it in sync when adding new operator-facing pages or APIs.

### Notable UI patterns

- **`AppShell.tsx`** — Main chrome: desktop sidebar (orange active items, MSA branding), light gray main background (`zinc-200`), white cards, mobile bottom navigation with orange active state
- **Work orders** — Kanban-style board in `app/(app)/tareas/WorkOrderList.tsx`; detail in `WorkOrderDetail.tsx`
- **Touch** — `.tap-target` in globals for minimum touch size on coarse pointers

### Data layer

- **Drizzle + SQLite** (`better-sqlite3`) — schema in `lib/db/schema.ts` (users, assets, work orders, checklists, notifications, maintenance schedules, audit logs, etc.)
- **Migrations** — `drizzle/`; scripts: `npm run db:*` at repo root

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
- Changing operator API allowlists on the web may **break the app** until the mobile client or middleware list is updated

### Run

```bash
cd mobile && npm install && npm run start
```

---

## Environment and tooling

- Web: standard Next env (e.g. `NODE_ENV`); database path/configuration via Drizzle setup in `lib/db/`
- Mobile: **`EXPO_PUBLIC_API_HOST`** required for real devices/simulators to reach the API

---

## Conventions worth preserving

- Prefer **existing patterns** in the same area (Tailwind + components on web; `theme` + StyleSheet on mobile)
- **Do not** edit `.pen` design files with normal file tools — Pencil MCP only, if applicable
- Keep **operator vs admin** behavior correct whenever you add routes under `(app)` or new `/api` handlers

---

## Maintenance of this file

**Agents:** When you finish work that changes architecture, env requirements, role limits, or folder layout, **update `agent.md`** so the next session stays aligned. You may **override, shorten, or restructure** this document if that improves clarity—this is not a legal spec, it is operational context.

**Humans:** Treat this as a quick orientation; the code and `middleware.ts` remain authoritative for security behavior.
