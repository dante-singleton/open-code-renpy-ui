/**
 * Storage backends used by the desktop app.
 *
 * In a Tauri build the implementation talks to the Rust side via IPC and
 * reads/writes the on-disk project. In a plain browser dev session it is
 * backed by an in-memory map seeded with the hello-world fixture so the UI
 * remains useful for visual iteration.
 */
export interface ProjectStorage {
  /** Human label shown in the title bar; e.g. "/path/to/project" or "(in-memory)". */
  readonly label: string;
  /** True when this backend supports `pickProject` and persists to disk. */
  readonly canPickProject: boolean;

  /** Show a directory picker (or no-op for in-memory). Returns the new label. */
  pickProject(): Promise<string | null>;

  /** Create a new project skeleton at the given location. */
  createProject(name: string, renpyPackage: string, location: string | null): Promise<void>;

  /** Read a JSON spec file relative to the project root. Returns null if missing. */
  readSpec(relPath: string): Promise<string | null>;
  /** Write a JSON spec file relative to the project root. Created as needed. */
  writeSpec(relPath: string, contents: string): Promise<void>;
  /** List spec files within a relative directory (returns relative paths). */
  listSpecDir(relDir: string): Promise<string[]>;

  /** Write a batch of generated .rpy files. */
  writeGenerated(files: Array<{ path: string; contents: string }>): Promise<void>;

  /**
   * Show a file picker and import the chosen file(s) into the project's
   * assets directory. Returns the imported file metadata for each successful
   * import (with `ref` relative to game/). Returns an empty array on cancel.
   */
  importAssetFiles(opts: { kindHint?: 'image' | 'audio' | 'video' | 'font' }): Promise<
    Array<{
      ref: string;
      kind: 'image' | 'audio' | 'video' | 'font' | 'other';
      sizeBytes: number;
      hash: string;
    }>
  >;
}
