import { type HTMLAttributes, type ReactNode, forwardRef } from 'react';
import { cn } from '../cn';

export interface PanelProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  heading?: ReactNode;
  actions?: ReactNode;
  scrollable?: boolean;
}

export const Panel = forwardRef<HTMLDivElement, PanelProps>(
  ({ className, heading, actions, scrollable = true, children, ...rest }, ref) => (
    <section
      ref={ref}
      className={cn(
        'flex flex-col min-h-0 min-w-0 bg-bg-1 border border-[color:var(--color-border)]',
        'rounded-lg overflow-hidden',
        className,
      )}
      {...rest}
    >
      {(heading || actions) && (
        <header
          className={cn(
            'flex items-center justify-between shrink-0',
            'h-10 px-3 border-b border-[color:var(--color-border)] bg-bg-2',
          )}
        >
          <h2
            className={cn(
              'text-xs font-semibold uppercase tracking-wide',
              'text-[color:var(--color-text-secondary)]',
            )}
          >
            {heading}
          </h2>
          {actions && <div className="flex items-center gap-1">{actions}</div>}
        </header>
      )}
      <div className={cn('flex-1 min-h-0', scrollable && 'overflow-auto')}>{children}</div>
    </section>
  ),
);
Panel.displayName = 'Panel';
