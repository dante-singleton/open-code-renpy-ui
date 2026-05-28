import { type SpecBundle, generate } from '@renpy-ui/codegen';
import type {
  Asset,
  AssetKind,
  AssetSubkind,
  Character,
  ProjectManifest,
  SceneEdge,
  SceneNode,
  SceneSpec,
  ScreenSpec,
  Variable,
} from '@renpy-ui/spec';
import {
  type Diagnostic,
  hasErrors,
  validateBundle,
  validateBundleWithEnv,
} from '@renpy-ui/validators';
import { enableMapSet, produce } from 'immer';

// Allow Immer to draft `Set` (used for the dirty tracker) and `Map`.
enableMapSet();
import { type TemporalState, temporal } from 'zundo';
import { type StoreApi, type UseBoundStore, create } from 'zustand';
import { loadProjectFromStorage } from '../codegen/load';
import type { ProjectStorage } from '../storage';
import { newId } from './ids';

/**
 * Top-level project store.
 *
 * The Zustand state is split into two layers:
 *
 *   1. A *temporal* slice (under `temporal`) holding everything that should be
 *      part of undo/redo: scenes, the active scene id, selection.
 *   2. The non-temporal top-level fields: storage, status, diagnostics, dirty
 *      set, etc.
 *
 * Mutations are exposed as named actions on the top-level store so component
 * code never reaches into Immer or zundo directly.
 */

export type Status = 'idle' | 'opening' | 'loading' | 'saving' | 'generating' | 'error';

export interface ProjectState {
  // ---- non-temporal ----
  storage: ProjectStorage | null;
  status: Status;
  errorMessage: string | null;
  /** Spec docs that are dirty and need to be persisted. */
  dirty: Set<string>;
  diagnostics: Diagnostic[];
  lastGenerated: { written: number; unchanged: number } | null;

  /**
   * Asset refs that the storage backend has confirmed exist on disk. Updated
   * by `refreshAssetEnvironment` and used by validators that need I/O.
   */
  existingAssetFiles: Set<string>;
  /** Stored content hashes per asset ref, refreshed on demand. */
  currentAssetHashes: Map<string, string>;

  // ---- temporal slice (undo/redo applies to these) ----
  bundle: SpecBundle | null;
  activeSceneId: string | null;
  selectedNodeIds: string[];
  selectedEdgeIds: string[];

  // ---- actions ----
  setStorage(storage: ProjectStorage): void;
  openProject(): Promise<void>;
  reloadProject(): Promise<void>;
  setActiveScene(sceneId: string): void;

  selectNodes(ids: string[]): void;
  selectEdges(ids: string[]): void;
  clearSelection(): void;

  addNode(node: SceneNode): void;
  updateNode(nodeId: string, patch: Partial<SceneNode>): void;
  removeNodes(nodeIds: string[]): void;
  moveNode(nodeId: string, position: { x: number; y: number }): void;

  addEdge(edge: SceneEdge): void;
  removeEdges(edgeIds: string[]): void;

  upsertCharacter(character: Character): void;
  removeCharacter(characterId: string): void;
  upsertVariable(variable: Variable): void;
  removeVariable(variableId: string): void;

  upsertScreen(screen: ScreenSpec): void;
  removeScreen(screenId: string): void;

  upsertAsset(asset: Asset): void;
  removeAsset(assetId: string): void;
  importAssets(opts: { kindHint?: AssetKind; subkind?: AssetSubkind }): Promise<Asset[]>;

  /**
   * Switch to the scene whose spec file matches `sourcePath` (relative path,
   * e.g. ".renpy-ui/scenes/start.json") and select the given node id.
   * No-op if either part can't be resolved.
   */
  jumpToNode(sourcePath: string, nodeId: string): void;
  /**
   * Remove a node identified by (sourcePath, nodeId), regardless of which
   * scene is currently active. Used by quick-fix actions.
   */
  removeNodeAt(sourcePath: string, nodeId: string): void;

  /** Save dirty spec docs. Triggers codegen on success. */
  save(): Promise<void>;
  /** Run validators only (no save). */
  validate(): void;
  /**
   * Refresh the asset existence + hash maps from the storage backend, then
   * re-validate. Use after asset import / removal, project open, or when an
   * external file watcher reports asset changes.
   */
  refreshAssetEnvironment(): Promise<void>;
}

