import { z } from 'zod';
import { SceneNode } from '../nodes';
import { Id, RenPyIdentifier, SpecVersionLiteral } from '../primitives';

/** See SPEC.md §8. */
export const SceneEdge = z.object({
  id: Id,
  source: Id,
  sourceHandle: z.string().optional(),
  target: Id,
  label: z.string().optional(),
});
export type SceneEdge = z.infer<typeof SceneEdge>;

export const SceneSpec = z.object({
  specVersion: SpecVersionLiteral,
  id: Id,
  label: RenPyIdentifier,
  title: z.string().min(1),
  entryNodeId: Id,
  nodes: z.array(SceneNode),
  edges: z.array(SceneEdge).default([]),
  viewport: z
    .object({
      x: z.number(),
      y: z.number(),
      zoom: z.number().positive(),
    })
    .optional(),
  notes: z.string().optional(),
});
export type SceneSpec = z.infer<typeof SceneSpec>;
