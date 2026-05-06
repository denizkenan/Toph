CREATE TABLE `timeline_regions` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`sequence` integer NOT NULL,
	`kind` text NOT NULL,
	`start_ms` integer NOT NULL,
	`end_ms` integer NOT NULL,
	`confidence` integer,
	`created_live` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `transcription_batches` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`sequence` integer NOT NULL,
	`status` text NOT NULL,
	`derived_duration_ms` integer NOT NULL,
	`created_live` integer NOT NULL,
	`debug_audio_path` text,
	`created_at` integer NOT NULL,
	`queued_at` integer,
	`transcribed_at` integer,
	`error_message` text
);
--> statement-breakpoint
CREATE TABLE `batch_source_ranges` (
	`id` text PRIMARY KEY NOT NULL,
	`batch_id` text NOT NULL,
	`timeline_region_id` text,
	`sequence` integer NOT NULL,
	`source_start_ms` integer NOT NULL,
	`source_end_ms` integer NOT NULL,
	`derived_start_ms` integer NOT NULL,
	`derived_end_ms` integer NOT NULL,
	`reason` text NOT NULL
);
