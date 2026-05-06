CREATE TABLE `recording_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`started_at` integer NOT NULL,
	`ended_at` integer,
	`duration_ms` integer,
	`raw_audio_path` text NOT NULL,
	`status` text NOT NULL,
	`error_message` text
);