type TemporalSlice = Pick<
  ProjectState,
  'bundle' | 'activeSceneId' | 'selectedNodeIds' | 'selectedEdgeIds'
>;

const partializeTemporal = (state: ProjectState): TemporalSlice => ({
  bundle: state.bundle,
  activeSceneId: state.activeSceneId,
  selectedNodeIds: state.selectedNodeIds,
  selectedEdgeIds: state.selectedEdgeIds,
});

const SCENE_FILE_PREFIX = '.renpy-ui/scenes/';
const SCREEN_FILE_PREFIX = '.renpy-ui/screens/';
const PROJECT_FILE = '.renpy-ui/project.json';
const CHARACTERS_FILE = '.renpy-ui/characters.json';
const VARIABLES_FILE = '.renpy-ui/variables.json';
const ASSETS_FILE = '.renpy-ui/assets.json';

function sceneFile(label: string): string {
  return `${SCENE_FILE_PREFIX}${label}.json`;
}

function screenFile(name: string): string {
  return `${SCREEN_FILE_PREFIX}${name}.json`;
}

function findScene(bundle: SpecBundle, sceneId: string): SceneSpec | undefined {
  return bundle.scenes.find((s) => s.id === sceneId);
}

function markDirty(state: ProjectState, ...files: string[]): void {
  for (const f of files) state.dirty.add(f);
}

function syncManifestScenes(project: ProjectManifest, scenes: SceneSpec[]): ProjectManifest {
  return {
    ...project,
    scenes: scenes.map((s) => ({ id: s.id, label: s.label, file: `scenes/${s.label}.json` })),
  };
}

function syncManifestScreens(project: ProjectManifest, screens: ScreenSpec[]): ProjectManifest {
  return {
    ...project,
    screens: screens.map((s) => ({
      id: s.id,
      name: s.name,
      file: `screens/${s.name}.json`,
    })),
  };
}

export const useProjectStore: UseBoundStore<
  StoreApi<ProjectState> & { temporal: StoreApi<TemporalState<TemporalSlice>> }
