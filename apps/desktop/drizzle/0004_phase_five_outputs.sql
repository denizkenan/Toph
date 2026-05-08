ALTER TABLE `recording_sessions` ADD COLUMN `selected_output_id` text;
--> statement-breakpoint
CREATE TABLE `session_outputs` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`kind` text NOT NULL,
	`text` text NOT NULL,
	`created_at` integer NOT NULL
);
