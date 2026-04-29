import type { AssetIndex, CharacterCatalog, Id, SceneNode, SceneSpec } from '@renpy-ui/spec';
import { evaluate } from './expr';
import {
  type ActiveMenuChoice,
  type AudioState,
  type HaltReason,
  type PlaybackState,
  type PlaybackWorld,
  type ShownSprite,
  getNode,
} from './types';

export interface CreateMachineInput {
  scenes: SceneSpec[];
  characters: CharacterCatalog;
  assets?: AssetIndex;
}

/**
 * The playback machine is a pure function library: every state transition
 * returns a new immutable PlaybackState. The caller (React component or test)
 * holds the state and feeds it back in for the next step.
 *
 * Why pure? It makes the machine trivially testable in Node and lets the UI
 * use it from a `useState` without React-specific glue.
 */
export interface PlaybackMachine {
  /** Build the initial state for `sceneId` (without yet executing anything). */
  start(sceneId: Id): PlaybackState;
  /**
   * Advance the machine. If we're halted on a menu, `choiceId` selects which
   * branch to take. For say/narration/pause, no argument is needed.
   */
  step(state: PlaybackState, opts?: StepOptions): PlaybackState;
  /** Reset the entire run, returning to the start of the current scene. */
  reset(state: PlaybackState): PlaybackState;
  /**
   * Advance to a specific node. Used by the Canvas-to-preview integration
   * ("jump-to-node"). Walks linearly from the scene start; falls back to
   * setting `currentNodeId` directly if the path is unreachable.
   */
  jumpToNode(state: PlaybackState, nodeId: Id): PlaybackState;
  /** True when no further automatic steps are pending. */
  isWaiting(state: PlaybackState): boolean;
  /** Active scene resolution helper for renderers. */
  scene(sceneId: Id | null): SceneSpec | undefined;
  /** Diagnostics: the world tables (for tooltips / debug). */
  world: PlaybackWorld;
}

export interface StepOptions {
  /** Choice id for menu selection. */
  choiceId?: string;
  /** Force a particular branch id on an If node (for jump-to-node). */
  branchId?: string;
}

const MAX_STEPS_PER_CALL = 1000; // guard against pathological loops

