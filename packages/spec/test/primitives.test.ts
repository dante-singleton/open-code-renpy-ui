import { describe, expect, it } from 'vitest';
import { AssetRef, HexColor, RenPyIdentifier, isReservedIdentifier } from '../src/primitives';

describe('RenPyIdentifier', () => {
  it.each(['alice', 'Alice', '_foo', 'foo_bar_1', 'a'])('accepts %s', (name) => {
    expect(RenPyIdentifier.safeParse(name).success).toBe(true);
  });

  it.each(['1foo', 'foo-bar', 'foo bar', '', 'foo.bar'])('rejects %s', (name) => {
    expect(RenPyIdentifier.safeParse(name).success).toBe(false);
  });
});

describe('AssetRef', () => {
  it('accepts relative forward-slash paths', () => {
    expect(AssetRef.safeParse('images/bg/room.png').success).toBe(true);
    expect(AssetRef.safeParse('audio/music/calm.ogg').success).toBe(true);
  });

  it('rejects absolute and backslash paths', () => {
    expect(AssetRef.safeParse('/images/x.png').success).toBe(false);
    expect(AssetRef.safeParse('images\\bg\\x.png').success).toBe(false);
    expect(AssetRef.safeParse('').success).toBe(false);
  });
});

describe('HexColor', () => {
  it.each(['#FFF', '#ffffff', '#FF7A1A', '#9D4EDDFF'])('accepts %s', (c) => {
    expect(HexColor.safeParse(c).success).toBe(true);
  });

  it.each(['FFF', '#GGGGGG', '#12', '#1234567'])('rejects %s', (c) => {
    expect(HexColor.safeParse(c).success).toBe(false);
  });
});

describe('isReservedIdentifier', () => {
  it('flags reserved words', () => {
    for (const word of ['label', 'jump', 'if', 'def', 'return', 'True']) {
      expect(isReservedIdentifier(word)).toBe(true);
    }
  });

  it('passes non-reserved names', () => {
    for (const word of ['alice', 'love_points', 'Alice', 'start_scene']) {
      expect(isReservedIdentifier(word)).toBe(false);
    }
  });
});
