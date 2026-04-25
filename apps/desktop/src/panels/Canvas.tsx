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

function toRfEdge(spec: SceneEdge, selected: boolean, derivedLabel: string | undefined): Edge {
  return {
    id: spec.id,
    source: spec.source,
    target: spec.target,
    sourceHandle: spec.sourceHandle ?? null,
    label: spec.label ?? derivedLabel,
    selected,
    type: 'default',
    labelBgPadding: derivedLabel ? [6, 2] : undefined,
    labelBgBorderRadius: 4,
    labelBgStyle: derivedLabel
      ? {
          fill: 'var(--color-bg-2)',
          stroke: 'var(--color-border)',
        }
      : undefined,
    labelStyle: derivedLabel
      ? {
          fill: 'var(--color-text-secondary)',
          fontSize: 10,
          fontFamily: 'JetBrains Mono Variable, monospace',
        }
      : undefined,
  };
}

/**
 * Pull a short human label from a sourceHandle of `choice:<id>` or
 * `branch:<id>` by looking up the corresponding choice/branch object.
 */
function deriveEdgeLabel(
  spec: SceneEdge,
  scene: import('@renpy-ui/spec').SceneSpec,
): string | undefined {
  if (!spec.sourceHandle) return undefined;
  const source = scene.nodes.find((n) => n.id === spec.source);
  if (!source) return undefined;
  if (source.type === 'menu' && spec.sourceHandle.startsWith('choice:')) {
    const choiceId = spec.sourceHandle.slice('choice:'.length);
    const choice = source.choices.find((c) => c.id === choiceId);
    return shorten(choice?.text ?? 'choice');
  }
  if (source.type === 'if' && spec.sourceHandle.startsWith('branch:')) {
    const branchId = spec.sourceHandle.slice('branch:'.length);
    const i = source.branches.findIndex((b) => b.id === branchId);
    const branch = source.branches[i];
    if (!branch) return undefined;
    if (branch.condition === '') return 'else';
    return `${i === 0 ? 'if' : 'elif'} ${shorten(branch.condition, 18)}`;
  }
  return undefined;
}

function shorten(text: string, max = 20): string {
  const t = text.replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max - 1)}\u2026` : t;
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
    () =>
      scene?.edges.map((e) => toRfEdge(e, selectedEdgeSet.has(e.id), deriveEdgeLabel(e, scene))) ??
      [],
    [scene, selectedEdgeSet],
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