> = create<ProjectState>()(
  temporal(
    (set, get) => ({
      storage: null,
      status: 'idle',
      errorMessage: null,
      dirty: new Set(),
      diagnostics: [],
      lastGenerated: null,
      existingAssetFiles: new Set(),
      currentAssetHashes: new Map(),
      bundle: null,
      activeSceneId: null,
      selectedNodeIds: [],
      selectedEdgeIds: [],

      setStorage(storage) {
        set({ storage });
      },

      async openProject() {
        const storage = get().storage;
        if (!storage) return;
        if (storage.canPickProject) {
          set({ status: 'opening' });
          const picked = await storage.pickProject();
          if (!picked) {
            set({ status: 'idle' });
            return;
          }
        }
        await get().reloadProject();
      },

      async reloadProject() {
        const storage = get().storage;
        if (!storage) return;
        set({ status: 'loading', errorMessage: null });
        try {
          const bundle = await loadProjectFromStorage(storage);
          const firstScene = bundle.scenes[0]?.id ?? null;
          set({
            bundle,
            activeSceneId: firstScene,
            selectedNodeIds: [],
            selectedEdgeIds: [],
            dirty: new Set(),
            existingAssetFiles: new Set(),
            currentAssetHashes: new Map(),
            status: 'idle',
            diagnostics: validateBundle(bundle),
          });
          // Refresh asset env in the background; the validator runs again
          // when it completes. Failure is non-fatal — the UI just shows the
          // pure-rules result until the env is back.
          void get().refreshAssetEnvironment();
        } catch (err) {
          set({
            status: 'error',
            errorMessage: err instanceof Error ? err.message : String(err),
          });
        }
      },

      setActiveScene(sceneId) {
        set({ activeSceneId: sceneId, selectedNodeIds: [], selectedEdgeIds: [] });
      },

      selectNodes(ids) {
        set({ selectedNodeIds: ids });
      },

      selectEdges(ids) {
        set({ selectedEdgeIds: ids });
      },

      clearSelection() {
        set({ selectedNodeIds: [], selectedEdgeIds: [] });
      },

      addNode(node) {
        set(
          produce((s: ProjectState) => {
            const scene = activeScene(s);
            if (!scene) return;
            scene.nodes.push(node);
            markDirty(s, sceneFile(scene.label));
            s.diagnostics = s.bundle
              ? validateBundleWithEnv(s.bundle, {
                  existingAssetFiles: s.existingAssetFiles,
                  currentAssetHashes: s.currentAssetHashes,
                })
              : [];
          }),
        );
      },

      updateNode(nodeId, patch) {
        set(
          produce((s: ProjectState) => {
            const scene = activeScene(s);
            if (!scene) return;
            const idx = scene.nodes.findIndex((n) => n.id === nodeId);
            if (idx === -1) return;
            // Type assertion is safe: caller is expected to pass a patch
            // compatible with the discriminated union member.
            scene.nodes[idx] = { ...scene.nodes[idx], ...patch } as SceneNode;
            markDirty(s, sceneFile(scene.label));
            s.diagnostics = s.bundle
              ? validateBundleWithEnv(s.bundle, {
                  existingAssetFiles: s.existingAssetFiles,
                  currentAssetHashes: s.currentAssetHashes,
                })
              : [];
          }),
        );
      },

      removeNodes(nodeIds) {
        set(
          produce((s: ProjectState) => {
            const scene = activeScene(s);
            if (!scene) return;
            const ids = new Set(nodeIds);
            scene.nodes = scene.nodes.filter((n) => !ids.has(n.id));
            scene.edges = scene.edges.filter((e) => !ids.has(e.source) && !ids.has(e.target));
            s.selectedNodeIds = s.selectedNodeIds.filter((id) => !ids.has(id));
            markDirty(s, sceneFile(scene.label));
            s.diagnostics = s.bundle
              ? validateBundleWithEnv(s.bundle, {
                  existingAssetFiles: s.existingAssetFiles,
                  currentAssetHashes: s.currentAssetHashes,
                })
              : [];
          }),
        );
      },

      moveNode(nodeId, position) {
        set(
          produce((s: ProjectState) => {
            const scene = activeScene(s);
            if (!scene) return;
            const node = scene.nodes.find((n) => n.id === nodeId);
            if (!node) return;
            node.position = position;
            markDirty(s, sceneFile(scene.label));
          }),
        );
      },

      addEdge(edge) {
        set(
          produce((s: ProjectState) => {
            const scene = activeScene(s);
            if (!scene) return;
            // Replace any existing edge from the same handle (single outgoing
            // edge per handle is the canonical case for sayar/menu/if).
            scene.edges = scene.edges.filter(
              (e) => !(e.source === edge.source && e.sourceHandle === edge.sourceHandle),
            );
            scene.edges.push(edge);
            markDirty(s, sceneFile(scene.label));
            s.diagnostics = s.bundle
              ? validateBundleWithEnv(s.bundle, {
                  existingAssetFiles: s.existingAssetFiles,
                  currentAssetHashes: s.currentAssetHashes,
                })
              : [];
          }),
        );
      },

      removeEdges(edgeIds) {
        set(
          produce((s: ProjectState) => {
            const scene = activeScene(s);
            if (!scene) return;
            const ids = new Set(edgeIds);
            scene.edges = scene.edges.filter((e) => !ids.has(e.id));
            s.selectedEdgeIds = s.selectedEdgeIds.filter((id) => !ids.has(id));
            markDirty(s, sceneFile(scene.label));
            s.diagnostics = s.bundle
              ? validateBundleWithEnv(s.bundle, {
                  existingAssetFiles: s.existingAssetFiles,
                  currentAssetHashes: s.currentAssetHashes,
                })
              : [];
          }),
        );
      },

      upsertCharacter(character) {
        set(
          produce((s: ProjectState) => {
            if (!s.bundle) return;
            const idx = s.bundle.characters.characters.findIndex((c) => c.id === character.id);
            if (idx === -1) s.bundle.characters.characters.push(character);
            else s.bundle.characters.characters[idx] = character;
            markDirty(s, CHARACTERS_FILE);
            s.diagnostics = validateBundleWithEnv(s.bundle, {
              existingAssetFiles: s.existingAssetFiles,
              currentAssetHashes: s.currentAssetHashes,
            });
          }),
        );
      },

      removeCharacter(characterId) {
        set(
          produce((s: ProjectState) => {
            if (!s.bundle) return;
            s.bundle.characters.characters = s.bundle.characters.characters.filter(
              (c) => c.id !== characterId,
            );
            markDirty(s, CHARACTERS_FILE);
            s.diagnostics = validateBundleWithEnv(s.bundle, {
              existingAssetFiles: s.existingAssetFiles,
              currentAssetHashes: s.currentAssetHashes,
            });
          }),
        );
      },

      upsertVariable(variable) {
        set(
          produce((s: ProjectState) => {
            if (!s.bundle) return;
            const idx = s.bundle.variables.variables.findIndex((v) => v.id === variable.id);
            if (idx === -1) s.bundle.variables.variables.push(variable);
            else s.bundle.variables.variables[idx] = variable;
            markDirty(s, VARIABLES_FILE);
            s.diagnostics = validateBundleWithEnv(s.bundle, {
              existingAssetFiles: s.existingAssetFiles,
              currentAssetHashes: s.currentAssetHashes,
            });
          }),
        );
      },

      removeVariable(variableId) {
        set(
          produce((s: ProjectState) => {
            if (!s.bundle) return;
            s.bundle.variables.variables = s.bundle.variables.variables.filter(
              (v) => v.id !== variableId,
            );
            markDirty(s, VARIABLES_FILE);
            s.diagnostics = validateBundleWithEnv(s.bundle, {
              existingAssetFiles: s.existingAssetFiles,
              currentAssetHashes: s.currentAssetHashes,
            });
          }),
        );
      },

      upsertScreen(screen) {
        set(
          produce((s: ProjectState) => {
            if (!s.bundle) return;
            const idx = s.bundle.screens.findIndex((sc) => sc.id === screen.id);
            const previous = idx === -1 ? null : (s.bundle.screens[idx] ?? null);
            if (idx === -1) s.bundle.screens.push(screen);
            else s.bundle.screens[idx] = screen;
            // If the user renamed the screen, remove the old file and mark
            // the new one dirty. Otherwise just dirty the current name.
            if (previous && previous.name !== screen.name) {
              markDirty(s, screenFile(previous.name));
            }
            markDirty(s, screenFile(screen.name));
            markDirty(s, PROJECT_FILE);
            s.diagnostics = validateBundleWithEnv(s.bundle, {
              existingAssetFiles: s.existingAssetFiles,
              currentAssetHashes: s.currentAssetHashes,
            });
          }),
        );
      },

      removeScreen(screenId) {
        set(
          produce((s: ProjectState) => {
            if (!s.bundle) return;
            const removed = s.bundle.screens.find((sc) => sc.id === screenId);
            s.bundle.screens = s.bundle.screens.filter((sc) => sc.id !== screenId);
            if (removed) markDirty(s, screenFile(removed.name));
            markDirty(s, PROJECT_FILE);
            s.diagnostics = validateBundleWithEnv(s.bundle, {
              existingAssetFiles: s.existingAssetFiles,
              currentAssetHashes: s.currentAssetHashes,
            });
          }),
        );
      },

      upsertAsset(asset) {
        set(
          produce((s: ProjectState) => {
            if (!s.bundle) return;
            const idx = s.bundle.assets.assets.findIndex((a) => a.id === asset.id);
            if (idx === -1) s.bundle.assets.assets.push(asset);
            else s.bundle.assets.assets[idx] = asset;
            markDirty(s, ASSETS_FILE);
            s.diagnostics = validateBundleWithEnv(s.bundle, {
              existingAssetFiles: s.existingAssetFiles,
              currentAssetHashes: s.currentAssetHashes,
            });
          }),
        );
      },

      removeAsset(assetId) {
        set(
          produce((s: ProjectState) => {
            if (!s.bundle) return;
            s.bundle.assets.assets = s.bundle.assets.assets.filter((a) => a.id !== assetId);
            markDirty(s, ASSETS_FILE);
            s.diagnostics = validateBundleWithEnv(s.bundle, {
              existingAssetFiles: s.existingAssetFiles,
              currentAssetHashes: s.currentAssetHashes,
            });
          }),
        );
      },

      jumpToNode(sourcePath, nodeId) {
        const bundle = get().bundle;
        if (!bundle) return;
        const scene = sceneFromSpecPath(bundle.scenes, sourcePath);
        if (!scene) return;
        if (!scene.nodes.some((n) => n.id === nodeId)) return;
        set({
          activeSceneId: scene.id,
          selectedNodeIds: [nodeId],
          selectedEdgeIds: [],
        });
      },

      removeNodeAt(sourcePath, nodeId) {
        set(
          produce((s: ProjectState) => {
            if (!s.bundle) return;
            const scene = sceneFromSpecPath(s.bundle.scenes, sourcePath);
            if (!scene) return;
            scene.nodes = scene.nodes.filter((n) => n.id !== nodeId);
            scene.edges = scene.edges.filter((e) => e.source !== nodeId && e.target !== nodeId);
            s.selectedNodeIds = s.selectedNodeIds.filter((id) => id !== nodeId);
            markDirty(s, sceneFile(scene.label));
            s.diagnostics = validateBundleWithEnv(s.bundle, {
              existingAssetFiles: s.existingAssetFiles,
              currentAssetHashes: s.currentAssetHashes,
            });
          }),
        );
      },

      async importAssets({ kindHint, subkind }) {
        const storage = get().storage;
        if (!storage) return [];
        // The storage interface only accepts kinds it can hint to a file
        // dialog; "other" has no useful filter and is downgraded to undefined.
        const hint =
          kindHint && kindHint !== 'other'
            ? (kindHint as 'image' | 'audio' | 'video' | 'font')
            : undefined;
        const imported = await storage.importAssetFiles({ kindHint: hint });
        const assets: Asset[] = imported.map((m) => ({
          id: newId('asset'),
          ref: m.ref,
          kind: m.kind,
          subkind: subkind ?? inferSubkind(m.ref, m.kind),
          tags: [],
          hash: m.hash,
          sizeBytes: m.sizeBytes,
          importedAt: new Date().toISOString(),
        }));
        for (const a of assets) get().upsertAsset(a);
        await get().refreshAssetEnvironment();
        return assets;
      },

      validate() {
        const bundle = get().bundle;
        if (!bundle) return;
        set({
          diagnostics: validateBundleWithEnv(bundle, {
            existingAssetFiles: get().existingAssetFiles,
            currentAssetHashes: get().currentAssetHashes,
          }),
        });
      },

      async refreshAssetEnvironment() {
        const { storage, bundle } = get();
        if (!storage || !bundle) return;
        const refs = new Set(bundle.assets.assets.map((a) => a.ref));
        if (refs.size === 0) {
          set({
            existingAssetFiles: new Set(),
            currentAssetHashes: new Map(),
          });
          get().validate();
          return;
        }
        // The storage backend takes paths relative to the project root;
        // AssetRefs are relative to the assets dir (game/). Adapt at the
        // boundary so callers can keep using bare AssetRef strings.
        const assetsDir = bundle.project.paths.assetsDir.replace(/\/+$/, '');
        const toRoot = (ref: string) => (assetsDir ? `${assetsDir}/${ref}` : ref);
        const fromRoot = (rooted: string): string =>
          assetsDir && rooted.startsWith(`${assetsDir}/`)
            ? rooted.slice(assetsDir.length + 1)
            : rooted;
        try {
          const rooted = new Set([...refs].map(toRoot));
          const existingRooted = await storage.listExistingAssetFiles(rooted);
          const existing = new Set([...existingRooted].map(fromRoot));
          const hashesRooted = await storage.hashAssetFiles(existingRooted);
          const hashes = new Map<string, string>();
          for (const [k, v] of hashesRooted) hashes.set(fromRoot(k), v);
          set({ existingAssetFiles: existing, currentAssetHashes: hashes });
          get().validate();
        } catch {
          // Non-fatal; keep previous env so the UI doesn't blink.
        }
      },

      async save() {
        const { storage, bundle, dirty } = get();
        if (!storage || !bundle) return;

        const diagnostics = validateBundle(bundle);
        set({ diagnostics });

        if (hasErrors(diagnostics)) {
          // We still write spec files so user work is never lost; we just
          // skip codegen. Errors stay surfaced in the Problems panel.
          set({ status: 'saving' });
          await persistDirty(storage, bundle, dirty);
          set({ dirty: new Set(), status: 'idle' });
          return;
        }

        set({ status: 'saving' });
        try {
          // Make sure the project manifest's `scenes[]` and `screens[]`
          // match reality before we persist + codegen.
          const synced = syncManifestScreens(
            syncManifestScenes(bundle.project, bundle.scenes),
            bundle.screens,
          );
          if (JSON.stringify(synced) !== JSON.stringify(bundle.project)) {
            set(
              produce((s: ProjectState) => {
                if (!s.bundle) return;
                s.bundle.project = synced;
                markDirty(s, PROJECT_FILE);
              }),
            );
          }

          await persistDirty(storage, get().bundle as SpecBundle, get().dirty);

          set({ status: 'generating' });
          const result = generate(get().bundle as SpecBundle);
          await storage.writeGenerated(result.files);

          set({
            dirty: new Set(),
            status: 'idle',
            lastGenerated: { written: result.files.length, unchanged: 0 },
          });
        } catch (err) {
          set({
            status: 'error',
            errorMessage: err instanceof Error ? err.message : String(err),
          });
        }
      },
    }),
    {
      partialize: partializeTemporal,
      // Limit history to keep memory bounded on big projects.
      limit: 100,
      // Don't bother recording mouse-driven selection changes alone.
      equality: (a, b) =>
        a.bundle === b.bundle &&
        a.activeSceneId === b.activeSceneId &&
        a.selectedNodeIds === b.selectedNodeIds &&
        a.selectedEdgeIds === b.selectedEdgeIds,
    },
  ),
) as UseBoundStore<StoreApi<ProjectState> & { temporal: StoreApi<TemporalState<TemporalSlice>> }>;

