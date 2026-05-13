import { Menu } from '@base-ui/react/menu';
import type { ReactNode } from 'react';

import {
  dangerItemClass,
  itemClass,
  popupAnimationClass,
  popupSurfaceClass,
  separatorClass,
} from './dropdown-styles';

export type DropdownMenuEntry = DropdownMenuItem | DropdownMenuSeparator;

export type DropdownMenuItem = {
  id: string;
  label: string;
  onClick: () => void;
  tone?: 'default' | 'danger';
};

export type DropdownMenuSeparator = {
  type: 'separator';
};

function isSeparator(entry: DropdownMenuEntry): entry is DropdownMenuSeparator {
  return 'type' in entry;
}

export function DropdownMenu({
  ariaLabel,
  trigger,
  items,
}: {
  ariaLabel: string;
  trigger: ReactNode;
  items: DropdownMenuEntry[];
}) {
  return (
    <Menu.Root>
      <Menu.Trigger
        aria-label={ariaLabel}
        className="inline-flex size-8 cursor-pointer items-center justify-center rounded-full bg-transparent text-text-tertiary transition-all duration-200 ease-out hover:bg-white/8 hover:text-text-primary focus:bg-white/8 focus:text-text-primary focus:outline-hidden"
      >
        {trigger}
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner className="outline-hidden" sideOffset={6}>
          <Menu.Popup className={`${popupSurfaceClass} ${popupAnimationClass}`}>
            {items.map((entry, index) => {
              if (isSeparator(entry)) {
                return <Menu.Separator key={`sep-${index}`} className={separatorClass} />;
              }

              const itemStyle = entry.tone === 'danger' ? dangerItemClass : itemClass;

              return (
                <Menu.Item key={entry.id} className={itemStyle} onClick={entry.onClick}>
                  {entry.label}
                </Menu.Item>
              );
            })}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
