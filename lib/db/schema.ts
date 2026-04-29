import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  integer,
  timestamp,
  boolean,
  jsonb,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  username: text("username").notNull().unique(),
  email: text("email").unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  role: text("role", { enum: ["operator", "admin", "supervisor"] })
    .notNull()
    .default("operator"),
  avatarUrl: text("avatar_url"),
  /** Fondo del avatar con iniciales (#RRGGBB); null = derivar de id en cliente */
  avatarBackgroundColor: text("avatar_background_color"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
});

export const assets = pgTable("assets", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  assetId: text("asset_id").notNull().unique(), // human-readable
  locationId: text("location_id"),
  parentAssetId: text("parent_asset_id"),
  qrCode: text("qr_code"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
});

export const assetFiles = pgTable("asset_files", {
  id: text("id").primaryKey(),
  assetId: text("asset_id").references(() => assets.id, { onDelete: "cascade" }), // null = uploaded directly to knowledge base
  filename: text("filename").notNull(),
  fileUrl: text("file_url").notNull(),
  category: text("category"), // e.g. "manual", "spec", "other" or free text
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
});

export const workOrders = pgTable(
  "work_orders",
  {
    id: text("id").primaryKey(),
    folio: integer("folio"),
    title: text("title").notNull(),
    description: text("description"),
    status: text("status", {
      enum: ["pending", "in_progress", "completed", "cancelled"],
    })
      .notNull()
      .default("pending"),
    priority: text("priority", { enum: ["low", "medium", "high", "urgent"] })
      .notNull()
      .default("medium"),
    assetId: text("asset_id"),
    assigneeId: text("assignee_id"),
    requesterId: text("requester_id"),
    dueDate: timestamp("due_date", { withTimezone: true, mode: "date" }),
    completedAt: timestamp("completed_at", { withTimezone: true, mode: "date" }),
    /** Set once on first transition to in_progress; null = nunca iniciada */
    startedAt: timestamp("started_at", { withTimezone: true, mode: "date" }),
    /** routine = desde mantenimiento programado; on_demand = creada bajo demanda */
    kind: text("kind", { enum: ["routine", "on_demand"] })
      .notNull()
      .default("on_demand"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    /** Order within the Kanban column (same status); lower = higher on the board */
    boardSortOrder: integer("board_sort_order").notNull().default(0),
  },
  (t) => [
    uniqueIndex("work_orders_folio_unique_idx")
      .on(t.folio)
      .where(sql`${t.folio} IS NOT NULL`),
  ]
);

export const checklistTemplates = pgTable("checklist_templates", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
});

export const checklistTemplateItems = pgTable("checklist_template_items", {
  id: text("id").primaryKey(),
  checklistTemplateId: text("checklist_template_id")
    .notNull()
    .references(() => checklistTemplates.id, { onDelete: "cascade" }),
  type: text("type", { enum: ["step", "custom_field", "text_block"] }).notNull(),
  label: text("label").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  fieldType: text("field_type", {
    enum: [
      "text",
      "number",
      "date",
      "dropdown",
      "checkbox",
      "photo",
      "title",
      "subtitle",
      "paragraph",
    ],
  }),
  options: jsonb("options").$type<string[]>(), // for dropdown: string[]
});

export const checklistTemplateRevisions = pgTable("checklist_template_revisions", {
  id: text("id").primaryKey(),
  checklistTemplateId: text("checklist_template_id")
    .notNull()
    .references(() => checklistTemplates.id, { onDelete: "cascade" }),
  revisionNumber: integer("revision_number").notNull(),
  name: text("name").notNull(),
  status: text("status", { enum: ["approved", "proposed", "rejected"] })
    .notNull()
    .default("proposed"),
  proposedByUserId: text("proposed_by_user_id")
    .notNull()
    .references(() => users.id),
  reviewedByUserId: text("reviewed_by_user_id").references(() => users.id),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true, mode: "date" }),
  reviewComment: text("review_comment"),
  snapshot: jsonb("snapshot")
    .$type<{
      before?: {
        name: string;
        description: string | null;
        items: Array<{
          type: string;
          label: string;
          fieldType: string | null;
          options: string[] | null;
        }>;
      };
      after: {
        name: string;
        description: string | null;
        items: Array<{
          type: string;
          label: string;
          fieldType: string | null;
          options: string[] | null;
        }>;
      };
    }>()
    .notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
});

