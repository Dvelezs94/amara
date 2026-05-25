CREATE TABLE IF NOT EXISTS "checklist_template_revisions" (
	"id" text PRIMARY KEY NOT NULL,
	"checklist_template_id" text NOT NULL,
	"revision_number" integer NOT NULL,
	"name" text NOT NULL,
	"status" text NOT NULL DEFAULT 'proposed',
	"proposed_by_user_id" text NOT NULL,
	"reviewed_by_user_id" text,
	"reviewed_at" timestamp with time zone,
	"review_comment" text,
	"snapshot" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL DEFAULT now(),
	CONSTRAINT "checklist_template_revisions_checklist_template_id_checklist_templates_id_fk"
		FOREIGN KEY ("checklist_template_id") REFERENCES "checklist_templates"("id") ON DELETE cascade,
	CONSTRAINT "checklist_template_revisions_proposed_by_user_id_users_id_fk"
		FOREIGN KEY ("proposed_by_user_id") REFERENCES "users"("id"),
	CONSTRAINT "checklist_template_revisions_reviewed_by_user_id_users_id_fk"
		FOREIGN KEY ("reviewed_by_user_id") REFERENCES "users"("id")
);
