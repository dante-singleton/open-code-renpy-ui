import { Canvas } from '../panels/Canvas';
import { CodeLens } from '../panels/CodeLens';
import { Inspector } from '../panels/Inspector';
import { Problems } from '../panels/Problems';
import { Sidebar } from '../panels/Sidebar';

/**
 * Canvas tab layout. Owns the 4-pane workspace: scene list (left),
 * graph + inspector (center), problems + generated-rpy (bottom).
 *
 * Lazy-loaded by App; this is where @xyflow/react actually lands in the
 * bundle, so users never pay for it on the Characters / Variables tabs.
 */
export function CanvasView() {
  return (
    <div className="grid grid-cols-[260px_1fr] gap-2 h-full min-h-0">
      <Sidebar />
      <div className="grid grid-rows-[1fr_220px] gap-2 min-h-0">
        <div className="grid grid-cols-[1fr_320px] gap-2 min-h-0">
          <Canvas />
          <Inspector />
        </div>
        <div className="grid grid-cols-[1fr_1fr] gap-2 min-h-0">
          <Problems />
          <CodeLens />
        </div>
      </div>
    </div>
  );
}
