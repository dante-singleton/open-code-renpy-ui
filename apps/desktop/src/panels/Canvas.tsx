import type { SceneEdge, SceneNode } from '@renpy-ui/spec';
import { Panel } from '@renpy-ui/ui';
import {
  Background,
  type Connection,
  Controls,
  type Edge,
  type EdgeChange,
  MiniMap,
  type Node,
  type NodeChange,
  ReactFlow,
  ReactFlowProvider,
} from '@xyflow/react';
import { useCallback, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { type CustomNodeData, NODE_TYPE_COMPONENTS } from '../components/nodes';
import { newEntityId, selectActiveScene, useProjectStore } from '../state/project';
import { CATEGORY_COLOR, categoryFor } from '../state/templates';

/** Map our SceneNode -> React Flow Node. */
function toRfNode(spec: SceneNode, selected: boolean): Node<CustomNodeData> {
  return {
    id: spec.id,
    type: spec.type,
    position: spec.position,
    data: { specNode: spec },
    selected,
  };
}

function toRfEdge(spec: SceneEdge, selected: boolean): Edge {
  // Use a coloured stroke per source node category if known; falls back to a
  // neutral edge. We don't have the source node here, so leave styling to CSS
  // and only set selection.
  return {
    id: spec.id,
    source: spec.source,
    target: spec.target,
    sourceHandle: spec.sourceHandle ?? null,
    label: spec.label,
    selected,
    type: 'default',
  };
}

export function Canvas() {
  const scene = useProjectStore(selectActiveScene);
  const { selectedNodeIds, selectedEdgeIds } = useProjectStore(
    useShallow((s) => ({
      selectedNodeIds: s.selectedNodeIds,
      selectedEdgeIds: s.selectedEdgeIds,
    })),
  );
  const moveNode = useProjectStore((s) => s.moveNode);
  const removeNodes = useProjectStore((s) => s.removeNodes);
  const removeEdges = useProjectStore((s) => s.removeEdges);
  const addEdge = useProjectStore((s) => s.addEdge);
  const selectNodes = useProjectStore((s) => s.selectNodes);
  const selectEdges = useProjectStore((s) => s.selectEdges);

  const selectedNodeSet = useMemo(() => new Set(selectedNodeIds), [selectedNodeIds]);
  const selectedEdgeSet = useMemo(() => new Set(selectedEdgeIds), [selectedEdgeIds]);

  const nodes = useMemo<Node<CustomNodeData>[]>(
    () => scene?.nodes.map((n) => toRfNode(n, selectedNodeSet.has(n.id))) ?? [],
    [scene?.nodes, selectedNodeSet],
  );

  const edges = useMemo<Edge[]>(
    () => scene?.edges.map((e) => toRfEdge(e, selectedEdgeSet.has(e.id))) ?? [],
    [scene?.edges, selectedEdgeSet],
  );

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      // We translate React Flow's change events into store actions instead of
      // mirroring its flat `nodes` array, so the spec stays the source of truth.
      const idsToRemove: string[] = [];
      const newSelection = new Set(selectedNodeSet);
      for (const change of changes) {
        if (change.type === 'position' && change.position && !change.dragging) {
          moveNode(change.id, change.position);
        } else if (change.type === 'remove') {
          idsToRemove.push(change.id);
        } else if (change.type === 'select') {
          if (change.selected) newSelection.add(change.id);
          else newSelection.delete(change.id);
        } else if (change.type === 'position' && change.position && change.dragging) {
          // Live-drag: update without committing to history (still reflected
          // in the store so the move is visible). Throttling could be added
          // in M8 if needed; in practice react-flow throttles internally.
          moveNode(change.id, change.position);
        }
      }
      if (idsToRemove.length) removeNodes(idsToRemove);
      if (newSelection.size !== selectedNodeSet.size || idsToRemove.length) {
        selectNodes([...newSelection]);
      }
    },
    [moveNode, removeNodes, selectNodes, selectedNodeSet],
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      const idsToRemove: string[] = [];
      const newSelection = new Set(selectedEdgeSet);
      for (const change of changes) {
        if (change.type === 'remove') idsToRemove.push(change.id);
        else if (change.type === 'select') {
          if (change.selected) newSelection.add(change.id);
          else newSelection.delete(change.id);
        }
      }
      if (idsToRemove.length) removeEdges(idsToRemove);
      if (newSelection.size !== selectedEdgeSet.size) selectEdges([...newSelection]);
    },
    [removeEdges, selectEdges, selectedEdgeSet],
  );

  const onConnect = useCallback(
    (conn: Connection) => {
      if (!conn.source || !conn.target) return;
      addEdge({
        id: newEntityId('e'),
        source: conn.source,
        target: conn.target,
        ...(conn.sourceHandle ? { sourceHandle: conn.sourceHandle } : {}),
      });
    },
    [addEdge],
  );

  const onPaneClick = useCallback(() => {
    selectNodes([]);
    selectEdges([]);
  }, [selectNodes, selectEdges]);

  if (!scene) {
    return (
      <Panel heading="Canvas" scrollable={false}>
        <div className="h-full grid place-items-center text-fg-muted text-sm">
          No scene selected.
        </div>
      </Panel>
    );
  }

  return (
    <Panel heading={`Canvas · ${scene.title}`} scrollable={false}>
      <div className="w-full h-full">
        <ReactFlowProvider>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={NODE_TYPE_COMPONENTS}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onPaneClick={onPaneClick}
            fitView
            fitViewOptions={{ padding: 0.25 }}
            deleteKeyCode={['Backspace', 'Delete']}
            multiSelectionKeyCode={['Meta', 'Control']}
            proOptions={{ hideAttribution: false }}
          >
            <Background gap={18} size={1} color="var(--rf-background-pattern-color)" />
            <MiniMap
              pannable
              zoomable
              nodeColor={(n) => {
                const node = scene.nodes.find((x) => x.id === n.id);
                return node ? CATEGORY_COLOR[categoryFor(node.type)] : 'var(--node-flow)';
              }}
            />
            <Controls showInteractive={false} />
          </ReactFlow>
        </ReactFlowProvider>
      </div>
    </Panel>
  );
}
