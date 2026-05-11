import type { PermissionRequirement } from '@toph/desktop-contracts';

export function isPermissionComplete(requirement: PermissionRequirement) {
  return requirement.status === 'granted' || requirement.status === 'not-required';
}
