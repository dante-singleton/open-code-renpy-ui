import type { CharacterCatalog, SceneSpec } from '@renpy-ui/spec';
import { describe, expect, it } from 'vitest';
import { emitScene } from '../src/emitters/scene';
import { emitVariables } from '../src/emitters/variables';
import { buildSymbolTable } from '../src/symbols';
import type { SpecBundle } from '../src/types';

const CHARACTERS: CharacterCatalog = {
  specVersion: '1.0.0',
  characters: [
    {
      id: 'c_alice',
      varName: 'alice',
      displayName: 'Alice',
      color: '#FF7A1A',
      images: { tag: 'alice', expressions: [] },
    },
  ],
};

function bundleFor(scene: SceneSpec): SpecBundle {
  return {
    project: {
      specVersion: '1.0.0',
      id: 'p',
      name: 'T',
      renpyPackage: 't',
      version: '0.0.1',
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
      scenes: [],
      screens: [],
    },
    characters: CHARACTERS,
    variables: { specVersion: '1.0.0', variables: [] },
    assets: { specVersion: '1.0.0', assets: [] },
    scenes: [scene],
    screens: [],
  };
}

const sceneShell = (nodes: SceneSpec['nodes'], edges: SceneSpec['edges']): SceneSpec => ({
  specVersion: '1.0.0',
  id: 's',
  label: 'start',
  title: 'Start',
  entryNodeId: nodes[0]?.id ?? 'n_start',
  nodes,
  edges,
});

describe('if / elif / else emitter', () => {
  it('emits if/elif/else with correct headers and indentation', () => {
    const scene = sceneShell(
      [
        { id: 'n_start', type: 'start', position: { x: 0, y: 0 } },
        {
          id: 'n_if',
          type: 'if',
          position: { x: 0, y: 0 },
          branches: [
            { id: 'b1', condition: 'x > 0' },
            { id: 'b2', condition: 'x < 0' },
            { id: 'b3', condition: '' },
          ],
        },
        { id: 'n_pos', type: 'narration', position: { x: 0, y: 0 }, text: 'pos' },
        { id: 'n_neg', type: 'narration', position: { x: 0, y: 0 }, text: 'neg' },
        { id: 'n_zero', type: 'narration', position: { x: 0, y: 0 }, text: 'zero' },
        { id: 'n_end', type: 'end', position: { x: 0, y: 0 } },
      ],
      [
        { id: 'e0', source: 'n_start', target: 'n_if' },
        { id: 'e1', source: 'n_if', sourceHandle: 'branch:b1', target: 'n_pos' },
        { id: 'e2', source: 'n_if', sourceHandle: 'branch:b2', target: 'n_neg' },
        { id: 'e3', source: 'n_if', sourceHandle: 'branch:b3', target: 'n_zero' },
        { id: 'e4', source: 'n_pos', target: 'n_end' },
        { id: 'e5', source: 'n_neg', target: 'n_end' },
        { id: 'e6', source: 'n_zero', target: 'n_end' },
      ],
    );
    const out = emitScene(scene, buildSymbolTable(bundleFor(scene)));
    expect(out).toContain('if x > 0:');
    expect(out).toContain('elif x < 0:');
    expect(out).toContain('else:');
    // Each branch's body must be indented one level deeper than the if/elif/else.
    expect(out).toMatch(/if x > 0:\n {8}"pos"/);
    expect(out).toMatch(/elif x < 0:\n {8}"neg"/);
    expect(out).toMatch(/else:\n {8}"zero"/);
  });

  it('falls back to `pass` when an if branch has no outgoing edge', () => {
    const scene = sceneShell(
      [
        { id: 'n_start', type: 'start', position: { x: 0, y: 0 } },
        {
          id: 'n_if',
          type: 'if',
          position: { x: 0, y: 0 },
          branches: [{ id: 'b1', condition: 'False' }],
        },
        { id: 'n_end', type: 'end', position: { x: 0, y: 0 } },
      ],
      [
        { id: 'e1', source: 'n_start', target: 'n_if' },
        { id: 'e2', source: 'n_if', target: 'n_end' },
      ],
    );
    const out = emitScene(scene, buildSymbolTable(bundleFor(scene)));
    expect(out).toMatch(/if False:\n {8}pass/);
  });
});