export function createMachine(input: CreateMachineInput): PlaybackMachine {
  const charactersById = new Map(input.characters.characters.map((c) => [c.id, c]));
  const scenesById = new Map(input.scenes.map((s) => [s.id, s]));
  const scenesByLabel = new Map(input.scenes.map((s) => [s.label, s]));
  const world: PlaybackWorld = { charactersById, scenesByLabel };

  function emptyAudio(): AudioState {
    return { music: null, recentSounds: [], voice: null };
  }

  function freshState(sceneId: Id): PlaybackState {
    const scene = scenesById.get(sceneId);
    return {
      sceneId,
      currentNodeId: scene?.entryNodeId ?? null,
      stage: { background: null, sprites: {} },
      activeSay: null,
      activeNarration: null,
      activeMenu: null,
      vars: {},
      inventory: {},
      stats: {},
      relationships: {},
      transition: null,
      callStack: [],
      audio: emptyAudio(),
      halt: null,
      log: [],
    };
  }

  function runUntilHalt(input: PlaybackState): PlaybackState {
    let s = input;
    let iterations = 0;
    while (!s.halt && s.currentNodeId && s.sceneId) {
      iterations++;
      if (iterations > MAX_STEPS_PER_CALL) {
        return halt(s, { kind: 'error', message: 'preview: step budget exceeded' });
      }
      s = handleNode(s);
    }
    return s;
  }

  function start(sceneId: Id): PlaybackState {
    return runUntilHalt(freshState(sceneId));
  }

  function step(state: PlaybackState, opts: StepOptions = {}): PlaybackState {
    if (!state.sceneId) return state;
    let s = state;
    if (s.halt) {
      // Resolve the wait condition by following the natural next edge, or
      // (for menus) by following the chosen choice's edge.
      if (s.halt.kind === 'awaitingMenu') {
        const node = currentNode(s);
        if (!node || node.type !== 'menu') return s;
        const choiceId = opts.choiceId ?? node.choices[0]?.id;
        if (!choiceId) return s;
        const target = followFromMenu(s, node.id, choiceId);
        s = clearTransientView({ ...s, halt: null, currentNodeId: target ?? null });
      } else {
        // For say / narration / pause / sceneEnded: progress to the next node.
        const node = currentNode(s);
        const nextId = node ? followNext(s, node.id) : undefined;
        s = clearTransientView({
          ...s,
          halt: null,
          currentNodeId: nextId ?? null,
        });
      }
    }
    return runUntilHalt(s);
  }

  function reset(state: PlaybackState): PlaybackState {
    if (!state.sceneId) return state;
    return start(state.sceneId);
  }

  function jumpToNode(state: PlaybackState, nodeId: Id): PlaybackState {
    if (!state.sceneId) return state;
    const scene = scenesById.get(state.sceneId);
    if (!scene) return state;
    if (!scene.nodes.some((n) => n.id === nodeId)) return state;
    // Walk from scene start, breaking once we land on the target. If we hit
    // a halting node we step past it without honouring user input.
    let s = freshState(state.sceneId);
    s = runUntilHalt(s);
    let safety = 0;
    while (s.currentNodeId !== nodeId && safety < 10000) {
      if (!s.currentNodeId) break;
      // Force-pick the first menu choice / branch when we're halted.
      s = step(s);
      safety++;
    }
    return s;
  }

  function isWaiting(state: PlaybackState): boolean {
    return Boolean(state.halt);
  }

  function scene(sceneId: Id | null): SceneSpec | undefined {
    return sceneId ? scenesById.get(sceneId) : undefined;
  }

  // ---------- internals ----------

  function currentNode(s: PlaybackState): SceneNode | undefined {
    if (!s.sceneId || !s.currentNodeId) return undefined;
    const sc = scenesById.get(s.sceneId);
    return sc ? getNode(sc, s.currentNodeId) : undefined;
  }

  function handleNode(s: PlaybackState): PlaybackState {
    const node = currentNode(s);
    if (!node) return halt(s, { kind: 'sceneEnded', nodeId: null });
    switch (node.type) {
      case 'start':
      case 'label':
        return advance(s, node.id);

      case 'end':
        return halt({ ...s, currentNodeId: node.id }, { kind: 'sceneEnded', nodeId: node.id });

      case 'return': {
        const stack = s.callStack.slice();
        const popped = stack.pop();
        if (popped) {
          // Synthetic: jump back to the call's continuation in the same scene.
          // For simplicity we treat `return` as scene end in the preview.
          return halt(
            { ...s, currentNodeId: node.id, callStack: stack },
            { kind: 'sceneEnded', nodeId: node.id },
          );
        }
        return halt({ ...s, currentNodeId: node.id }, { kind: 'sceneEnded', nodeId: node.id });
      }

      case 'jump': {
        const target = scenesByLabel.get(node.target);
        if (!target) {
          return halt(s, {
            kind: 'error',
            message: `preview: jump target "${node.target}" not found`,
          });
        }
        // Crossing scenes resets the activeSay/menu/narration but preserves
        // vars/inventory/stats so player progress survives transitions.
        return {
          ...s,
          sceneId: target.id,
          currentNodeId: target.entryNodeId,
          activeSay: null,
          activeMenu: null,
          activeNarration: null,
          transition: null,
        };
      }

      case 'call': {
        const target = scenesByLabel.get(node.target);
        if (!target) {
          return halt(s, {
            kind: 'error',
            message: `preview: call target "${node.target}" not found`,
          });
        }
        return {
          ...s,
          sceneId: target.id,
          currentNodeId: target.entryNodeId,
          callStack: [...s.callStack, node.target],
          activeSay: null,
          activeMenu: null,
          activeNarration: null,
        };
      }

      case 'say': {
        const character = node.characterId ? charactersById.get(node.characterId) : undefined;
        return halt(
          {
            ...s,
            activeSay: {
              characterId: node.characterId,
              speaker: character?.displayName ?? (node.characterId ? '???' : 'Narrator'),
              color: character?.color ?? 'var(--color-text-primary)',
              text: node.text,
              voice: node.voice,
              expression: node.expressionName,
            },
            activeNarration: null,
            audio: node.voice ? { ...s.audio, voice: node.voice } : s.audio,
          },
          { kind: 'awaitingSay', nodeId: node.id },
        );
      }

      case 'narration':
        return halt(
          {
            ...s,
            activeNarration: node.text,
            activeSay: null,
          },
          { kind: 'awaitingNarration', nodeId: node.id },
        );

      case 'menu': {
        const choices: ActiveMenuChoice[] = node.choices.map((c) => ({
          id: c.id,
          text: c.text,
          enabled:
            c.condition === undefined ||
            c.condition === '' ||
            evaluate(c.condition, s.vars) === true,
        }));
        return halt(
          {
            ...s,
            activeMenu: { prompt: node.prompt, choices },
          },
          { kind: 'awaitingMenu', nodeId: node.id },
        );
      }

      case 'pause':
        return halt(s, { kind: 'awaitingPause', nodeId: node.id, seconds: node.seconds });

      case 'sceneBg': {
        const tag = node.imageTag ?? 'bg';
        return advance(
          {
            ...s,
            stage: { ...s.stage, background: { tag, asset: node.background } },
            transition: node.withTransition ?? null,
          },
          node.id,
        );
      }

      case 'show': {
        const character = charactersById.get(node.characterId);
        const tag = character?.images.tag ?? node.characterId;
        const expression = node.expressionName;
        const expressionAsset =
          character?.images.expressions.find((e) => e.name === expression)?.asset ?? null;
        const sprite: ShownSprite = {
          characterId: node.characterId,
          tag,
          expression,
          at: node.at,
          zorder: node.zorder ?? 0,
          asset: expressionAsset,
        };
        return advance(
          {
            ...s,
            stage: { ...s.stage, sprites: { ...s.stage.sprites, [tag]: sprite } },
            transition: node.withTransition ?? null,
          },
          node.id,
        );
      }

      case 'hide': {
        const character = charactersById.get(node.characterId);
        const tag = character?.images.tag ?? node.characterId;
        const sprites = { ...s.stage.sprites };
        delete sprites[tag];
        return advance(
          {
            ...s,
            stage: { ...s.stage, sprites },
            transition: node.withTransition ?? null,
          },
          node.id,
        );
      }

      case 'transition':
        return advance({ ...s, transition: node.name }, node.id);

      case 'camera':
        return advance(s, node.id); // not modelled

      case 'playMusic':
        return advance({ ...s, audio: { ...s.audio, music: node.asset } }, node.id);

      case 'stopMusic':
        return advance({ ...s, audio: { ...s.audio, music: null } }, node.id);

      case 'playSound': {
        const recent = [
          { asset: node.asset, channel: node.channel ?? 'sound', at: Date.now() },
          ...s.audio.recentSounds,
        ].slice(0, 4);
        return advance({ ...s, audio: { ...s.audio, recentSounds: recent } }, node.id);
      }

      case 'playVoice':
        return advance({ ...s, audio: { ...s.audio, voice: node.asset } }, node.id);

      case 'queue':
        return advance(s, node.id); // queue is renderer-only

      case 'setVar':
        return advance(
          { ...s, vars: { ...s.vars, [node.variable]: tryEvalScalar(node.expression, s.vars) } },
          node.id,
        );

      case 'increment': {
        const cur = numericOrZero(s.vars[node.variable]);
        return advance({ ...s, vars: { ...s.vars, [node.variable]: cur + node.delta } }, node.id);
      }

      case 'python':
        return advance(
          {
            ...s,
            log: limitLog([
              ...s.log,
              `python block skipped: ${node.code.split('\n')[0]?.slice(0, 40) ?? ''}`,
            ]),
          },
          node.id,
        );

      case 'inventoryOp': {
        const item = node.itemId;
        const inv = { ...s.inventory };
        const have = inv[item] ?? 0;
        const qty = node.quantity ?? 1;
        if (node.op === 'add') inv[item] = have + qty;
        else if (node.op === 'remove') inv[item] = Math.max(0, have - qty);
        else inv[item] = qty;
        return advance({ ...s, inventory: inv }, node.id);
      }

      case 'statOp': {
        const cur = s.stats[node.stat] ?? 0;
        const next =
          node.op === 'add'
            ? cur + node.value
            : node.op === 'subtract'
              ? cur - node.value
              : node.value;
        return advance({ ...s, stats: { ...s.stats, [node.stat]: next } }, node.id);
      }

      case 'relationshipOp': {
        const character = charactersById.get(node.characterId);
        const tag = character?.images.tag ?? node.characterId;
        const track = node.track ?? 'love';
        const key = `${tag}.${track}`;
        const cur = s.relationships[key] ?? 0;
        const next =
          node.op === 'add'
            ? cur + node.value
            : node.op === 'subtract'
              ? cur - node.value
              : node.value;
        return advance({ ...s, relationships: { ...s.relationships, [key]: next } }, node.id);
      }

      case 'showScreen':
      case 'hideScreen':
      case 'callScreen':
        return advance(s, node.id);

      case 'if': {
        // Evaluate branches in order; first match wins. `else` (empty) wins
        // by default so we always have a path forward.
        const matchingBranch = node.branches.find((b) => evaluate(b.condition, s.vars) === true);
        if (!matchingBranch) {
          // No branch matched. Fall through to the natural next edge.
          return advance(s, node.id);
        }
        const target = followFromIf(s, node.id, matchingBranch.id);
        if (!target) return advance(s, node.id);
        return { ...s, currentNodeId: target };
      }

      default: {
        const _exhaustive: never = node;
        return _exhaustive;
      }
    }
  }

  function advance(s: PlaybackState, fromNodeId: string): PlaybackState {
    const nextId = followNext(s, fromNodeId);
    return { ...s, currentNodeId: nextId ?? null };
  }

  function followNext(s: PlaybackState, fromNodeId: string): string | undefined {
    const sc = currentScene(s);
    if (!sc) return undefined;
    const edges = sc.edges.filter((e) => e.source === fromNodeId);
    const next = edges.find((e) => !e.sourceHandle || e.sourceHandle === 'next') ?? edges[0];
    return next?.target;
  }

  function followFromMenu(s: PlaybackState, menuId: string, choiceId: string): string | undefined {
    const sc = currentScene(s);
    if (!sc) return undefined;
    const edge = sc.edges.find(
      (e) => e.source === menuId && e.sourceHandle === `choice:${choiceId}`,
    );
    return edge?.target;
  }

  function followFromIf(s: PlaybackState, ifId: string, branchId: string): string | undefined {
    const sc = currentScene(s);
    if (!sc) return undefined;
    const edge = sc.edges.find((e) => e.source === ifId && e.sourceHandle === `branch:${branchId}`);
    return edge?.target;
  }

  function currentScene(s: PlaybackState): SceneSpec | undefined {
    return s.sceneId ? scenesById.get(s.sceneId) : undefined;
  }

  return { start, step, reset, jumpToNode, isWaiting, scene, world };
}

