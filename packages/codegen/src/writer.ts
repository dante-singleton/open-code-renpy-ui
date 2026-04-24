import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import type { GeneratedFile } from './types';

export interface WriteReport {
  written: string[];
  unchanged: string[];
}

/**
 * Write generated files under `projectRoot`, skipping files whose content
 * already matches on disk (keeps mtimes stable for Ren'Py's cache).
 * Writes are atomic (temp + rename).
 */
export async function writeGenerated(
  projectRoot: string,
  files: GeneratedFile[],
): Promise<WriteReport> {
  const report: WriteReport = { written: [], unchanged: [] };
  const root = resolve(projectRoot);

  for (const file of files) {
    const absPath = join(root, file.path);
    await mkdir(dirname(absPath), { recursive: true });

    if (await contentMatches(absPath, file.contents)) {
      report.unchanged.push(file.path);
      continue;
    }

    const tmp = `${absPath}.tmp-${randomSuffix()}`;
    await writeFile(tmp, file.contents, 'utf8');
    await rename(tmp, absPath);
    report.written.push(file.path);
  }

  return report;
}

async function contentMatches(path: string, contents: string): Promise<boolean> {
  try {
    const current = await readFile(path, 'utf8');
    return current === contents;
  } catch {
    return false;
  }
}

function randomSuffix(): string {
  // Collision-resistant enough for temp filenames; deterministic enough for
  // tests (we never assert on the suffix).
  return createHash('sha256')
    .update(`${process.pid}-${Date.now()}-${Math.random()}`)
    .digest('hex')
    .slice(0, 8);
}
