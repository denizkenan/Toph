import { Select } from '@base-ui/react/select';
import type { ReactNode } from 'react';

export const settingsButtonClass =
  'inline-flex cursor-pointer items-center justify-center rounded-full border border-transparent px-5 py-3 text-sm font-semibold transition-[transform,border-color,background-color,opacity] duration-200 ease-out hover:-translate-y-px hover:scale-[1.01] disabled:cursor-default disabled:opacity-55 disabled:hover:translate-y-0 disabled:hover:scale-100';

const selectTriggerClass =
  'flex h-12 w-full items-center justify-between gap-3 rounded-2xl border border-white/8 bg-white/4 px-4 text-text-primary transition-colors duration-150 hover:bg-white/6 data-[popup-open]:bg-white/6 disabled:opacity-55';

const selectItemClass =
  'flex cursor-default items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-text-primary outline-hidden select-none transition-colors duration-100 data-[highlighted]:bg-white/8';

export type SettingsSelectItem<TValue extends string = string> = {
  value: TValue;
  label: string;
};

export function SettingsSectionHeader({
  eyebrow,
  title,
  description,
  badge,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  badge?: ReactNode;
}) {
  return (
    <div className={`mb-5 ${badge ? 'flex items-start justify-between gap-4' : ''}`}>
      <div>
        <span className="mb-2 inline-flex text-xs font-bold tracking-[0.14em] text-accent-cyan uppercase">
          {eyebrow}
        </span>
        <h2 className="m-0 font-display text-xl tracking-[-0.03em]">{title}</h2>
        {description && (
          <p className="mt-2 mb-0 text-sm leading-relaxed text-text-secondary">
            {description}
          </p>
        )}
      </div>
      {badge}
    </div>
  );
}

export function StatusBadge({
  active,
  activeLabel,
  inactiveLabel,
  inactiveTone = 'text-text-secondary',
}: {
  active: boolean;
  activeLabel: string;
  inactiveLabel: string;
  inactiveTone?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-2 rounded-full border border-white/8 bg-white/5 px-3.5 py-2 text-sm ${active ? 'text-accent-green' : inactiveTone}`}>
      <span className={`size-2 rounded-full ${active ? 'bg-accent-green' : inactiveTone === 'text-accent-amber' ? 'bg-accent-amber' : 'bg-white/20'}`} />
      {active ? activeLabel : inactiveLabel}
    </span>
  );
}

export function SettingsSelect<TValue extends string>({
  items,
  value,
  placeholder,
  disabled,
  onValueChange,
}: {
  items: SettingsSelectItem<TValue>[];
  value: TValue;
  placeholder: string;
  disabled?: boolean;
  onValueChange: (value: TValue) => void;
}) {
  return (
    <Select.Root items={items} value={value} onValueChange={(nextValue) => nextValue && onValueChange(nextValue as TValue)}>
      <Select.Trigger className={selectTriggerClass} disabled={disabled}>
        <Select.Value placeholder={placeholder} />
        <Select.Icon className="text-text-tertiary">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M2 4L5 7L8 4" />
          </svg>
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Positioner className="outline-hidden" sideOffset={6} alignItemWithTrigger={false}>
          <Select.Popup className="menu-popup-surface origin-[var(--transform-origin)] rounded-xl py-1.5 transition-[transform,opacity] duration-150 data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0">
            <Select.List>
              {items.map((item) => (
                <Select.Item key={item.value} value={item.value} className={selectItemClass}>
                  <Select.ItemIndicator className="text-accent-green">
                    <svg width="12" height="12" viewBox="0 0 10 10" fill="currentColor">
                      <path d="M9.16 1.12a.75.75 0 0 1 .22 1.04L5.14 8.66a.75.75 0 0 1-1.13.13L1.25 6.31a.75.75 0 1 1 1.06-1.06l2.1 1.91L8.12 1.34a.75.75 0 0 1 1.04-.22Z" />
                    </svg>
                  </Select.ItemIndicator>
                  <Select.ItemText>{item.label}</Select.ItemText>
                </Select.Item>
              ))}
            </Select.List>
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  );
}

export function SettingsTextInput({
  value,
  disabled,
  onChange,
}: {
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <input
      className="h-12 w-full rounded-2xl border border-white/8 bg-white/4 px-4 text-text-primary outline-hidden transition-colors duration-150 hover:bg-white/6 focus:bg-white/6 disabled:opacity-55"
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.currentTarget.value)}
    />
  );
}
