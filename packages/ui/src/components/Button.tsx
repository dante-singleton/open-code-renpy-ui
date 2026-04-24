import { type ButtonHTMLAttributes, forwardRef } from 'react';
import { cn } from '../cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const base =
  'inline-flex items-center justify-center gap-2 font-medium rounded-md ' +
  'transition-colors duration-[var(--duration-fast)] ease-[var(--ease-standard)] ' +
  'focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus-orange)] ' +
  'disabled:opacity-50 disabled:cursor-not-allowed select-none';

const variants: Record<Variant, string> = {
  primary:
    'bg-orange-500 text-[color:var(--color-text-inverse)] hover:bg-orange-400 active:bg-orange-600',
  secondary:
    'bg-purple-500 text-white hover:bg-purple-400 active:bg-purple-600 ' +
    'focus-visible:shadow-[var(--shadow-focus-purple)]',
  ghost:
    'bg-transparent text-[color:var(--color-text-primary)] ' +
    'hover:bg-bg-3 active:bg-bg-4 border border-[color:var(--color-border)]',
  danger: 'bg-[color:var(--color-danger)] text-white hover:brightness-110 active:brightness-90',
};

const sizes: Record<Size, string> = {
  sm: 'h-7 px-2.5 text-xs',
  md: 'h-9 px-3.5 text-sm',
  lg: 'h-11 px-5 text-base',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', type = 'button', ...rest }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(base, variants[variant], sizes[size], className)}
      {...rest}
    />
  ),
);
Button.displayName = 'Button';
