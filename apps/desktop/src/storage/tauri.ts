import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import type { ProjectStorage } from './types';

/**
 * Storage backend that talks to the Rust core via Tauri IPC. The Rust side
 * implements `project_open`, `project_create`, `spec_read`, `spec_write`,
 * `spec_list_dir`, and `generated_write` (see src-tauri/src/lib.rs).
 */
export class TauriStorage implements ProjectStorage {
  readonly canPickProject = true;
  label = '(no project)';

  async pickProject(): Promise<string | null> {
    const root = await invoke<string | null>('project_open');
    if (root) {
      this.label = root;
      return root;
    }
    return null;
  }

  async createProject(name: string, renpyPackage: string, location: string | null): Promise<void> {
    const root = await invoke<string>('project_create', { name, renpyPackage, location });
    this.label = root;
  }

  async readSpec(relPath: string): Promise<string | null> {
    return invoke<string | null>('spec_read', { relPath });
  }

  async writeSpec(relPath: string, contents: string): Promise<void> {
    await invoke('spec_write', { relPath, contents });
  }

  async listSpecDir(relDir: string): Promise<string[]> {
    return invoke<string[]>('spec_list_dir', { relDir });
  }

  async writeGenerated(files: Array<{ path: string; contents: string }>): Promise<void> {
    await invoke('generated_write', { files });
  }

  async importAssetFiles(opts: {
    kindHint?: 'image' | 'audio' | 'video' | 'font';
  }): Promise<
    Array<{
      ref: string;
      kind: 'image' | 'audio' | 'video' | 'font' | 'other';
      sizeBytes: number;
      hash: string;
    }>
  > {
    return invoke('asset_import', { kindHint: opts.kindHint ?? null });
  }

  async listExistingAssetFiles(refs: ReadonlySet<string>): Promise<Set<string>> {
    const result = await invoke<string[]>('asset_check_exists', { refs: [...refs] });
    return new Set(result);
  }

  async hashAssetFiles(refs: ReadonlySet<string>): Promise<Map<string, string>> {
    const result = await invoke<Array<[string, string]>>('asset_hash_files', {
      refs: [...refs],
    });
    return new Map(result);
  }

  async watchSpec(handler: (changedPaths: string[]) => void): Promise<() => void> {
    await invoke('watch_start');
    const unlisten = await listen<string[]>('spec-changed', (event) => {
      handler(event.payload);
    });
    return async () => {
      try {
        await invoke('watch_stop');
      } finally {
        unlisten();
      }
    };
  }
}
