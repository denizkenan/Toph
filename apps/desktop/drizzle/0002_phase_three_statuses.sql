UPDATE `recording_sessions`
SET `status` = 'recording_failed'
WHERE `status` = 'failed';