describe('setVar / increment emitters', () => {
  it('setVar produces a `$` python statement', () => {
    const scene = sceneShell(
      [
        { id: 'n_start', type: 'start', position: { x: 0, y: 0 } },
        {
          id: 'n_set',
          type: 'setVar',
          position: { x: 0, y: 0 },
          variable: 'love_points',
          expression: 'love_points + 1',
        },
        { id: 'n_end', type: 'end', position: { x: 0, y: 0 } },
      ],
      [
        { id: 'e1', source: 'n_start', target: 'n_set' },
        { id: 'e2', source: 'n_set', target: 'n_end' },
      ],
    );
    expect(emitScene(scene, buildSymbolTable(bundleFor(scene)))).toContain(
      '$ love_points = love_points + 1',
    );
  });

  it('increment uses `+=` for positive deltas, `-=` for negative', () => {
    const scenePos = sceneShell(
      [
        { id: 'n_start', type: 'start', position: { x: 0, y: 0 } },
        {
          id: 'n_inc',
          type: 'increment',
          position: { x: 0, y: 0 },
          variable: 'count',
          delta: 2,
        },
        { id: 'n_end', type: 'end', position: { x: 0, y: 0 } },
      ],
      [
        { id: 'e1', source: 'n_start', target: 'n_inc' },
        { id: 'e2', source: 'n_inc', target: 'n_end' },
      ],
    );
    expect(emitScene(scenePos, buildSymbolTable(bundleFor(scenePos)))).toContain('$ count += 2');

    const sceneNeg = sceneShell(
      [
        { id: 'n_start', type: 'start', position: { x: 0, y: 0 } },
        {
          id: 'n_inc',
          type: 'increment',
          position: { x: 0, y: 0 },
          variable: 'count',
          delta: -3,
        },
        { id: 'n_end', type: 'end', position: { x: 0, y: 0 } },
      ],
      [
        { id: 'e1', source: 'n_start', target: 'n_inc' },
        { id: 'e2', source: 'n_inc', target: 'n_end' },
      ],
    );
    expect(emitScene(sceneNeg, buildSymbolTable(bundleFor(sceneNeg)))).toContain('$ count -= 3');
  });
});

describe('python block emitter', () => {
  it('indents each line of the user code one level inside `python:`', () => {
    const scene = sceneShell(
      [
        { id: 'n_start', type: 'start', position: { x: 0, y: 0 } },
        {
          id: 'n_py',
          type: 'python',
          position: { x: 0, y: 0 },
          code: 'a = 1\nb = 2\nprint(a + b)',
        },
        { id: 'n_end', type: 'end', position: { x: 0, y: 0 } },
      ],
      [
        { id: 'e1', source: 'n_start', target: 'n_py' },
        { id: 'e2', source: 'n_py', target: 'n_end' },
      ],
    );
    const out = emitScene(scene, buildSymbolTable(bundleFor(scene)));
    expect(out).toMatch(/python:\n {8}a = 1\n {8}b = 2\n {8}print\(a \+ b\)/);
  });
});

