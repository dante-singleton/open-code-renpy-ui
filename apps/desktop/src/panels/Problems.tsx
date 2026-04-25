import { Panel, cn } from '@renpy-ui/ui';
import type { Severity } from '@renpy-ui/validators';
import { useShallow } from 'zustand/react/shallow';
import { useProjectStore } from '../state/project';

const SEVERITY_DOT: Record<Severity, string> = {
  error: 'bg-[color:var(--color-danger)]',
  warning: 'bg-[color:var(--color-warning)]',
  info: 'bg-[color:var(--color-info)]',
};

const SEVERITY_LABEL: Record<Severity, string> = {
  error: 'Error',
  warning: 'Warning',
  info: 'Info',
};

const SCENE_PREFIX = '.renpy-ui/scenes/';

export function Problems() {
  const diagnostics = useProjectStore((s) => s.diagnostics);
  const { setActiveScene, selectNodes } = useProjectStore(
    useShallow((s) => ({ setActiveScene: s.setActiveScene, selectNodes: s.selectNodes })),
  );
  const scenes = useProjectStore(useShallow((s) => s.bundle?.scenes ?? []));

  function jumpTo(diagnostic: (typeof diagnostics)[number]): void {
    if (!diagnostic.source?.startsWith(SCENE_PREFIX)) return;
    const label = diagnostic.source.slice(SCENE_PREFIX.length, -'.json'.length);
    const target = scenes.find((s) => s.label === label);
    if (!target) return;
    setActiveScene(target.id);
    if (diagnostic.location) selectNodes([diagnostic.location]);
  }

  return (
    <Panel heading={diagnostics.length > 0 ? `Problems (${diagnostics.length})` : 'Problems'}>
      {diagnostics.length === 0 ? (
        <div className="p-3 text-xs text-fg-muted italic">No problems detected.</div>
      ) : (
        <ul className="divide-y divide-[color:var(--color-divider)]">
          {diagnostics.map((d, i) => (
            <li key={`${d.code}-${i}`}>
              <button
                type="button"
                onClick={() => jumpTo(d)}
                className={cn(
                  'w-full text-left px-3 py-1.5 flex items-start gap-2 text-xs',
                  'hover:bg-bg-2',
                )}
              >
                <span
                  className={cn(
                    'inline-block w-1.5 h-1.5 rounded-full mt-1.5 shrink-0',
                    SEVERITY_DOT[d.severity],
                  )}
                  aria-label={SEVERITY_LABEL[d.severity]}
                />
                <div className="flex-1 min-w-0 space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] uppercase tracking-wider text-fg-muted">
                      {d.code}
                    </span>
                    {d.source && (
                      <span className="font-mono text-[10px] text-fg-muted truncate">
                        {d.source}
                        {d.location && ` :: ${d.location}`}
                      </span>
                    )}
                  </div>
                  <div className="text-fg">{d.message}</div>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
