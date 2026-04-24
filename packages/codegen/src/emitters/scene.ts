import type { IfNode, LabelNode, MenuNode, SceneEdge, SceneNode, SceneSpec } from '@renpy-ui/spec';
import type { SymbolTable } from '../symbols';
import { generatedHeader } from '../utils/header';
import { BLANK, finalize, indent, renPyString } from '../utils/render';

/**
 * Scene -> .rpy emitter.
 *
 * Algorithm (M1 subset of ARCHITECTURE.md §5.1):
 *
 * 1. Build an adjacency index `outgoing: nodeId -> edges[]` and count inbound
 *    edges per node.
 * 2. Pick entry points:
 *      - The scene's `entryNodeId` is always an entry with label `scene.label`.
 *      - Every `LabelNode` is also an entry, using its `name`.
 *      - Any other node with > 1 inbound edges that isn't already an entry
 *        becomes a SYNTHETIC entry, labelled `scene.label__join_<shortId>`.
 * 3. For each entry, DFS outwards and emit a `label <name>:` block. When
 *    traversal reaches another entry node, emit `jump <name>` and stop that
 *    path (prevents duplication and handles re-merges cleanly).
 * 4. Inside an entry, nodes emit per-kind code. Branching nodes (`menu`, `if`)
 *    recurse: each branch emits an indented block that terminates either with
 *    a jump back to the continuation (entry after the branch) or with `end`
 *    markers as appropriate.
 *
 * The algorithm is deterministic: entries and branch order follow the spec's
 * `nodes`/`edges`/`choices`/`branches` order; id is used as a tiebreaker.
 */

type OutEdge = SceneEdge;

interface SceneIndex {
  byId: Map<string, SceneNode>;
  out: Map<string, OutEdge[]>;
  inCount: Map<string, number>;
}

function buildIndex(scene: SceneSpec): SceneIndex {
  const byId = new Map<string, SceneNode>();
  for (const n of scene.nodes) byId.set(n.id, n);

  const out = new Map<string, OutEdge[]>();
  const inCount = new Map<string, number>();
  for (const n of scene.nodes) {
    out.set(n.id, []);
    inCount.set(n.id, 0);
  }
  for (const e of scene.edges) {
    out.get(e.source)?.push(e);
    inCount.set(e.target, (inCount.get(e.target) ?? 0) + 1);
  }
  return { byId, out, inCount };
}

interface EntryPoint {
  nodeId: string;
  label: string;
}

/**
 * Decide which nodes become their own `label` block. The entry order is the
 * emit order of labels in the output file.
 */
function pickEntryPoints(scene: SceneSpec, idx: SceneIndex): EntryPoint[] {
  const entries: EntryPoint[] = [];
  const entryNodeIds = new Set<string>();

  // 1. The scene's entryNode — uses the scene label.
  entries.push({ nodeId: scene.entryNodeId, label: scene.label });
  entryNodeIds.add(scene.entryNodeId);

  // 2. Every explicit LabelNode, in file order.
  for (const n of scene.nodes) {
    if (n.type === 'label' && !entryNodeIds.has(n.id)) {
      entries.push({ nodeId: n.id, label: n.name });
      entryNodeIds.add(n.id);
    }
  }

  // 3. Re-merge joins: any node with > 1 inbound edges that isn't already an
  //    entry becomes a synthetic label.
  for (const n of scene.nodes) {
    if (entryNodeIds.has(n.id)) continue;
    const ic = idx.inCount.get(n.id) ?? 0;
    if (ic > 1) {
      entries.push({ nodeId: n.id, label: synthLabel(scene.label, n.id) });
      entryNodeIds.add(n.id);
    }
  }

  return entries;
}

function synthLabel(sceneLabel: string, nodeId: string): string {
  // Keep synthetic labels deterministic and namespace-safe.
  const short = nodeId.replace(/[^A-Za-z0-9_]/g, '_').slice(0, 16);
  return `${sceneLabel}__join_${short}`;
}

interface EmitContext {
  scene: SceneSpec;
  idx: SceneIndex;
  sym: SymbolTable;
  /** nodeId -> label that starts an entry. Used to emit `jump <label>`. */
  entryLabelByNodeId: Map<string, string>;
}

