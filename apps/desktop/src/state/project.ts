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
  Variable,
} from '@renpy-ui/spec';
import { type Diagnostic, hasErrors, validateBundle } from '@renpy-ui/validators';
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

  upsertAsset(asset: Asset): void;
  removeAsset(assetId: string): void;
  importAssets(opts: { kindHint?: AssetKind; subkind?: AssetSubkind }): Promise<Asset[]>;

  /** Save dirty spec docs. Triggers codegen on success. */
  save(): Promise<void>;
  /** Run validators only (no save). */
  validate(): void;
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
const PROJECT_FILE = '.renpy-ui/project.json';
const CHARACTERS_FILE = '.renpy-ui/characters.json';
const VARIABLES_FILE = '.renpy-ui/variables.json';
const ASSETS_FILE = '.renpy-ui/assets.json';

function sceneFile(label: string): string {
  return `${SCENE_FILE_PREFIX}${label}.json`;
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
            status: 'idle',
            diagnostics: validateBundle(bundle),
          });
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
            s.diagnostics = s.bundle ? validateBundle(s.bundle) : [];
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
            s.diagnostics = s.bundle ? validateBundle(s.bundle) : [];
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
            s.diagnostics = s.bundle ? validateBundle(s.bundle) : [];
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
            s.diagnostics = s.bundle ? validateBundle(s.bundle) : [];
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
            s.diagnostics = s.bundle ? validateBundle(s.bundle) : [];
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
            s.diagnostics = validateBundle(s.bundle);
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
            s.diagnostics = validateBundle(s.bundle);
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
            s.diagnostics = validateBundle(s.bundle);
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
            s.diagnostics = validateBundle(s.bundle);
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
            s.diagnostics = validateBundle(s.bundle);
          }),
        );
      },

      removeAsset(assetId) {
        set(
          produce((s: ProjectState) => {
            if (!s.bundle) return;
            s.bundle.assets.assets = s.bundle.assets.assets.filter((a) => a.id !== assetId);
            markDirty(s, ASSETS_FILE);
            s.diagnostics = validateBundle(s.bundle);
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
        return assets;
      },

      validate() {
        const bundle = get().bundle;
        if (!bundle) return;
        set({ diagnostics: validateBundle(bundle) });
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
          // Make sure the project manifest's `scenes[]` matches reality.
          const synced = syncManifestScenes(bundle.project, bundle.scenes);
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
    }
  }
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
