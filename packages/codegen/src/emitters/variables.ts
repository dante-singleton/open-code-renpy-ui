import type { VariableCatalog } from '@renpy-ui/spec';
import { generatedHeader } from '../utils/header';
import { finalize } from '../utils/render';

/**
 * Emit game/generated/variables.rpy:
 *
 *   default love_points = 0
 *   default persistent.seen_intro = False
 */
export function emitVariables(catalog: VariableCatalog): string {
  const lines: string[] = [...generatedHeader('.renpy-ui/variables.json')];

  const sorted = [...catalog.variables].sort((a, b) =>
    a.name < b.name ? -1 : a.name > b.name ? 1 : 0,
  );

  for (const v of sorted) {
    const prefix = v.persistent ? 'default persistent.' : 'default ';
    if (v.doc) lines.push(`# ${v.doc.replace(/\n/g, ' ')}`);
    lines.push(`${prefix}${v.name} = ${v.default}`);
  }

  return finalize(lines);
}
