import { z } from 'zod';
import { AssetRef, Id, SpecVersionLiteral } from '../primitives';

/** See SPEC.md §7. */
export const AssetKind = z.enum(['image', 'audio', 'video', 'font', 'other']);
export type AssetKind = z.infer<typeof AssetKind>;

export const AssetSubkind = z.enum(['background', 'sprite', 'ui', 'music', 'sfx', 'voice']);
export type AssetSubkind = z.infer<typeof AssetSubkind>;

export const Asset = z.object({
  id: Id,
  ref: AssetRef,
  kind: AssetKind,
  subkind: AssetSubkind.optional(),
  tags: z.array(z.string()).default([]),
  /** Content hash for change detection. Any non-empty string is accepted. */
  hash: z.string(),
  sizeBytes: z.number().int().nonnegative(),
  importedAt: z.string(),
});
export type Asset = z.infer<typeof Asset>;

export const AssetIndex = z.object({
  specVersion: SpecVersionLiteral,
  assets: z.array(Asset).default([]),
});
export type AssetIndex = z.infer<typeof AssetIndex>;
