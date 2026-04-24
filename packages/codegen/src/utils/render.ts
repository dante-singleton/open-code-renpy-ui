/**
 * Small helpers for emitting Ren'Py-flavored text deterministically.
 *
 * Ren'Py is block-structured and indentation-sensitive (like Python). These
 * helpers keep indentation consistent and escape strings the same way every
 * time so snapshot tests stay stable.
 */

export const INDENT = '    '; // 4 spaces, Ren'Py convention

export function indent(level: number, line: string): string {
  return INDENT.repeat(level) + line;
}

/**
 * Escape a string for use inside a Ren'Py "..." literal. Preserves Ren'Py tag
 * markers ({i}, {b}, etc.) by only escaping characters that would break the
 * string itself.
 */
export function escapeRenPyString(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}

/** Wrap a string in double quotes with escaping. */
export function renPyString(s: string): string {
  return `"${escapeRenPyString(s)}"`;
}

/** A blank line — used between top-level declarations. */
export const BLANK = '';

/**
 * Join lines with \n and append a trailing newline. Ren'Py files conventionally
 * end with a single newline.
 */
export function finalize(lines: string[]): string {
  return `${lines.join('\n')}\n`;
}

/**
 * Deterministic sort: (y, x, id). Used by the scene emitter so nodes render
 * top-left-first regardless of insertion order.
 */
export function byPositionThenId<T extends { id: string; position: { x: number; y: number } }>(
  a: T,
  b: T,
): number {
  if (a.position.y !== b.position.y) return a.position.y - b.position.y;
  if (a.position.x !== b.position.x) return a.position.x - b.position.x;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}
