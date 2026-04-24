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

export const ALL_RULES = [
  checkReservedIdentifiers,
  checkLabelReferences,
  checkSceneTerminals,
  checkMenuChoices,
  checkIfBranchOrder,
  checkUniqueLabels,
  checkVariableDeclarations,
] as const;

export function validateBundle(bundle: SpecBundle): Diagnostic[] {
  const all: Diagnostic[] = [];
  for (const rule of ALL_RULES) all.push(...rule(bundle));
  return all;
}
