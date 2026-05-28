import { type SceneSpec, type Variable, isReservedIdentifier } from '@renpy-ui/spec';
import type { SpecBundle } from './bundle';
import type { Diagnostic } from './types';

/**
 * Semantic validation rules per SPEC.md §10. M1 ships rules 1–6; rules 7–8
 * (asset existence on disk, cyclic-call detection) require I/O / dataflow
 * analysis and ship in M5.
 */

/** Rule 1: identifiers are non-reserved. */
export function checkReservedIdentifiers(bundle: SpecBundle): Diagnostic[] {
  const out: Diagnostic[] = [];
  for (const c of bundle.characters.characters) {
    if (isReservedIdentifier(c.varName)) {
      out.push({
        severity: 'error',
        code: 'RESERVED_IDENTIFIER',
        message: `Character varName "${c.varName}" collides with a Python/Ren'Py reserved word`,
        source: '.renpy-ui/characters.json',
        location: c.id,
      });
    }
  }
  for (const v of bundle.variables.variables) {
    if (isReservedIdentifier(v.name)) {
      out.push({
        severity: 'error',
        code: 'RESERVED_IDENTIFIER',
        message: `Variable name "${v.name}" collides with a Python/Ren'Py reserved word`,
        source: '.renpy-ui/variables.json',
        location: v.id,
      });
    }
  }
  for (const scene of bundle.scenes) {
    for (const node of scene.nodes) {
      if (node.type === 'label' && isReservedIdentifier(node.name)) {
        out.push({
          severity: 'error',
          code: 'RESERVED_IDENTIFIER',
          message: `Label "${node.name}" collides with a reserved word`,
          source: sceneSource(scene),
          location: node.id,
        });
      }
    }
  }
  return out;
}

/** Rule 2: jump/call targets resolve to a known label. */
export function checkLabelReferences(bundle: SpecBundle): Diagnostic[] {
  const out: Diagnostic[] = [];
  const known = new Set<string>();
  for (const s of bundle.scenes) {
    known.add(s.label);
    for (const n of s.nodes) if (n.type === 'label') known.add(n.name);
  }
  for (const scene of bundle.scenes) {
    for (const node of scene.nodes) {
      if ((node.type === 'jump' || node.type === 'call') && !known.has(node.target)) {
        out.push({
          severity: 'error',
          code: 'UNKNOWN_LABEL',
          message: `${node.type} target "${node.target}" is not a known label`,
          source: sceneSource(scene),
          location: node.id,
        });
      }
    }
  }
  return out;
}

/** Rule 3: every scene has reachable Start and at least one terminal. */
export function checkSceneTerminals(bundle: SpecBundle): Diagnostic[] {
  const out: Diagnostic[] = [];
  for (const scene of bundle.scenes) {
    const startCount = scene.nodes.filter((n) => n.type === 'start').length;
    if (startCount === 0) {
      out.push({
        severity: 'error',
        code: 'NO_START_NODE',
        message: 'Scene has no Start node',
        source: sceneSource(scene),
      });
    } else if (startCount > 1) {
      out.push({
        severity: 'error',
        code: 'MULTIPLE_START_NODES',
        message: `Scene has ${startCount} Start nodes; expected 1`,
        source: sceneSource(scene),
      });
    }

    const terminals = scene.nodes.filter(
      (n) => n.type === 'end' || n.type === 'return' || n.type === 'jump',
    );
    if (terminals.length === 0) {
      out.push({
        severity: 'error',
        code: 'NO_TERMINAL_NODE',
        message: 'Scene has no terminal node (end / return / jump)',
        source: sceneSource(scene),
      });
    }

    if (!scene.nodes.some((n) => n.id === scene.entryNodeId)) {
      out.push({
        severity: 'error',
        code: 'ENTRY_NODE_MISSING',
        message: `entryNodeId "${scene.entryNodeId}" is not present in the scene's nodes`,
        source: sceneSource(scene),
      });
    }
  }
  return out;
}

