ALTER TABLE `transcription_batches` RENAME COLUMN `debug_audio_path` TO `derived_audio_path`;
--> statement-breakpoint
ALTER TABLE `transcription_batches` RENAME COLUMN `derived_duration_ms` TO `derived_audio_duration_ms`;
--> statement-breakpoint
ALTER TABLE `transcription_batches` ADD COLUMN `source_duration_ms` integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE `transcription_batches` ADD COLUMN `transcription_attempts` integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE `transcription_batches` ADD COLUMN `transcription_started_at` integer;
--> statement-breakpoint
UPDATE `transcription_batches`
SET `source_duration_ms` = `derived_audio_duration_ms`
WHERE `source_duration_ms` = 0;
--> statement-breakpoint
CREATE TABLE `batch_transcripts` (
	`id` text PRIMARY KEY NOT NULL,
	`batch_id` text NOT NULL,
	`provider` text NOT NULL,
	`model` text,
	`text` text NOT NULL,
	`estimated_billable_duration_ms` integer NOT NULL,
	`estimated_cost_usd` integer,
	`provider_request_id` text,
	`provider_response_json` text,
	`created_at` integer NOT NULL
);
