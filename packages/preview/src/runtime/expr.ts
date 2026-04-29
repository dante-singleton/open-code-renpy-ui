/**
 * Tiny, intentionally-conservative expression evaluator used by the preview.
 *
 * Supports the subset of Python expressions the editor's Expression Builder
 * can produce: comparisons against literals (`True`, `False`, numbers,
 * single-quoted or double-quoted strings) and `and` / `or` / `not` chains,
 * plus simple `+ - * /` arithmetic.
 *
 * Anything the evaluator can't understand returns `undefined`; the preview
 * treats `undefined` as "fall through to default branch / disabled choice"
 * and shows the raw expression in the debug log so users see what was
 * skipped.
 *
 * Parser strategy: a recursive descent over a hand-written lexer. ~150 LOC
 * and zero deps; we don't need full Python.
 */
import type { PreviewValue } from './types';

type Scope = Record<string, PreviewValue>;

type Tok =
  | { t: 'num'; v: number }
  | { t: 'str'; v: string }
  | { t: 'ident'; v: string }
  | { t: 'op'; v: string }
  | { t: 'lparen' }
  | { t: 'rparen' }
  | { t: 'kw'; v: 'and' | 'or' | 'not' | 'in' | 'True' | 'False' | 'None' };

const KEYWORDS = new Set(['and', 'or', 'not', 'in', 'True', 'False', 'None']);

function lex(s: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i] as string;
    if (c === ' ' || c === '\t' || c === '\n') {
      i++;
      continue;
    }
    if (c === '(') {
      out.push({ t: 'lparen' });
      i++;
      continue;
    }
    if (c === ')') {
      out.push({ t: 'rparen' });
      i++;
      continue;
    }
    if (c === '"' || c === "'") {
      const quote = c;
      let j = i + 1;
      let v = '';
      while (j < s.length && s[j] !== quote) {
        if (s[j] === '\\' && j + 1 < s.length) {
          v += s[j + 1];
          j += 2;
          continue;
        }
        v += s[j];
        j++;
      }
      if (s[j] !== quote) throw new Error('unterminated string');
      out.push({ t: 'str', v });
      i = j + 1;
      continue;
    }
    if (/[0-9]/.test(c)) {
      let j = i;
      while (j < s.length && /[0-9.]/.test(s[j] as string)) j++;
      out.push({ t: 'num', v: Number(s.slice(i, j)) });
      i = j;
      continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      let j = i;
      while (j < s.length && /[A-Za-z0-9_]/.test(s[j] as string)) j++;
      const v = s.slice(i, j);
      if (KEYWORDS.has(v))
        out.push({
          t: 'kw',
          v: v as 'and' | 'or' | 'not' | 'in' | 'True' | 'False' | 'None',
        });
      else out.push({ t: 'ident', v });
      i = j;
      continue;
    }
    const two = s.slice(i, i + 2);
    if (two === '==' || two === '!=' || two === '<=' || two === '>=') {
      out.push({ t: 'op', v: two });
      i += 2;
      continue;
    }
    if (c === '<' || c === '>' || c === '+' || c === '-' || c === '*' || c === '/') {
      out.push({ t: 'op', v: c });
      i++;
      continue;
    }
    throw new Error(`unexpected char: ${c}`);
  }
  return out;
}

type Value = PreviewValue | null | undefined;

class Parser {
  pos = 0;
  constructor(
    private readonly tokens: Tok[],
    private readonly scope: Scope,
  ) {}

  expectEnd(): void {
    if (this.pos !== this.tokens.length) throw new Error('trailing tokens');
  }

  parseExpr(): Value {
    return this.parseOr();
  }

  private peek(): Tok | undefined {
    return this.tokens[this.pos];
  }

  private take(): Tok | undefined {
    const t = this.tokens[this.pos];
    if (t) this.pos++;
    return t;
  }

  private parseOr(): Value {
    let left = this.parseAnd();
    while (this.peek()?.t === 'kw' && (this.peek() as { v: string }).v === 'or') {
      this.take();
      const right = this.parseAnd();
      left = toBool(left) || toBool(right);
    }
    return left;
  }