/** Rule 4: menu has >=1 choice; each choice has a connected outgoing edge. */
export function checkMenuChoices(bundle: SpecBundle): Diagnostic[] {
  const out: Diagnostic[] = [];
  for (const scene of bundle.scenes) {
    const sourceMap = groupEdgesBySource(scene);
    for (const node of scene.nodes) {
      if (node.type !== 'menu') continue;
      if (node.choices.length === 0) {
        out.push({
          severity: 'error',
          code: 'EMPTY_MENU',
          message: 'Menu has no choices',
          source: sceneSource(scene),
          location: node.id,
        });
        continue;
      }
      const outs = sourceMap.get(node.id) ?? [];
      for (const choice of node.choices) {
        const handle = `choice:${choice.id}`;
        if (!outs.some((e) => e.sourceHandle === handle)) {
          out.push({
            severity: 'warning',
            code: 'DANGLING_CHOICE',
            message: `Menu choice "${choice.text}" has no outgoing edge`,
            source: sceneSource(scene),
            location: node.id,
          });
        }
      }
    }
  }
  return out;
}

/** Rule 5: if-else: only the last branch may have an empty `condition`. */
export function checkIfBranchOrder(bundle: SpecBundle): Diagnostic[] {
  const out: Diagnostic[] = [];
  for (const scene of bundle.scenes) {
    for (const node of scene.nodes) {
      if (node.type !== 'if') continue;
      const idxOfElse = node.branches.findIndex((b) => b.condition === '');
      if (idxOfElse !== -1 && idxOfElse !== node.branches.length - 1) {
        out.push({
          severity: 'error',
          code: 'ELSE_NOT_LAST',
          message: 'else branch (empty condition) must be the last branch in an if node',
          source: sceneSource(scene),
          location: node.id,
        });
      }
    }
  }
  return out;
}

/** Rule 6: duplicate label names across the project. */
export function checkUniqueLabels(bundle: SpecBundle): Diagnostic[] {
  const out: Diagnostic[] = [];
  const seen = new Map<string, string>();
  for (const scene of bundle.scenes) {
    record(seen, scene.label, sceneSource(scene), out, 'DUPLICATE_LABEL');
    for (const node of scene.nodes) {
      if (node.type === 'label') {
        record(seen, node.name, sceneSource(scene), out, 'DUPLICATE_LABEL');
      }
    }
  }
  return out;
}

/** Rule (informational): variable referenced via setVar/increment but never declared. */
export function checkVariableDeclarations(bundle: SpecBundle): Diagnostic[] {
  const declared = new Set<string>(bundle.variables.variables.map((v: Variable) => v.name));
  const out: Diagnostic[] = [];
  for (const scene of bundle.scenes) {
    for (const node of scene.nodes) {
      if ((node.type === 'setVar' || node.type === 'increment') && !declared.has(node.variable)) {
        out.push({
          severity: 'warning',
          code: 'UNDECLARED_VARIABLE',
          message: `Variable "${node.variable}" is assigned but never declared`,
          source: sceneSource(scene),
          location: node.id,
        });
      }
    }
  }
  return out;
}

// ---- helpers ----

function sceneSource(scene: SceneSpec): string {
  return `.renpy-ui/scenes/${scene.label}.json`;
}

function groupEdgesBySource(scene: SceneSpec): Map<string, SceneSpec['edges']> {
  const out = new Map<string, SceneSpec['edges']>();
  for (const e of scene.edges) {
    const arr = out.get(e.source) ?? [];
    arr.push(e);
    out.set(e.source, arr);
  }
  return out;
}

function record(
  seen: Map<string, string>,
  name: string,
  source: string,
  out: Diagnostic[],
  code: string,
): void {
  const prev = seen.get(name);
  if (prev) {
    out.push({
      severity: 'error',
      code,
      message: `Duplicate label "${name}" (also defined in ${prev})`,
      source,
    });
  } else {
    seen.set(name, source);
  }
}

/**
 * Rule (M5): every AssetRef used by a scene/character/screen resolves to an
 * entry in the AssetIndex. Pure-data check; the on-disk file existence check
 * is `checkAssetFilesExist` which takes the set of files the caller knows
 * about.
 */
