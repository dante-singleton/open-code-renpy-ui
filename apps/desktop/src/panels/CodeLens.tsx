import { buildSymbolTable, emitScene } from '@renpy-ui/codegen';
import { Panel, cn } from '@renpy-ui/ui';
import { useMemo, useState } from 'react';
import { selectActiveScene, useProjectStore } from '../state/project';

/**
 * Live preview of the .rpy that the active scene would emit. Updates on every
 * graph mutation so the user can see exactly what their canvas produces.
 *
 * This is intentionally read-only and offered as a collapsible footer so it
 * stays out of the way until needed.
 */
export function CodeLens() {
  const scene = useProjectStore(selectActiveScene);
  const bundle = useProjectStore((s) => s.bundle);
  const [open, setOpen] = useState(false);

  const code = useMemo(() => {
    if (!scene || !bundle) return '';
    try {
      return emitScene(scene, buildSymbolTable(bundle));
    } catch (err) {
      return `# emitter error: ${err instanceof Error ? err.message : String(err)}\n`;
    }
  }, [scene, bundle]);

  return (
    <Panel
      heading={scene ? `Generated · scenes/${scene.label}.rpy` : 'Generated'}
      actions={
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="text-xs text-fg-secondary hover:text-fg"
        >
          {open ? 'Collapse' : 'Expand'}
        </button>
      }
    >
      {open ? (
        <pre
          className={cn(
            'p-3 m-0 text-xs font-mono leading-snug whitespace-pre',
            'bg-bg-0 text-fg overflow-auto',
          )}
        >
          {code || '(no scene selected)'}
        </pre>
      ) : (
        <div className="p-3 text-xs text-fg-muted italic">
          Click "Expand" to preview the generated .rpy for the active scene.
        </div>
      )}
    </Panel>
  );
}