function activeScene(state: ProjectState): SceneSpec | undefined {
  if (!state.bundle || !state.activeSceneId) return undefined;
  return findScene(state.bundle, state.activeSceneId);
}

async function persistDirty(
  storage: ProjectStorage,
  bundle: SpecBundle,
  dirty: Set<string>,
): Promise<void> {
  for (const file of dirty) {
    if (file === PROJECT_FILE) {
      await storage.writeSpec(file, jsonString(bundle.project));
    } else if (file === CHARACTERS_FILE) {
      await storage.writeSpec(file, jsonString(bundle.characters));
    } else if (file === VARIABLES_FILE) {
      await storage.writeSpec(file, jsonString(bundle.variables));
    } else if (file === ASSETS_FILE) {
      await storage.writeSpec(file, jsonString(bundle.assets));
    } else if (file.startsWith(SCENE_FILE_PREFIX)) {
      const label = file.slice(SCENE_FILE_PREFIX.length, -'.json'.length);
      const scene = bundle.scenes.find((s) => s.label === label);
      if (scene) await storage.writeSpec(file, jsonString(scene));
    } else if (file.startsWith(SCREEN_FILE_PREFIX)) {
      const name = file.slice(SCREEN_FILE_PREFIX.length, -'.json'.length);
      const screen = bundle.screens.find((sc) => sc.name === name);
      if (screen) await storage.writeSpec(file, jsonString(screen));
      // If we don't find the screen, the user removed/renamed it; skip
      // writing. Stale on-disk files are pruned in M8 polish.
    }
  }
}

