/**
 * @renpy-ui/spec
 *
 * Source-of-truth Zod schemas + TypeScript types for every on-disk spec
 * document. See SPEC.md.
 */

export * from './primitives';
export * from './nodes';
export * from './documents/project';
export * from './documents/characters';
export * from './documents/variables';
export * from './documents/assets';
export * from './documents/scene';
export * from './documents/screen';
export * from './migrations';

// Conventional on-disk paths (relative to project root).
export const SPEC_PATHS = {
  specDir: '.renpy-ui',
  generatedDir: 'game/generated',
  assetsDir: 'game',
  project: '.renpy-ui/project.json',
  characters: '.renpy-ui/characters.json',
  variables: '.renpy-ui/variables.json',
  assets: '.renpy-ui/assets.json',
  scenesDir: '.renpy-ui/scenes',
  screensDir: '.renpy-ui/screens',
} as const;
