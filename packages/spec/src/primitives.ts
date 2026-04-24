import { z } from 'zod';

/**
 * Primitive Zod schemas shared across documents. See SPEC.md §3.
 */

/** Stable id. ULIDs are preferred but any non-empty opaque string is accepted. */
export const Id = z.string().min(1);
export type Id = z.infer<typeof Id>;

/** Python/Ren'Py identifier: letters, digits, underscore; cannot start with a digit. */
export const RenPyIdentifier = z
  .string()
  .regex(/^[A-Za-z_][A-Za-z0-9_]*$/, 'must be a valid Python identifier');
export type RenPyIdentifier = z.infer<typeof RenPyIdentifier>;

/** Relative path under game/, e.g. "images/bg/room.png". Forward slashes only. */
export const AssetRef = z
  .string()
  .min(1)
  .refine((s) => !s.startsWith('/') && !s.includes('\\'), {
    message: 'AssetRef must be a relative path using forward slashes',
  });
export type AssetRef = z.infer<typeof AssetRef>;

/** Raw Python expression string. Evaluated by Ren'Py, not by the editor. */
export const Expression = z.string();
export type Expression = z.infer<typeof Expression>;

export const Position = z.object({
  x: z.number(),
  y: z.number(),
});
export type Position = z.infer<typeof Position>;

/** Current spec version. Bumped per SPEC.md §2. */
export const SPEC_VERSION = '1.0.0' as const;
export type SpecVersion = typeof SPEC_VERSION;

/** Every top-level document carries this tag. */
export const SpecVersionLiteral = z.literal(SPEC_VERSION);

/** Hex color, e.g. "#FF7A1A" or "#FFF". */
export const HexColor = z
  .string()
  .regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/, 'invalid hex color');
export type HexColor = z.infer<typeof HexColor>;

/**
 * Python/Ren'Py reserved words. Not exhaustive of all Ren'Py keywords, but
 * covers everything the validator should reject for new identifiers.
 */
export const RESERVED_IDENTIFIERS: readonly string[] = [
  // Python
  'False',
  'None',
  'True',
  'and',
  'as',
  'assert',
  'async',
  'await',
  'break',
  'class',
  'continue',
  'def',
  'del',
  'elif',
  'else',
  'except',
  'finally',
  'for',
  'from',
  'global',
  'if',
  'import',
  'in',
  'is',
  'lambda',
  'nonlocal',
  'not',
  'or',
  'pass',
  'raise',
  'return',
  'try',
  'while',
  'with',
  'yield',
  // Ren'Py statement keywords (common ones users would collide with)
  'call',
  'default',
  'define',
  'hide',
  'image',
  'init',
  'jump',
  'label',
  'menu',
  'play',
  'python',
  'queue',
  'scene',
  'screen',
  'show',
  'stop',
  'transform',
  'voice',
  'window',
];

export function isReservedIdentifier(name: string): boolean {
  return RESERVED_IDENTIFIERS.includes(name);
}