function sceneFromSpecPath(scenes: SceneSpec[], sourcePath: string): SceneSpec | undefined {
  if (!sourcePath.startsWith(SCENE_FILE_PREFIX)) return undefined;
  const label = sourcePath.slice(SCENE_FILE_PREFIX.length, -'.json'.length);
  return scenes.find((s) => s.label === label);
}

function inferSubkind(ref: string, kind: AssetKind): AssetSubkind | undefined {
  if (kind === 'image') {
    if (/\/(bg|backgrounds?)\//i.test(ref)) return 'background';
    if (/\/(ui|gui)\//i.test(ref)) return 'ui';
    return 'sprite';
  }
  if (kind === 'audio') {
    if (/\/music\//i.test(ref)) return 'music';
    if (/\/voice\//i.test(ref)) return 'voice';
    if (/\/(sfx|sounds?)\//i.test(ref)) return 'sfx';
    return undefined;
  }
  return undefined;
}

function jsonString(v: unknown): string {
  return `${JSON.stringify(v, null, 2)}\n`;
}

// ---------- Selectors ----------

/** Returns the active scene; recomputes only when the bundle or id change. */
export function selectActiveScene(state: ProjectState): SceneSpec | undefined {
  if (!state.bundle || !state.activeSceneId) return undefined;
  return state.bundle.scenes.find((s) => s.id === state.activeSceneId);
}

export function selectActiveNode(state: ProjectState): SceneNode | undefined {
  const scene = selectActiveScene(state);
  if (!scene) return undefined;
  const id = state.selectedNodeIds[0];
  if (!id) return undefined;
  return scene.nodes.find((n) => n.id === id);
}

// ---------- Public helpers ----------

/** Generate a fresh entity id. Re-exported so call sites don't import ids.ts directly. */
export const newEntityId = newId;
