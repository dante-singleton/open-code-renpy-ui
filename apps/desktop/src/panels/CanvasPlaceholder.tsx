import { Panel } from '@renpy-ui/ui';
import { Background, Controls, MiniMap, ReactFlow, ReactFlowProvider } from '@xyflow/react';
import type { Edge, Node } from '@xyflow/react';

// Placeholder nodes so the canvas isn't empty in M0. Real scene nodes land in M2.
const nodes: Node[] = [
  {
    id: 'start',
    position: { x: 0, y: 0 },
    data: { label: 'start' },
    type: 'input',
    style: {
      background: 'var(--color-bg-2)',
      color: 'var(--color-text-primary)',
      border: '1px solid var(--color-border)',
      borderRadius: 10,
      padding: 10,
      boxShadow: 'var(--shadow-md)',
    },
  },
  {
    id: 'say',
    position: { x: 220, y: 40 },
    data: { label: 'say "Hello!"' },
    style: {
      background: 'var(--color-bg-2)',
      color: 'var(--color-text-primary)',
      border: '1px solid var(--color-border)',
      borderLeft: '3px solid var(--node-narrative)',
      borderRadius: 10,
      padding: 10,
    },
  },
  {
    id: 'end',
    position: { x: 460, y: 80 },
    data: { label: 'end' },
    type: 'output',
    style: {
      background: 'var(--color-bg-2)',
      color: 'var(--color-text-primary)',
      border: '1px solid var(--color-border)',
      borderRadius: 10,
      padding: 10,
    },
  },
];

const edges: Edge[] = [
  { id: 'e1', source: 'start', target: 'say' },
  { id: 'e2', source: 'say', target: 'end' },
];

export function CanvasPlaceholder() {
  return (
    <Panel heading="Canvas · (placeholder)" scrollable={false}>
      <div className="w-full h-full">
        <ReactFlowProvider>
          <ReactFlow
            defaultNodes={nodes}
            defaultEdges={edges}
            fitView
            proOptions={{ hideAttribution: false }}
          >
            <Background gap={18} size={1} color="var(--rf-background-pattern-color)" />
            <MiniMap pannable zoomable nodeColor={() => 'var(--color-orange-500)'} />
            <Controls showInteractive={false} />
          </ReactFlow>
        </ReactFlowProvider>
      </div>
    </Panel>
  );
}