export const workOrderChecklist = pgTable("work_order_checklist", {
  id: text("id").primaryKey(),
  workOrderId: text("work_order_id")
    .notNull()
    .references(() => workOrders.id, { onDelete: "cascade" }),
  checklistTemplateId: text("checklist_template_id"),
  type: text("type", { enum: ["step", "custom_field", "text_block"] }).notNull(),
  label: text("label").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  completed: boolean("completed").notNull().default(false),
  value: jsonb("value"), // for custom_field
  fieldType: text("field_type", {
    enum: [
      "text",
      "number",
      "date",
      "dropdown",
      "checkbox",
      "photo",
      "title",
      "subtitle",
      "paragraph",
    ],
  }),
  options: jsonb("options").$type<string[]>(),
});

export const notes = pgTable("notes", {
  id: text("id").primaryKey(),
  workOrderId: text("work_order_id")
    .notNull()
    .references(() => workOrders.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id),
  body: text("body").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
});

export const attachments = pgTable("attachments", {
  id: text("id").primaryKey(),
  workOrderId: text("work_order_id")
    .notNull()
    .references(() => workOrders.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id),
  fileUrl: text("file_url").notNull(),
  filename: text("filename").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
});

export const requests = pgTable("requests", {
  id: text("id").primaryKey(),
  description: text("description").notNull(),
  priority: text("priority", { enum: ["low", "medium", "high", "urgent"] })
    .notNull()
    .default("medium"),
  assetId: text("asset_id"),
  requesterId: text("requester_id").notNull().references(() => users.id),
  status: text("status", { enum: ["pending", "converted", "cancelled"] })
    .notNull()
    .default("pending"),
  workOrderId: text("work_order_id"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
});

// Dashboard: saved analytics widgets per user
export const dashboardWidgets = pgTable("dashboard_widgets", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  templateId: text("template_id").notNull(),
  templateName: text("template_name").notNull(),
  fieldLabel: text("field_label").notNull(),
  dateFrom: text("date_from"), // YYYY-MM-DD or null
  dateTo: text("date_to"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
});

export const auditLogs = pgTable("audit_logs", {
  id: text("id").primaryKey(),
  entityType: text("entity_type").notNull(), // e.g. work_order, checklist_template, work_order_checklist
  entityId: text("entity_id").notNull(),
  action: text("action").notNull(), // e.g. created, updated, completed
  /** null = accion del sistema o publica (ej. solicitud sin sesion) */
  userId: text("user_id").references(() => users.id),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
});

export const notifications = pgTable(
  "notifications",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type", { enum: ["assignment", "work_order_update", "mention"] })
      .notNull(),
    title: text("title").notNull(),
    body: text("body"),
    workOrderId: text("work_order_id").references(() => workOrders.id, {
      onDelete: "cascade",
    }),
    noteId: text("note_id").references(() => notes.id, { onDelete: "cascade" }),
    readAt: timestamp("read_at", { withTimezone: true, mode: "date" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    userCreatedIdx: index("notifications_user_created_idx").on(
      t.userId,
      t.createdAt
    ),
    userUnreadIdx: index("notifications_user_unread_idx").on(t.userId, t.readAt),
  })
);

// Phase 3
export const maintenanceSchedules = pgTable("maintenance_schedules", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  assetId: text("asset_id"),
  assigneeId: text("assignee_id").references(() => users.id),
  color: text("color"),
  recurrence: text("recurrence").notNull(), // cron or interval description
  checklistTemplateId: text("checklist_template_id"),
  nextRunAt: timestamp("next_run_at", { withTimezone: true, mode: "date" }),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
});
