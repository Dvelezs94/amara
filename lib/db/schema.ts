import {
  sqliteTable,
  text,
  integer,
  real,
} from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  role: text("role", { enum: ["technician", "supervisor", "admin"] })
    .notNull()
    .default("technician"),
  avatarUrl: text("avatar_url"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const assets = sqliteTable("assets", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  assetId: text("asset_id").notNull().unique(), // human-readable
  locationId: text("location_id"),
  parentAssetId: text("parent_asset_id"),
  qrCode: text("qr_code"),
  metadata: text("metadata", { mode: "json" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const assetFiles = sqliteTable("asset_files", {
  id: text("id").primaryKey(),
  assetId: text("asset_id").references(() => assets.id, { onDelete: "cascade" }), // null = uploaded directly to knowledge base
  filename: text("filename").notNull(),
  fileUrl: text("file_url").notNull(),
  category: text("category"), // e.g. "manual", "spec", "other" or free text
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const workOrders = sqliteTable("work_orders", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status", {
    enum: ["open", "in_progress", "completed", "cancelled"],
  }).notNull().default("open"),
  priority: text("priority", { enum: ["low", "medium", "high", "urgent"] })
    .notNull()
    .default("medium"),
  assetId: text("asset_id"),
  assigneeId: text("assignee_id"),
  requesterId: text("requester_id"),
  dueDate: integer("due_date", { mode: "timestamp" }),
  completedAt: integer("completed_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const checklistTemplates = sqliteTable("checklist_templates", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const checklistTemplateItems = sqliteTable("checklist_template_items", {
  id: text("id").primaryKey(),
  checklistTemplateId: text("checklist_template_id")
    .notNull()
    .references(() => checklistTemplates.id, { onDelete: "cascade" }),
  type: text("type", { enum: ["step", "custom_field"] }).notNull(),
  label: text("label").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  fieldType: text("field_type", {
    enum: ["text", "number", "date", "dropdown", "checkbox", "photo"],
  }),
  options: text("options", { mode: "json" }), // for dropdown: string[]
});

export const workOrderChecklist = sqliteTable("work_order_checklist", {
  id: text("id").primaryKey(),
  workOrderId: text("work_order_id")
    .notNull()
    .references(() => workOrders.id, { onDelete: "cascade" }),
  checklistTemplateId: text("checklist_template_id"),
  type: text("type", { enum: ["step", "custom_field"] }).notNull(),
  label: text("label").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  completed: integer("completed", { mode: "boolean" }).default(false),
  value: text("value", { mode: "json" }), // for custom_field
  fieldType: text("field_type", {
    enum: ["text", "number", "date", "dropdown", "checkbox", "photo"],
  }),
  options: text("options", { mode: "json" }),
});

export const notes = sqliteTable("notes", {
  id: text("id").primaryKey(),
  workOrderId: text("work_order_id")
    .notNull()
    .references(() => workOrders.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id),
  body: text("body").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const attachments = sqliteTable("attachments", {
  id: text("id").primaryKey(),
  workOrderId: text("work_order_id")
    .notNull()
    .references(() => workOrders.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id),
  fileUrl: text("file_url").notNull(),
  filename: text("filename").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const requests = sqliteTable("requests", {
  id: text("id").primaryKey(),
  description: text("description").notNull(),
  assetId: text("asset_id"),
  requesterId: text("requester_id").notNull().references(() => users.id),
  status: text("status", { enum: ["pending", "converted", "cancelled"] })
    .notNull()
    .default("pending"),
  workOrderId: text("work_order_id"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// Dashboard: saved analytics widgets per user
export const dashboardWidgets = sqliteTable("dashboard_widgets", {
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
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// Phase 3
export const maintenanceSchedules = sqliteTable("maintenance_schedules", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  assetId: text("asset_id"),
  recurrence: text("recurrence").notNull(), // cron or interval description
  checklistTemplateId: text("checklist_template_id"),
  nextRunAt: integer("next_run_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});
