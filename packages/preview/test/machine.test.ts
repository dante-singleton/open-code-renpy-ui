import type { CharacterCatalog, SceneSpec } from '@renpy-ui/spec';
import { describe, expect, it } from 'vitest';
import { createMachine } from '../src/runtime/machine';

const ALICE: CharacterCatalog = {
  specVersion: '1.0.0',
  characters: [
    {
      id: 'c_alice',
      varName: 'alice',
      displayName: 'Alice',
      color: '#FF7A1A',
      images: {
        tag: 'alice',
        expressions: [{ name: 'happy', asset: 'images/alice/happy.png' }],
      },
    },
  ],
};

function shell(
  patch: Partial<SceneSpec> & {
    id: string;
    label: string;
    nodes: SceneSpec['nodes'];
    edges: SceneSpec['edges'];
  },
): SceneSpec {
  return {
    specVersion: '1.0.0',
    title: patch.title ?? patch.label,
    entryNodeId: patch.entryNodeId ?? patch.nodes[0]?.id ?? 'n_start',
    ...patch,
  } as SceneSpec;
}

describe('playback machine — basic flow', () => {
  it('runs through a linear scene with a say and ends', () => {
    const scene = shell({
      id: 's',
      label: 'start',
      nodes: [
        { id: 'n_start', type: 'start', position: { x: 0, y: 0 } },
        {
          id: 'n_say',
          type: 'say',
          position: { x: 0, y: 0 },
          characterId: 'c_alice',
          text: 'Hi',
        },
        { id: 'n_end', type: 'end', position: { x: 0, y: 0 } },
      ],
      edges: [
        { id: 'e1', source: 'n_start', target: 'n_say' },
        { id: 'e2', source: 'n_say', target: 'n_end' },
      ],
    });
    const m = createMachine({ scenes: [scene], characters: ALICE });
    let s = m.start('s');
    expect(s.halt?.kind).toBe('awaitingSay');
    expect(s.activeSay?.speaker).toBe('Alice');
    expect(s.activeSay?.text).toBe('Hi');

    s = m.step(s);
    expect(s.halt?.kind).toBe('sceneEnded');
    expect(s.activeSay).toBe(null);
  });

  it('renders narration and clears it when stepping', () => {
    const scene = shell({
      id: 's',
      label: 'start',
      nodes: [
        { id: 'n_start', type: 'start', position: { x: 0, y: 0 } },
        { id: 'n_say', type: 'narration', position: { x: 0, y: 0 }, text: 'A long, dark night.' },
        { id: 'n_end', type: 'end', position: { x: 0, y: 0 } },
      ],
      edges: [
        { id: 'e1', source: 'n_start', target: 'n_say' },
        { id: 'e2', source: 'n_say', target: 'n_end' },
      ],
    });
    const m = createMachine({ scenes: [scene], characters: ALICE });
    let s = m.start('s');
    expect(s.activeNarration).toBe('A long, dark night.');
    s = m.step(s);
    expect(s.activeNarration).toBe(null);
    expect(s.halt?.kind).toBe('sceneEnded');
  });
});

