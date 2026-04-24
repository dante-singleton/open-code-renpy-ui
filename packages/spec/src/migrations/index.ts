/**
 * Migration runner for spec documents. See SPEC.md §2.
 *
 * Each migration takes a document (as plain JSON) at version `from` and
 * returns the document at version `to`. Migrations are applied in order until
 * the document reaches the current `SPEC_VERSION`.
 *
 * v1.0.0 is the first version, so there are no registered migrations yet.
 * Adding a future version (e.g. 1.1.0) means appending an entry here.
 */

import { SPEC_VERSION } from '../primitives';

export interface Migration {
  from: string;
  to: string;
  migrate: (doc: unknown) => unknown;
}

const MIGRATIONS: Migration[] = [];

export function listMigrations(): readonly Migration[] {
  return MIGRATIONS;
}

/**
 * Apply migrations sequentially. If the document has no `specVersion`, it is
 * assumed to be `SPEC_VERSION` (treated as current).
 */
export function migrate(doc: unknown): { doc: unknown; migrated: boolean } {
  if (typeof doc !== 'object' || doc === null) {
    return { doc, migrated: false };
  }
  const d = doc as { specVersion?: string };
  let current = d.specVersion ?? SPEC_VERSION;
  let result: unknown = doc;
  let migrated = false;

  // Safety cap: a runaway chain should never loop forever.
  for (let i = 0; i < 64; i++) {
    if (current === SPEC_VERSION) break;
    const step = MIGRATIONS.find((m) => m.from === current);
    if (!step) {
      throw new Error(`No migration found from spec version ${current} toward ${SPEC_VERSION}`);
    }
    result = step.migrate(result);
    current = step.to;
    migrated = true;
  }
  return { doc: result, migrated };
}
