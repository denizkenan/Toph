import type { PermissionRequirement, PermissionRequirementId } from '@toph/desktop-contracts';

import { Button } from '../button';
import { CheckIcon } from './check-icon';
import { isPermissionComplete } from './onboarding-utils';
import { PendingDot } from './pending-dot';
import { StatusText } from './status-text';

function getActionLabel(requirement: PermissionRequirement) {
  if (requirement.status === 'granted') {
    return 'Granted';
  }

  if (requirement.action === 'request') {
    return 'Request access';
  }

  return 'Open settings';
}

function getStatusLabel(requirement: PermissionRequirement) {
  if (requirement.status === 'granted') {
    return 'Complete';
  }

  if (requirement.status === 'promptable') {
    return 'Ready to ask';
  }

  if (requirement.status === 'denied') {
    return 'Blocked';
  }

  return 'Needed';
}

export function PermissionCard({
  requirement,
  busy,
  disabled,
  onAction,
}: {
  requirement: PermissionRequirement;
  busy: boolean;
  disabled: boolean;
  onAction: (permissionId: PermissionRequirementId) => void;
}) {
  const complete = isPermissionComplete(requirement);

  return (
    <article
      className={`flex items-center gap-3 rounded-2xl border px-4 py-3 transition-[transform,border-color,background-color,opacity] duration-200 ease-out hover:translate-x-0.5 ${complete ? 'border-accent-green/12 bg-accent-green/6' : disabled ? 'border-white/5 bg-white/2 opacity-60' : 'border-white/5 bg-white/2 hover:bg-white/4'}`}
    >
      <div
        className={`grid size-8 shrink-0 place-items-center rounded-[0.625rem] border transition-colors duration-300 ${complete ? 'border-accent-green/12 bg-accent-green/8 text-accent-green' : 'border-accent-cyan/10 bg-accent-cyan/6 text-accent-cyan'}`}
      >
        {complete ? <CheckIcon size={14} /> : <PendingDot />}
      </div>

      <div className="min-w-0 flex-1">
        <h3 className="m-0 font-display text-sm font-medium tracking-[-0.015em] text-text-primary">
          {requirement.label}
        </h3>
        <StatusText complete={complete}>{getStatusLabel(requirement)}</StatusText>
      </div>

      <Button
        variant={complete ? 'secondary' : 'primary'}
        className="h-8 shrink-0 rounded-lg px-3 py-0 text-xs"
        onClick={() => onAction(requirement.id)}
        disabled={complete || busy || disabled || requirement.action === 'none'}
      >
        {busy ? 'Checking...' : getActionLabel(requirement)}
      </Button>
    </article>
  );
}
