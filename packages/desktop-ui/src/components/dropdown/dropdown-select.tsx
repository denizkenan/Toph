import { Select } from '@base-ui/react/select';

import {
  itemClass,
  itemIndicatorClass,
  popupAnimationClass,
  popupSurfaceClass,
  selectTriggerDefaultClass,
  selectTriggerInlineClass,
} from './dropdown-styles';

export type DropdownSelectItem<TValue extends string = string> = {
  value: TValue;
  label: string;
};

export type DropdownSelectVariant = 'inline' | 'default';

export function DropdownSelect<TValue extends string>({
  ariaLabel,
  items,
  value,
  placeholder,
  disabled,
  variant = 'inline',
  onValueChange,
}: {
  ariaLabel: string;
  items: DropdownSelectItem<TValue>[];
  value: TValue;
  placeholder: string;
  disabled?: boolean;
  variant?: DropdownSelectVariant;
  onValueChange: (value: TValue) => void;
}) {
  const triggerClass = variant === 'inline' ? selectTriggerInlineClass : selectTriggerDefaultClass;

  return (
    <Select.Root items={items} value={value} onValueChange={(nextValue) => nextValue != null && onValueChange(nextValue as TValue)}>
      <Select.Trigger aria-label={ariaLabel} className={triggerClass} disabled={disabled}>
        <Select.Value placeholder={placeholder} />
        <Select.Icon className="text-text-tertiary">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 2L7 5L3 8" />
          </svg>
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Positioner className="outline-hidden" sideOffset={6} alignItemWithTrigger={false}>
          <Select.Popup className={`${popupSurfaceClass} ${popupAnimationClass}`}>
            <Select.List>
              {items.map((item) => (
                <Select.Item key={item.value} value={item.value} className={itemClass}>
                  <span className={itemIndicatorClass}>
                    <Select.ItemIndicator>
                      <svg width="12" height="12" viewBox="0 0 10 10" fill="currentColor">
                        <path d="M9.16 1.12a.75.75 0 0 1 .22 1.04L5.14 8.66a.75.75 0 0 1-1.13.13L1.25 6.31a.75.75 0 1 1 1.06-1.06l2.1 1.91L8.12 1.34a.75.75 0 0 1 1.04-.22Z" />
                      </svg>
                    </Select.ItemIndicator>
                  </span>
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
