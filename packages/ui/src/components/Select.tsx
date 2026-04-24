import { type SelectHTMLAttributes, forwardRef } from 'react';
import { cn } from '../cn';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  options: SelectOption[];
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, options, ...rest }, ref) => (
    <select
      ref={ref}
      className={cn(
        'w-full h-9 px-3 rounded-md bg-bg-0 text-[color:var(--color-text-primary)]',
        'border border-[color:var(--color-border)]',
        'transition-colors duration-[var(--duration-fast)]',
        'hover:border-[color:var(--color-border-strong)]',
        'focus-visible:outline-none focus-visible:border-orange-500 focus-visible:shadow-[var(--shadow-focus-orange)]',
        className,
      )}
      {...rest}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value} disabled={opt.disabled}>
          {opt.label}
        </option>
      ))}
    </select>
  ),
);
Select.displayName = 'Select';
