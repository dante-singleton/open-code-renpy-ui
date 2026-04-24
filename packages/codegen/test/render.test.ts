import { describe, expect, it } from 'vitest';
import { byPositionThenId, escapeRenPyString, indent, renPyString } from '../src/utils/render';

describe('escapeRenPyString', () => {
  it('escapes quotes and backslashes', () => {
    expect(escapeRenPyString('He said "hi"')).toBe('He said \\"hi\\"');
    expect(escapeRenPyString('back\\slash')).toBe('back\\\\slash');
  });

  it('escapes newlines as \\n (no real newline in output)', () => {
    expect(escapeRenPyString('a\nb')).toBe('a\\nb');
  });

  it("preserves Ren'Py tag markers", () => {
    expect(escapeRenPyString('hello {b}world{/b}')).toBe('hello {b}world{/b}');
  });
});

describe('renPyString', () => {
  it('wraps in quotes', () => {
    expect(renPyString('Alice')).toBe('"Alice"');
    expect(renPyString('"hi"')).toBe('"\\"hi\\""');
  });
});

describe('indent', () => {
  it('uses 4-space steps', () => {
    expect(indent(0, 'x')).toBe('x');
    expect(indent(1, 'x')).toBe('    x');
    expect(indent(2, 'x')).toBe('        x');
  });
});

describe('byPositionThenId', () => {
  const make = (id: string, x: number, y: number) => ({ id, position: { x, y } });

  it('sorts by y, then x, then id', () => {
    const items = [make('a', 100, 10), make('b', 0, 0), make('c', 100, 0), make('d', 50, 0)];
    items.sort(byPositionThenId);
    expect(items.map((i) => i.id)).toEqual(['b', 'd', 'c', 'a']);
  });

  it('uses id as a stable tiebreaker', () => {
    const items = [make('z', 0, 0), make('a', 0, 0)];
    items.sort(byPositionThenId);
    expect(items.map((i) => i.id)).toEqual(['a', 'z']);
  });
});
