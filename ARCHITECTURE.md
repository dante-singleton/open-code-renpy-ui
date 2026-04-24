# ARCHITECTURE — Open-Code-RenPy-UI

## 1. Monorepo layout

```
Open-Code-RenPy-UI/
├── apps/
│   └── desktop/                # Tauri shell + React UI entry
│       ├── src-tauri/          # Rust (Tauri commands: fs access, SDK invoke)
│       └── src/                # React app root, routing, panels
├── packages/
│   ├── spec/                   # Zod schemas + TS types + migrations
│   ├── codegen/                # spec -> .rpy emitter (pure TS, no DOM deps)
│   ├── parser/                 # (later) .rpy -> spec for round-trip
│   ├── preview/                # HTML scene renderer (framework-agnostic core + React bindings)
│   ├── ui/                     # shared React components, design tokens
│   ├── graph/                  # React Flow node types, edge types, layout helpers
│   └── validators/             # referential-integrity + static analysis
├── schemas/                    # JSON Schemas generated from packages/spec
├── fixtures/                   # sample projects for tests + demos
├── docs/                       # rendered guides, images for README
└── .github/workflows/          # CI: typecheck, test, snapshot, build
```

Tooling: **pnpm workspaces**, **Turborepo** (or Nx) for caching, **Changesets**
for package versioning, **Biome** (or ESLint+Prettier) for lint/format.

---

## 2. Runtime architecture

