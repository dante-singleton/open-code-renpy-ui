import { cn } from '@renpy-ui/ui';
import { useShallow } from 'zustand/react/shallow';
import { useProjectStore } from '../state/project';
import { type WorkspaceTab, useWorkspaceStore } from '../state/workspace';

const TABS: Array<{ id: WorkspaceTab; label: string }> = [
  { id: 'canvas', label: 'Canvas' },
  { id: 'characters', label: 'Characters' },
  { id: 'variables', label: 'Variables' },
  { id: 'assets', label: 'Assets' },
];

export function WorkspaceTabs() {
  const tab = useWorkspaceStore((s) => s.tab);
  const setTab = useWorkspaceStore((s) => s.setTab);

  const counts = useProjectStore(
    useShallow((s) => ({
      characters: s.bundle?.characters.characters.length ?? 0,
      variables: s.bundle?.variables.variables.length ?? 0,
      assets: s.bundle?.assets.assets.length ?? 0,
    })),
  );

  return (
    <div
      role="tablist"
      aria-label="Workspace"
      className="flex items-center gap-0.5 px-2 h-9 bg-bg-1 border-b border-[color:var(--color-border)]"
    >
      {TABS.map((t) => {
        const active = tab === t.id;
        const count =
          t.id === 'characters'
            ? counts.characters
            : t.id === 'variables'
              ? counts.variables
              : t.id === 'assets'
                ? counts.assets
                : null;
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => setTab(t.id)}
            className={cn(
              'h-7 px-3 rounded-md text-xs font-medium transition-colors',
              active
                ? 'bg-bg-3 text-fg border-b-2 border-orange-500'
                : 'text-fg-secondary hover:bg-bg-2 hover:text-fg',
            )}
          >
            {t.label}
            {count !== null && count > 0 && (
              <span className="ml-1.5 text-[10px] text-fg-muted font-mono">{count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
