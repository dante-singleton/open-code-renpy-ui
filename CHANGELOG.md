# Changelog

All notable changes to Open-Code-RenPy-UI are tracked here. The format
follows [Keep a Changelog](https://keepachangelog.com/) and this project
adheres to [Semantic Versioning](https://semver.org/).

## 1.0.0 — 2026-05-07

The first stable release. Closes the loop on every milestone in the
original roadmap (M0 through M8).

### Licensing
- Licensed under [Apache-2.0](./LICENSE). Each workspace `package.json`
  and the Tauri Cargo manifest declare it explicitly. NOTICE file
  added at the repo root.

### Versioning
- All workspace packages, the Tauri config, and the Rust crate moved
  from `1.0.0-rc.1` to `1.0.0`.
- The `private` workspace packages (everything except a future
  publish-eligible CLI) are kept private; the version field is bumped
  uniformly so releases line up.

## 1.0.0-rc.1 — M8: Polish & 1.0

### Performance
- Code-split every workspace tab. Initial JS bundle is now ~85 KB
  gzipped (down from ~152 KB); `@xyflow/react` (Canvas) and the preview
  runtime are loaded on demand.

### UI / UX
- Added a first-run welcome dialog explaining the panels and the `/`
  shortcut; dismissal persists in localStorage.
- Added a keyboard-shortcuts help overlay bound to `?`.
- Added a render-error boundary at the app root so render exceptions
  show a diagnostic panel instead of a blank screen.

### Distribution
- Tauri config bumped to `1.0.0-rc.1` with proper bundle metadata
  (productName, identifier, copyright, publisher) and a strict
  production CSP that allows the asset protocol.
- Linux AppImage and Windows NSIS bundle settings configured.
- Verified `pnpm tauri:build` produces working `.deb` (3.9 MB), `.rpm`
  (3.9 MB), and `.AppImage` (111 MB) on Linux. `NO_STRIP=true` baked
  into the script to work around a `linuxdeploy` × modern-binutils
  incompatibility on rolling-release distros.

### Documentation
- New `docs/getting-started.md`, `docs/spec-reference.md`,
  `docs/codegen-reference.md`.
- README rewritten to reflect the shipped product instead of the
  original planning placeholder.
- CONTRIBUTING.md updated with the toolchain, test matrix, and the
  stable-Zustand-selector convention learned from the M6 blank-screen
  incident.

## M7 — Screens & GUI

### Added
- `packages/codegen/src/emitters/screens.ts`: emit Ren'Py screen
  language for `say` / `choice` / `mainMenu` templates plus a `custom`
  passthrough.
- Validator rules: `UNKNOWN_SCREEN`, `DUPLICATE_SCREEN_NAME`; screen
  widgets contribute to `UNINDEXED_ASSET`.
- New `Screens` workspace tab with a master/detail editor, slot picker,
  and a widget tree editor.
- `fixtures/demo-screens/` exercising every template type (auto-picked
  up by the byte-equality test).

## M6 — Preview

### Added
- `@renpy-ui/preview`: pure playback state machine with a
  conservative Python expression evaluator.
- `ScenePreview` React bindings: layered stage, sprite layer, say /
  narration / menu overlay, playback controls, "approximate" badge.
- New `Preview` workspace tab; Canvas ↔ Preview cross-navigation
  (selecting a node jumps the preview; clicking a sprite reveals the
  current node back on the canvas).

### Fixed
- Stable empty selectors module (`apps/desktop/src/state/empty.ts`)
  prevents an infinite re-render loop introduced by inline-fallback
  literals in `useShallow` selectors.

## M5 — Assets & validation

### Added
- Validator rules: `UNINDEXED_ASSET`, `MISSING_ASSET_FILE`,
  `STALE_ASSET_HASH`, `CALL_CYCLE`.
- Env-aware `validateBundleWithEnv` runs both pure and I/O-aware rules.
- Tauri commands: `asset_check_exists`, `asset_hash_files`,
  `watch_start`, `watch_stop` (notify + notify-debouncer-mini).
- File watcher reloads the project on external spec changes when no
  buffers are dirty.
- Quick-fix catalog (`quickFixesFor`) and Problems panel actions
  ("Reveal", "Remove node", "Remove asset entry").
- CLI `lint-spec` runs the env-aware validator; exits 1 on errors.

## M4 — Logic & systems

### Added
- Codegen for `if` / `elif` / `else`, `setVar`, `increment`,
  `python`, `inventoryOp`, `statOp`, `relationshipOp`.
- Validator rules: `UNREACHABLE_NODE`, `TRIVIAL_IF`,
  `UNKNOWN_CHARACTER`.
- Expression Builder component with guided + custom modes.
- Edge labels for menu choices and if branches on the canvas.
- Problems panel and CodeLens panel.
- `fixtures/demo-stats/`.

## M3 — Stage & audio

### Added
- Codegen for `sceneBg`, `show`, `hide`, `transition`, audio nodes.
- Characters / Variables / Assets workspace tabs.
- `AssetPicker` reused across asset-referencing inspector fields.
- Tauri `asset_import` command with SHA-256 hashing and per-kind
  destination paths.
- Workspace tabs (top of canvas).
- `fixtures/demo-cafe/`.

## M2 — Canvas MVP

### Added
- Storage abstraction: Tauri (FS) and in-memory (browser fallback).
- Zustand store with zundo undo/redo, Immer mutations, dirty tracking.
- 30 custom React Flow node components with category-coloured chrome.
- Inspector for every node type.
- Quick-insert palette (`/` shortcut), Cmd-Z / Cmd-S / Cmd-Y bindings.
- Tauri Rust commands: `project_open`, `project_create`, `spec_*`,
  `generated_write`.

## M1 — Spec & codegen core

### Added
- `@renpy-ui/spec`: Zod schemas for every spec document and node.
- `@renpy-ui/codegen`: deterministic spec → `.rpy` emitter with the
  DAG → Ren'Py block algorithm.
- `@renpy-ui/validators`: 7 initial semantic rules.
- `apps/cli`: `renpy-ui generate` and `renpy-ui lint`.
- `fixtures/hello-world/` with byte-equality regression tests.
- JSON Schema export via `pnpm schemas`.

## M0 — Foundations

### Added
- pnpm workspace + Turborepo monorepo.
- Tauri 2 + React 18 + Vite + TS scaffold.
- Tailwind wired to the design tokens (orange + purple on dark).
- `@renpy-ui/ui` primitives.
- Biome lint + format, GitHub Actions CI, themed empty app shell.
