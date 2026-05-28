# Getting started

This guide walks you from an empty checkout to a playable visual-novel scene
in about ten minutes.

## Prerequisites

- **Node.js** ≥ 20
- **pnpm** ≥ 9
- **Rust** stable (`rustup default stable`) — only if you want the Tauri shell
- **Tauri Linux prereqs** — see <https://v2.tauri.app/start/prerequisites/>;
  the browser-only preview (`pnpm dev`) needs none of them.

## Install

```bash
pnpm install
```

Workspace dependencies for the eight packages are installed in one shot.

## Run

```bash
pnpm dev
```

That opens the editor at <http://localhost:1420/> with a small in-memory
project pre-seeded so you can click around immediately. Any change you make
stays in memory; saving runs validation + codegen but the output is held in
memory too.

For real persistence you need the desktop shell:

```bash
pnpm tauri:dev
```

The first launch shows a folder picker. Select an empty directory; the
editor scaffolds `.renpy-ui/` (the spec) and starts writing
`game/generated/*.rpy` on every save.

## A 10-minute tour

The editor has six tabs. Press `?` at any time for the keyboard cheat sheet.

1. **Characters** — click `+ New`, name a character (e.g. `alice`), pick a
   color, and add a `happy` expression pointing at a sprite asset (which you
   can import on the **Assets** tab — see step 3).
2. **Variables** — declare anything your scenes will reference. For this
   tour, add an `int` named `love_points` defaulting to `0`.
3. **Assets** — `Import images…` brings up the OS file picker (Tauri only;
   in `pnpm dev` you'll see "requires desktop build"). Files are copied
   into `game/images/…` and indexed automatically. Drop a sprite for Alice
   and a background.
4. **Canvas** — switch to the seeded scene in the left sidebar, press `/`
   and pick **SceneBg** to drop a node. Connect the Start node's right
   handle to it (drag from one to the other). Continue with **PlayMusic**,
   **Show**, **Say**, **Menu**, etc. The right panel edits the selected
   node; the Problems panel surfaces validation errors live, and the
   bottom-right CodeLens shows the `.rpy` your graph would emit.
5. **Preview** — step through the scene without launching Ren'Py. Click a
   sprite to reveal the responsible node back on the Canvas; click a node
   on the Canvas first to jump the preview to that point.
6. **Screens** — visually edit Ren'Py's `say`, `choice`, and `mainMenu`
   screens, or drop into a free-form **Custom** template. The widget tree
   editor on the right is where you compose `frame` / `vbox` / `hbox` /
   `text` / `image` / `button` / `bar` widgets.

## Saving and codegen

Press <kbd>Cmd</kbd>/<kbd>Ctrl</kbd>+<kbd>S</kbd> (or click **Save**) to:

1. Run every validator, including the env-aware "asset exists on disk" check.
2. If there are no errors: persist every dirty spec document under
   `.renpy-ui/`, then write the generated `.rpy` files under
   `game/generated/`.
3. If there are errors: still persist the spec docs (so user work is never
   lost), but skip codegen until the issues are resolved. The Problems
   panel lists each one with click-to-jump and quick-fix actions where
   available.

## Building a release

```bash
pnpm tauri:build
```

Outputs platform-specific bundles into `apps/desktop/src-tauri/target/release/`:

- Linux: `.AppImage` and `.deb`
- macOS: `.app` and `.dmg`
- Windows: `.msi` and NSIS `.exe`

The `Open-Code-RenPy-UI` icon, identifier (`ai.opencode.renpy-ui`), and
metadata come from `apps/desktop/src-tauri/tauri.conf.json`.

## Where to next?

- [`spec-reference.md`](./spec-reference.md) — every JSON document type and
  node kind, with example payloads.
- [`codegen-reference.md`](./codegen-reference.md) — what each node emits;
  rules for deterministic output; how to add a fixture.
- [`../ARCHITECTURE.md`](../ARCHITECTURE.md) — runtime, state management,
  codegen pipeline, and Tauri IPC.