export function emitScene(scene: SceneSpec, sym: SymbolTable): string {
  const idx = buildIndex(scene);
  const entries = pickEntryPoints(scene, idx);
  const entryLabelByNodeId = new Map<string, string>();
  for (const e of entries) entryLabelByNodeId.set(e.nodeId, e.label);

  const ctx: EmitContext = { scene, idx, sym, entryLabelByNodeId };

  const lines: string[] = [...generatedHeader(`.renpy-ui/scenes/${scene.label}.json`)];
  if (scene.notes) {
    for (const ln of scene.notes.split('\n')) lines.push(`# ${ln}`);
    lines.push(BLANK);
  }

  let first = true;
  for (const entry of entries) {
    if (!first) lines.push(BLANK);
    first = false;
    lines.push(`label ${entry.label}:`);
    emitFrom(ctx, entry.nodeId, 1, lines, {
      // We're entering at an entry — don't treat it as "jump back to self".
      skipEntryJump: true,
    });
  }
  return finalize(lines);
}

interface WalkOptions {
  /** When true, we are at an entry node; don't emit `jump <self>` for it. */
  skipEntryJump?: boolean;
}

/**
 * Walk from `nodeId`, emitting one statement per node until we reach either a
 * terminal node (end/return) or another entry (which becomes a `jump`).
 */
function emitFrom(
  ctx: EmitContext,
  nodeId: string,
  level: number,
  lines: string[],
  opts: WalkOptions = {},
): void {
  const visited = new Set<string>();
  let current: string | undefined = nodeId;
  let first = true;

  while (current) {
    if (visited.has(current)) {
      // Cycle within a straight run — emit a jump to the entry for `current`
      // and stop. pickEntryPoints will have made `current` an entry already
      // because it has >1 inbound edges (the cycle's back edge + original).
      const entryLabel = ctx.entryLabelByNodeId.get(current);
      if (entryLabel) lines.push(indent(level, `jump ${entryLabel}`));
      return;
    }
    visited.add(current);

    // If this node is an entry point (other than the one we started at), jump.
    const entryLabel = ctx.entryLabelByNodeId.get(current);
    if (entryLabel && !(first && opts.skipEntryJump)) {
      lines.push(indent(level, `jump ${entryLabel}`));
      return;
    }
    first = false;

    const node = ctx.idx.byId.get(current);
    if (!node) return;

    const next = emitNode(ctx, node, level, lines);
    if (next === 'terminate') return;
    current = next;
  }
}

