CREATE TABLE IF NOT EXISTS "workflow_definitions" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "enabled" boolean NOT NULL DEFAULT true,
  "trigger_type" text NOT NULL,
  "trigger_config" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "actions" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "created_by_user_id" text REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "workflow_definitions_trigger_idx"
  ON "workflow_definitions" ("trigger_type", "enabled");

CREATE TABLE IF NOT EXISTS "workflow_runs" (
  "id" text PRIMARY KEY NOT NULL,
  "workflow_id" text REFERENCES "workflow_definitions"("id") ON DELETE SET NULL,
  "trigger_type" text NOT NULL,
  "entity_type" text,
  "entity_id" text,
  "status" text NOT NULL,
  "error" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "workflow_runs_created_idx"
  ON "workflow_runs" ("created_at");