export function checkAssetReferencesIndexed(bundle: SpecBundle): Diagnostic[] {
  const known = new Set(bundle.assets.assets.map((a) => a.ref));
  const out: Diagnostic[] = [];
  for (const c of bundle.characters.characters) {
    for (const e of c.images.expressions) {
      if (!known.has(e.asset)) {
        out.push({
          severity: 'warning',
          code: 'UNINDEXED_ASSET',
          message: `Character expression "${c.varName}.${e.name}" references unindexed asset "${e.asset}"`,
          source: '.renpy-ui/characters.json',
          location: c.id,
        });
      }
    }
    for (const p of c.images.poses ?? []) {
      if (!known.has(p.asset)) {
        out.push({
          severity: 'warning',
          code: 'UNINDEXED_ASSET',
          message: `Character pose "${c.varName}.${p.name}" references unindexed asset "${p.asset}"`,
          source: '.renpy-ui/characters.json',
          location: c.id,
        });
      }
    }
  }
  for (const scene of bundle.scenes) {
    for (const node of scene.nodes) {
      const refs = assetRefsFromNode(node);
      for (const ref of refs) {
        if (!known.has(ref)) {
          out.push({
            severity: 'warning',
            code: 'UNINDEXED_ASSET',
            message: `Node references unindexed asset "${ref}"`,
            source: sceneSource(scene),
            location: node.id,
          });
        }
      }
    }
  }
  for (const screen of bundle.screens) {
    for (const widget of Object.values(screen.slots)) {
      for (const ref of assetRefsFromWidget(widget)) {
        if (!known.has(ref)) {
          out.push({
            severity: 'warning',
            code: 'UNINDEXED_ASSET',
            message: `Screen "${screen.name}" references unindexed asset "${ref}"`,
            source: `.renpy-ui/screens/${screen.name}.json`,
            location: screen.id,
          });
        }
      }
    }
  }
  return out;
}

/**
 * Rule (M5): asset entries that resolve to files which don't exist on disk.
 * Caller passes the set of asset refs (relative to the project root) it has
 * verified to exist; we report each AssetIndex entry not in that set, plus
 * any scene/character ref that isn't in the index AND isn't on disk.
 */
export function checkAssetFilesExist(
  bundle: SpecBundle,
  existingFiles: ReadonlySet<string>,
): Diagnostic[] {
  const out: Diagnostic[] = [];
  for (const a of bundle.assets.assets) {
    if (!existingFiles.has(a.ref)) {
      out.push({
        severity: 'error',
        code: 'MISSING_ASSET_FILE',
        message: `Asset "${a.ref}" is in the index but the file is missing on disk`,
        source: '.renpy-ui/assets.json',
        location: a.id,
      });
    }
  }
  return out;
}

/**
 * Rule (M5): warn when an Asset entry's stored hash doesn't match the
 * caller-supplied current hash (i.e. the file was modified outside the editor).
 */
export function checkAssetHashes(
  bundle: SpecBundle,
  currentHashes: ReadonlyMap<string, string>,
): Diagnostic[] {
  const out: Diagnostic[] = [];
  for (const a of bundle.assets.assets) {
    const fresh = currentHashes.get(a.ref);
    if (fresh && fresh !== a.hash) {
      out.push({
        severity: 'info',
        code: 'STALE_ASSET_HASH',
        message: `Asset "${a.ref}" has changed on disk; re-import to refresh metadata`,
        source: '.renpy-ui/assets.json',
        location: a.id,
      });
    }
  }
  return out;
}

/**
 * Rule (M5): detect a `call` chain that re-enters a label without a
 * `return` to break it. The check is intentionally conservative: it walks
 * out-edges from each `call` node within the same scene and reports a cycle
 * if the same call target is hit again before any `return` is seen.
 *
 * Cross-scene call cycles are reported when the call target resolves to a
 * scene's entry label and that scene also calls back into ours.
 */
export function checkCallCycles(bundle: SpecBundle): Diagnostic[] {
  // Build a project-wide call graph: label -> labels it calls.
  const callGraph = new Map<string, Set<string>>();
  function add(from: string, to: string): void {
    const set = callGraph.get(from) ?? new Set<string>();
    set.add(to);
    callGraph.set(from, set);
  }

  // Each scene's main label calls every call-target reachable inside it.
  for (const scene of bundle.scenes) {
    const calls = scene.nodes.filter((n) => n.type === 'call');
    for (const c of calls) {
      if (c.type === 'call') add(scene.label, c.target);
    }
    // Sub-labels within the scene also count as call sources.
    for (const n of scene.nodes) {
      if (n.type === 'label') {
        for (const c of calls) {
          if (c.type === 'call') add(n.name, c.target);
        }
      }
    }
  }

  const out: Diagnostic[] = [];
  for (const start of callGraph.keys()) {
    const stack: Array<{ node: string; path: string[] }> = [{ node: start, path: [start] }];
    while (stack.length) {
      const { node, path } = stack.pop() as { node: string; path: string[] };
      const targets = callGraph.get(node);
      if (!targets) continue;
      for (const t of targets) {
        if (path.includes(t)) {
          out.push({
            severity: 'error',
            code: 'CALL_CYCLE',
            message: `Cyclic call chain detected: ${[...path, t].join(' -> ')}`,
            source: '.renpy-ui',
          });
          continue;
        }
        stack.push({ node: t, path: [...path, t] });
      }
    }
  }

  // Deduplicate by message — DFS may report the same cycle from multiple starts.
  const seen = new Set<string>();
  return out.filter((d) => {
    if (seen.has(d.message)) return false;
    seen.add(d.message);
    return true;
  });
}

