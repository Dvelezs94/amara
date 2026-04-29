CREATE TABLE IF NOT EXISTS `checklist_template_revisions` (
	`id` text PRIMARY KEY NOT NULL,
	`checklist_template_id` text NOT NULL,
	`revision_number` integer NOT NULL,
	`name` text NOT NULL,
	`status` text NOT NULL DEFAULT 'proposed',
	`proposed_by_user_id` text NOT NULL,
	`reviewed_by_user_id` text,
	`reviewed_at` integer,
	`review_comment` text,
	`snapshot` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`checklist_template_id`) REFERENCES `checklist_templates`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`proposed_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`reviewed_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
