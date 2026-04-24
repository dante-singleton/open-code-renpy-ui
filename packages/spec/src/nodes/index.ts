import { z } from 'zod';
import { AssetRef, Expression, Id, Position, RenPyIdentifier } from '../primitives';

/**
 * Scene node schemas. See SPEC.md §8.
 * The module exports one Zod schema per node kind plus a discriminated-union
 * `SceneNode` schema.
 */

const NodeBaseShape = {
  id: Id,
  position: Position,
  comment: z.string().optional(),
} as const;

// ---------- Flow ----------

export const StartNode = z.object({ ...NodeBaseShape, type: z.literal('start') });
export const EndNode = z.object({ ...NodeBaseShape, type: z.literal('end') });
export const LabelNode = z.object({
  ...NodeBaseShape,
  type: z.literal('label'),
  name: RenPyIdentifier,
});
export const JumpNode = z.object({
  ...NodeBaseShape,
  type: z.literal('jump'),
  target: RenPyIdentifier,
});
export const CallNode = z.object({
  ...NodeBaseShape,
  type: z.literal('call'),
  target: RenPyIdentifier,
});
export const ReturnNode = z.object({ ...NodeBaseShape, type: z.literal('return') });

// ---------- Narrative ----------

export const SayNode = z.object({
  ...NodeBaseShape,
  type: z.literal('say'),
  characterId: Id.optional(),
  expressionName: z.string().optional(),
  text: z.string(),
  attributes: z.array(z.string()).optional(),
  withTransition: z.string().optional(),
  voice: AssetRef.optional(),
});

export const NarrationNode = z.object({
  ...NodeBaseShape,
  type: z.literal('narration'),
  text: z.string(),
});

export const MenuChoice = z.object({
  id: Id,
  text: z.string(),
  condition: Expression.optional(),
});

export const MenuNode = z.object({
  ...NodeBaseShape,
  type: z.literal('menu'),
  prompt: z.string().optional(),
  choices: z.array(MenuChoice).min(1),
});

export const PauseNode = z.object({
  ...NodeBaseShape,
  type: z.literal('pause'),
  seconds: z.number().nonnegative().optional(),
});

// ---------- Stage ----------

export const SceneBgNode = z.object({
  ...NodeBaseShape,
  type: z.literal('sceneBg'),
  background: AssetRef,
  imageTag: RenPyIdentifier.optional(),
  withTransition: z.string().optional(),
});

export const ShowNode = z.object({
  ...NodeBaseShape,
  type: z.literal('show'),
  characterId: Id,
  expressionName: z.string().optional(),
  at: z.string().optional(),
  withTransition: z.string().optional(),
  zorder: z.number().int().optional(),
});

export const HideNode = z.object({
  ...NodeBaseShape,
  type: z.literal('hide'),
  characterId: Id,
  withTransition: z.string().optional(),
});

export const TransitionNode = z.object({
  ...NodeBaseShape,
  type: z.literal('transition'),
  name: z.string(),
});

export const CameraNode = z.object({
  ...NodeBaseShape,
  type: z.literal('camera'),
  action: z.enum(['zoom', 'pan', 'shake', 'reset']),
  params: z.record(z.string(), z.union([z.number(), z.string()])).optional(),
});

// ---------- Audio ----------

export const PlayMusicNode = z.object({
  ...NodeBaseShape,
  type: z.literal('playMusic'),
  asset: AssetRef,
  fadeIn: z.number().nonnegative().optional(),
  loop: z.boolean().optional(),
  channel: z.string().optional(),
});

export const StopMusicNode = z.object({
  ...NodeBaseShape,
  type: z.literal('stopMusic'),
  channel: z.string().optional(),
  fadeOut: z.number().nonnegative().optional(),
});

export const PlaySoundNode = z.object({
  ...NodeBaseShape,
  type: z.literal('playSound'),
  asset: AssetRef,
  channel: z.string().optional(),
});

export const PlayVoiceNode = z.object({
  ...NodeBaseShape,
  type: z.literal('playVoice'),
  asset: AssetRef,
});

export const QueueNode = z.object({
  ...NodeBaseShape,
  type: z.literal('queue'),
  channel: z.string(),
  asset: AssetRef,
});

// ---------- Logic ----------

export const IfBranch = z.object({
  id: Id,
  /** Empty string indicates the `else` branch; must be last. */
  condition: Expression,
});

export const IfNode = z.object({
  ...NodeBaseShape,
  type: z.literal('if'),
  branches: z.array(IfBranch).min(1),
});

export const SetVarNode = z.object({
  ...NodeBaseShape,
  type: z.literal('setVar'),
  variable: RenPyIdentifier,
  expression: Expression,
});

