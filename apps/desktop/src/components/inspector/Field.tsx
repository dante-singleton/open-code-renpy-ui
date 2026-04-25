import type { ReactNode } from 'react';

/**
 * Inspector form field. Wraps the control in a div (rather than `<label>`)
 * because some children are composite (textarea + helper buttons) and Biome
 * a11y rules require a single labelled control per `<label>`. The visible
 * caption is rendered as a styled span; controls remain focusable normally.
 */
export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="block text-sm">
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-xs uppercase tracking-wide text-fg-muted">{label}</span>
        {hint && <span className="text-[10px] text-fg-muted ml-2 font-mono">{hint}</span>}
      </div>
      {children}
    </div>
  );
}