  private parseAnd(): Value {
    let left = this.parseNot();
    while (this.peek()?.t === 'kw' && (this.peek() as { v: string }).v === 'and') {
      this.take();
      const right = this.parseNot();
      left = toBool(left) && toBool(right);
    }
    return left;
  }

  private parseNot(): Value {
    if (this.peek()?.t === 'kw' && (this.peek() as { v: string }).v === 'not') {
      this.take();
      return !toBool(this.parseNot());
    }
    return this.parseComparison();
  }

  private parseComparison(): Value {
    const left = this.parseAdd();
    const t = this.peek();
    if (t?.t === 'op' && /^(==|!=|<=|>=|<|>)$/.test(t.v)) {
      this.take();
      const right = this.parseAdd();
      return compare(left, right, t.v);
    }
    if (t?.t === 'kw' && t.v === 'in') {
      throw new Error('`in` not supported in preview evaluator');
    }
    return left;
  }

  private parseAdd(): Value {
    let left = this.parseMul();
    while (this.peek()?.t === 'op' && /^[+-]$/.test((this.peek() as { v: string }).v)) {
      const op = (this.take() as { v: string }).v;
      const right = this.parseMul();
      const a = toNumber(left);
      const b = toNumber(right);
      if (a == null || b == null) return undefined;
      left = op === '+' ? a + b : a - b;
    }
    return left;
  }

  private parseMul(): Value {
    let left = this.parseAtom();
    while (this.peek()?.t === 'op' && /^[*/]$/.test((this.peek() as { v: string }).v)) {
      const op = (this.take() as { v: string }).v;
      const right = this.parseAtom();
      const a = toNumber(left);
      const b = toNumber(right);
      if (a == null || b == null) return undefined;
      left = op === '*' ? a * b : a / b;
    }
    return left;
  }

  private parseAtom(): Value {
    const t = this.take();
    if (!t) throw new Error('unexpected end of expression');
    if (t.t === 'num') return t.v;
    if (t.t === 'str') return t.v;
    if (t.t === 'kw') {
      if (t.v === 'True') return true;
      if (t.v === 'False') return false;
      if (t.v === 'None') return null;
      throw new Error(`unexpected keyword: ${t.v}`);
    }
    if (t.t === 'ident') {
      return Object.hasOwn(this.scope, t.v) ? (this.scope[t.v] as PreviewValue) : undefined;
    }
    if (t.t === 'lparen') {
      const v = this.parseExpr();
      const close = this.take();
      if (close?.t !== 'rparen') throw new Error('expected )');
      return v;
    }
    throw new Error('unexpected token');
  }
}

function toBool(v: Value): boolean {
  if (v == null) return false;
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  if (typeof v === 'string') return v.length > 0;
  return false;
}

function toNumber(v: Value): number | null {
  if (typeof v === 'number') return v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (typeof v === 'string') {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function compare(a: Value, b: Value, op: string): boolean | undefined {
  if (a == null || b == null) return undefined;
  if (op === '==') return a === b;
  if (op === '!=') return a !== b;
  const an = toNumber(a);
  const bn = toNumber(b);
  if (an == null || bn == null) return undefined;
  switch (op) {
    case '<':
      return an < bn;
    case '<=':
      return an <= bn;
    case '>':
      return an > bn;
    case '>=':
      return an >= bn;
    default:
      return undefined;
  }
}

/**
 * Evaluate `src` against `scope`. Empty source returns true (the `else`
 * convention). Returns `undefined` for anything the parser/evaluator can't
 * understand so callers can decide how to fall back.
 */
export function evaluate(src: string, scope: Scope): boolean | undefined {
  const trimmed = src.trim();
  if (trimmed === '') return true;
  try {
    const tokens = lex(trimmed);
    const parser = new Parser(tokens, scope);
    const value = parser.parseExpr();
    parser.expectEnd();
    return toBool(value);
  } catch {
    return undefined;
  }
}
