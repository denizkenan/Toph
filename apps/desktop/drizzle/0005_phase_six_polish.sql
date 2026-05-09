ALTER TABLE `session_outputs` ADD COLUMN `source_output_id` text;
--> statement-breakpoint
ALTER TABLE `session_outputs` ADD COLUMN `provider` text;
--> statement-breakpoint
ALTER TABLE `session_outputs` ADD COLUMN `model` text;
--> statement-breakpoint
ALTER TABLE `session_outputs` ADD COLUMN `prompt_id` text;
--> statement-breakpoint
ALTER TABLE `session_outputs` ADD COLUMN `prompt_hash` text;
--> statement-breakpoint
CREATE TABLE `polish_prompts` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`body_hash` text NOT NULL,
	`is_builtin` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
