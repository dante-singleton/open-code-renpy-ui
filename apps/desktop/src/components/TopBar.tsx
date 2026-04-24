import { Button, IconButton } from '@renpy-ui/ui';

export function TopBar() {
  return (
    <header
      className={[
        'flex items-center justify-between h-11 shrink-0',
        'px-3 border-b border-[color:var(--color-border)] bg-bg-1',
      ].join(' ')}
    >
      <div className="flex items-center gap-2">
        <div
          className="w-6 h-6 rounded-md"
          style={{
            background: 'linear-gradient(135deg, var(--color-orange-500), var(--color-purple-500))',
          }}
          aria-hidden="true"
        />
        <span className="font-semibold tracking-tight text-md">Open-Code-RenPy-UI</span>
        <span className="ml-2 px-1.5 py-0.5 rounded-xs text-[10px] font-semibold uppercase tracking-wider text-purple-200 bg-[color:var(--color-purple-700)]/40 border border-[color:var(--color-purple-700)]/60">
          pre-alpha
        </span>
      </div>
      <div className="flex items-center gap-2">
        <IconButton label="Undo" size="sm">
          <span aria-hidden>↶</span>
        </IconButton>
        <IconButton label="Redo" size="sm">
          <span aria-hidden>↷</span>
        </IconButton>
        <div className="w-px h-5 bg-[color:var(--color-border)] mx-1" />
        <Button variant="ghost" size="sm">
          Generate
        </Button>
        <Button variant="primary" size="sm">
          Save
        </Button>
      </div>
    </header>
  );
}
