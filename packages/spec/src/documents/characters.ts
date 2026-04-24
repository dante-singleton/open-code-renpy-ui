import { z } from 'zod';
import { AssetRef, HexColor, Id, RenPyIdentifier, SpecVersionLiteral } from '../primitives';

/** See SPEC.md §5. */
export const CharacterExpression = z.object({
  name: z.string().min(1),
  asset: AssetRef,
});
export type CharacterExpression = z.infer<typeof CharacterExpression>;

export const CharacterPose = z.object({
  name: z.string().min(1),
  asset: AssetRef,
});
export type CharacterPose = z.infer<typeof CharacterPose>;

export const Character = z.object({
  id: Id,
  varName: RenPyIdentifier,
  displayName: z.string().min(1),
  color: HexColor,
  voiceTag: RenPyIdentifier.optional(),
  images: z.object({
    tag: RenPyIdentifier,
    expressions: z.array(CharacterExpression).default([]),
    poses: z.array(CharacterPose).optional(),
  }),
  sayAttributes: z.record(z.string(), z.string()).optional(),
});
export type Character = z.infer<typeof Character>;

export const CharacterCatalog = z.object({
  specVersion: SpecVersionLiteral,
  characters: z.array(Character).default([]),
});
export type CharacterCatalog = z.infer<typeof CharacterCatalog>;