```
┌─────────────────────────────── Tauri window ───────────────────────────────┐
│                                                                            │
│  React UI (renderer)                                                       │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │ App shell: Sidebar | Canvas | Inspector | Preview | Problems         │  │
│  │                                                                      │  │
│  │   Canvas  <──── Zustand store (graph + selection) ──── Inspector     │  │
│  │     │                   │                                            │  │
│  │     │                   ▼                                            │  │
│  │     │            packages/spec (Zod)                                 │  │
│  │     │                   │                                            │  │
│  │     │                   ▼                                            │  │
│  │     │            packages/validators  ──► Problems panel             │  │
│  │     │                   │                                            │  │
│  │     ▼                   ▼                                            │  │
│  │  React Flow      packages/codegen ──► .rpy text                      │  │
│  │                           │                                          │  │
│  │                           ▼                                          │  │
│  │                   Tauri IPC (invoke)                                 │  │
│  └──────────────┬───────────────────────────────────────────────────────┘  │
│                 │                                                          │
│  Rust core (main)                                                          │
│  ┌──────────────▼───────────────────────────────────────────────────────┐  │
│  │ FS plugin: read/write spec + generated .rpy (scoped to project dir)  │  │
│  │ Watcher: notify UI of external changes                               │  │
│  │ SDK invoker (optional): launch `renpy.sh <project> run`              │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. State management

- **Zustand store** (`apps/desktop/src/state/project.ts`) holds:
  - `project` (ProjectManifest), `characters`, `variables`, `assets`
  - `scenes: Record<SceneId, SceneSpec>` (loaded lazily)
  - `activeSceneId`, `selection` (nodeIds[], edgeIds[])
  - `dirty` set, undo/redo stacks (via zundo middleware)
- Mutations go through **typed actions** that:
  1. Produce the next immutable state via Immer.
  2. Validate the affected document with Zod.
  3. Push an undo entry.
  4. Mark the document dirty; a debounced saver writes to disk.
- React Flow is a **view** over the active scene: its `nodes`/`edges` arrays are
  derived (`useMemo`) from the store; user interactions dispatch actions back.

### Undo/redo

- Scope: per-scene graph edits + inspector field edits.
- Out of scope: file-level operations (rename, delete scene) — those prompt
  confirmation and are not undoable in v1.

---

## 4. Persistence & file sync

- On project open, the Rust side mounts the project directory with a scoped
  FS permission. The UI only ever sends **relative paths**.
- Saves are **debounced per document** (default 400 ms after last edit) and
  written atomically (`write temp → rename`).
- A **file watcher** in Rust emits `spec-changed` events. The UI reloads the
  affected document unless it is locally dirty (in which case it surfaces a
  merge prompt — v1: "keep mine" / "reload theirs"; proper 3-way merge later).
- The editor writes a `.renpy-ui.lock` file on open and removes it on close;
  subsequent opens warn the user.

---

## 5. Codegen pipeline

`packages/codegen` is a pure function library. Input: validated spec objects.
Output: a map `{ "game/generated/<file>.rpy": "<text>" }`.

### Stages

1. **Load & validate** — Zod-parse every spec document; abort on errors.
2. **Build symbol table** — collect characters, variables, labels, screens,
   assets. Resolve cross-document references to stable handles.
3. **Plan files** — decide which `.rpy` files are produced (one per scene, plus
   `characters.rpy`, `variables.rpy`, `screens/*.rpy`, `_manifest.rpy`).
4. **Emit per file**:
   - Scene emitter walks the graph from the `StartNode` using a
     control-flow-aware traversal that produces Ren'Py's block-structured
     output (not a flat list). See §5.1.
   - Character emitter writes `define alice = Character("Alice", color="#...")`
     plus `image alice happy = "images/alice/happy.png"` lines.
   - Variable emitter writes `default <name> = <default>` (or
     `default persistent.<name> = ...`).
   - Screen emitter converts `ScreenSpec` widgets to Ren'Py screen language.
5. **Format & write** — deterministic formatter (stable key order, 4-space
   indent), then atomic write. Files that didn't change are skipped (content
   hash compared) to keep mtimes stable for Ren'Py's cache.

### 5.1 Scene graph → Ren'Py blocks

Ren'Py code is block-structured; our graph is a DAG with branches. The emitter
converts one into the other using this algorithm:

```
emitLabel(entryNode):
    1. Compute dominator tree from entryNode.
    2. Walk nodes in topological order.
    3. At a branching node (menu / if):
         - For each branch, recursively emit the subgraph dominated by that branch
           as an indented block.
         - The first node that post-dominates all branches becomes the
           "continuation" and is emitted after the branch at the parent indent.
    4. Back-edges (loops) that reach a Label become `jump <label>`.
    5. Any node reachable only via `jump` from elsewhere is emitted as its own
       `label`.
```

This keeps simple linear scenes as flat `label:` blocks, and only introduces
synthetic labels when graph structure demands them (e.g., when two branches
re-merge and the continuation has multiple predecessors outside the menu).

### 5.2 Determinism

- Node iteration order is `(y, x, id)` — visually top-left first, id as tiebreak.
- Dictionaries serialized with sorted keys.
- Generated files start with a header:

  ```renpy
  # ==========================================================================
  #  GENERATED by Open-Code-RenPy-UI. DO NOT EDIT.
  #  Source: .renpy-ui/scenes/chapter1_intro.json
  #  Spec version: 1.0.0
  # ==========================================================================
  ```

### 5.3 Snapshot testing

`fixtures/` contains paired `<name>/spec/` and `<name>/expected/` directories.
CI runs the emitter and asserts byte-for-byte equality. Adding a feature adds a
fixture; changing output requires an explicit snapshot update PR.

---

## 6. Validation (`packages/validators`)

Two tiers:

1. **Schema validation** — Zod, runs on every edit. Cheap.
2. **Semantic validation** — cross-document, runs on save and pre-generate:
   - Missing asset files on disk.
   - Dangling jumps / unknown labels.
   - Unreachable nodes, unreachable choices.
   - Duplicate labels / character var names.
   - Variables referenced but never defaulted.
   - Reserved identifier collisions.

Results feed the **Problems panel** with severity (`error | warning | info`),
location (document + nodeId), and quick-fix actions where applicable
(e.g., "create label 'foo'", "remove dangling edge").

---

## 7. Preview (`packages/preview`)

A small state machine that takes a scene spec + character/asset catalogs and
simulates playback in HTML:

- **Layers**: background, sprites (by tag + zorder), CG, UI overlay.
- **Playback controls**: step, play, pause, reset, jump-to-node.
- **Fidelity caveats**: we approximate transitions with CSS; Python blocks and
  `PythonBlockNode` are ignored (or mocked via user-provided stubs in
  `.renpy-ui/preview-mocks.js`). The preview always shows a badge: "approximate".
- Exposed as framework-agnostic core + thin React bindings so it can later
  power a web-only demo.

---

## 8. Canvas (`packages/graph`)

- Custom node components per node `type`, registered with React Flow via
  `nodeTypes`.
- Custom edge components: default for linear flow; labeled edges for
  `menu`/`if` branches (emit a pill with the choice/condition summary).
- Keyboard: `Del`, `Ctrl/Cmd+Z/Y`, `Tab` (cycle handles), `F` (focus node),
  `/` (quick-insert), `G` (group selection into sub-label).
- **Auto-layout**: Dagre (left-to-right) available on demand (button in toolbar
  and on first creation of a scene from template).
- **Performance**: virtualized rendering via React Flow's built-in culling;
  selectors memoized; edges recomputed only on structural changes.

---

## 9. Tauri commands (IPC surface)

```rust
// src-tauri/src/commands.rs  (sketch)
#[tauri::command] async fn project_open(path: String) -> Result<ProjectManifest>;
#[tauri::command] async fn project_create(path: String, template: String) -> Result<ProjectManifest>;
#[tauri::command] async fn spec_read(relPath: String) -> Result<String>;      // JSON text
#[tauri::command] async fn spec_write(relPath: String, contents: String) -> Result<()>;
#[tauri::command] async fn generated_write(files: Vec<(String, String)>) -> Result<()>;
#[tauri::command] async fn asset_import(srcAbsPath: String, destRel: String) -> Result<AssetMeta>;
#[tauri::command] async fn renpy_launch(sdkPath: String) -> Result<()>;        // optional
#[tauri::command] async fn watch_start() -> Result<()>;                        // emits events
```

All paths are validated against the mounted project root — attempts to escape
are rejected.

---

## 10. Testing strategy

| Layer            | Tooling                    | What we test                                   |
|------------------|----------------------------|------------------------------------------------|
| `packages/spec`  | Vitest                     | Schemas accept/reject, migrations round-trip   |
| `packages/codegen` | Vitest + snapshot fixtures | Deterministic `.rpy` output per fixture       |
| `packages/validators` | Vitest                 | Diagnostics for every rule                     |
| `packages/graph` | Vitest + React Testing Lib | Node render, handle wiring, keyboard shortcuts |
| App shell        | Playwright (Tauri driver)  | Open project, create scene, save, regenerate   |
| Perf             | Vitest bench + Playwright  | 500-node scene interactions stay > 60 fps      |

CI matrix: Linux + Windows + macOS, Node LTS, Rust stable.

---

## 11. Security & safety

- Filesystem access is **scoped to the opened project directory**.
- `PythonBlockNode` contents are never executed by the editor; they are only
  written to generated `.rpy`. Preview ignores them (or uses user-supplied
  mocks loaded in a sandboxed worker).
- Asset imports validate MIME + extension; oversized files warn.
- No network calls by default; telemetry (if ever added) is opt-in.
