import { describe, expect, it } from 'vitest';
import { CharacterCatalog, ProjectManifest, SceneSpec, VariableCatalog } from '../src';

describe('ProjectManifest', () => {
  it('applies defaults', () => {
    const parsed = ProjectManifest.parse({
      specVersion: '1.0.0',
      id: '01HYZPROJECT',
      name: 'Demo',
      renpyPackage: 'demo',
    });
    expect(parsed.startLabel).toBe('start');
    expect(parsed.paths.specDir).toBe('.renpy-ui');
    expect(parsed.renpy.minVersion).toBe('8.2.0');
    expect(parsed.scenes).toEqual([]);
  });

  it('rejects invalid renpyPackage', () => {
    const res = ProjectManifest.safeParse({
      specVersion: '1.0.0',
      id: 'x',
      name: 'Demo',
      renpyPackage: '1bad-name',
    });
    expect(res.success).toBe(false);
  });
});

describe('CharacterCatalog', () => {
  it('parses a single character', () => {
    const cat = CharacterCatalog.parse({
      specVersion: '1.0.0',
      characters: [
        {
          id: 'c1',
          varName: 'alice',
          displayName: 'Alice',
          color: '#FF7A1A',
          images: {
            tag: 'alice',
            expressions: [{ name: 'happy', asset: 'images/alice/happy.png' }],
          },
        },
      ],
    });
    expect(cat.characters).toHaveLength(1);
    expect(cat.characters[0]?.images.expressions[0]?.name).toBe('happy');
  });
});

describe('VariableCatalog', () => {
  it('accepts variables with defaults', () => {
    const cat = VariableCatalog.parse({
      specVersion: '1.0.0',
      variables: [{ id: 'v1', name: 'love_points', kind: 'int', default: '0', persistent: false }],
    });
    expect(cat.variables[0]?.persistent).toBe(false);
  });
});

describe('SceneSpec', () => {
  it('parses the minimal scene from SPEC.md §11', () => {
    const scene = SceneSpec.parse({
      specVersion: '1.0.0',
      id: 's1',
      label: 'chapter1_intro',
      title: 'Chapter 1 — Intro',
      entryNodeId: 'n_start',
      nodes: [
        { id: 'n_start', type: 'start', position: { x: 0, y: 0 } },
        {
          id: 'n_say',
          type: 'say',
          position: { x: 200, y: 0 },
          characterId: 'c1',
          text: 'Hi',
        },
        { id: 'n_end', type: 'end', position: { x: 400, y: 0 } },
      ],
      edges: [
        { id: 'e1', source: 'n_start', target: 'n_say' },
        { id: 'e2', source: 'n_say', target: 'n_end' },
      ],
    });
    expect(scene.nodes).toHaveLength(3);
  });

  it('rejects an unknown node type', () => {
    const res = SceneSpec.safeParse({
      specVersion: '1.0.0',
      id: 's1',
      label: 'x',
      title: 'x',
      entryNodeId: 'n1',
      nodes: [{ id: 'n1', type: 'bogus', position: { x: 0, y: 0 } }],
    });
    expect(res.success).toBe(false);
  });
});