// ---------- helpers ----------

function halt(s: PlaybackState, reason: HaltReason): PlaybackState {
  return { ...s, halt: reason };
}

function clearTransientView(s: PlaybackState): PlaybackState {
  return { ...s, activeSay: null, activeNarration: null, activeMenu: null };
}

function tryEvalScalar(
  src: string,
  scope: Record<string, import('./types').PreviewValue>,
): import('./types').PreviewValue {
  // setVar accepts arbitrary Python literals. The full expression evaluator
  // returns a boolean (because it's used for conditions); for setVar we want
  // to preserve numeric and string values so subsequent comparisons behave.
  const trimmed = src.trim();
  if (trimmed === 'True') return true;
  if (trimmed === 'False') return false;
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed);
  // Strip matching quote pairs to recover a plain string literal.
  const m = /^(['"])(.*)\1$/.exec(trimmed);
  if (m) return m[2] as string;
  // Identifier reference — copy from scope if present.
  if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(trimmed) && Object.hasOwn(scope, trimmed)) {
    return scope[trimmed] as import('./types').PreviewValue;
  }
  // Fallback: keep the raw expression text so it's visible in debug.
  return trimmed;
}

function numericOrZero(v: import('./types').PreviewValue | undefined): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  if (typeof v === 'boolean') return v ? 1 : 0;
  return 0;
}

function limitLog(lines: string[], cap = 20): string[] {
  return lines.length > cap ? lines.slice(lines.length - cap) : lines;
}