/** Returns the next nodeId to continue with, or 'terminate' to stop. */
function emitNode(
  ctx: EmitContext,
  node: SceneNode,
  level: number,
  lines: string[],
): string | undefined | 'terminate' {
  if (node.comment) {
    lines.push(indent(level, `# ${node.comment.replace(/\n/g, ' ')}`));
  }

  switch (node.type) {
    case 'start':
    case 'label':
      // Entry markers — no direct output; flow falls through.
      return followSingle(ctx, node.id);

    case 'end':
      lines.push(indent(level, 'return'));
      return 'terminate';

    case 'return':
      lines.push(indent(level, 'return'));
      return 'terminate';

    case 'jump': {
      lines.push(indent(level, `jump ${node.target}`));
      return 'terminate';
    }

    case 'call': {
      lines.push(indent(level, `call ${node.target}`));
      return followSingle(ctx, node.id);
    }

    case 'say': {
      emitSay(ctx, node, level, lines);
      return followSingle(ctx, node.id);
    }

    case 'narration': {
      lines.push(indent(level, renPyString(node.text)));
      return followSingle(ctx, node.id);
    }

    case 'menu': {
      emitMenu(ctx, node, level, lines);
      return 'terminate'; // every branch handles its own continuation
    }

    case 'if': {
      emitIf(ctx, node, level, lines);
      return 'terminate';
    }

    case 'pause': {
      if (node.seconds != null) lines.push(indent(level, `pause ${node.seconds}`));
      else lines.push(indent(level, 'pause'));
      return followSingle(ctx, node.id);
    }

    case 'sceneBg': {
      const tag = node.imageTag ?? 'bg';
      let stmt = `scene ${tag} ${bgName(node.background)}`;
      if (node.withTransition) stmt += ` with ${node.withTransition}`;
      lines.push(indent(level, stmt));
      return followSingle(ctx, node.id);
    }

    case 'show': {
      const ch = ctx.sym.charactersById.get(node.characterId);
      const tag = ch?.images.tag ?? node.characterId;
      let stmt = `show ${tag}`;
      if (node.expressionName) stmt += ` ${node.expressionName}`;
      if (node.at) stmt += ` at ${node.at}`;
      if (typeof node.zorder === 'number') stmt += ` zorder ${node.zorder}`;
      if (node.withTransition) stmt += ` with ${node.withTransition}`;
      lines.push(indent(level, stmt));
      return followSingle(ctx, node.id);
    }

    case 'hide': {
      const ch = ctx.sym.charactersById.get(node.characterId);
      const tag = ch?.images.tag ?? node.characterId;
      let stmt = `hide ${tag}`;
      if (node.withTransition) stmt += ` with ${node.withTransition}`;
      lines.push(indent(level, stmt));
      return followSingle(ctx, node.id);
    }

    case 'transition': {
      lines.push(indent(level, `with ${node.name}`));
      return followSingle(ctx, node.id);
    }

    case 'camera': {
      // M1: emit as comment until dedicated transforms land in M3.
      lines.push(indent(level, `# camera ${node.action}`));
      return followSingle(ctx, node.id);
    }

    case 'playMusic': {
      let stmt = `play music ${renPyString(node.asset)}`;
      if (node.channel && node.channel !== 'music') {
        stmt = `play ${node.channel} ${renPyString(node.asset)}`;
      }
      if (typeof node.fadeIn === 'number') stmt += ` fadein ${node.fadeIn}`;
      if (node.loop === false) stmt += ' noloop';
      lines.push(indent(level, stmt));
      return followSingle(ctx, node.id);
    }

    case 'stopMusic': {
      const channel = node.channel ?? 'music';
      let stmt = `stop ${channel}`;
      if (typeof node.fadeOut === 'number') stmt += ` fadeout ${node.fadeOut}`;
      lines.push(indent(level, stmt));
      return followSingle(ctx, node.id);
    }

    case 'playSound': {
      const channel = node.channel ?? 'sound';
      lines.push(indent(level, `play ${channel} ${renPyString(node.asset)}`));
      return followSingle(ctx, node.id);
    }

    case 'playVoice': {
      lines.push(indent(level, `voice ${renPyString(node.asset)}`));
      return followSingle(ctx, node.id);
    }

    case 'queue': {
      lines.push(indent(level, `queue ${node.channel} ${renPyString(node.asset)}`));
      return followSingle(ctx, node.id);
    }

    case 'setVar': {
      lines.push(indent(level, `$ ${node.variable} = ${node.expression}`));
      return followSingle(ctx, node.id);
    }

    case 'increment': {
      const delta = node.delta;
      if (delta >= 0) lines.push(indent(level, `$ ${node.variable} += ${delta}`));
      else lines.push(indent(level, `$ ${node.variable} -= ${-delta}`));
      return followSingle(ctx, node.id);
    }

    case 'python': {
      lines.push(indent(level, 'python:'));
      for (const ln of node.code.split('\n')) {
        lines.push(indent(level + 1, ln));
      }
      return followSingle(ctx, node.id);
    }

    case 'inventoryOp': {
      // Simple convention for M1; pluggable system API lands in M4.
      const fn =
        node.op === 'add'
          ? 'inventory_add'
          : node.op === 'remove'
            ? 'inventory_remove'
            : 'inventory_set';
      const qty = node.quantity ?? 1;
      lines.push(indent(level, `$ ${fn}(${renPyString(node.itemId)}, ${qty})`));
      return followSingle(ctx, node.id);
    }

    case 'statOp': {
      if (node.op === 'add') lines.push(indent(level, `$ ${node.stat} += ${node.value}`));
      else if (node.op === 'subtract') lines.push(indent(level, `$ ${node.stat} -= ${node.value}`));
      else lines.push(indent(level, `$ ${node.stat} = ${node.value}`));
      return followSingle(ctx, node.id);
    }

    case 'relationshipOp': {
      const ch = ctx.sym.charactersById.get(node.characterId);
      const tag = ch?.images.tag ?? node.characterId;
      const track = node.track ?? 'love';
      const base = `relationship_${tag}_${track}`;
      if (node.op === 'add') lines.push(indent(level, `$ ${base} += ${node.value}`));
      else if (node.op === 'subtract') lines.push(indent(level, `$ ${base} -= ${node.value}`));
      else lines.push(indent(level, `$ ${base} = ${node.value}`));
      return followSingle(ctx, node.id);
    }

    case 'showScreen': {
      const name = ctx.sym.screenNameById.get(node.screenId) ?? 'unknown';
      const args = renderScreenArgs(node.args);
      lines.push(indent(level, `show screen ${name}${args}`));
      return followSingle(ctx, node.id);
    }

    case 'hideScreen': {
      const name = ctx.sym.screenNameById.get(node.screenId) ?? 'unknown';
      lines.push(indent(level, `hide screen ${name}`));
      return followSingle(ctx, node.id);
    }

    case 'callScreen': {
      const name = ctx.sym.screenNameById.get(node.screenId) ?? 'unknown';
      const args = renderScreenArgs(node.args);
      lines.push(indent(level, `call screen ${name}${args}`));
      return followSingle(ctx, node.id);
    }

    default: {
      // Exhaustiveness guard — if a new node kind is added, TS will flag here.
      const _never: never = node;
      return _never;
    }
  }
}

