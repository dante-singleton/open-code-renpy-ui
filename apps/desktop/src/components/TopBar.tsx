import { Button, IconButton } from '@renpy-ui/ui';
import { useShallow } from 'zustand/react/shallow';
import { useProjectStore } from '../state/project';

export function TopBar() {
  const { dirtyCount, status, canPick } = useProjectStore(
    useShallow((s) => ({
      dirtyCount: s.dirty.size,
      status: s.status,
      canPick: s.storage?.canPickProject ?? false,
    })),
  );
  const openProject = useProjectStore((s) => s.openProject);
  const save = useProjectStore((s) => s.save);

  const undo = () => useProjectStore.temporal.getState().undo();
  const redo = () => useProjectStore.temporal.getState().redo();

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
          M2 · canvas
        </span>
      </div>

      <div className="flex items-center gap-2">
        {canPick && (
          <Button variant="ghost" size="sm" onClick={() => void openProject()}>
            Open Project…
          </Button>
        )}
        <IconButton label="Undo (Ctrl+Z)" size="sm" onClick={undo}>
          <span aria-hidden>↶</span>
        </IconButton>
        <IconButton label="Redo (Ctrl+Shift+Z)" size="sm" onClick={redo}>
          <span aria-hidden>↷</span>
        </IconButton>
        <div className="w-px h-5 bg-[color:var(--color-border)] mx-1" />
        <Button
          variant="primary"
          size="sm"
          onClick={() => void save()}
          disabled={status === 'saving' || status === 'generating'}
        >
          {status === 'saving' ? 'Saving…' : status === 'generating' ? 'Generating…' : 'Save'}
          {dirtyCount > 0 && status === 'idle' && (
            <span className="ml-1.5 px-1 rounded-xs text-[9px] font-bold bg-bg-0/40 text-[color:var(--color-text-inverse)]">
              {dirtyCount}
            </span>
          )}
        </Button>
      </div>
    </header>
  );
}
