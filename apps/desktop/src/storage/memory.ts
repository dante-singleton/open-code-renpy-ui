import type { ProjectStorage } from './types';

/**
 * In-memory storage backend. Used when running the React app outside Tauri
 * (e.g. via plain `pnpm dev`) so the UI is exercise-able without touching
 * the filesystem.
 *
 * Spec contents are stored as strings (JSON text) so they round-trip through
 * the same parsing path as a real project.
 */
export class MemoryStorage implements ProjectStorage {
  readonly canPickProject = false;
  label = '(in-memory)';
  private files = new Map<string, string>();
  private generated = new Map<string, string>();

  constructor(seed?: Record<string, string>) {
    if (seed) for (const [k, v] of Object.entries(seed)) this.files.set(k, v);
  }

  async pickProject(): Promise<string | null> {
    return null;
  }

  async createProject(
    name: string,
    _renpyPackage: string,
    _location: string | null,
  ): Promise<void> {
    this.files.clear();
    this.generated.clear();
    this.label = `(memory: ${name})`;
  }

  async readSpec(relPath: string): Promise<string | null> {
    return this.files.get(relPath) ?? null;
  }

  async writeSpec(relPath: string, contents: string): Promise<void> {
    this.files.set(relPath, contents);
  }

  async listSpecDir(relDir: string): Promise<string[]> {
    const prefix = relDir.endsWith('/') ? relDir : `${relDir}/`;
    const out: string[] = [];
    for (const k of this.files.keys()) {
      if (k.startsWith(prefix) && !k.slice(prefix.length).includes('/')) out.push(k);
    }
    return out.sort();
  }

  async writeGenerated(files: Array<{ path: string; contents: string }>): Promise<void> {
    for (const f of files) this.generated.set(f.path, f.contents);
  }

  async importAssetFiles(_opts: {
    kindHint?: 'image' | 'audio' | 'video' | 'font';
  }): Promise<
    Array<{
      ref: string;
      kind: 'image' | 'audio' | 'video' | 'font' | 'other';
      sizeBytes: number;
      hash: string;
    }>
  > {
    // The browser fallback can't read arbitrary files. Surface the limitation
    // to the user instead of silently failing.
    throw new Error('Asset import requires the desktop (Tauri) build.');
  }

  async listExistingAssetFiles(refs: ReadonlySet<string>): Promise<Set<string>> {
    // In-memory backend: every ref the caller knows about is treated as
    // "present" so the validator behaves benignly for the seeded demo.
    return new Set(refs);
  }

  async hashAssetFiles(_refs: ReadonlySet<string>): Promise<Map<string, string>> {
    return new Map();
  }

  async watchSpec(_handler: (changedPaths: string[]) => void): Promise<() => void> {
    // No filesystem to watch. Return a no-op unsubscribe.
    return () => {};
  }

  /** Test helper: snapshot of generated .rpy contents. */
  generatedFiles(): Map<string, string> {
    return new Map(this.generated);
  }
}
