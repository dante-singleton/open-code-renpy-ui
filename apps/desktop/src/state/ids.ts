/**
 * ID generation for spec entities. Format: `<prefix>_<base32>` where base32 is
 * the timestamp + a small random tail. Not a real ULID (we want zero deps for
 * an internal helper) but is sortable and URL/Python-safe.
 */

const CHARS = '0123456789abcdefghijklmnopqrstuv';

function base32(n: number, len: number): string {
  let out = '';
  let v = n;
  for (let i = 0; i < len; i++) {
    out = (CHARS[v & 31] ?? '0') + out;
    v = Math.floor(v / 32);
  }
  return out;
}

let counter = 0;

export function newId(prefix = 'id'): string {
  counter = (counter + 1) % 1024;
  const ts = base32(Date.now(), 9);
  const rand = base32(Math.floor(Math.random() * 0x40000) | counter, 4);
  return `${prefix}_${ts}${rand}`;
}

/** Stable nodeId helper: same prefix per node type makes graphs easier to read. */
export function newNodeId(type: string): string {
  return newId(`n_${type}`);
}
