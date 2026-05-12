import { createHash } from 'node:crypto';

import emailWritingRuleBody from './rules/email-writing.txt?raw';
import engineerRuleBody from './rules/engineer.txt?raw';
import generalRuleBody from './rules/general.txt?raw';

export const builtinPolishRulePresets = [
  {
    id: 'general',
    title: 'General',
    body: generalRuleBody,
    bodyHash: createRulePresetHash(generalRuleBody),
  },
  {
    id: 'engineer',
    title: 'Engineer',
    body: engineerRuleBody,
    bodyHash: createRulePresetHash(engineerRuleBody),
  },
  {
    id: 'email-writing',
    title: 'Email & Writing',
    body: emailWritingRuleBody,
    bodyHash: createRulePresetHash(emailWritingRuleBody),
  },
] as const;

export function createRulePresetHash(body: string) {
  return createHash('sha256').update(body, 'utf8').digest('hex');
}
