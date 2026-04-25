/**
 * @renpy-ui/codegen
 *
 * Deterministic spec -> .rpy emitter. See ARCHITECTURE.md §5.
 *
 * This entry is pure-TS (no `node:*` imports) and safe in browsers. For the
 * Node-only filesystem helpers (`loadProject`, `writeGenerated`), import from
 * `@renpy-ui/codegen/node` instead.
 */

export * from './types';
export * from './symbols';
export { generate } from './generate';
export { emitCharacters } from './emitters/characters';
export { emitVariables } from './emitters/variables';
export { emitScene } from './emitters/scene';
export { emitManifest } from './emitters/manifest';
export { generatedHeader } from './utils/header';
