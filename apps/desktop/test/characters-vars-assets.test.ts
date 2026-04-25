/**
 * Tests for the M3 store actions: character / variable / asset upserts and
 * removals, dirty tracking on the right files, and codegen for the new
 * scene/show/hide nodes when saving through the store.
 */
import type { Asset, Character, Variable } from '@renpy-ui/spec';
import { beforeEach, describe, expect, it } from 'vitest';
import { newEntityId, useProjectStore } from '../src/state/project';
import { MemoryStorage } from '../src/storage/memory';

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

async function freshStore(): Promise<MemoryStorage> {
  const storage = new MemoryStorage(SEED);
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
  });
  useProjectStore.temporal.getState().clear();
  await useProjectStore.getState().reloadProject();
  return storage;
}

describe('characters', () => {
  beforeEach(async () => {
    await freshStore();
  });

  it('upsertCharacter adds and marks characters.json dirty', () => {
    const c: Character = {
      id: 'c1',
      varName: 'alice',
      displayName: 'Alice',
      color: '#FF7A1A',
      images: { tag: 'alice', expressions: [] },
    };
    useProjectStore.getState().upsertCharacter(c);
    const state = useProjectStore.getState();
    expect(state.bundle?.characters.characters).toHaveLength(1);
    expect(state.dirty.has('.renpy-ui/characters.json')).toBe(true);
  });

  it('upsertCharacter updates an existing entry by id', () => {
    const c: Character = {
      id: 'c1',
      varName: 'alice',
      displayName: 'Alice',
      color: '#FF7A1A',
      images: { tag: 'alice', expressions: [] },
    };
    useProjectStore.getState().upsertCharacter(c);
    useProjectStore.getState().upsertCharacter({ ...c, displayName: 'Alice Renamed' });
    expect(useProjectStore.getState().bundle?.characters.characters[0]?.displayName).toBe(
      'Alice Renamed',
    );
  });

  it('removeCharacter drops the entry', () => {
    const c: Character = {
      id: 'c1',
      varName: 'alice',
      displayName: 'Alice',
      color: '#FF7A1A',
      images: { tag: 'alice', expressions: [] },
    };
    useProjectStore.getState().upsertCharacter(c);
    useProjectStore.getState().removeCharacter('c1');
    expect(useProjectStore.getState().bundle?.characters.characters).toHaveLength(0);
  });
});

describe('variables', () => {
  beforeEach(async () => {
    await freshStore();
  });

  it('upsertVariable adds and marks variables.json dirty', () => {
    const v: Variable = {
      id: 'v1',
      name: 'love_points',
      kind: 'int',
      default: '0',
      persistent: false,
    };
    useProjectStore.getState().upsertVariable(v);
    const state = useProjectStore.getState();
    expect(state.bundle?.variables.variables).toHaveLength(1);
    expect(state.dirty.has('.renpy-ui/variables.json')).toBe(true);
  });
});

describe('assets', () => {
  beforeEach(async () => {
    await freshStore();
  });

  it('upsertAsset adds and marks assets.json dirty', () => {
    const a: Asset = {
      id: 'a1',
      ref: 'images/bg/room.png',
      kind: 'image',
      subkind: 'background',
      tags: [],
      hash: 'h',
      sizeBytes: 100,
      importedAt: '2026-01-01T00:00:00.000Z',
    };
    useProjectStore.getState().upsertAsset(a);
    const state = useProjectStore.getState();
    expect(state.bundle?.assets.assets).toHaveLength(1);
    expect(state.dirty.has('.renpy-ui/assets.json')).toBe(true);
  });

  it('removeAsset drops the entry', () => {
    const a: Asset = {
      id: 'a1',
      ref: 'images/bg/room.png',
      kind: 'image',
      tags: [],
      hash: 'h',
      sizeBytes: 100,
      importedAt: '2026-01-01T00:00:00.000Z',
    };
    useProjectStore.getState().upsertAsset(a);
    useProjectStore.getState().removeAsset('a1');
    expect(useProjectStore.getState().bundle?.assets.assets).toHaveLength(0);
  });
});

describe('save with stage and audio', () => {
  beforeEach(async () => {
    await freshStore();
  });

  it('persists assets/characters and codegens stage/audio nodes', async () => {
    const storage = useProjectStore.getState().storage as MemoryStorage;

    // Add a background asset and character.
    useProjectStore.getState().upsertAsset({
      id: newEntityId('asset'),
      ref: 'images/bg/room.png',
      kind: 'image',
      subkind: 'background',
      tags: [],
      hash: 'h1',
      sizeBytes: 1,
      importedAt: '2026-01-01T00:00:00.000Z',
    });
    const charId = newEntityId('char');
    useProjectStore.getState().upsertCharacter({
      id: charId,
      varName: 'alice',
      displayName: 'Alice',
      color: '#FF7A1A',
      images: {
        tag: 'alice',
        expressions: [{ name: 'happy', asset: 'images/alice/happy.png' }],
      },
    });

    // Replace the trivial scene with start -> sceneBg -> show -> say -> end.
    useProjectStore.setState((s) => ({
      bundle: s.bundle && {
        ...s.bundle,
        scenes: [
          {
            ...(s.bundle.scenes[0] as import('@renpy-ui/spec').SceneSpec),
            nodes: [
              { id: 'n_start', type: 'start', position: { x: 0, y: 0 } },
              {
                id: 'n_bg',
                type: 'sceneBg',
                position: { x: 0, y: 0 },
                background: 'images/bg/room.png',
                withTransition: 'fade',
              },
              {
                id: 'n_show',
                type: 'show',
                position: { x: 0, y: 0 },
                characterId: charId,
                expressionName: 'happy',
                at: 'left',
              },
              {
                id: 'n_say',
                type: 'say',
                position: { x: 0, y: 0 },
                characterId: charId,
                expressionName: 'happy',
                text: 'Hi!',
              },
              { id: 'n_end', type: 'end', position: { x: 0, y: 0 } },
            ],
            edges: [
              { id: 'e1', source: 'n_start', target: 'n_bg' },
              { id: 'e2', source: 'n_bg', target: 'n_show' },
              { id: 'e3', source: 'n_show', target: 'n_say' },
              { id: 'e4', source: 'n_say', target: 'n_end' },
            ],
          },
        ],
      },
      dirty: new Set(s.dirty).add('.renpy-ui/scenes/start.json'),
    }));

    await useProjectStore.getState().save();

    const generated = storage.generatedFiles();
    const startRpy = generated.get('game/generated/scenes/start.rpy') ?? '';
    expect(startRpy).toContain('scene bg room with fade');
    expect(startRpy).toContain('show alice happy at left');
    expect(startRpy).toContain('alice happy "Hi!"');

    const charactersRpy = generated.get('game/generated/characters.rpy') ?? '';
    expect(charactersRpy).toContain('define alice = Character("Alice"');
    expect(charactersRpy).toContain('image alice happy = "images/alice/happy.png"');

    // No errors: validation passed.
    expect(
      useProjectStore.getState().diagnostics.filter((d) => d.severity === 'error'),
    ).toHaveLength(0);
  });
});