describe('playback machine — branching', () => {
  it('halts at a menu and follows the chosen edge', () => {
    const scene = shell({
      id: 's',
      label: 'start',
      nodes: [
        { id: 'n_start', type: 'start', position: { x: 0, y: 0 } },
        {
          id: 'n_menu',
          type: 'menu',
          position: { x: 0, y: 0 },
          choices: [
            { id: 'c_yes', text: 'Yes' },
            { id: 'c_no', text: 'No' },
          ],
        },
        { id: 'n_yes_say', type: 'narration', position: { x: 0, y: 0 }, text: 'You agreed.' },
        { id: 'n_no_say', type: 'narration', position: { x: 0, y: 0 }, text: 'You declined.' },
        { id: 'n_end', type: 'end', position: { x: 0, y: 0 } },
      ],
      edges: [
        { id: 'e1', source: 'n_start', target: 'n_menu' },
        { id: 'e2', source: 'n_menu', sourceHandle: 'choice:c_yes', target: 'n_yes_say' },
        { id: 'e3', source: 'n_menu', sourceHandle: 'choice:c_no', target: 'n_no_say' },
        { id: 'e4', source: 'n_yes_say', target: 'n_end' },
        { id: 'e5', source: 'n_no_say', target: 'n_end' },
      ],
    });
    const m = createMachine({ scenes: [scene], characters: ALICE });
    let s = m.start('s');
    expect(s.halt?.kind).toBe('awaitingMenu');
    expect(s.activeMenu?.choices).toHaveLength(2);

    s = m.step(s, { choiceId: 'c_no' });
    expect(s.activeNarration).toBe('You declined.');

    s = m.step(s);
    expect(s.halt?.kind).toBe('sceneEnded');
  });

  it('grays out menu choices whose condition is false', () => {
    const scene = shell({
      id: 's',
      label: 'start',
      nodes: [
        { id: 'n_start', type: 'start', position: { x: 0, y: 0 } },
        {
          id: 'n_set',
          type: 'setVar',
          position: { x: 0, y: 0 },
          variable: 'gold',
          expression: '0',
        },
        {
          id: 'n_menu',
          type: 'menu',
          position: { x: 0, y: 0 },
          choices: [
            { id: 'c_buy', text: 'Buy', condition: 'gold >= 1' },
            { id: 'c_skip', text: 'Skip' },
          ],
        },
        { id: 'n_end', type: 'end', position: { x: 0, y: 0 } },
      ],
      edges: [
        { id: 'e1', source: 'n_start', target: 'n_set' },
        { id: 'e2', source: 'n_set', target: 'n_menu' },
        { id: 'e3', source: 'n_menu', sourceHandle: 'choice:c_skip', target: 'n_end' },
      ],
    });
    const m = createMachine({ scenes: [scene], characters: ALICE });
    const s = m.start('s');
    const buy = s.activeMenu?.choices.find((c) => c.id === 'c_buy');
    const skip = s.activeMenu?.choices.find((c) => c.id === 'c_skip');
    expect(buy?.enabled).toBe(false);
    expect(skip?.enabled).toBe(true);
  });

  it('takes the matching if branch and skips the others', () => {
    const scene = shell({
      id: 's',
      label: 'start',
      nodes: [
        { id: 'n_start', type: 'start', position: { x: 0, y: 0 } },
        {
          id: 'n_set',
          type: 'setVar',
          position: { x: 0, y: 0 },
          variable: 'love',
          expression: '5',
        },
        {
          id: 'n_if',
          type: 'if',
          position: { x: 0, y: 0 },
          branches: [
            { id: 'b_high', condition: 'love >= 3' },
            { id: 'b_low', condition: '' },
          ],
        },
        { id: 'n_high', type: 'narration', position: { x: 0, y: 0 }, text: 'happy ending' },
        { id: 'n_low', type: 'narration', position: { x: 0, y: 0 }, text: 'sad ending' },
        { id: 'n_end', type: 'end', position: { x: 0, y: 0 } },
      ],
      edges: [
        { id: 'e1', source: 'n_start', target: 'n_set' },
        { id: 'e2', source: 'n_set', target: 'n_if' },
        { id: 'e3', source: 'n_if', sourceHandle: 'branch:b_high', target: 'n_high' },
        { id: 'e4', source: 'n_if', sourceHandle: 'branch:b_low', target: 'n_low' },
        { id: 'e5', source: 'n_high', target: 'n_end' },
        { id: 'e6', source: 'n_low', target: 'n_end' },
      ],
    });
    const m = createMachine({ scenes: [scene], characters: ALICE });
    const s = m.start('s');
    expect(s.activeNarration).toBe('happy ending');
  });
});

describe('playback machine — stage and audio side effects', () => {
  it('shows / hides a sprite and tracks it on the stage', () => {
    const scene = shell({
      id: 's',
      label: 'start',
      nodes: [
        { id: 'n_start', type: 'start', position: { x: 0, y: 0 } },
        {
          id: 'n_show',
          type: 'show',
          position: { x: 0, y: 0 },
          characterId: 'c_alice',
          expressionName: 'happy',
          at: 'left',
        },
        {
          id: 'n_say',
          type: 'say',
          position: { x: 0, y: 0 },
          characterId: 'c_alice',
          text: 'Hi',
        },
        {
          id: 'n_hide',
          type: 'hide',
          position: { x: 0, y: 0 },
          characterId: 'c_alice',
        },
        { id: 'n_end', type: 'end', position: { x: 0, y: 0 } },
      ],
      edges: [
        { id: 'e1', source: 'n_start', target: 'n_show' },
        { id: 'e2', source: 'n_show', target: 'n_say' },
        { id: 'e3', source: 'n_say', target: 'n_hide' },
        { id: 'e4', source: 'n_hide', target: 'n_end' },
      ],
    });
    const m = createMachine({ scenes: [scene], characters: ALICE });
    let s = m.start('s'); // halts at say
    expect(s.stage.sprites.alice).toBeDefined();
    expect(s.stage.sprites.alice?.expression).toBe('happy');
    expect(s.stage.sprites.alice?.asset).toBe('images/alice/happy.png');

    s = m.step(s); // continues past say to hide -> end
    expect(s.stage.sprites.alice).toBeUndefined();
  });

  it('tracks music and recent sounds', () => {
    const scene = shell({
      id: 's',
      label: 'start',
      nodes: [
        { id: 'n_start', type: 'start', position: { x: 0, y: 0 } },
        {
          id: 'n_music',
          type: 'playMusic',
          position: { x: 0, y: 0 },
          asset: 'audio/music/calm.ogg',
        },
        {
          id: 'n_sfx',
          type: 'playSound',
          position: { x: 0, y: 0 },
          asset: 'audio/sfx/bell.ogg',
        },
        { id: 'n_end', type: 'end', position: { x: 0, y: 0 } },
      ],
      edges: [
        { id: 'e1', source: 'n_start', target: 'n_music' },
        { id: 'e2', source: 'n_music', target: 'n_sfx' },
        { id: 'e3', source: 'n_sfx', target: 'n_end' },
      ],
    });
    const m = createMachine({ scenes: [scene], characters: ALICE });
    const s = m.start('s');
    expect(s.audio.music).toBe('audio/music/calm.ogg');
    expect(s.audio.recentSounds[0]?.asset).toBe('audio/sfx/bell.ogg');
  });
});

