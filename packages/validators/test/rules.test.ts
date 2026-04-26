import { describe, expect, it } from 'vitest';
import type { SpecBundle } from '../src/bundle';
import {
  checkAssetFilesExist,
  checkAssetHashes,
  checkAssetReferencesIndexed,
  checkCallCycles,
  checkIfBranchOrder,
  checkIfTriviality,
  checkLabelReferences,
  checkMenuChoices,
  checkRelationshipCharacters,
  checkReservedIdentifiers,
  checkSceneTerminals,
  checkUniqueLabels,
  checkUnreachableNodes,
  checkVariableDeclarations,
  validateBundle,
  validateBundleWithEnv,
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

describe('unreachable nodes', () => {
  it('warns when a node has no path back to an entry', () => {
    const b = bundle({
      scenes: [
        sceneShell({
          nodes: [
            { id: 'n_start', type: 'start', position: { x: 0, y: 0 } },
            { id: 'n_end', type: 'end', position: { x: 0, y: 0 } },
            // Orphan: not connected to anything.
            { id: 'n_orphan', type: 'narration', position: { x: 0, y: 0 }, text: 'lonely' },
          ],
          edges: [{ id: 'e1', source: 'n_start', target: 'n_end' }],
        }),
      ],
    });
    const d = checkUnreachableNodes(b);
    expect(d.some((x) => x.code === 'UNREACHABLE_NODE' && x.location === 'n_orphan')).toBe(true);
  });

  it('does not warn for nodes reachable through a label', () => {
    const b = bundle({
      scenes: [
        sceneShell({
          entryNodeId: 'n_start',
          nodes: [
            { id: 'n_start', type: 'start', position: { x: 0, y: 0 } },
            { id: 'n_label', type: 'label', position: { x: 0, y: 0 }, name: 'sub' },
            { id: 'n_say', type: 'narration', position: { x: 0, y: 0 }, text: 'hi' },
            { id: 'n_end', type: 'end', position: { x: 0, y: 0 } },
          ],
          // Walk start -> end, but label -> say is its own subgraph.
          edges: [
            { id: 'e1', source: 'n_start', target: 'n_end' },
            { id: 'e2', source: 'n_label', target: 'n_say' },
          ],
        }),
      ],
    });
    const d = checkUnreachableNodes(b).filter((x) => x.code === 'UNREACHABLE_NODE');
    // n_say is reachable from the label entry; n_end is reachable from start.
    // The label node itself is also an entry, so nothing should be flagged.
    expect(d).toHaveLength(0);
  });
});

describe('trivial if', () => {
  it('reports info for an if node with a single branch', () => {
    const b = bundle({
      scenes: [
        sceneShell({
          nodes: [
            { id: 'n_start', type: 'start', position: { x: 0, y: 0 } },
            {
              id: 'n_if',
              type: 'if',
              position: { x: 0, y: 0 },
              branches: [{ id: 'b1', condition: 'True' }],
            },
            { id: 'n_end', type: 'end', position: { x: 0, y: 0 } },
          ],
          edges: [{ id: 'e1', source: 'n_start', target: 'n_if' }],
        }),
      ],
    });
    expect(checkIfTriviality(b).some((x) => x.code === 'TRIVIAL_IF')).toBe(true);
  });
});

describe('relationship / show / hide character refs', () => {
  it('errors on an unknown character id', () => {
    const b = bundle({
      scenes: [
        sceneShell({
          nodes: [
            { id: 'n_start', type: 'start', position: { x: 0, y: 0 } },
            {
              id: 'n_rel',
              type: 'relationshipOp',
              position: { x: 0, y: 0 },
              characterId: 'ghost',
              op: 'add',
              value: 1,
            },
            { id: 'n_end', type: 'end', position: { x: 0, y: 0 } },
          ],
          edges: [
            { id: 'e1', source: 'n_start', target: 'n_rel' },
            { id: 'e2', source: 'n_rel', target: 'n_end' },
          ],
        }),
      ],
    });
    expect(checkRelationshipCharacters(b).some((x) => x.code === 'UNKNOWN_CHARACTER')).toBe(true);
  });

  it('also flags show / hide / say with unknown characters', () => {
    const b = bundle({
      scenes: [
        sceneShell({
          nodes: [
            { id: 'n_start', type: 'start', position: { x: 0, y: 0 } },
            { id: 'n_show', type: 'show', position: { x: 0, y: 0 }, characterId: 'ghost' },
            { id: 'n_hide', type: 'hide', position: { x: 0, y: 0 }, characterId: 'ghost' },
            { id: 'n_say', type: 'say', position: { x: 0, y: 0 }, characterId: 'ghost', text: '?' },
            { id: 'n_end', type: 'end', position: { x: 0, y: 0 } },
          ],
          edges: [
            { id: 'e1', source: 'n_start', target: 'n_show' },
            { id: 'e2', source: 'n_show', target: 'n_hide' },
            { id: 'e3', source: 'n_hide', target: 'n_say' },
            { id: 'e4', source: 'n_say', target: 'n_end' },
          ],
        }),
      ],
    });
    const errors = checkRelationshipCharacters(b).filter((x) => x.code === 'UNKNOWN_CHARACTER');
    expect(errors).toHaveLength(3);
  });
});

describe('asset references vs index', () => {
  it('warns when a node references an asset not in the index', () => {
    const b = bundle({
      assets: { specVersion: '1.0.0', assets: [] },
      scenes: [
        sceneShell({
          nodes: [
            { id: 'n_start', type: 'start', position: { x: 0, y: 0 } },
            {
              id: 'n_bg',
              type: 'sceneBg',
              position: { x: 0, y: 0 },
              background: 'images/bg/missing.png',
            },
            { id: 'n_end', type: 'end', position: { x: 0, y: 0 } },
          ],
          edges: [
            { id: 'e1', source: 'n_start', target: 'n_bg' },
            { id: 'e2', source: 'n_bg', target: 'n_end' },
          ],
        }),
      ],
    });
    const diags = checkAssetReferencesIndexed(b);
    expect(diags.some((d) => d.code === 'UNINDEXED_ASSET')).toBe(true);
  });

  it('warns when a character expression references an unindexed asset', () => {
    const b = bundle({
      assets: { specVersion: '1.0.0', assets: [] },
      characters: {
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
      },
    });
    expect(
      checkAssetReferencesIndexed(b).some(
        (d) => d.code === 'UNINDEXED_ASSET' && d.location === 'c1',
      ),
    ).toBe(true);
  });

  it('passes when every asset is indexed', () => {
    const b = bundle({
      assets: {
        specVersion: '1.0.0',
        assets: [
          {
            id: 'a1',
            ref: 'images/bg/room.png',
            kind: 'image',
            tags: [],
            hash: 'h',
            sizeBytes: 0,
            importedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
      },
      scenes: [
        sceneShell({
          nodes: [
            { id: 'n_start', type: 'start', position: { x: 0, y: 0 } },
            {
              id: 'n_bg',
              type: 'sceneBg',
              position: { x: 0, y: 0 },
              background: 'images/bg/room.png',
            },
            { id: 'n_end', type: 'end', position: { x: 0, y: 0 } },
          ],
          edges: [
            { id: 'e1', source: 'n_start', target: 'n_bg' },
            { id: 'e2', source: 'n_bg', target: 'n_end' },
          ],
        }),
      ],
    });
    expect(checkAssetReferencesIndexed(b)).toHaveLength(0);
  });
});

describe('asset files on disk (env)', () => {
  it('errors on indexed assets whose file is missing', () => {
    const b = bundle({
      assets: {
        specVersion: '1.0.0',
        assets: [
          {
            id: 'a1',
            ref: 'images/bg/room.png',
            kind: 'image',
            tags: [],
            hash: 'h',
            sizeBytes: 0,
            importedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
      },
    });
    const diags = checkAssetFilesExist(b, new Set());
    expect(diags.some((d) => d.code === 'MISSING_ASSET_FILE')).toBe(true);
  });

  it('passes when the file is present', () => {
    const b = bundle({
      assets: {
        specVersion: '1.0.0',
        assets: [
          {
            id: 'a1',
            ref: 'images/bg/room.png',
            kind: 'image',
            tags: [],
            hash: 'h',
            sizeBytes: 0,
            importedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
      },
    });
    expect(checkAssetFilesExist(b, new Set(['images/bg/room.png']))).toHaveLength(0);
  });
});

describe('asset hashes (env)', () => {
  it('reports stale hash when on-disk content differs', () => {
    const b = bundle({
      assets: {
        specVersion: '1.0.0',
        assets: [
          {
            id: 'a1',
            ref: 'images/bg/room.png',
            kind: 'image',
            tags: [],
            hash: 'h_old',
            sizeBytes: 0,
            importedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
      },
    });
    const diags = checkAssetHashes(b, new Map([['images/bg/room.png', 'h_new']]));
    expect(diags.some((d) => d.code === 'STALE_ASSET_HASH')).toBe(true);
  });

  it('passes when hashes match', () => {
    const b = bundle({
      assets: {
        specVersion: '1.0.0',
        assets: [
          {
            id: 'a1',
            ref: 'images/bg/room.png',
            kind: 'image',
            tags: [],
            hash: 'h_same',
            sizeBytes: 0,
            importedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
      },
    });
    expect(checkAssetHashes(b, new Map([['images/bg/room.png', 'h_same']]))).toHaveLength(0);
  });
});

describe('call cycle detection', () => {
  it('flags a 2-label cycle: A -> B, B -> A', () => {
    const b = bundle({
      scenes: [
        sceneShell({
          id: 'sa',
          label: 'a',
          nodes: [
            { id: 'n_start', type: 'start', position: { x: 0, y: 0 } },
            { id: 'n_call', type: 'call', position: { x: 0, y: 0 }, target: 'b' },
            { id: 'n_end', type: 'end', position: { x: 0, y: 0 } },
          ],
          edges: [
            { id: 'e1', source: 'n_start', target: 'n_call' },
            { id: 'e2', source: 'n_call', target: 'n_end' },
          ],
        }),
        sceneShell({
          id: 'sb',
          label: 'b',
          nodes: [
            { id: 'n_start', type: 'start', position: { x: 0, y: 0 } },
            { id: 'n_call', type: 'call', position: { x: 0, y: 0 }, target: 'a' },
            { id: 'n_end', type: 'end', position: { x: 0, y: 0 } },
          ],
          edges: [
            { id: 'e1', source: 'n_start', target: 'n_call' },
            { id: 'e2', source: 'n_call', target: 'n_end' },
          ],
        }),
      ],
    });
    const diags = checkCallCycles(b);
    expect(diags.some((d) => d.code === 'CALL_CYCLE')).toBe(true);
  });

  it('does not flag a linear chain', () => {
    const b = bundle({
      scenes: [
        sceneShell({
          id: 'sa',
          label: 'a',
          nodes: [
            { id: 'n_start', type: 'start', position: { x: 0, y: 0 } },
            { id: 'n_call', type: 'call', position: { x: 0, y: 0 }, target: 'b' },
            { id: 'n_end', type: 'end', position: { x: 0, y: 0 } },
          ],
          edges: [
            { id: 'e1', source: 'n_start', target: 'n_call' },
            { id: 'e2', source: 'n_call', target: 'n_end' },
          ],
        }),
        sceneShell({
          id: 'sb',
          label: 'b',
          nodes: [
            { id: 'n_start', type: 'start', position: { x: 0, y: 0 } },
            { id: 'n_end', type: 'end', position: { x: 0, y: 0 } },
          ],
          edges: [{ id: 'e1', source: 'n_start', target: 'n_end' }],
        }),
      ],
    });
    expect(checkCallCycles(b).filter((d) => d.code === 'CALL_CYCLE')).toHaveLength(0);
  });
});

describe('validateBundleWithEnv', () => {
  it('runs both pure and env-aware rules', () => {
    const b = bundle({
      assets: {
        specVersion: '1.0.0',
        assets: [
          {
            id: 'a1',
            ref: 'images/bg/missing.png',
            kind: 'image',
            tags: [],
            hash: 'h',
            sizeBytes: 0,
            importedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
      },
      scenes: [sceneShell({})],
    });
    const diags = validateBundleWithEnv(b, { existingAssetFiles: new Set() });
    expect(diags.some((d) => d.code === 'MISSING_ASSET_FILE')).toBe(true);
  });
});

describe('validateBundle (integration)', () => {
  it('returns no errors for the minimal valid bundle', () => {
    const b = bundle({ scenes: [sceneShell({})] });
    expect(validateBundle(b).filter((d) => d.severity === 'error')).toHaveLength(0);
  });
});
