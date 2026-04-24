import { type InputHTMLAttributes, forwardRef } from 'react';
import { cn } from '../cn';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, invalid, ...rest }, ref) => (
    <input
      ref={ref}
      className={cn(
        'w-full h-9 px-3 rounded-md bg-bg-0 text-[color:var(--color-text-primary)]',
        'border border-[color:var(--color-border)] placeholder:text-[color:var(--color-text-muted)]',
        'transition-colors duration-[var(--duration-fast)]',
        'hover:border-[color:var(--color-border-strong)]',
        'focus-visible:outline-none focus-visible:border-orange-500 focus-visible:shadow-[var(--shadow-focus-orange)]',
        'disabled:opacity-60 disabled:cursor-not-allowed',
        invalid && 'border-[color:var(--color-danger)]',
        className,
      )}
      {...rest}
    />
  ),
);
Input.displayName = 'Input';
