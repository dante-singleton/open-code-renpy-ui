/**
 * @renpy-ui/codegen
 *
 * Deterministic spec -> .rpy emitter. See ARCHITECTURE.md §5.
 */

export * from './types';
export * from './symbols';
export { generate } from './generate';
export { emitCharacters } from './emitters/characters';
export { emitVariables } from './emitters/variables';
export { emitScene } from './emitters/scene';
export { emitManifest } from './emitters/manifest';
export { generatedHeader } from './utils/header';
export { loadProject, SpecLoadError } from './loader';
export { writeGenerated, type WriteReport } from './writer';
