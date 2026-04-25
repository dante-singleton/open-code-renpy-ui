import type { SceneNode, SceneNodeType } from '@renpy-ui/spec';
import { newNodeId } from './ids';

/**
 * Default constructors for each node type. Used by the quick-insert palette
 * and the inspector's "convert to" menu so the user always gets a valid node.
 */

export interface NodeCategoryDef {
  type: SceneNodeType;
  label: string;
  category: 'flow' | 'narrative' | 'stage' | 'audio' | 'logic' | 'systems' | 'screens';
}

export const NODE_CATALOG: NodeCategoryDef[] = [
  { type: 'start', label: 'Start', category: 'flow' },
  { type: 'end', label: 'End', category: 'flow' },
  { type: 'label', label: 'Label', category: 'flow' },
  { type: 'jump', label: 'Jump', category: 'flow' },
  { type: 'call', label: 'Call', category: 'flow' },
  { type: 'return', label: 'Return', category: 'flow' },
  { type: 'say', label: 'Say', category: 'narrative' },
  { type: 'narration', label: 'Narration', category: 'narrative' },
  { type: 'menu', label: 'Menu', category: 'narrative' },
  { type: 'pause', label: 'Pause', category: 'narrative' },
  { type: 'sceneBg', label: 'Scene Background', category: 'stage' },
  { type: 'show', label: 'Show', category: 'stage' },
  { type: 'hide', label: 'Hide', category: 'stage' },
  { type: 'transition', label: 'Transition', category: 'stage' },
  { type: 'camera', label: 'Camera', category: 'stage' },
  { type: 'playMusic', label: 'Play Music', category: 'audio' },
  { type: 'stopMusic', label: 'Stop Music', category: 'audio' },
  { type: 'playSound', label: 'Play Sound', category: 'audio' },
  { type: 'playVoice', label: 'Play Voice', category: 'audio' },
  { type: 'queue', label: 'Queue', category: 'audio' },
  { type: 'if', label: 'If / Else', category: 'logic' },
  { type: 'setVar', label: 'Set Variable', category: 'logic' },
  { type: 'increment', label: 'Increment', category: 'logic' },
  { type: 'python', label: 'Python Block', category: 'logic' },
  { type: 'inventoryOp', label: 'Inventory Op', category: 'systems' },
  { type: 'statOp', label: 'Stat Op', category: 'systems' },
  { type: 'relationshipOp', label: 'Relationship Op', category: 'systems' },
  { type: 'showScreen', label: 'Show Screen', category: 'screens' },
  { type: 'hideScreen', label: 'Hide Screen', category: 'screens' },
  { type: 'callScreen', label: 'Call Screen', category: 'screens' },
];

export const CATEGORY_COLOR: Record<NodeCategoryDef['category'], string> = {
  flow: 'var(--node-flow)',
  narrative: 'var(--node-narrative)',
  stage: 'var(--node-stage)',
  audio: 'var(--node-audio)',
  logic: 'var(--node-logic)',
  systems: 'var(--node-systems)',
  screens: 'var(--node-screens)',
};

export function categoryFor(type: SceneNodeType): NodeCategoryDef['category'] {
  return NODE_CATALOG.find((n) => n.type === type)?.category ?? 'flow';
}

export function labelFor(type: SceneNodeType): string {
  return NODE_CATALOG.find((n) => n.type === type)?.label ?? type;
}

/**
 * Build a default-constructed SceneNode of the requested type.
 * The caller supplies the position; the id is generated.
 */
export function makeNode(type: SceneNodeType, position: { x: number; y: number }): SceneNode {
  const id = newNodeId(type);
  switch (type) {
    case 'start':
      return { id, type, position };
    case 'end':
      return { id, type, position };
    case 'label':
      return { id, type, position, name: 'new_label' };
    case 'jump':
      return { id, type, position, target: 'start' };
    case 'call':
      return { id, type, position, target: 'start' };
    case 'return':
      return { id, type, position };
    case 'say':
      return { id, type, position, text: '' };
    case 'narration':
      return { id, type, position, text: '' };
    case 'menu':
      return {
        id,
        type,
        position,
        choices: [
          { id: newNodeId('choice'), text: 'Option A' },
          { id: newNodeId('choice'), text: 'Option B' },
        ],
      };
    case 'pause':
      return { id, type, position, seconds: 1 };
    case 'sceneBg':
      return { id, type, position, background: 'images/bg/placeholder.png' };
    case 'show':
      return { id, type, position, characterId: '' };
    case 'hide':
      return { id, type, position, characterId: '' };
    case 'transition':
      return { id, type, position, name: 'dissolve' };
    case 'camera':
      return { id, type, position, action: 'reset' };
    case 'playMusic':
      return { id, type, position, asset: 'audio/music/placeholder.ogg' };
    case 'stopMusic':
      return { id, type, position };
    case 'playSound':
      return { id, type, position, asset: 'audio/sfx/placeholder.ogg' };
    case 'playVoice':
      return { id, type, position, asset: 'audio/voice/placeholder.ogg' };
    case 'queue':
      return { id, type, position, channel: 'music', asset: 'audio/music/placeholder.ogg' };
    case 'if':
      return {
        id,
        type,
        position,
        branches: [
          { id: newNodeId('branch'), condition: 'True' },
          { id: newNodeId('branch'), condition: '' },
        ],
      };
    case 'setVar':
      return { id, type, position, variable: 'flag', expression: 'True' };
    case 'increment':
      return { id, type, position, variable: 'counter', delta: 1 };
    case 'python':
      return { id, type, position, code: '# python code' };
    case 'inventoryOp':
      return { id, type, position, op: 'add', itemId: 'item', quantity: 1 };
    case 'statOp':
      return { id, type, position, stat: 'strength', op: 'add', value: 1 };
    case 'relationshipOp':
      return { id, type, position, characterId: '', op: 'add', value: 1 };
    case 'showScreen':
      return { id, type, position, screenId: '' };
    case 'hideScreen':
      return { id, type, position, screenId: '' };
    case 'callScreen':
      return { id, type, position, screenId: '' };
    default: {
      const _exhaustive: never = type;
      throw new Error(`Unknown node type: ${_exhaustive}`);
    }
  }
}
