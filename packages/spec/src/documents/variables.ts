import { z } from 'zod';
import { Id, RenPyIdentifier, SpecVersionLiteral } from '../primitives';

/** See SPEC.md §6. */
export const VariableKind = z.enum(['bool', 'int', 'float', 'string', 'list', 'dict', 'python']);
export type VariableKind = z.infer<typeof VariableKind>;

export const Variable = z.object({
  id: Id,
  name: RenPyIdentifier,
  kind: VariableKind,
  /** Raw Python literal as a string. */
  default: z.string(),
  persistent: z.boolean().default(false),
  doc: z.string().optional(),
});
export type Variable = z.infer<typeof Variable>;

export const VariableCatalog = z.object({
  specVersion: SpecVersionLiteral,
  variables: z.array(Variable).default([]),
});
export type VariableCatalog = z.infer<typeof VariableCatalog>;
