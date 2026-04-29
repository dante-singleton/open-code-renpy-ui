import { describe, expect, it } from 'vitest';
import { evaluate } from '../src/runtime/expr';

describe('preview expression evaluator', () => {
  it('returns true for an empty expression (the else convention)', () => {
    expect(evaluate('', {})).toBe(true);
  });

  it('handles boolean literals', () => {
    expect(evaluate('True', {})).toBe(true);
    expect(evaluate('False', {})).toBe(false);
  });

  it('handles numeric comparisons', () => {
    const scope = { love_points: 3 };
    expect(evaluate('love_points >= 1', scope)).toBe(true);
    expect(evaluate('love_points < 1', scope)).toBe(false);
    expect(evaluate('love_points == 3', scope)).toBe(true);
    expect(evaluate('love_points != 3', scope)).toBe(false);
  });

  it('handles boolean compounds', () => {
    const scope = { a: 2, b: false };
    expect(evaluate('a > 1 and b', scope)).toBe(false);
    expect(evaluate('a > 1 or b', scope)).toBe(true);
    expect(evaluate('not b', scope)).toBe(true);
  });

  it('treats unknown identifiers as falsy', () => {
    // Unknown ident => undefined value; compare(undefined, 1) => undefined;
    // toBool(undefined) => false.
    expect(evaluate('mystery == 1', {})).toBe(false);
  });

  it('returns undefined for syntax it cannot handle', () => {
    expect(evaluate('items.length > 0', {})).toBe(undefined);
    expect(evaluate('"a" in items', {})).toBe(undefined);
  });

  it('handles parentheses and arithmetic', () => {
    expect(evaluate('(2 + 3) * 4 == 20', {})).toBe(true);
    expect(evaluate('1 + 2 == 3', {})).toBe(true);
  });

  it('respects scope and unknown vars', () => {
    expect(evaluate('flag', { flag: true })).toBe(true);
    expect(evaluate('flag', { flag: false })).toBe(false);
    expect(evaluate('flag', {})).toBe(false); // undefined coerces to false in bool context
  });

  it('handles string equality', () => {
    expect(evaluate('"hello" == "hello"', {})).toBe(true);
    expect(evaluate('"hello" != "world"', {})).toBe(true);
  });
});
