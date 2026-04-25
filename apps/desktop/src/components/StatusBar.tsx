import { useShallow } from 'zustand/react/shallow';
import { useProjectStore } from '../state/project';

export function StatusBar() {
  const { status, errorCount, warningCount, label, dirty, lastGenerated } = useProjectStore(
    useShallow((s) => ({
      status: s.status,
      errorCount: s.diagnostics.filter((d) => d.severity === 'error').length,
      warningCount: s.diagnostics.filter((d) => d.severity === 'warning').length,
      label: s.storage?.label ?? '(no project)',
      dirty: s.dirty.size,
      lastGenerated: s.lastGenerated,
    })),
  );

  const dot =
    status === 'error'
      ? 'bg-danger'
      : status === 'idle' && errorCount === 0
        ? 'bg-success'
        : 'bg-warning';

  return (
    <footer
      className={[
        'flex items-center justify-between h-7 shrink-0',
        'px-3 border-t border-[color:var(--color-border)] bg-bg-1',
        'text-xs text-fg-secondary',
      ].join(' ')}
    >
      <div className="flex items-center gap-4">
        <span className="flex items-center gap-1.5">
          <span className={`inline-block w-1.5 h-1.5 rounded-full ${dot}`} aria-hidden />
          {humanStatus(status)}
        </span>
        <span className="truncate max-w-[40ch]" title={label}>
          {label}
        </span>
        {dirty > 0 && <span className="text-orange-400">● {dirty} unsaved</span>}
      </div>
      <div className="flex items-center gap-4">
        {errorCount > 0 && (
          <span className="text-[color:var(--color-danger)]">errors: {errorCount}</span>
        )}
        {warningCount > 0 && (
          <span className="text-[color:var(--color-warning)]">warnings: {warningCount}</span>
        )}
        {lastGenerated && (
          <span className="text-fg-muted">
            generated: {lastGenerated.written + lastGenerated.unchanged} files
          </span>
        )}
        <span>spec v1.0.0</span>
      </div>
    </footer>
  );
}

function humanStatus(s: string): string {
  switch (s) {
    case 'idle':
      return 'Idle';
    case 'opening':
      return 'Opening…';
    case 'loading':
      return 'Loading…';
    case 'saving':
      return 'Saving…';
    case 'generating':
      return 'Generating…';
    case 'error':
      return 'Error';
    default:
      return s;
  }
}
