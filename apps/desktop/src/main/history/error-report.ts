import type { RetainedSessionRecord } from '../stores/session-store';

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const pathEndLookahead = String.raw`(?=[:.!?](?:\s|$)|["'\`]|$)`;

export function sanitizeErrorMessage(message: string, sensitiveRoots: string[]) {
  let sanitized = message;
  for (const root of sensitiveRoots.filter(Boolean).sort((a, b) => b.length - a.length)) {
    sanitized = sanitized.replace(
      new RegExp(`${escapeRegExp(root)}[^\n\r"'\`]*?${pathEndLookahead}`, 'g'),
      '[redacted-path]',
    );
  }

  return sanitized
    .replace(/(["'`])(?:[A-Za-z]:[\\/]|~[\\/]|\/)[^"'`]*\1/g, '$1[redacted-path]$1')
    .replace(/\b[A-Za-z]:[\\/][^\s"'`)]+/g, '[redacted-path]')
    .replace(/~[\\/][^\s"'`)]+/g, '[redacted-path]')
    .replace(
      /\/(?:Users|home|var|tmp|private|Volumes|opt|mnt|media)\/[^\n\r"'`]*?(?=[:.!?](?:\s|$)|["'`]|$)/g,
      '[redacted-path]',
    )
    .replace(/(^|\s)\/(?!\/|backend-api\b)[^\s"'`)]+/g, '$1[redacted-path]');
}

export function buildSessionErrorReport(record: RetainedSessionRecord, sensitiveRoots: string[]) {
  const sessionError = record.session.errorMessage?.trim();
  const failedBatches = record.failedBatches.filter((batch) => batch.errorMessage?.trim());
  if (!sessionError && failedBatches.length === 0) {
    return null;
  }

  const lines = ['Toph error report', '', `Session: ${record.session.id}`];
  if (sessionError) {
    lines.push('', 'Session error:', sanitizeErrorMessage(sessionError, sensitiveRoots));
  }
  if (failedBatches.length > 0) {
    lines.push('', 'Batch errors:');
    failedBatches.forEach((batch, index) => {
      lines.push(
        `${index + 1}. ${batch.id}`,
        `   Sequence: ${batch.sequence}`,
        `   Attempts: ${batch.transcriptionAttempts}`,
        `   Error: ${sanitizeErrorMessage(batch.errorMessage ?? 'Unknown batch error.', sensitiveRoots)}`,
      );
    });
  }

  return lines.join('\n');
}