describe('playback machine — cross-scene jump', () => {
  it('follows a jump into another scene', () => {
    const a = shell({
      id: 'sa',
      label: 'a',
      nodes: [
        { id: 'n_start', type: 'start', position: { x: 0, y: 0 } },
        { id: 'n_jump', type: 'jump', position: { x: 0, y: 0 }, target: 'b' },
      ],
      edges: [{ id: 'e1', source: 'n_start', target: 'n_jump' }],
    });
    const b = shell({
      id: 'sb',
      label: 'b',
      nodes: [
        { id: 'n_start', type: 'start', position: { x: 0, y: 0 } },
        { id: 'n_say', type: 'narration', position: { x: 0, y: 0 }, text: 'In B.' },
        { id: 'n_end', type: 'end', position: { x: 0, y: 0 } },
      ],
      edges: [
        { id: 'e1', source: 'n_start', target: 'n_say' },
        { id: 'e2', source: 'n_say', target: 'n_end' },
      ],
    });
    const m = createMachine({ scenes: [a, b], characters: ALICE });
    const s = m.start('sa');
    expect(s.sceneId).toBe('sb');
    expect(s.activeNarration).toBe('In B.');
  });
});

describe('playback machine — reset and jump-to-node', () => {
  it('reset returns to the start of the current scene', () => {
    const scene = shell({
      id: 's',
      label: 'start',
      nodes: [
        { id: 'n_start', type: 'start', position: { x: 0, y: 0 } },
        {
          id: 'n_say',
          type: 'narration',
          position: { x: 0, y: 0 },
          text: 'first',
        },
        { id: 'n_end', type: 'end', position: { x: 0, y: 0 } },
      ],
      edges: [
        { id: 'e1', source: 'n_start', target: 'n_say' },
        { id: 'e2', source: 'n_say', target: 'n_end' },
      ],
    });
    const m = createMachine({ scenes: [scene], characters: ALICE });
    let s = m.start('s');
    s = m.step(s); // -> sceneEnded
    expect(s.halt?.kind).toBe('sceneEnded');
    s = m.reset(s);
    expect(s.activeNarration).toBe('first');
  });

  it('jumpToNode advances directly to the requested node', () => {
    const scene = shell({
      id: 's',
      label: 'start',
      nodes: [
        { id: 'n_start', type: 'start', position: { x: 0, y: 0 } },
        { id: 'n_a', type: 'narration', position: { x: 0, y: 0 }, text: 'A' },
        { id: 'n_b', type: 'narration', position: { x: 0, y: 0 }, text: 'B' },
        { id: 'n_c', type: 'narration', position: { x: 0, y: 0 }, text: 'C' },
        { id: 'n_end', type: 'end', position: { x: 0, y: 0 } },
      ],
      edges: [
        { id: 'e1', source: 'n_start', target: 'n_a' },
        { id: 'e2', source: 'n_a', target: 'n_b' },
        { id: 'e3', source: 'n_b', target: 'n_c' },
        { id: 'e4', source: 'n_c', target: 'n_end' },
      ],
    });
    const m = createMachine({ scenes: [scene], characters: ALICE });
    const initial = m.start('s');
    const jumped = m.jumpToNode(initial, 'n_c');
    expect(jumped.activeNarration).toBe('C');
    expect(jumped.currentNodeId).toBe('n_c');
  });
});
