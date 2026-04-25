import type { IfNode, MenuNode, SceneNode, SceneNodeType } from '@renpy-ui/spec';
/**
 * Custom React Flow node components per scene-node category.
 *
 * Each component receives `NodeProps<Node<CustomNodeData>>` from React Flow
 * (every node carries the same `data` shape). Branching nodes (menu / if)
 * emit multiple right-side handles, one per choice/branch, with id
 * `choice:<id>` / `branch:<id>` (matching the codegen convention).
 */
import { Handle, type Node, type NodeProps, Position } from '@xyflow/react';
import type { ReactNode } from 'react';
import { useProjectStore } from '../../state/project';
import { categoryFor } from '../../state/templates';
import { BaseNode } from './BaseNode';

export interface CustomNodeData extends Record<string, unknown> {
  specNode: SceneNode;
}

export type CustomNode = Node<CustomNodeData>;
export type CustomNodeProps = NodeProps<CustomNode>;

function useCharacterName(characterId: string | undefined): string | undefined {
  return useProjectStore((s) => {
    if (!characterId || !s.bundle) return undefined;
    return s.bundle.characters.characters.find((c) => c.id === characterId)?.displayName;
  });
}

function preview(text: string, max = 60): string {
  const t = text.replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

function genericNode(spec: SceneNode, selected: boolean, body?: ReactNode) {
  const cat = categoryFor(spec.type);
  return (
    <BaseNode
      type={spec.type}
      category={cat}
      selected={selected}
      hideTargetHandle={spec.type === 'start'}
      hideSourceHandle={spec.type === 'end' || spec.type === 'return'}
    >
      {body}
    </BaseNode>
  );
}

// ---------- Single-handle variants ----------

function StartCard({ data, selected }: CustomNodeProps) {
  return genericNode(
    data.specNode,
    !!selected,
    <p className="text-fg-muted text-xs">Scene entry point</p>,
  );
}

function EndCard({ data, selected }: CustomNodeProps) {
  return genericNode(
    data.specNode,
    !!selected,
    <p className="text-fg-muted text-xs">Returns from the scene</p>,
  );
}

function LabelCard({ data, selected }: CustomNodeProps) {
  const node = data.specNode as Extract<SceneNode, { type: 'label' }>;
  return genericNode(node, !!selected, <p className="font-mono text-xs">label {node.name}:</p>);
}

function JumpCard({ data, selected }: CustomNodeProps) {
  const node = data.specNode as Extract<SceneNode, { type: 'jump' }>;
  return genericNode(node, !!selected, <p className="font-mono text-xs">jump {node.target}</p>);
}

function CallCard({ data, selected }: CustomNodeProps) {
  const node = data.specNode as Extract<SceneNode, { type: 'call' }>;
  return genericNode(node, !!selected, <p className="font-mono text-xs">call {node.target}</p>);
}

function ReturnCard({ data, selected }: CustomNodeProps) {
  return genericNode(data.specNode, !!selected, <p className="font-mono text-xs">return</p>);
}

function SayCard({ data, selected }: CustomNodeProps) {
  const node = data.specNode as Extract<SceneNode, { type: 'say' }>;
  const charName = useCharacterName(node.characterId);
  return genericNode(
    node,
    !!selected,
    <div className="space-y-1">
      <div className="text-xs uppercase tracking-wide text-fg-muted">
        {charName ?? (node.characterId ? '(missing character)' : 'Narrator')}
        {node.expressionName ? ` · ${node.expressionName}` : ''}
      </div>
      <div className="text-sm leading-snug">{preview(node.text || '(empty)')}</div>
    </div>,
  );
}

function NarrationCard({ data, selected }: CustomNodeProps) {
  const node = data.specNode as Extract<SceneNode, { type: 'narration' }>;
  return genericNode(
    node,
    !!selected,
    <div className="text-sm italic leading-snug">{preview(node.text || '(empty)')}</div>,
  );
}

function PauseCard({ data, selected }: CustomNodeProps) {
  const node = data.specNode as Extract<SceneNode, { type: 'pause' }>;
  return genericNode(
    node,
    !!selected,
    <div className="text-sm">{node.seconds != null ? `pause ${node.seconds}s` : 'pause'}</div>,
  );
}

function SceneBgCard({ data, selected }: CustomNodeProps) {
  const node = data.specNode as Extract<SceneNode, { type: 'sceneBg' }>;
  return genericNode(
    node,
    !!selected,
    <div className="text-xs font-mono break-all">{node.background}</div>,
  );
}

function ShowCard({ data, selected }: CustomNodeProps) {
  const node = data.specNode as Extract<SceneNode, { type: 'show' }>;
  const name = useCharacterName(node.characterId);
  return genericNode(
    node,
    !!selected,
    <div className="text-sm">
      <div>{name ?? '(missing character)'}</div>
      {node.expressionName && <div className="text-xs text-fg-muted">{node.expressionName}</div>}
    </div>,
  );
}

function HideCard({ data, selected }: CustomNodeProps) {
  const node = data.specNode as Extract<SceneNode, { type: 'hide' }>;
  const name = useCharacterName(node.characterId);
  return genericNode(
    node,
    !!selected,
    <div className="text-sm">{name ?? '(missing character)'}</div>,
  );
}

function TransitionCard({ data, selected }: CustomNodeProps) {
  const node = data.specNode as Extract<SceneNode, { type: 'transition' }>;
  return genericNode(node, !!selected, <div className="text-sm font-mono">with {node.name}</div>);
}

function CameraCard({ data, selected }: CustomNodeProps) {
  const node = data.specNode as Extract<SceneNode, { type: 'camera' }>;
  return genericNode(node, !!selected, <div className="text-sm">{node.action}</div>);
}

function PlayMusicCard({ data, selected }: CustomNodeProps) {
  const node = data.specNode as Extract<SceneNode, { type: 'playMusic' }>;
  return genericNode(
    node,
    !!selected,
    <div className="text-xs font-mono break-all">{node.asset}</div>,
  );
}

function StopMusicCard({ data, selected }: CustomNodeProps) {
  const node = data.specNode as Extract<SceneNode, { type: 'stopMusic' }>;
  return genericNode(
    node,
    !!selected,
    <div className="text-sm">stop {node.channel ?? 'music'}</div>,
  );
}

function PlaySoundCard({ data, selected }: CustomNodeProps) {
  const node = data.specNode as Extract<SceneNode, { type: 'playSound' }>;
  return genericNode(
    node,
    !!selected,
    <div className="text-xs font-mono break-all">{node.asset}</div>,
  );
}

function PlayVoiceCard({ data, selected }: CustomNodeProps) {
  const node = data.specNode as Extract<SceneNode, { type: 'playVoice' }>;
  return genericNode(
    node,
    !!selected,
    <div className="text-xs font-mono break-all">{node.asset}</div>,
  );
}

function QueueCard({ data, selected }: CustomNodeProps) {
  const node = data.specNode as Extract<SceneNode, { type: 'queue' }>;
  return genericNode(
    node,
    !!selected,
    <div className="text-xs font-mono break-all">
      queue {node.channel}: {node.asset}
    </div>,
  );
}

function SetVarCard({ data, selected }: CustomNodeProps) {
  const node = data.specNode as Extract<SceneNode, { type: 'setVar' }>;
  return genericNode(
    node,
    !!selected,
    <div className="text-xs font-mono break-all">
      {node.variable} = {node.expression}
    </div>,
  );
}

function IncrementCard({ data, selected }: CustomNodeProps) {
  const node = data.specNode as Extract<SceneNode, { type: 'increment' }>;
  const op = node.delta >= 0 ? '+=' : '-=';
  return genericNode(
    node,
    !!selected,
    <div className="text-xs font-mono break-all">
      {node.variable} {op} {Math.abs(node.delta)}
    </div>,
  );
}

function PythonCard({ data, selected }: CustomNodeProps) {
  const node = data.specNode as Extract<SceneNode, { type: 'python' }>;
  return genericNode(
    node,
    !!selected,
    <pre className="text-xs font-mono whitespace-pre-wrap break-all">{preview(node.code, 80)}</pre>,
  );
}

function InventoryOpCard({ data, selected }: CustomNodeProps) {
  const node = data.specNode as Extract<SceneNode, { type: 'inventoryOp' }>;
  return genericNode(
    node,
    !!selected,
    <div className="text-xs font-mono break-all">
      {node.op} {node.itemId} × {node.quantity ?? 1}
    </div>,
  );
}

function StatOpCard({ data, selected }: CustomNodeProps) {
  const node = data.specNode as Extract<SceneNode, { type: 'statOp' }>;
  return genericNode(
    node,
    !!selected,
    <div className="text-xs font-mono break-all">
      {node.op} {node.stat} {node.value}
    </div>,
  );
}

function RelationshipOpCard({ data, selected }: CustomNodeProps) {
  const node = data.specNode as Extract<SceneNode, { type: 'relationshipOp' }>;
  const name = useCharacterName(node.characterId);
  return genericNode(
    node,
    !!selected,
    <div className="text-xs font-mono break-all">
      {name ?? '(missing)'} · {node.track ?? 'love'} {node.op} {node.value}
    </div>,
  );
}

function ScreenOpCard({ data, selected }: CustomNodeProps) {
  const node = data.specNode as Extract<
    SceneNode,
    { type: 'showScreen' | 'hideScreen' | 'callScreen' }
  >;
  const screenName = useProjectStore(
    (s) => s.bundle?.screens.find((sc) => sc.id === node.screenId)?.name,
  );
  return genericNode(
    node,
    !!selected,
    <div className="text-xs font-mono break-all">{screenName ?? '(missing screen)'}</div>,
  );
}

// ---------- Multi-handle variants ----------

function MenuCard({ data, selected }: CustomNodeProps) {
  const node = data.specNode as MenuNode;
  return (
    <BaseNode
      type="menu"
      category="narrative"
      selected={!!selected}
      rightHandles={
        <div className="relative pb-1">
          {node.choices.map((choice, i) => (
            <div
              key={choice.id}
              className="relative flex items-center justify-end gap-2 px-2.5 py-1 text-sm"
              style={{ minHeight: 22 }}
            >
              <span className="text-xs text-fg truncate" title={choice.text}>
                {choice.text || `choice ${i + 1}`}
              </span>
              <Handle
                type="source"
                position={Position.Right}
                id={`choice:${choice.id}`}
                className="!w-2.5 !h-2.5"
                style={{ background: 'var(--color-bg-3)', borderColor: 'var(--node-narrative)' }}
              />
            </div>
          ))}
        </div>
      }
    >
      {node.prompt && (
        <div className="text-xs italic text-fg-secondary mb-1">{preview(node.prompt, 60)}</div>
      )}
      <div className="text-xs text-fg-muted">{node.choices.length} choice(s)</div>
    </BaseNode>
  );
}

function IfCard({ data, selected }: CustomNodeProps) {
  const node = data.specNode as IfNode;
  return (
    <BaseNode
      type="if"
      category="logic"
      selected={!!selected}
      rightHandles={
        <div className="relative pb-1">
          {node.branches.map((branch, i) => (
            <div
              key={branch.id}
              className="relative flex items-center justify-end gap-2 px-2.5 py-1"
              style={{ minHeight: 22 }}
            >
              <span className="text-xs font-mono text-fg truncate" title={branch.condition}>
                {branch.condition === ''
                  ? 'else'
                  : i === 0
                    ? `if ${preview(branch.condition, 24)}`
                    : `elif ${preview(branch.condition, 24)}`}
              </span>
              <Handle
                type="source"
                position={Position.Right}
                id={`branch:${branch.id}`}
                className="!w-2.5 !h-2.5"
                style={{ background: 'var(--color-bg-3)', borderColor: 'var(--node-logic)' }}
              />
            </div>
          ))}
        </div>
      }
    >
      <div className="text-xs text-fg-muted">{node.branches.length} branch(es)</div>
    </BaseNode>
  );
}

// ---------- Registration ----------

export const NODE_TYPE_COMPONENTS: Record<SceneNodeType, React.ComponentType<CustomNodeProps>> = {
  start: StartCard,
  end: EndCard,
  label: LabelCard,
  jump: JumpCard,
  call: CallCard,
  return: ReturnCard,
  say: SayCard,
  narration: NarrationCard,
  menu: MenuCard,
  pause: PauseCard,
  sceneBg: SceneBgCard,
  show: ShowCard,
  hide: HideCard,
  transition: TransitionCard,
  camera: CameraCard,
  playMusic: PlayMusicCard,
  stopMusic: StopMusicCard,
  playSound: PlaySoundCard,
  playVoice: PlayVoiceCard,
  queue: QueueCard,
  if: IfCard,
  setVar: SetVarCard,
  increment: IncrementCard,
  python: PythonCard,
  inventoryOp: InventoryOpCard,
  statOp: StatOpCard,
  relationshipOp: RelationshipOpCard,
  showScreen: ScreenOpCard,
  hideScreen: ScreenOpCard,
  callScreen: ScreenOpCard,
};
