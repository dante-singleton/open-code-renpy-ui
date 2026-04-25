/**
 * Node-only entry point. Pulls in `node:fs/promises` and friends via the
 * loader/writer modules; do not import from a browser bundle.
 */
export { loadProject, SpecLoadError } from './loader';
export { writeGenerated, type WriteReport } from './writer';
