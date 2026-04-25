import { Panel } from '@renpy-ui/ui';
import { NodeInspector } from '../components/inspector/NodeInspector';
import { selectActiveNode, useProjectStore } from '../state/project';

export function Inspector() {
  const node = useProjectStore(selectActiveNode);

  return (
    <Panel heading="Inspector">
      {node ? (
        <NodeInspector node={node} />
      ) : (
        <div className="p-4 text-sm text-fg-secondary">
          <p className="text-fg-muted">Nothing selected.</p>
          <p className="mt-2">Select a node on the canvas to edit its properties.</p>
        </div>
      )}
    </Panel>
  );
}
