import { z } from 'zod';
import { Id, RenPyIdentifier, SpecVersionLiteral } from '../primitives';

/** See SPEC.md §4. */
export const ProjectManifest = z.object({
  specVersion: SpecVersionLiteral,
  id: Id,
  name: z.string().min(1),
  renpyPackage: RenPyIdentifier,
  version: z.string().default('0.0.1'),
  authors: z.array(z.string()).default([]),
  startLabel: RenPyIdentifier.default('start'),
  locales: z.array(z.string()).default(['en']),
  paths: z
    .object({
      specDir: z.string().default('.renpy-ui'),
      generatedDir: z.string().default('game/generated'),
      assetsDir: z.string().default('game'),
    })
    .default({
      specDir: '.renpy-ui',
      generatedDir: 'game/generated',
      assetsDir: 'game',
    }),
  renpy: z
    .object({
      minVersion: z.string().default('8.2.0'),
      buildWindows: z.boolean().default(true),
      buildMac: z.boolean().default(true),
      buildLinux: z.boolean().default(true),
      buildWeb: z.boolean().default(false),
    })
    .default({
      minVersion: '8.2.0',
      buildWindows: true,
      buildMac: true,
      buildLinux: true,
      buildWeb: false,
    }),
  scenes: z
    .array(
      z.object({
        id: Id,
        label: RenPyIdentifier,
        file: z.string(),
      }),
    )
    .default([]),
  screens: z
    .array(
      z.object({
        id: Id,
        name: RenPyIdentifier,
        file: z.string(),
      }),
    )
    .default([]),
});

export type ProjectManifest = z.infer<typeof ProjectManifest>;
