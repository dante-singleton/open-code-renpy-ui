import type { CharacterCatalog, SceneSpec } from '@renpy-ui/spec';
import { describe, expect, it } from 'vitest';
import { emitScene } from '../src/emitters/scene';
import { buildSymbolTable } from '../src/symbols';
import type { SpecBundle } from '../src/types';

/**
 * Targeted tests for the stage and audio emitters added in M3.
 * These cover the small Ren'Py-grammar nuances that the byte-equality
 * fixture would otherwise mask in failure messages.
 */

const CHARACTERS: CharacterCatalog = {
  specVersion: '1.0.0',
  characters: [
    {
      id: 'c_alice',
      varName: 'alice',
      displayName: 'Alice',
      color: '#FF7A1A',
      images: { tag: 'alice', expressions: [{ name: 'happy', asset: 'images/alice/happy.png' }] },
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

describe('sceneBg emitter', () => {
  it('derives the image name from the asset path', () => {
    const scene = sceneShell(
      [
        { id: 'n_start', type: 'start', position: { x: 0, y: 0 } },
        {
          id: 'n_bg',
          type: 'sceneBg',
          position: { x: 0, y: 0 },
          background: 'images/bg/room.png',
        },
        { id: 'n_end', type: 'end', position: { x: 0, y: 0 } },
      ],
      [
        { id: 'e1', source: 'n_start', target: 'n_bg' },
        { id: 'e2', source: 'n_bg', target: 'n_end' },
      ],
    );
    const out = emitScene(scene, buildSymbolTable(bundleFor(scene)));
    expect(out).toContain('scene bg room');
  });

  it('emits the optional with-transition', () => {
    const scene = sceneShell(
      [
        { id: 'n_start', type: 'start', position: { x: 0, y: 0 } },
        {
          id: 'n_bg',
          type: 'sceneBg',
          position: { x: 0, y: 0 },
          background: 'images/bg/cafe.png',
          withTransition: 'fade',
        },
        { id: 'n_end', type: 'end', position: { x: 0, y: 0 } },
      ],
      [
        { id: 'e1', source: 'n_start', target: 'n_bg' },
        { id: 'e2', source: 'n_bg', target: 'n_end' },
      ],
    );
    expect(emitScene(scene, buildSymbolTable(bundleFor(scene)))).toContain(
      'scene bg cafe with fade',
    );
  });
});

describe('show / hide emitter', () => {
  it('uses the character\u2019s sprite tag and expression', () => {
    const scene = sceneShell(
      [
        { id: 'n_start', type: 'start', position: { x: 0, y: 0 } },
        {
          id: 'n_show',
          type: 'show',
          position: { x: 0, y: 0 },
          characterId: 'c_alice',
          expressionName: 'happy',
          at: 'left',
          zorder: 2,
        },
        { id: 'n_end', type: 'end', position: { x: 0, y: 0 } },
      ],
      [
        { id: 'e1', source: 'n_start', target: 'n_show' },
        { id: 'e2', source: 'n_show', target: 'n_end' },
      ],
    );
    const out = emitScene(scene, buildSymbolTable(bundleFor(scene)));
    expect(out).toContain('show alice happy at left zorder 2');
  });

  it('hides by tag with optional transition', () => {
    const scene = sceneShell(
      [
        { id: 'n_start', type: 'start', position: { x: 0, y: 0 } },
        {
          id: 'n_hide',
          type: 'hide',
          position: { x: 0, y: 0 },
          characterId: 'c_alice',
          withTransition: 'dissolve',
        },
        { id: 'n_end', type: 'end', position: { x: 0, y: 0 } },
      ],
      [
        { id: 'e1', source: 'n_start', target: 'n_hide' },
        { id: 'e2', source: 'n_hide', target: 'n_end' },
      ],
    );
    expect(emitScene(scene, buildSymbolTable(bundleFor(scene)))).toContain(
      'hide alice with dissolve',
    );
  });
});

describe('audio emitters', () => {
  it('plays music with a non-default channel via `play <channel>`', () => {
    const scene = sceneShell(
      [
        { id: 'n_start', type: 'start', position: { x: 0, y: 0 } },
        {
          id: 'n_m',
          type: 'playMusic',
          position: { x: 0, y: 0 },
          asset: 'audio/music/calm.ogg',
          channel: 'ambient',
          fadeIn: 0.5,
        },
        { id: 'n_end', type: 'end', position: { x: 0, y: 0 } },
      ],
      [
        { id: 'e1', source: 'n_start', target: 'n_m' },
        { id: 'e2', source: 'n_m', target: 'n_end' },
      ],
    );
    expect(emitScene(scene, buildSymbolTable(bundleFor(scene)))).toContain(
      'play ambient "audio/music/calm.ogg" fadein 0.5',
    );
  });

  it('stops the music channel by default', () => {
    const scene = sceneShell(
      [
        { id: 'n_start', type: 'start', position: { x: 0, y: 0 } },
        { id: 'n_s', type: 'stopMusic', position: { x: 0, y: 0 }, fadeOut: 2 },
        { id: 'n_end', type: 'end', position: { x: 0, y: 0 } },
      ],
      [
        { id: 'e1', source: 'n_start', target: 'n_s' },
        { id: 'e2', source: 'n_s', target: 'n_end' },
      ],
    );
    expect(emitScene(scene, buildSymbolTable(bundleFor(scene)))).toContain('stop music fadeout 2');
  });
});

describe('say emitter', () => {
  it('emits voice line before the say statement', () => {
    const scene = sceneShell(
      [
        { id: 'n_start', type: 'start', position: { x: 0, y: 0 } },
        {
          id: 'n_say',
          type: 'say',
          position: { x: 0, y: 0 },
          characterId: 'c_alice',
          expressionName: 'happy',
          text: 'Hi',
          voice: 'audio/voice/alice_001.ogg',
        },
        { id: 'n_end', type: 'end', position: { x: 0, y: 0 } },
      ],
      [
        { id: 'e1', source: 'n_start', target: 'n_say' },
        { id: 'e2', source: 'n_say', target: 'n_end' },
      ],
    );
    const out = emitScene(scene, buildSymbolTable(bundleFor(scene)));
    expect(out.split('\n').some((l) => l.includes('voice "audio/voice/alice_001.ogg"'))).toBe(true);
    expect(out).toContain('alice happy "Hi"');
  });
});
