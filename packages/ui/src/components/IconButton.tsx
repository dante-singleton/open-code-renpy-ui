import { type ButtonHTMLAttributes, forwardRef } from 'react';
import { cn } from '../cn';

type Size = 'sm' | 'md' | 'lg';

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  size?: Size;
  label: string; // required for a11y
}

const sizes: Record<Size, string> = {
  sm: 'h-7 w-7',
  md: 'h-9 w-9',
  lg: 'h-11 w-11',
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, size = 'md', label, type = 'button', children, ...rest }, ref) => (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex items-center justify-center rounded-md border border-[color:var(--color-border)] bg-bg-2',
        'text-[color:var(--color-text-secondary)] transition-colors duration-[var(--duration-fast)]',
        'hover:bg-bg-3 hover:text-[color:var(--color-text-primary)] hover:border-[color:var(--color-border-strong)]',
        'focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus-orange)] active:bg-bg-4',
        sizes[size],
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  ),
);
IconButton.displayName = 'IconButton';