describe('inventory / stat / relationship op emitters', () => {
  it('inventory ops dispatch to a Python helper', () => {
    const cases: Array<{ op: 'add' | 'remove' | 'set'; fn: string }> = [
      { op: 'add', fn: 'inventory_add' },
      { op: 'remove', fn: 'inventory_remove' },
      { op: 'set', fn: 'inventory_set' },
    ];
    for (const { op, fn } of cases) {
      const scene = sceneShell(
        [
          { id: 'n_start', type: 'start', position: { x: 0, y: 0 } },
          {
            id: 'n_inv',
            type: 'inventoryOp',
            position: { x: 0, y: 0 },
            op,
            itemId: 'sword',
            quantity: 2,
          },
          { id: 'n_end', type: 'end', position: { x: 0, y: 0 } },
        ],
        [
          { id: 'e1', source: 'n_start', target: 'n_inv' },
          { id: 'e2', source: 'n_inv', target: 'n_end' },
        ],
      );
      expect(emitScene(scene, buildSymbolTable(bundleFor(scene)))).toContain(`$ ${fn}("sword", 2)`);
    }
  });

  it('stat ops use += / -= / = depending on op', () => {
    for (const { op, expected } of [
      { op: 'add' as const, expected: '$ strength += 1' },
      { op: 'subtract' as const, expected: '$ strength -= 1' },
      { op: 'set' as const, expected: '$ strength = 1' },
    ]) {
      const scene = sceneShell(
        [
          { id: 'n_start', type: 'start', position: { x: 0, y: 0 } },
          {
            id: 'n_s',
            type: 'statOp',
            position: { x: 0, y: 0 },
            stat: 'strength',
            op,
            value: 1,
          },
          { id: 'n_end', type: 'end', position: { x: 0, y: 0 } },
        ],
        [
          { id: 'e1', source: 'n_start', target: 'n_s' },
          { id: 'e2', source: 'n_s', target: 'n_end' },
        ],
      );
      expect(emitScene(scene, buildSymbolTable(bundleFor(scene)))).toContain(expected);
    }
  });

  it('relationship op uses the character\u2019s sprite tag in the variable name', () => {
    const scene = sceneShell(
      [
        { id: 'n_start', type: 'start', position: { x: 0, y: 0 } },
        {
          id: 'n_rel',
          type: 'relationshipOp',
          position: { x: 0, y: 0 },
          characterId: 'c_alice',
          op: 'add',
          value: 1,
        },
        { id: 'n_end', type: 'end', position: { x: 0, y: 0 } },
      ],
      [
        { id: 'e1', source: 'n_start', target: 'n_rel' },
        { id: 'e2', source: 'n_rel', target: 'n_end' },
      ],
    );
    expect(emitScene(scene, buildSymbolTable(bundleFor(scene)))).toContain(
      '$ relationship_alice_love += 1',
    );
  });

  it('relationship op honours the optional `track`', () => {
    const scene = sceneShell(
      [
        { id: 'n_start', type: 'start', position: { x: 0, y: 0 } },
        {
          id: 'n_rel',
          type: 'relationshipOp',
          position: { x: 0, y: 0 },
          characterId: 'c_alice',
          op: 'subtract',
          value: 2,
          track: 'trust',
        },
        { id: 'n_end', type: 'end', position: { x: 0, y: 0 } },
      ],
      [
        { id: 'e1', source: 'n_start', target: 'n_rel' },
        { id: 'e2', source: 'n_rel', target: 'n_end' },
      ],
    );
    expect(emitScene(scene, buildSymbolTable(bundleFor(scene)))).toContain(
      '$ relationship_alice_trust -= 2',
    );
  });
});

describe('variables emitter', () => {
  it('emits `default persistent.<name>` when persistent is true', () => {
    const out = emitVariables({
      specVersion: '1.0.0',
      variables: [
        { id: 'v1', name: 'love', kind: 'int', default: '0', persistent: false },
        { id: 'v2', name: 'seen', kind: 'bool', default: 'False', persistent: true },
      ],
    });
    expect(out).toContain('default love = 0');
    expect(out).toContain('default persistent.seen = False');
  });

  it('emits the doc string as a comment above the default', () => {
    const out = emitVariables({
      specVersion: '1.0.0',
      variables: [
        {
          id: 'v1',
          name: 'love',
          kind: 'int',
          default: '0',
          persistent: false,
          doc: 'Affection toward Alice.',
        },
      ],
    });
    expect(out).toMatch(/# Affection toward Alice\.\ndefault love = 0/);
  });
});
