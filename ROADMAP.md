# ROADMAP — Open-Code-RenPy-UI

Each milestone has an **Exit criterion** — a concrete, demonstrable capability.
Milestones ship independently and are expected to take 1–3 weeks of focused work.

---

## M0 — Foundations

**Goal:** every contributor can clone, build, and run a "hello window".

- Init pnpm workspace + Turborepo
- Scaffold `apps/desktop` (Tauri 2 + React 18 + Vite + TS)
- Install Tailwind and wire up the design tokens from `design-tokens.md`
- Add `packages/ui` with a handful of primitives (Button, Panel, IconButton, Input, Select)
- Add Biome + strict TS config + basic GitHub Actions (typecheck, lint, test)
- Empty app shell: topbar, left sidebar, center canvas placeholder, right inspector placeholder

**Exit criterion:** `pnpm dev` launches a themed empty Tauri window on Linux, macOS, and Windows.

---

## M1 — Spec & codegen core

**Goal:** a headless pipeline that turns a spec directory into `.rpy` files.

- `packages/spec`: Zod schemas for every document in `SPEC.md`, TS types, migration runner.
- `packages/codegen`: emitters for characters, variables, and a minimal scene (start → say → end).
- `packages/validators`: schema validation + the first five semantic rules.
- JSON Schema export from Zod via `zod-to-json-schema` into `schemas/`.
- `fixtures/hello-world/` with spec and expected `.rpy`; snapshot tests in CI.
- CLI entry `pnpm generate <project>` that runs the pipeline against a folder.

**Exit criterion:** `pnpm generate fixtures/hello-world` produces byte-identical
output to `fixtures/hello-world/expected/` and Ren'Py SDK runs the generated project.

---

## M2 — Canvas MVP

**Goal:** create and connect the core narrative nodes on the canvas, save the spec.

- `packages/graph`: React Flow setup with custom node components for
  `start`, `end`, `label`, `jump`, `say`, `menu`, `narration`, `pause`.
- Zustand store + undo/redo; Inspector panel binds to the selected node.
- Project open/create flow through Tauri FS; auto-save debounced writes.
- Codegen runs on save; writes to `game/generated/`.
- Quick-insert palette (`/`), keyboard shortcuts, auto-layout button.

**Exit criterion:** a user can open an empty folder, create a scene, wire
`start → say → menu → (end, end)`, save, and the resulting `.rpy` runs in Ren'Py
showing the dialogue and a 2-choice menu.

---

## M3 — Stage & audio

**Goal:** full presentational control over a scene.

- Node types: `sceneBg`, `show`, `hide`, `transition`, `camera`, and all audio nodes.
- Characters panel: add/edit `Character` entries with expressions & poses.
- Asset picker widget used by every asset-referencing node.
- Codegen + fixtures for `scene`/`show`/`hide`/`play music`/`play sound`.

**Exit criterion:** a new 3-scene demo project (`fixtures/demo-cafe/`) renders a
background, shows Alice with two expressions across a conversation, plays music,
plays an SFX, and transitions between scenes — all authored entirely in the UI.

---

## M4 — Logic & systems

**Goal:** branching beyond menus.

- Nodes: `if`, `setVar`, `increment`, `python`, `inventoryOp`, `statOp`, `relationshipOp`.
- Variables panel with typed editors and default-value validation.
- Expression builder component (reused by `if`, conditional choices, `setVar`).
- Codegen handles `if/elif/else` emission from the `IfNode` branch list.
- Semantic validator: dead branches, unused variables, reserved identifiers.

**Exit criterion:** authoring a scene where a choice increments a relationship
stat and a later scene gates a branch with `if love_points >= 3:` works end-to-end.

---

## M5 — Assets & validation

**Goal:** make broken projects impossible to ship.

- Assets panel: drag-import, preview, tag, remove; writes `assets.json`.
- File watcher surfaces external asset changes; hash-based stale detection.
- Problems panel with severity, jump-to-node, and quick fixes.
- Pre-save and pre-generate gates; CI linter `pnpm lint-spec <project>`.

**Exit criterion:** deleting an asset file surfaces an error in the Problems
panel within 1 s and prevents codegen until resolved; `pnpm lint-spec` fails CI.

---

## M6 — Preview

**Goal:** iterate on a scene without launching the Ren'Py SDK.

- `packages/preview`: HTML renderer with layers, sprite tags, zorder, transitions.
- Playback controls (step / play / pause / reset / jump-to-node).
- Click a node → preview jumps to that state.
- Optional: "Launch in Ren'Py" button that invokes the SDK via Tauri (if path configured).

**Exit criterion:** stepping through the demo project in the preview matches the
Ren'Py build for dialogue order, character expressions, and background changes.

---

## M7 — Screens & GUI

**Goal:** visual editing of Ren'Py screens.

- Template editors for `say`, `choice`, and `mainMenu` screens.
- Widget tree editor with live preview.
- Codegen emits valid Ren'Py screen language for each template.
- "Custom" template that keeps a raw screen block under user control.

**Exit criterion:** user can restyle the say screen (text color, frame bg, name
box position) from the UI and see the change in preview and in a Ren'Py build.

---

## M8 — Polish & 1.0

- Onboarding tour, example projects, template picker on new-project.
- Packaged installers (NSIS / DMG / AppImage); auto-update via Tauri updater.
- Docs site (Astro or Docusaurus) with guides, spec reference, codegen reference.
- Accessibility pass (keyboard nav, focus rings, screen-reader labels).
- Performance budget: 500-node scene keeps interactions > 60 fps on a 2020 laptop.

**Exit criterion:** tagged `v1.0.0`, published installers, published docs site,
and a 20-minute tutorial video that walks a newcomer to a playable VN.

---

## Post-1.0 candidates

- Round-trip import of existing `.rpy` projects (`packages/parser`).
- Collaboration: CRDT-based multi-user editing on the spec.
- Localization editor (per-locale string tables for `say` nodes).
- Plugin API for custom node types.
- Web-only build for read-only preview of shared projects.
- AI-assisted dialogue draft / branch suggestions (opt-in, local models first).
