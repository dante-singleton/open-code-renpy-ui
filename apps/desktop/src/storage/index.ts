import { MemoryStorage } from './memory';
import { TauriStorage } from './tauri';
import type { ProjectStorage } from './types';

export type { ProjectStorage } from './types';
export { MemoryStorage } from './memory';
export { TauriStorage } from './tauri';

/**
 * True when running inside a Tauri webview. Tauri injects `__TAURI_INTERNALS__`
 * (v2) on `window`. We check at runtime so the same bundle works in both
 * environments (handy for `pnpm dev`).
 */
export function isTauri(): boolean {
  if (typeof window === 'undefined') return false;
  // biome-ignore lint/suspicious/noExplicitAny: window's runtime shape is dynamic
  return Boolean((window as any).__TAURI_INTERNALS__);
}

const HELLO_WORLD_SEED: Record<string, string> = {
  '.renpy-ui/project.json': JSON.stringify(
    {
      specVersion: '1.0.0',
      id: '01HYZPROJECT_DEMO',
      name: 'Untitled VN',
      renpyPackage: 'untitled_vn',
      version: '0.1.0',
      authors: [],
      startLabel: 'start',
      locales: ['en'],
      paths: { specDir: '.renpy-ui', generatedDir: 'game/generated', assetsDir: 'game' },
      renpy: {
        minVersion: '8.2.0',
        buildWindows: true,
        buildMac: true,
        buildLinux: true,
        buildWeb: false,
      },
      scenes: [{ id: '01HYZSCENE_START', label: 'start', file: 'scenes/start.json' }],
      screens: [],
    },
    null,
    2,
  ),
  '.renpy-ui/characters.json': JSON.stringify({ specVersion: '1.0.0', characters: [] }, null, 2),
  '.renpy-ui/variables.json': JSON.stringify({ specVersion: '1.0.0', variables: [] }, null, 2),
  '.renpy-ui/assets.json': JSON.stringify({ specVersion: '1.0.0', assets: [] }, null, 2),
  '.renpy-ui/scenes/start.json': JSON.stringify(
    {
      specVersion: '1.0.0',
      id: '01HYZSCENE_START',
      label: 'start',
      title: 'Start',
      entryNodeId: 'n_start',
      nodes: [
        { id: 'n_start', type: 'start', position: { x: 40, y: 40 } },
        {
          id: 'n_say',
          type: 'narration',
          position: { x: 280, y: 40 },
          text: 'Welcome to your visual novel!',
        },
        { id: 'n_end', type: 'end', position: { x: 560, y: 40 } },
      ],
      edges: [
        { id: 'e1', source: 'n_start', target: 'n_say' },
        { id: 'e2', source: 'n_say', target: 'n_end' },
      ],
    },
    null,
    2,
  ),
};

/** Pick the appropriate backend for the current runtime. */
export function createStorage(): ProjectStorage {
  if (isTauri()) return new TauriStorage();
  return new MemoryStorage(HELLO_WORLD_SEED);
}