function renderScreenArgs(args: Record<string, string> | undefined): string {
  if (!args) return '';
  const entries = Object.entries(args).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  if (entries.length === 0) return '';
  return `(${entries.map(([k, v]) => `${k}=${v}`).join(', ')})`;
}

function emitSay(
  ctx: EmitContext,
  node: import('@renpy-ui/spec').SayNode,
  level: number,
  lines: string[],
): void {
  let stmt = '';
  if (node.characterId) {
    const ch = ctx.sym.charactersById.get(node.characterId);
    stmt += ch ? ch.varName : node.characterId;
    if (node.expressionName) stmt += ` ${node.expressionName}`;
    if (node.attributes) for (const a of node.attributes) stmt += ` ${a}`;
    stmt += ' ';
  }
  stmt += renPyString(node.text);
  if (node.withTransition) stmt += ` with ${node.withTransition}`;
  if (node.voice) {
    lines.push(indent(level, `voice ${renPyString(node.voice)}`));
  }
  lines.push(indent(level, stmt));
}

function emitMenu(ctx: EmitContext, node: MenuNode, level: number, lines: string[]): void {
  lines.push(indent(level, 'menu:'));
  if (node.prompt) {
    lines.push(indent(level + 1, renPyString(node.prompt)));
  }
  const outs = ctx.idx.out.get(node.id) ?? [];
  for (const choice of node.choices) {
    const edge = outs.find((e) => e.sourceHandle === `choice:${choice.id}`);
    let header = renPyString(choice.text);
    if (choice.condition) header += ` if ${choice.condition}`;
    header += ':';
    lines.push(indent(level + 1, header));
    if (edge) {
      emitFrom(ctx, edge.target, level + 2, lines);
    } else {
      // No edge attached — emit a `pass` so the block stays syntactically valid.
      lines.push(indent(level + 2, 'pass'));
    }
  }
}

function emitIf(ctx: EmitContext, node: IfNode, level: number, lines: string[]): void {
  const outs = ctx.idx.out.get(node.id) ?? [];
  node.branches.forEach((branch, i) => {
    const edge = outs.find((e) => e.sourceHandle === `branch:${branch.id}`);
    const kw = i === 0 ? 'if' : branch.condition === '' ? 'else' : 'elif';
    const header = branch.condition === '' ? `${kw}:` : `${kw} ${branch.condition}:`;
    lines.push(indent(level, header));
    if (edge) {
      emitFrom(ctx, edge.target, level + 1, lines);
    } else {
      lines.push(indent(level + 1, 'pass'));
    }
  });
}

function followSingle(ctx: EmitContext, nodeId: string): string | undefined {
  const outs = ctx.idx.out.get(nodeId) ?? [];
  // For nodes with a single natural "next", prefer edges with no handle or
  // sourceHandle === "next".
  const next = outs.find((e) => !e.sourceHandle || e.sourceHandle === 'next') ?? outs[0];
  return next?.target;
}

/**
 * Turn "images/bg/room.png" into "room" — Ren'Py image-name convention used
 * after `scene `. This keeps generated code matching the hand-written idiom
 * while still letting users register full-path images via LabelNode + `image`
 * statements when they want.
 */
function bgName(ref: string): string {
  const base = ref.split('/').pop() ?? ref;
  return base.replace(/\.[^.]+$/, '');
}

// Touch the unused-LabelNode import so TS doesn't remove it if we prune code
// above later. (The type is used in collectLabels in symbols.ts.)
export type _LabelNode = LabelNode;
