# AmiMaint — Product & Build Plan

A **mobile-first** maintenance management app with full **web** support. UI inspired by **Nimble**: clear, efficient, consistent, and visually polished (component-based, layout-driven).

---

## 1. Vision & Principles

| Principle | Meaning |
|-----------|--------|
| **Mobile-first** | Design and build for small screens and touch first; web is an enhanced, responsive version of the same experience. |
| **Technician-first** | Field users can complete work orders, find assets/parts, capture notes/photos, and stay productive with minimal taps. |
| **Nimble-like UI** | Clarity > Efficiency > Consistency > Beauty. Component-based UI, reusable layouts, familiar patterns everywhere. |
| **Progressive** | Start with core work-order and asset flows; add analytics, inventory, and integrations later. |

---

## 2. Core Features (by priority)

### 2.1 MVP (Phase 1)

- **Work orders**
  - List (open / in progress / completed), filter by status/date/assignee.
  - Detail view: title, description, asset link, priority, due date, assignee, checklist, notes, photos.
  - Create and update from mobile and web; status transitions (e.g. Open → In progress → Done).
- **Assets**
  - List with search (name, ID) and optional QR lookup.
  - Detail: name, ID, location, hierarchy (parent/children), linked work orders.
  - Simple asset creation from web (mobile can view/edit basic fields later).
- **Requests (simple)**
  - Submit a request (description, optional asset, requester); creates a work order or “request” that shows in a queue for assignment.
- **Auth & users**
  - Login (email/password or OAuth); roles: Technician, Supervisor, Admin (role-based visibility later).
- **Mobile-first shell**
  - Bottom nav or tab bar: Work orders, Assets, Requests, Profile/Settings.
  - Pull-to-refresh, clear empty states, loading states.

### 2.2 Phase 2 — Field productivity

- **Offline**
  - Cache work orders and assets for assigned user; queue updates (notes, photos, status) when back online.
- **QR / barcode**
  - Scan to open asset or work order directly.
- **Photos & notes**
  - Attach photos and rich notes to work orders; show in timeline on detail.
- **Checklists (with custom fields)**
  - **Checklist templates** are reusable and define both steps (e.g. “Inspect belt”) and **custom fields** (text, number, date, dropdown, checkbox, photo). Templates can be created and edited on web.
  - Templates can be **attached to maintenance schedules** (e.g. “Monthly inspection” schedule always uses the “Monthly inspection checklist” template). When a scheduled WO is auto-created, it gets a copy of that checklist for the technician to fill out.
  - Per work order: the checklist is either ad-hoc steps or an instance of a template; completion and custom field values are tracked.
- **Maps (optional)**
  - Show asset or site location on map; “navigate” link to device maps.

### 2.3 Phase 3 — Planning & visibility (web-heavy)

- **Calendar / schedule**
  - View work orders by date; drag-and-drop or quick reassign (web).
- **Dashboard**
  - Counts: open WO, overdue, completed this week; simple charts (optional).
- **Preventive maintenance**
  - Recurring templates (e.g. “Monthly inspection”); auto-create work orders on schedule. Each schedule can have a **checklist template** attached so every generated WO includes the same checklist (with custom fields) for technicians to complete.
- **Reporting**
  - Export or simple reports: WO by status, by asset, by technician, time to complete.

### 2.4 Phase 4 — Scale & polish

- **Parts / inventory**
  - Parts linked to assets and work orders; low-stock alerts; consume parts on WO completion.
- **Multi-site / locations**
  - Locations and sub-locations; filter assets and WO by location.
- **Integrations**
  - Webhooks or API for ERP, IoT, or other tools (read-only or two-way as needed).
- **Audit & compliance**
  - History log for WO and asset changes; export for audits.

---

## 3. UI/UX — “Like Nimble”

### 3.1 Design principles

1. **Clarity** — One primary action per screen; clear labels and hierarchy; no jargon in technician-facing copy.
2. **Efficiency** — Few taps to complete a WO; global search; shortcuts (e.g. “My work”, “Due today”).
3. **Consistency** — Same components (cards, lists, forms, nav) on mobile and web; same terminology and field order.
4. **Beauty** — Clean layout, generous whitespace, coherent color and type; subtle motion for feedback.

### 3.2 Layout & structure

- **Default layout**
  - Mobile: top bar (logo/menu) + bottom nav (4–5 items) + main content area.
  - Web: collapsible sidebar (same nav items) + top bar (search, user) + main content; list/detail or master-detail where it fits.
- **Reusable layouts**
  - Auth (login/forgot password).
  - App shell (nav + content).
  - Settings/Profile.
- **List → detail**
  - Lists: cards or rows with key info (title, status, due date, assignee); tap/click → detail.
  - Detail: header (title, status badge, actions) + sections (description, asset, checklist, notes, photos, history).

### 3.3 Component set (design system)

