import type { ScreenSpec } from '@renpy-ui/spec';
import { describe, expect, it } from 'vitest';
import { emitScreen } from '../src/emitters/screens';

const SAY_HEADER = 'screen say(who, what):';
const MAIN_HEADER = 'screen main_menu():';
const CHOICE_HEADER = 'screen choice(items):';

describe('screens emitter — built-in templates', () => {
  it('say template wraps the user window slot in style_prefix', () => {
    const spec: ScreenSpec = {
      specVersion: '1.0.0',
      id: 'screen_say',
      name: 'say',
      template: 'say',
      slots: {
        window: {
          kind: 'frame',
          background: '#000a',
          padding: 8,
          children: [{ kind: 'text', text: '[what]' }],
        },
      },
    };
    const out = emitScreen(spec);
    expect(out).toContain(SAY_HEADER);
    expect(out).toContain('style_prefix "say"');
    expect(out).toContain('frame:');
    expect(out).toContain('background "#000a"');
    expect(out).toContain('padding (8, 8)');
    expect(out).toContain('text "[what]"');
  });

  it('say template falls back to a default window when no slot is provided', () => {
    const spec: ScreenSpec = {
      specVersion: '1.0.0',
      id: 'screen_say',
      name: 'say',
      template: 'say',
      slots: {},
    };
    const out = emitScreen(spec);
    expect(out).toContain('text who id "who"');
    expect(out).toContain('text what id "what"');
  });

  it('mainMenu emits tag menu and a vbox of textbuttons', () => {
    const spec: ScreenSpec = {
      specVersion: '1.0.0',
      id: 'screen_main',
      name: 'main_menu',
      template: 'mainMenu',
      slots: {
        menuButtons: {
          kind: 'vbox',
          children: [
            { kind: 'button', text: 'Start', action: 'Start()' },
            { kind: 'button', text: 'Quit', action: 'Quit(confirm=False)' },
          ],
        },
      },
    };
    const out = emitScreen(spec);
    expect(out).toContain(MAIN_HEADER);
    expect(out).toContain('tag menu');
    expect(out).toMatch(/textbutton "Start":\n\s+action Start\(\)/);
    expect(out).toMatch(/textbutton "Quit":\n\s+action Quit\(confirm=False\)/);
  });

  it('choice template emits the items iterator vbox by default', () => {
    const spec: ScreenSpec = {
      specVersion: '1.0.0',
      id: 'screen_choice',
      name: 'choice',
      template: 'choice',
      slots: {},
    };
    const out = emitScreen(spec);
    expect(out).toContain(CHOICE_HEADER);
    expect(out).toContain('style_prefix "choice"');
    expect(out).toContain('for i in items:');
    expect(out).toContain('textbutton i.caption');
    expect(out).toContain('action i.action');
  });

  it('parameters extend the say signature without dropping who/what', () => {
    const spec: ScreenSpec = {
      specVersion: '1.0.0',
      id: 'screen_say',
      name: 'say',
      template: 'say',
      slots: {},
      parameters: [{ name: 'extra', default: 'None' }],
    };
    const out = emitScreen(spec);
    expect(out).toContain('screen say(who, what, extra=None):');
  });
});

describe('screens emitter — custom template', () => {
  it('emits the raw body verbatim under the screen header', () => {
    const spec: ScreenSpec = {
      specVersion: '1.0.0',
      id: 'screen_pause',
      name: 'pause',
      template: 'custom',
      slots: {},
      raw: 'tag menu\nframe:\n    text "Paused"',
    };
    const out = emitScreen(spec);
    expect(out).toContain('screen pause():');
    // Each raw line is indented one level under the header.
    expect(out).toMatch(/screen pause\(\):\n {4}tag menu\n {4}frame:\n {8}text "Paused"/);
  });

  it('emits a `pass` body when raw is empty', () => {
    const spec: ScreenSpec = {
      specVersion: '1.0.0',
      id: 'screen_empty',
      name: 'empty',
      template: 'custom',
      slots: {},
      raw: '',
    };
    const out = emitScreen(spec);
    expect(out).toMatch(/screen empty\(\):\n {4}pass/);
  });
});

describe('screens emitter — widgets', () => {
  it('text widget emits properties on continuation lines', () => {
    const spec: ScreenSpec = {
      specVersion: '1.0.0',
      id: 'screen_x',
      name: 'screen_x',
      template: 'custom',
      slots: {},
      raw: '',
    };
    // Use the say slot to exercise widget emission while keeping the test
    // independent of template defaults.
    const sayWithText: ScreenSpec = {
      ...spec,
      template: 'say',
      slots: {
        window: { kind: 'text', text: 'hi', size: 14, color: '#fff' },
      },
    };
    const out = emitScreen(sayWithText);
    expect(out).toContain('text "hi"');
    expect(out).toContain('size 14');
    expect(out).toContain('color "#fff"');
  });

  it('image widget uses `add` and emits xalign/yalign when set', () => {
    const spec: ScreenSpec = {
      specVersion: '1.0.0',
      id: 'screen_x',
      name: 'screen_x',
      template: 'say',
      slots: {
        window: {
          kind: 'image',
          asset: 'images/logo.png',
          xalign: 0.5,
          yalign: 0.2,
        },
      },
    };
    const out = emitScreen(spec);
    expect(out).toContain('add "images/logo.png"');
    expect(out).toContain('xalign 0.5');
    expect(out).toContain('yalign 0.2');
  });

  it('bar widget emits value and range as raw expressions', () => {
    const spec: ScreenSpec = {
      specVersion: '1.0.0',
      id: 'screen_x',
      name: 'screen_x',
      template: 'say',
      slots: {
        window: { kind: 'bar', value: 'love_points', range: '10' },
      },
    };
    const out = emitScreen(spec);
    expect(out).toContain('bar:');
    expect(out).toContain('value love_points');
    expect(out).toContain('range 10');
  });

  it('empty containers emit `null` as a body to satisfy Ren\u2019Py', () => {
    const spec: ScreenSpec = {
      specVersion: '1.0.0',
      id: 'screen_x',
      name: 'screen_x',
      template: 'say',
      slots: { window: { kind: 'vbox', children: [] } },
    };
    const out = emitScreen(spec);
    expect(out).toMatch(/vbox:\n {8}null/);
  });
});
