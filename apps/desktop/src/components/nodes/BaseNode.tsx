import type { SceneNodeType } from '@renpy-ui/spec';
import { cn } from '@renpy-ui/ui';
import { Handle, Position } from '@xyflow/react';
import type { ReactNode } from 'react';
import { CATEGORY_COLOR, type NodeCategoryDef, labelFor } from '../../state/templates';

export interface BaseNodeProps {
  type: SceneNodeType;
  category: NodeCategoryDef['category'];
  selected?: boolean;
  hasError?: boolean;
  /** Hide the default target handle (e.g. for Start). */
  hideTargetHandle?: boolean;
  /** Hide the default source handle (e.g. for End/Return). */
  hideSourceHandle?: boolean;
  /** Custom right-side content (instead of the single source handle). */
  rightHandles?: ReactNode;
  title?: string;
  children?: ReactNode;
}

/**
 * Shared chrome for every custom node: category-coloured header strip, body,
 * and optional handles.
 */
export function BaseNode({
  type,
  category,
  selected,
  hasError,
  hideTargetHandle,
  hideSourceHandle,
  rightHandles,
  title,
  children,
}: BaseNodeProps) {
  const color = CATEGORY_COLOR[category];

  return (
    <div
      className={cn(
        'rounded-lg bg-bg-2 text-fg shadow-md min-w-[180px] max-w-[280px]',
        'border transition-shadow',
        selected ? 'border-orange-500 shadow-lg' : 'border-[color:var(--color-border)]',
        hasError && 'border-[color:var(--color-danger)]',
      )}
      data-node-type={type}
    >
      {!hideTargetHandle && (
        <Handle
          type="target"
          position={Position.Left}
          className="!w-2.5 !h-2.5"
          style={{ background: 'var(--color-bg-3)', borderColor: color }}
        />
      )}

      <header
        className="flex items-center gap-2 px-2.5 py-1.5 rounded-t-[9px]"
        style={{
          background: `linear-gradient(0deg, transparent, ${color} 200%)`,
          borderBottom: '1px solid var(--color-border)',
        }}
      >
        <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: color }} />
        <span className="text-xs font-semibold uppercase tracking-wide text-fg-secondary">
          {labelFor(type)}
        </span>
        {title && (
          <span className="ml-auto text-xs text-fg-muted truncate" title={title}>
            {title}
          </span>
        )}
      </header>

      {children && <div className="px-2.5 py-2 text-sm">{children}</div>}

      {rightHandles ? (
        rightHandles
      ) : hideSourceHandle ? null : (
        <Handle
          type="source"
          position={Position.Right}
          className="!w-2.5 !h-2.5"
          style={{ background: 'var(--color-bg-3)', borderColor: color }}
        />
      )}
    </div>
  );
}