export const IncrementNode = z.object({
  ...NodeBaseShape,
  type: z.literal('increment'),
  variable: RenPyIdentifier,
  delta: z.number(),
});

export const PythonBlockNode = z.object({
  ...NodeBaseShape,
  type: z.literal('python'),
  code: z.string(),
});

// ---------- Systems ----------

export const InventoryOpNode = z.object({
  ...NodeBaseShape,
  type: z.literal('inventoryOp'),
  op: z.enum(['add', 'remove', 'set']),
  itemId: RenPyIdentifier,
  quantity: z.number().int().optional(),
});

export const StatOpNode = z.object({
  ...NodeBaseShape,
  type: z.literal('statOp'),
  stat: RenPyIdentifier,
  op: z.enum(['add', 'subtract', 'set']),
  value: z.number(),
});

export const RelationshipOpNode = z.object({
  ...NodeBaseShape,
  type: z.literal('relationshipOp'),
  characterId: Id,
  op: z.enum(['add', 'subtract', 'set']),
  value: z.number(),
  track: z.string().optional(),
});

// ---------- Screens ----------

export const ShowScreenNode = z.object({
  ...NodeBaseShape,
  type: z.literal('showScreen'),
  screenId: Id,
  args: z.record(z.string(), z.string()).optional(),
});

export const HideScreenNode = z.object({
  ...NodeBaseShape,
  type: z.literal('hideScreen'),
  screenId: Id,
});

export const CallScreenNode = z.object({
  ...NodeBaseShape,
  type: z.literal('callScreen'),
  screenId: Id,
  args: z.record(z.string(), z.string()).optional(),
});

// ---------- Union ----------

export const SceneNode = z.discriminatedUnion('type', [
  StartNode,
  EndNode,
  LabelNode,
  JumpNode,
  CallNode,
  ReturnNode,
  SayNode,
  NarrationNode,
  MenuNode,
  PauseNode,
  SceneBgNode,
  ShowNode,
  HideNode,
  TransitionNode,
  CameraNode,
  PlayMusicNode,
  StopMusicNode,
  PlaySoundNode,
  PlayVoiceNode,
  QueueNode,
  IfNode,
  SetVarNode,
  IncrementNode,
  PythonBlockNode,
  InventoryOpNode,
  StatOpNode,
  RelationshipOpNode,
  ShowScreenNode,
  HideScreenNode,
  CallScreenNode,
]);

export type SceneNode = z.infer<typeof SceneNode>;
export type SceneNodeType = SceneNode['type'];
export type StartNode = z.infer<typeof StartNode>;
export type EndNode = z.infer<typeof EndNode>;
export type LabelNode = z.infer<typeof LabelNode>;
export type JumpNode = z.infer<typeof JumpNode>;
export type CallNode = z.infer<typeof CallNode>;
export type ReturnNode = z.infer<typeof ReturnNode>;
export type SayNode = z.infer<typeof SayNode>;
export type NarrationNode = z.infer<typeof NarrationNode>;
export type MenuChoice = z.infer<typeof MenuChoice>;
export type MenuNode = z.infer<typeof MenuNode>;
export type PauseNode = z.infer<typeof PauseNode>;
export type SceneBgNode = z.infer<typeof SceneBgNode>;
export type ShowNode = z.infer<typeof ShowNode>;
export type HideNode = z.infer<typeof HideNode>;
export type TransitionNode = z.infer<typeof TransitionNode>;
export type CameraNode = z.infer<typeof CameraNode>;
export type PlayMusicNode = z.infer<typeof PlayMusicNode>;
export type StopMusicNode = z.infer<typeof StopMusicNode>;
export type PlaySoundNode = z.infer<typeof PlaySoundNode>;
export type PlayVoiceNode = z.infer<typeof PlayVoiceNode>;
export type QueueNode = z.infer<typeof QueueNode>;
export type IfBranch = z.infer<typeof IfBranch>;
export type IfNode = z.infer<typeof IfNode>;
export type SetVarNode = z.infer<typeof SetVarNode>;
export type IncrementNode = z.infer<typeof IncrementNode>;
export type PythonBlockNode = z.infer<typeof PythonBlockNode>;
export type InventoryOpNode = z.infer<typeof InventoryOpNode>;
export type StatOpNode = z.infer<typeof StatOpNode>;
export type RelationshipOpNode = z.infer<typeof RelationshipOpNode>;
export type ShowScreenNode = z.infer<typeof ShowScreenNode>;
export type HideScreenNode = z.infer<typeof HideScreenNode>;
export type CallScreenNode = z.infer<typeof CallScreenNode>;
