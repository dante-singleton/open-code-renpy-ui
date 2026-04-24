import type { Character, SceneSpec } from '@renpy-ui/spec';
import type { SpecBundle } from './types';

/**
 * Resolved cross-document handles the emitters need.
 *
 * Built once from a validated SpecBundle. Scene emitters consult this to:
 * - map a character id to its varName and sprite tag
 * - map an expression name to the set of (image) attributes used on `show`/`say`
 * - resolve a screen id to its screen name
 * - find a scene's label from a node's jump/call target (by identifier match)
 */
export interface SymbolTable {
  charactersById: Map<string, Character>;
  screenNameById: Map<string, string>;
  sceneLabelById: Map<string, string>;
  /** Known labels from scenes + any LabelNode across the whole project. */
  knownLabels: Set<string>;
}

export function buildSymbolTable(bundle: SpecBundle): SymbolTable {
  const charactersById = new Map<string, Character>();
  for (const c of bundle.characters.characters) charactersById.set(c.id, c);

  const screenNameById = new Map<string, string>();
  for (const s of bundle.screens) screenNameById.set(s.id, s.name);

  const sceneLabelById = new Map<string, string>();
  const knownLabels = new Set<string>();
  for (const scene of bundle.scenes) {
    sceneLabelById.set(scene.id, scene.label);
    knownLabels.add(scene.label);
    collectLabels(scene, knownLabels);
  }

  return { charactersById, screenNameById, sceneLabelById, knownLabels };
}

function collectLabels(scene: SceneSpec, out: Set<string>): void {
  for (const n of scene.nodes) {
    if (n.type === 'label') out.add(n.name);
  }
}
