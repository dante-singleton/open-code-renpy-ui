/**
 * Tests for the M5 store wiring: env-aware validation pulls in
 * MISSING_ASSET_FILE / STALE_ASSET_HASH diagnostics, refreshAssetEnvironment
 * pulls from the storage backend, and quick-fix style actions move state.
 */
import type { Asset } from '@renpy-ui/spec';
import { describe, expect, it } from 'vitest';
import { newEntityId, useProjectStore } from '../src/state/project';
import { makeNode } from '../src/state/templates';
import { MemoryStorage } from '../src/storage/memory';
import type { ProjectStorage } from '../src/storage/types';

const SEED = {
  '.renpy-ui/project.json': JSON.stringify({
    specVersion: '1.0.0',
    id: 'p',
    name: 'T',
    renpyPackage: 't',
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
    scenes: [{ id: 's', label: 'start', file: 'scenes/start.json' }],
    screens: [],
  }),
  '.renpy-ui/characters.json': JSON.stringify({ specVersion: '1.0.0', characters: [] }),
  '.renpy-ui/variables.json': JSON.stringify({ specVersion: '1.0.0', variables: [] }),
  '.renpy-ui/assets.json': JSON.stringify({ specVersion: '1.0.0', assets: [] }),
  '.renpy-ui/scenes/start.json': JSON.stringify({
    specVersion: '1.0.0',
    id: 's',
    label: 'start',
    title: 'Start',
    entryNodeId: 'n_start',
    nodes: [
      { id: 'n_start', type: 'start', position: { x: 0, y: 0 } },
      { id: 'n_end', type: 'end', position: { x: 200, y: 0 } },
    ],
    edges: [{ id: 'e1', source: 'n_start', target: 'n_end' }],
  }),
};

/**
 * MemoryStorage subclass that pretends to know the on-disk file set without
 * actually reading anything.
 *
 * The store rooots AssetRefs through `paths.assetsDir` before passing them
 * to the storage backend (so refs like "images/bg/room.png" become
 * "game/images/bg/room.png"). The stub therefore stores rooted paths in
 * `existing` and `hashes`; the test helper `markPresent` does the prefixing
 * so callers stay clean.
 */
const ASSETS_DIR = 'game';

class StubStorage extends MemoryStorage {
  existing = new Set<string>();
  hashes = new Map<string, string>();

  /** Mark a bare asset ref as present on disk. */
  markPresent(ref: string, hash?: string): void {
    const rooted = `${ASSETS_DIR}/${ref}`;
    this.existing.add(rooted);
    if (hash) this.hashes.set(rooted, hash);
  }

  override async listExistingAssetFiles(refs: ReadonlySet<string>): Promise<Set<string>> {
    const out = new Set<string>();
    for (const r of refs) if (this.existing.has(r)) out.add(r);
    return out;
  }

  override async hashAssetFiles(refs: ReadonlySet<string>): Promise<Map<string, string>> {
    const out = new Map<string, string>();
    for (const r of refs) {
      const h = this.hashes.get(r);
      if (h) out.set(r, h);
    }
    return out;
  }
}

async function freshStore(storage: ProjectStorage): Promise<void> {
  useProjectStore.setState({
    storage,
    bundle: null,
    activeSceneId: null,
    selectedNodeIds: [],
    selectedEdgeIds: [],
    dirty: new Set(),
    diagnostics: [],
    status: 'idle',
    errorMessage: null,
    lastGenerated: null,
    existingAssetFiles: new Set(),
    currentAssetHashes: new Map(),
  });
  useProjectStore.temporal.getState().clear();
  await useProjectStore.getState().reloadProject();
}

function asset(ref: string, hash = 'h_old'): Asset {
  return {
    id: newEntityId('asset'),
    ref,
    kind: 'image',
    subkind: 'background',
    tags: [],
    hash,
    sizeBytes: 1,
    importedAt: '2026-01-01T00:00:00.000Z',
  };
}

describe('asset env validation', () => {
  it('flags an asset whose file is missing on disk', async () => {
    const storage = new StubStorage(SEED);
    // No files marked as existing.
    storage.existing = new Set();
    await freshStore(storage);

    useProjectStore.getState().upsertAsset(asset('images/bg/room.png'));
    await useProjectStore.getState().refreshAssetEnvironment();

    const diags = useProjectStore.getState().diagnostics;
    expect(diags.some((d) => d.code === 'MISSING_ASSET_FILE')).toBe(true);
  });

  it('clears the diagnostic when the file appears', async () => {
    const storage = new StubStorage(SEED);
    await freshStore(storage);

    useProjectStore.getState().upsertAsset(asset('images/bg/room.png'));
    await useProjectStore.getState().refreshAssetEnvironment();
    expect(
      useProjectStore.getState().diagnostics.some((d) => d.code === 'MISSING_ASSET_FILE'),
    ).toBe(true);

    storage.markPresent('images/bg/room.png');
    await useProjectStore.getState().refreshAssetEnvironment();
    expect(
      useProjectStore.getState().diagnostics.some((d) => d.code === 'MISSING_ASSET_FILE'),
    ).toBe(false);
  });

  it('flags STALE_ASSET_HASH when on-disk hash differs', async () => {
    const storage = new StubStorage(SEED);
    storage.markPresent('images/bg/room.png', 'h_new');
    await freshStore(storage);

    useProjectStore.getState().upsertAsset(asset('images/bg/room.png', 'h_old'));
    await useProjectStore.getState().refreshAssetEnvironment();

    const diags = useProjectStore.getState().diagnostics;
    expect(diags.some((d) => d.code === 'STALE_ASSET_HASH')).toBe(true);
  });
});

describe('quick-fix store actions', () => {
  it('jumpToNode switches the active scene and selects the node', async () => {
    const storage = new StubStorage(SEED);
    await freshStore(storage);

    const node = makeNode('narration', { x: 0, y: 0 });
    useProjectStore.getState().addNode(node);
    useProjectStore.getState().selectNodes([]);
    useProjectStore.getState().setActiveScene('s'); // already active

    useProjectStore.getState().jumpToNode('.renpy-ui/scenes/start.json', node.id);

    expect(useProjectStore.getState().activeSceneId).toBe('s');
    expect(useProjectStore.getState().selectedNodeIds).toEqual([node.id]);
  });

  it('removeNodeAt deletes a node from a scene by spec path', async () => {
    const storage = new StubStorage(SEED);
    await freshStore(storage);

    const node = makeNode('narration', { x: 0, y: 0 });
    useProjectStore.getState().addNode(node);
    expect(useProjectStore.getState().bundle?.scenes[0]?.nodes.some((n) => n.id === node.id)).toBe(
      true,
    );

    useProjectStore.getState().removeNodeAt('.renpy-ui/scenes/start.json', node.id);

    expect(useProjectStore.getState().bundle?.scenes[0]?.nodes.some((n) => n.id === node.id)).toBe(
      false,
    );
  });
});