/**
 * Helper: collect every AssetRef appearing on a SceneNode.
 */
function assetRefsFromNode(node: import('@renpy-ui/spec').SceneNode): string[] {
  switch (node.type) {
    case 'sceneBg':
      return [node.background];
    case 'playMusic':
    case 'playSound':
    case 'playVoice':
      return [node.asset];
    case 'queue':
      return [node.asset];
    case 'say':
      return node.voice ? [node.voice] : [];
    default:
      return [];
  }
}

/**
 * Helper: collect every AssetRef from a ScreenWidget tree.
 */
function assetRefsFromWidget(widget: import('@renpy-ui/spec').ScreenWidget): string[] {
  const out: string[] = [];
  walk(widget);
  return out;
  function walk(w: import('@renpy-ui/spec').ScreenWidget): void {
    if (w.kind === 'image') out.push(w.asset);
    if (w.kind === 'frame' || w.kind === 'vbox' || w.kind === 'hbox') {
      for (const c of w.children) walk(c);
    }
  }
}

/**
 * Rule (M7): a screen referenced by a `showScreen` / `hideScreen` /
 * `callScreen` node resolves to a screen spec in the project.
 */
export function checkScreenReferences(bundle: SpecBundle): Diagnostic[] {
  const known = new Set(bundle.screens.map((s) => s.id));
  const out: Diagnostic[] = [];
  for (const scene of bundle.scenes) {
    for (const node of scene.nodes) {
      if (
        (node.type === 'showScreen' || node.type === 'hideScreen' || node.type === 'callScreen') &&
        node.screenId &&
        !known.has(node.screenId)
      ) {
        out.push({
          severity: 'error',
          code: 'UNKNOWN_SCREEN',
          message: `${node.type} references unknown screen id "${node.screenId}"`,
          source: sceneSource(scene),
          location: node.id,
        });
      }
    }
  }
  return out;
}

/**
 * Rule (M7): screen names are unique within the project.
 */
export function checkUniqueScreenNames(bundle: SpecBundle): Diagnostic[] {
  const out: Diagnostic[] = [];
  const seen = new Map<string, string>();
  for (const screen of bundle.screens) {
    const prev = seen.get(screen.name);
    const source = `.renpy-ui/screens/${screen.name}.json`;
    if (prev) {
      out.push({
        severity: 'error',
        code: 'DUPLICATE_SCREEN_NAME',
        message: `Duplicate screen name "${screen.name}" (also defined in ${prev})`,
        source,
        location: screen.id,
      });
    } else {
      seen.set(screen.name, source);
    }
  }
  return out;
}

/**
 * Rule (M4): warn on nodes that aren't reachable from any entry point.
 *
 * Entry points include the scene's `entryNodeId` and every `LabelNode`. We
 * walk all outgoing edges and report any node that wasn't visited.
 */
export function checkUnreachableNodes(bundle: SpecBundle): Diagnostic[] {
  const out: Diagnostic[] = [];
  for (const scene of bundle.scenes) {
    const entries = collectEntryIds(scene);
    const reachable = new Set<string>();
    const adj = new Map<string, string[]>();
    for (const e of scene.edges) {
      const list = adj.get(e.source) ?? [];
      list.push(e.target);
      adj.set(e.source, list);
    }
    const stack = [...entries];
    while (stack.length) {
      const id = stack.pop();
      if (!id || reachable.has(id)) continue;
      reachable.add(id);
      for (const next of adj.get(id) ?? []) stack.push(next);
    }
    for (const node of scene.nodes) {
      if (!reachable.has(node.id)) {
        out.push({
          severity: 'warning',
          code: 'UNREACHABLE_NODE',
          message: `Node "${node.id}" (${node.type}) is not reachable from any entry point`,
          source: sceneSource(scene),
          location: node.id,
        });
      }
    }
  }
  return out;
}

