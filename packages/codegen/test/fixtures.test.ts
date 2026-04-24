import { readFile, readdir, stat } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { generate } from '../src/generate';
import { loadProject } from '../src/loader';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const FIXTURES_ROOT = resolve(__dirname, '../../../fixtures');

/**
 * For each fixture under fixtures/<name>/{spec, expected}, run the codegen
 * against `spec/` and assert byte-for-byte equality with `expected/`.
 */
describe('codegen fixtures', async () => {
  const fixtures = await listFixtures(FIXTURES_ROOT);

  // Sanity: discovery should find at least one fixture.
  it('discovers fixtures on disk', () => {
    expect(fixtures.length).toBeGreaterThan(0);
  });

  for (const fixture of fixtures) {
    describe(fixture.name, () => {
      it('produces the expected file set', async () => {
        const bundle = await loadProject(fixture.specRoot);
        const result = generate(bundle);
        const generated = new Set(result.files.map((f) => f.path));
        const expected = await listExpectedFiles(fixture.expectedRoot);
        expect([...generated].sort()).toEqual([...expected].sort());
      });

      it('produces byte-identical contents', async () => {
        const bundle = await loadProject(fixture.specRoot);
        const result = generate(bundle);
        for (const file of result.files) {
          const expectedPath = join(fixture.expectedRoot, file.path);
          const expected = await readFile(expectedPath, 'utf8');
          expect(file.contents, `mismatch in ${file.path}`).toBe(expected);
        }
      });
    });
  }
});

interface Fixture {
  name: string;
  specRoot: string;
  expectedRoot: string;
}

async function listFixtures(root: string): Promise<Fixture[]> {
  let entries: string[];
  try {
    entries = await readdir(root);
  } catch {
    return [];
  }
  const out: Fixture[] = [];
  for (const name of entries.sort()) {
    const dir = join(root, name);
    const s = await stat(dir).catch(() => null);
    if (!s?.isDirectory()) continue;
    const specRoot = join(dir, 'spec');
    const expectedRoot = join(dir, 'expected');
    const hasSpec = await stat(specRoot)
      .then((x) => x.isDirectory())
      .catch(() => false);
    const hasExpected = await stat(expectedRoot)
      .then((x) => x.isDirectory())
      .catch(() => false);
    if (hasSpec && hasExpected) out.push({ name, specRoot, expectedRoot });
  }
  return out;
}

async function listExpectedFiles(root: string): Promise<string[]> {
  const out: string[] = [];
  await walk(root, root, out);
  return out;
}

async function walk(base: string, dir: string, out: string[]): Promise<void> {
  for (const e of await readdir(dir)) {
    const full = join(dir, e);
    const s = await stat(full);
    if (s.isDirectory()) await walk(base, full, out);
    else if (e.endsWith('.rpy')) out.push(relative(base, full).replace(/\\/g, '/'));
  }
}
