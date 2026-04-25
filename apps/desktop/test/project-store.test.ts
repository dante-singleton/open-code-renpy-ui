/**
 * Behavioural tests for the project store: graph mutations, dirty tracking,
 * undo/redo, and save -> codegen pipeline against the in-memory storage.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { useProjectStore } from '../src/state/project';
import { makeNode } from '../src/state/templates';
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
  // Reset the singleton store between tests.
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

describe('project store', () => {
  beforeEach(async () => {
    await freshStore();
  });

  it('loads the seed project', () => {
    const state = useProjectStore.getState();
    expect(state.bundle?.scenes).toHaveLength(1);
    expect(state.bundle?.scenes[0]?.label).toBe('start');
    expect(state.activeSceneId).toBe('s');
    expect(state.dirty.size).toBe(0);
  });

  it('addNode marks the scene dirty and revalidates', () => {
    const node = makeNode('say', { x: 100, y: 0 });
    useProjectStore.getState().addNode(node);

    const state = useProjectStore.getState();
    expect(state.dirty.has('.renpy-ui/scenes/start.json')).toBe(true);
    expect(state.bundle?.scenes[0]?.nodes.some((n) => n.id === node.id)).toBe(true);
  });

  it('updateNode patches the active scene', () => {
    const node = makeNode('say', { x: 100, y: 0 });
    useProjectStore.getState().addNode(node);
    useProjectStore.getState().updateNode(node.id, { text: 'hi' });

    const updated = useProjectStore
      .getState()
      .bundle?.scenes[0]?.nodes.find((n) => n.id === node.id) as
      | { type: 'say'; text: string }
      | undefined;
    expect(updated?.text).toBe('hi');
  });

  it('removeNodes also drops connected edges', () => {
    const before = useProjectStore.getState().bundle?.scenes[0]?.edges.length ?? 0;
    useProjectStore.getState().removeNodes(['n_end']);

    const state = useProjectStore.getState();
    const scene = state.bundle?.scenes[0];
    expect(scene?.nodes.some((n) => n.id === 'n_end')).toBe(false);
    expect(scene?.edges.length).toBeLessThan(before);
  });

  it('addEdge replaces an existing edge with the same source+handle', () => {
    const sayId = makeNode('say', { x: 100, y: 0 }).id;
    useProjectStore.getState().addNode({ ...makeNode('say', { x: 100, y: 0 }), id: sayId });

    useProjectStore.getState().addEdge({ id: 'eA', source: 'n_start', target: sayId });
    useProjectStore.getState().addEdge({ id: 'eB', source: 'n_start', target: 'n_end' });

    const edges = useProjectStore.getState().bundle?.scenes[0]?.edges ?? [];
    const fromStart = edges.filter((e) => e.source === 'n_start' && !e.sourceHandle);
    expect(fromStart).toHaveLength(1);
    expect(fromStart[0]?.id).toBe('eB');
  });

  it('undo / redo restores graph state', () => {
    const node = makeNode('narration', { x: 100, y: 0 });
    useProjectStore.getState().addNode(node);
    expect(useProjectStore.getState().bundle?.scenes[0]?.nodes.some((n) => n.id === node.id)).toBe(
      true,
    );

    useProjectStore.temporal.getState().undo();
    expect(useProjectStore.getState().bundle?.scenes[0]?.nodes.some((n) => n.id === node.id)).toBe(
      false,
    );

    useProjectStore.temporal.getState().redo();
    expect(useProjectStore.getState().bundle?.scenes[0]?.nodes.some((n) => n.id === node.id)).toBe(
      true,
    );
  });

  it('save persists dirty docs and runs codegen', async () => {
    const storage = useProjectStore.getState().storage as MemoryStorage;

    const node = makeNode('narration', { x: 100, y: 0 });
    useProjectStore.getState().addNode(node);
    useProjectStore.getState().updateNode(node.id, { text: 'after save' } as never);

    await useProjectStore.getState().save();

    expect(useProjectStore.getState().dirty.size).toBe(0);
    expect(useProjectStore.getState().status).toBe('idle');

    // Spec was written back.
    const persisted = await storage.readSpec('.renpy-ui/scenes/start.json');
    expect(persisted).toContain('after save');

    // Codegen output is present.
    const generated = storage.generatedFiles();
    expect(generated.size).toBeGreaterThan(0);
    expect(generated.has('game/generated/scenes/start.rpy')).toBe(true);
  });

  it('save does not codegen when validation has errors', async () => {
    const storage = useProjectStore.getState().storage as MemoryStorage;
    // Introduce a duplicate label by renaming the only scene's start label.
    const labelNode = makeNode('label', { x: 100, y: 0 });
    if (labelNode.type === 'label') {
      labelNode.name = 'start';
    }
    useProjectStore.getState().addNode(labelNode);

    await useProjectStore.getState().save();

    const errors = useProjectStore.getState().diagnostics.filter((d) => d.severity === 'error');
    expect(errors.length).toBeGreaterThan(0);
    // Generated dir is empty — codegen was skipped.
    expect(storage.generatedFiles().size).toBe(0);
  });
});