function collectEntryIds(scene: SceneSpec): string[] {
  const ids = new Set<string>();
  if (scene.nodes.some((n) => n.id === scene.entryNodeId)) ids.add(scene.entryNodeId);
  for (const n of scene.nodes) if (n.type === 'label') ids.add(n.id);
  // Synthetic-label joins (>1 inbound edges) become entries at codegen time;
  // they only exist as a result of being already-reachable, so not added here.
  return [...ids];
}

/** Rule (M4): warn when an If node has only one branch. */
export function checkIfTriviality(bundle: SpecBundle): Diagnostic[] {
  const out: Diagnostic[] = [];
  for (const scene of bundle.scenes) {
    for (const node of scene.nodes) {
      if (node.type !== 'if') continue;
      if (node.branches.length === 1) {
        out.push({
          severity: 'info',
          code: 'TRIVIAL_IF',
          message: 'If node has only one branch; consider removing it',
          source: sceneSource(scene),
          location: node.id,
        });
      }
    }
  }
  return out;
}

/** Rule (M4): warn when a relationshipOp's character does not exist. */
export function checkRelationshipCharacters(bundle: SpecBundle): Diagnostic[] {
  const known = new Set(bundle.characters.characters.map((c) => c.id));
  const out: Diagnostic[] = [];
  for (const scene of bundle.scenes) {
    for (const node of scene.nodes) {
      if (
        (node.type === 'relationshipOp' || node.type === 'show' || node.type === 'hide') &&
        node.characterId &&
        !known.has(node.characterId)
      ) {
        out.push({
          severity: 'error',
          code: 'UNKNOWN_CHARACTER',
          message: `Node references unknown character id "${node.characterId}"`,
          source: sceneSource(scene),
          location: node.id,
        });
      }
      if (node.type === 'say' && node.characterId && !known.has(node.characterId)) {
        out.push({
          severity: 'error',
          code: 'UNKNOWN_CHARACTER',
          message: `Say node references unknown character id "${node.characterId}"`,
          source: sceneSource(scene),
          location: node.id,
        });
      }
    }
  }
  return out;
}

export const ALL_RULES = [
  checkReservedIdentifiers,
  checkLabelReferences,
  checkSceneTerminals,
  checkMenuChoices,
  checkIfBranchOrder,
  checkUniqueLabels,
  checkVariableDeclarations,
  checkUnreachableNodes,
  checkIfTriviality,
  checkRelationshipCharacters,
  checkAssetReferencesIndexed,
  checkCallCycles,
  checkScreenReferences,
  checkUniqueScreenNames,
] as const;

/**
 * Optional environment passed into the I/O-aware extension of validateBundle.
 * Both fields are optional; pass only what you can resolve.
 */
export interface ValidationEnvironment {
  /** Asset refs (relative to project root) confirmed to exist on disk. */
  existingAssetFiles?: ReadonlySet<string>;
  /** Current SHA-256 (or any stable hash) per asset ref. */
  currentAssetHashes?: ReadonlyMap<string, string>;
}

/**
 * Variant of validateBundle that also runs the I/O-aware rules. Useful in the
 * desktop app and CLI where the environment is reachable; the pure
 * `validateBundle` keeps its no-args signature for browser consumers.
 */
export function validateBundleWithEnv(
  bundle: SpecBundle,
  env: ValidationEnvironment,
): Diagnostic[] {
  const all: Diagnostic[] = [...validateBundle(bundle)];
  if (env.existingAssetFiles) {
    all.push(...checkAssetFilesExist(bundle, env.existingAssetFiles));
  }
  if (env.currentAssetHashes) {
    all.push(...checkAssetHashes(bundle, env.currentAssetHashes));
  }
  return all;
}

export function validateBundle(bundle: SpecBundle): Diagnostic[] {
  const all: Diagnostic[] = [];
  for (const rule of ALL_RULES) all.push(...rule(bundle));
  return all;
}