- **Navigation**: bottom tab bar (mobile), sidebar + top bar (web).
- **Cards**: work order card, asset card, request card (image optional).
- **Lists**: filterable/sortable list with status chips and avatars.
- **Forms**: inputs, selects, date/time pickers, file/photo upload; inline validation.
- **Feedback**: toasts/snackbars, loading skeletons, empty states, error states.
- **Typography**: clear hierarchy (title, subtitle, body, caption); one sans-serif family.
- **Color**: primary for actions and key statuses; semantic (success, warning, error); neutral for text and borders. Optional light/dark theme.

### 3.4 Responsive breakpoints

- **Mobile first**: 320px–767px (single column, bottom nav, full-width cards).
- **Tablet**: 768px–1023px (optional two-column list/detail or wider cards).
- **Desktop**: 1024px+ (sidebar, multi-column tables, dashboard grids).

---

## 4. Tech stack suggestions

- **Frontend**
  - **Mobile**: React Native (Expo) or PWA (React/Vue/Svelte) for one codebase and “mobile-first” PWA.
  - **Web**: Same React/Vue/Svelte app with responsive layout and optional Electron for desktop.
  - **UI**: Tailwind CSS + headless component library (e.g. Radix, Ark) for Nimble-like consistency and accessibility.
- **Backend**
  - REST or GraphQL API; auth (JWT or session); role-based access.
  - Option A: Node (Express/Fastify) or Next.js API routes.  
  - Option B: Python (FastAPI/Django) or Go if team prefers.
- **Data**
  - PostgreSQL (or SQLite for MVP); migrations (e.g. Drizzle, Prisma, or Django ORM).
  - Optional: Redis for sessions and cache; S3-compatible storage for photos/files.
- **Offline (Phase 2)**
  - Local DB (SQLite/WatermelonDB) or IndexedDB + sync layer (e.g. custom or PowerSync, ElectricSQL).
- **DevOps**
  - Git; CI (tests, lint); deploy backend (Railway, Fly, Render, or Vercel); host PWA on same or CDN; app store builds only if using native (React Native).

---

## 5. Data model (high level)

- **Users**: id, email, name, role, avatar_url, created_at.
- **Assets**: id, name, asset_id (human-readable), location_id, parent_asset_id, qr_code, metadata (JSON), created_at, updated_at.
- **Locations** (Phase 4): id, name, parent_id.
- **Work orders**: id, title, description, status (open, in_progress, completed, cancelled), priority, asset_id, assignee_id, requester_id, due_date, completed_at, created_at, updated_at.
- **Checklist templates**: id, name, description (optional). Reusable; can be attached to maintenance schedules.
- **Checklist template items**: id, checklist_template_id, type (step | custom_field), label, sort_order; for custom_field: field_type (text, number, date, dropdown, checkbox, photo), options (JSON, for dropdown).
- **Maintenance schedules** (Phase 3): id, name, asset_id (optional), recurrence (cron or interval), checklist_template_id (optional), next_run_at, etc.
- **Work order checklist** (instance on a WO): id, work_order_id, checklist_template_id (nullable; if set, WO was created from schedule with that template), sort_order. Each row is one step or one custom field; step has title, completed (boolean); custom field has field_type and value (JSON: string, number, date, option key, boolean, or file ref).
- **Notes**: id, work_order_id, user_id, body, created_at.
- **Attachments**: id, work_order_id, user_id, file_url, filename, created_at.
- **Requests**: id, description, asset_id (optional), requester_id, status, work_order_id (once converted), created_at.

---

## 6. Phases summary

| Phase | Focus | Deliverables |
|-------|--------|--------------|
| **1 – MVP** | Mobile-first shell, WO, assets, simple requests, auth | PWA + responsive web; backend API; SQL DB |
| **2 – Field** | Offline, QR, photos, notes, checklists | Sync strategy; camera/scan; richer WO detail |
| **3 – Planning** | Calendar, dashboard, preventive, reports | Web-focused screens; recurring jobs; exports |
| **4 – Scale** | Parts, locations, integrations, compliance | Inventory model; audit log; webhooks/API |

---

## 7. Out of scope (for the “copy”)

- Full EAM/ERP parity.
- Native iOS/Android apps (unless you choose React Native later).
- Built-in predictive maintenance ML (can integrate later).
- Multi-tenant SaaS billing and onboarding flows (can add after MVP).

---

## 8. Success criteria

- A technician can **open the app on a phone**, see **assigned work orders**, **open one**, **complete checklist steps**, **add notes and photos**, and **mark it done** with minimal friction.
- The same flows work on **web** with a **consistent, Nimble-like** look and feel.
- **Mobile-first** is evident: touch targets, readability, and performance on 3G and small screens.

---

## Next steps

1. Choose stack (e.g. React PWA + Node/Postgres or Expo + same backend).
2. Set up repo, DB schema, and auth.
3. Implement app shell (nav, layout) and one list + detail flow (e.g. work orders).
4. Add assets and requests; then iterate with offline, QR, and Phase 3–4 features.

If you want, the next concrete step can be a **detailed technical spec** (folder structure, API routes, and first screens) or **wireframes** for the MVP shell and work-order flow.
