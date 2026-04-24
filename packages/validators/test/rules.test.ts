import { describe, expect, it } from 'vitest';
import type { SpecBundle } from '../src/bundle';
import {
  checkIfBranchOrder,
  checkLabelReferences,
  checkMenuChoices,
  checkReservedIdentifiers,
  checkSceneTerminals,
  checkUniqueLabels,
  checkVariableDeclarations,
  validateBundle,
} from '../src/rules';

function bundle(partial: Partial<SpecBundle> = {}): SpecBundle {
  return {
    project: {
      specVersion: '1.0.0',
      id: 'p',
      name: 'X',
      renpyPackage: 'x',
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
    characters: { specVersion: '1.0.0', characters: [] },
    variables: { specVersion: '1.0.0', variables: [] },
    assets: { specVersion: '1.0.0', assets: [] },
    scenes: [],
    screens: [],
    ...partial,
  };
}

const sceneShell = (
  patch: Partial<import('@renpy-ui/spec').SceneSpec>,
): import('@renpy-ui/spec').SceneSpec => ({
  specVersion: '1.0.0',
  id: 's',
  label: 'start',
  title: 't',
  entryNodeId: 'n_start',
  nodes: [
    { id: 'n_start', type: 'start', position: { x: 0, y: 0 } },
    { id: 'n_end', type: 'end', position: { x: 100, y: 0 } },
  ],
  edges: [{ id: 'e1', source: 'n_start', target: 'n_end' }],
  ...patch,
});

describe('reserved identifiers', () => {
  it('flags reserved character varName', () => {
    const b = bundle({
      characters: {
        specVersion: '1.0.0',
        characters: [
          {
            id: 'c1',
            varName: 'return',
            displayName: 'X',
            color: '#FFF',
            images: { tag: 'x', expressions: [] },
          },
        ],
      },
    });
    const d = checkReservedIdentifiers(b);
    expect(d.some((x) => x.code === 'RESERVED_IDENTIFIER')).toBe(true);
  });

  it('passes non-reserved names', () => {
    const b = bundle({
      variables: {
        specVersion: '1.0.0',
        variables: [{ id: 'v', name: 'love_points', kind: 'int', default: '0', persistent: false }],
      },
    });
    expect(checkReservedIdentifiers(b)).toHaveLength(0);
  });
});

describe('label references', () => {
  it('flags unknown jump targets', () => {
    const b = bundle({
      scenes: [
        sceneShell({
          nodes: [
            { id: 'n_start', type: 'start', position: { x: 0, y: 0 } },
            { id: 'n_jump', type: 'jump', position: { x: 0, y: 0 }, target: 'nowhere' },
          ],
          edges: [{ id: 'e1', source: 'n_start', target: 'n_jump' }],
        }),
      ],
    });
    expect(checkLabelReferences(b).some((x) => x.code === 'UNKNOWN_LABEL')).toBe(true);
  });

  it('accepts a label defined elsewhere in the project', () => {
    const b = bundle({
      scenes: [
        sceneShell({
          label: 'start',
          nodes: [
            { id: 'n_start', type: 'start', position: { x: 0, y: 0 } },
            { id: 'n_jump', type: 'jump', position: { x: 0, y: 0 }, target: 'chapter2' },
          ],
        }),
        sceneShell({
          id: 's2',
          label: 'chapter2',
          entryNodeId: 'n2_start',
          nodes: [
            { id: 'n2_start', type: 'start', position: { x: 0, y: 0 } },
            { id: 'n2_end', type: 'end', position: { x: 0, y: 0 } },
          ],
          edges: [{ id: 'e', source: 'n2_start', target: 'n2_end' }],
        }),
      ],
    });
    expect(checkLabelReferences(b).filter((x) => x.code === 'UNKNOWN_LABEL')).toHaveLength(0);
  });
});

describe('scene terminals', () => {
  it('flags missing start node', () => {
    const b = bundle({
      scenes: [
        sceneShell({
          nodes: [{ id: 'n_end', type: 'end', position: { x: 0, y: 0 } }],
          edges: [],
          entryNodeId: 'n_end',
        }),
      ],
    });
    expect(checkSceneTerminals(b).some((x) => x.code === 'NO_START_NODE')).toBe(true);
  });

  it('flags missing terminal', () => {
    const b = bundle({
      scenes: [
        sceneShell({
          nodes: [
            { id: 'n_start', type: 'start', position: { x: 0, y: 0 } },
            { id: 'n_say', type: 'say', position: { x: 0, y: 0 }, text: 'hi' },
          ],
          edges: [{ id: 'e1', source: 'n_start', target: 'n_say' }],
        }),
      ],
    });
    expect(checkSceneTerminals(b).some((x) => x.code === 'NO_TERMINAL_NODE')).toBe(true);
  });
});

describe('menu choices', () => {
  it('warns when a choice has no outgoing edge', () => {
    const b = bundle({
      scenes: [
        sceneShell({
          nodes: [
            { id: 'n_start', type: 'start', position: { x: 0, y: 0 } },
            {
              id: 'n_menu',
              type: 'menu',
              position: { x: 0, y: 0 },
              choices: [
                { id: 'c1', text: 'Yes' },
                { id: 'c2', text: 'No' },
              ],
            },
            { id: 'n_end', type: 'end', position: { x: 0, y: 0 } },
          ],
          edges: [
            { id: 'e1', source: 'n_start', target: 'n_menu' },
            { id: 'e2', source: 'n_menu', sourceHandle: 'choice:c1', target: 'n_end' },
          ],
        }),
      ],
    });
    const d = checkMenuChoices(b);
    expect(d.some((x) => x.code === 'DANGLING_CHOICE')).toBe(true);
  });
});

describe('if branch order', () => {
  it('flags else not last', () => {
    const b = bundle({
      scenes: [
        sceneShell({
          nodes: [
            { id: 'n_start', type: 'start', position: { x: 0, y: 0 } },
            {
              id: 'n_if',
              type: 'if',
              position: { x: 0, y: 0 },
              branches: [
                { id: 'b1', condition: '' },
                { id: 'b2', condition: 'x > 0' },
              ],
            },
            { id: 'n_end', type: 'end', position: { x: 0, y: 0 } },
          ],
          edges: [{ id: 'e1', source: 'n_start', target: 'n_if' }],
        }),
      ],
    });
    expect(checkIfBranchOrder(b).some((x) => x.code === 'ELSE_NOT_LAST')).toBe(true);
  });
});

describe('unique labels', () => {
  it('flags duplicates across scenes', () => {
    const b = bundle({
      scenes: [sceneShell({ id: 's1', label: 'start' }), sceneShell({ id: 's2', label: 'start' })],
    });
    expect(checkUniqueLabels(b).some((x) => x.code === 'DUPLICATE_LABEL')).toBe(true);
  });
});

describe('undeclared variables', () => {
  it('warns when setVar references an undeclared variable', () => {
    const b = bundle({
      scenes: [
        sceneShell({
          nodes: [
            { id: 'n_start', type: 'start', position: { x: 0, y: 0 } },
            {
              id: 'n_set',
              type: 'setVar',
              position: { x: 0, y: 0 },
              variable: 'unknown',
              expression: 'True',
            },
            { id: 'n_end', type: 'end', position: { x: 0, y: 0 } },
          ],
          edges: [
            { id: 'e1', source: 'n_start', target: 'n_set' },
            { id: 'e2', source: 'n_set', target: 'n_end' },
          ],
        }),
      ],
    });
    expect(checkVariableDeclarations(b).some((x) => x.code === 'UNDECLARED_VARIABLE')).toBe(true);
  });
});

describe('validateBundle (integration)', () => {
  it('returns no errors for the minimal valid bundle', () => {
    const b = bundle({ scenes: [sceneShell({})] });
    expect(validateBundle(b).filter((d) => d.severity === 'error')).toHaveLength(0);
  });
});
