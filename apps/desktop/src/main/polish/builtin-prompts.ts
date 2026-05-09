import { createHash } from 'node:crypto';

import defaultPromptBody from './prompts/default.txt?raw';

export const defaultPolishPrompt = {
  id: 'default',
  title: 'Default',
  body: defaultPromptBody,
  bodyHash: createPromptHash(defaultPromptBody),
} as const;

export function createPromptHash(body: string) {
  return createHash('sha256').update(body, 'utf8').digest('hex');
}
