import { Select } from '@base-ui/react/select';
import type { ReactNode } from 'react';

const selectTriggerClass =
  'inline-flex min-w-0 items-center justify-end gap-2 rounded-lg bg-transparent px-0 py-0 text-right text-sm font-semibold text-text-secondary transition-colors duration-150 hover:text-text-primary data-[popup-open]:text-text-primary disabled:opacity-55';

const selectItemClass =
  'flex cursor-default items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-text-primary outline-hidden select-none transition-colors duration-100 data-[highlighted]:bg-white/8';

const menuPopupSurfaceClass =
  'rounded-xl border border-white/10 bg-[linear-gradient(180deg,rgba(54,58,79,0.98),rgba(36,39,58,0.98))] py-1.5 shadow-menu backdrop-blur-[18px]';

export type SettingsSelectItem<TValue extends string = string> = {
  value: TValue;
  label: string;
};

export function SettingsSection({
  eyebrow,
  description,
  children,
  footer,
}: {
  eyebrow: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <section className="mb-7">
      <span className="mb-2 inline-flex px-1 text-xs font-bold tracking-[0.12em] text-accent-cyan uppercase">
        {eyebrow}
      </span>
      {description && (
        <p className="mb-2 px-1 text-sm leading-relaxed text-text-secondary">
          {description}
        </p>
      )}
      <div className="overflow-hidden rounded-xl border border-white/6 bg-canvas-elevated/55">
        {children}
      </div>
      {footer && <div className="px-1 pt-2 text-xs leading-relaxed text-text-tertiary">{footer}</div>}
    </section>
  );
}

export function SettingsRow({
  label,
  description,
  icon,
  children,
  className = '',
  tone = 'default',
}: {
  label: string;
  description?: ReactNode;
  icon?: ReactNode;
  children?: ReactNode;
  className?: string;
  tone?: 'default' | 'danger';
}) {
  const labelClass = tone === 'danger' ? 'text-accent-red' : 'text-text-primary';
  const descriptionClass = tone === 'danger' ? 'text-accent-red' : 'text-text-secondary';

  return (
    <div className={`flex min-h-12 items-center justify-between gap-4 border-b border-white/5 px-4 py-3 last:border-b-0 ${className}`}>
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {icon}
        <div className="min-w-0">
          <div className={`truncate text-sm font-semibold ${labelClass}`}>{label}</div>
          {description && <div className={`text-xs leading-relaxed ${descriptionClass}`}>{description}</div>}
        </div>
      </div>
      {children && <div className="flex shrink-0 items-center gap-2">{children}</div>}
    </div>
  );
}

export function SettingsIcon({
  tone,
  children,
}: {
  tone: 'blue' | 'violet' | 'amber' | 'green' | 'red' | 'cyan';
  children: ReactNode;
}) {
  const toneClass = {
    blue: 'bg-accent-blue/14 text-accent-blue',
    violet: 'bg-accent-violet/14 text-accent-violet',
    amber: 'bg-accent-amber/14 text-accent-amber',
    green: 'bg-accent-green/14 text-accent-green',
    red: 'bg-accent-red/14 text-accent-red',
    cyan: 'bg-accent-cyan/14 text-accent-cyan',
  }[tone];

  return <span className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${toneClass}`}>{children}</span>;
}

export function StatusBadge({
  active,
  activeLabel,
  inactiveLabel,
  inactiveTone = 'muted',
}: {
  active: boolean;
  activeLabel: string;
  inactiveLabel: string;
  inactiveTone?: 'muted' | 'amber' | 'red';
}) {
  const inactiveClass = {
    muted: 'bg-white/6 text-text-tertiary',
    amber: 'bg-accent-amber/12 text-accent-amber',
    red: 'bg-accent-red/12 text-accent-red',
  }[inactiveTone];
  const inactiveDotClass = {
    muted: 'bg-text-tertiary',
    amber: 'bg-accent-amber',
    red: 'bg-accent-red',
  }[inactiveTone];

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${active ? 'bg-accent-green/12 text-accent-green' : inactiveClass}`}>
      <span className={`size-1.5 rounded-full ${active ? 'bg-accent-green' : inactiveDotClass}`} />
      {active ? activeLabel : inactiveLabel}
    </span>
  );
}

export function SettingsSwitch({
  checked,
  disabled,
  label,
  onCheckedChange,
}: {
  checked: boolean;
  disabled?: boolean;
  label: string;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={`relative h-[26px] w-11 rounded-full transition-colors duration-200 ease-out disabled:cursor-default disabled:opacity-55 ${checked ? 'bg-accent-green' : 'bg-white/12'}`}
      onClick={() => onCheckedChange(!checked)}
      disabled={disabled}
    >
      <span className={`absolute top-[3px] left-[3px] size-5 rounded-full bg-white shadow-[0_1px_4px_rgba(0,0,0,0.3)] transition-transform duration-200 ease-out ${checked ? 'translate-x-[18px]' : ''}`} />
    </button>
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
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 2L7 5L3 8" />
          </svg>
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Positioner className="outline-hidden" sideOffset={6} alignItemWithTrigger={false}>
          <Select.Popup className={`${menuPopupSurfaceClass} origin-[var(--transform-origin)] transition-[transform,opacity] duration-150 data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0`}>
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
      className="w-40 rounded-lg border border-white/8 bg-white/4 px-3 py-1.5 text-right text-sm font-semibold text-text-primary outline-hidden transition-colors duration-150 hover:bg-white/6 focus:border-accent-blue/70 focus:bg-white/6 disabled:opacity-55"
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.currentTarget.value)}
    />
  );
}
