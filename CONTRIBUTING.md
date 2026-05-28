# Contributing

Open-Code-RenPy-UI is **1.0.0**, licensed under Apache-2.0. Issues, design
feedback, and PRs are all welcome. This document covers the toolchain, the
test matrix, and the conventions PRs are expected to follow.

## Prerequisites

- **Node.js** ≥ 20
- **pnpm** ≥ 9
- **Rust** stable (`rustup default stable`) — only needed for the Tauri shell
- **Tauri Linux prereqs** — see <https://v2.tauri.app/start/prerequisites/>.
  On Debian/Ubuntu this is roughly:

  ```bash
  sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file \
    libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev
  ```

  On Arch / Manjaro for `tauri:dev`:

  ```bash
  sudo pacman -S --needed webkit2gtk-4.1 base-devel curl wget file \
    xdotool openssl libayatana-appindicator librsvg
  ```

  Additionally, **for `tauri:build`** (producing `.deb` / `.rpm` / `.AppImage`):

  ```bash
  sudo pacman -S --needed squashfs-tools dpkg
  ```

  Note: on rolling-release distros (Arch, Fedora 40+) the `linuxdeploy`
  binary that Tauri downloads ships an older `strip` that fails on
  libraries built with modern binutils' `.relr.dyn` relocations. The
  `tauri:build` script in `apps/desktop/package.json` sets `NO_STRIP=true`
  to bypass this. The compiled AppImage is the same size either way.

The browser-only preview (`pnpm dev`) needs none of the Tauri prereqs.

## Common commands

```bash
pnpm install              # install workspace deps
pnpm dev                  # Vite dev server (web only, http://localhost:1420)
pnpm tauri:dev            # Tauri dev shell (requires system deps above)
pnpm typecheck            # tsc --noEmit across every package
pnpm lint                 # Biome check
pnpm lint:fix             # Biome auto-fix + format
pnpm test                 # Vitest across every package
pnpm --filter @renpy-ui/desktop build   # production web bundle
pnpm --filter @renpy-ui/desktop tauri:build   # platform installers

# CLI sanity checks
pnpm generate fixtures/demo-cafe/spec
pnpm lint-spec fixtures/demo-cafe/spec
pnpm schemas              # emit JSON Schemas to schemas/
```

## Monorepo layout

| Package                     | Role                                                     |
|-----------------------------|----------------------------------------------------------|
| `apps/desktop/`             | Tauri 2 + React shell (the app users run)                |
| `apps/cli/`                 | `renpy-ui` CLI (CI-friendly generate / lint)             |
| `packages/spec/`            | Zod schemas + TS types for the spec                      |
| `packages/codegen/`         | Deterministic spec → `.rpy` emitter                      |
| `packages/validators/`      | Pure + env-aware semantic checks + quick-fix catalog     |
| `packages/preview/`         | Pure playback machine + React `ScenePreview` bindings    |
| `packages/graph/`           | React Flow node/edge primitives                          |
| `packages/ui/`              | Shared React primitives + design tokens                  |
| `fixtures/<name>/`          | Spec + expected `.rpy` for byte-equality regression tests |

See `ARCHITECTURE.md` for the runtime, codegen, and Tauri IPC details.

## Code style

- **Biome** enforces formatting and lint (`pnpm lint`).
- Single quotes in JS/TS, double quotes in JSX attributes, trailing commas,
  100-col line width.
- Strict TypeScript: no implicit `any`, unused locals are errors.
- Prefer `import type { Foo }` for type-only imports.
- Comments explain *why*, not *what*. Reach for them when an invariant
  isn't obvious from the code (e.g. why a selector falls back to a frozen
  module-scope constant).

### Stable Zustand selectors

The store is consumed via Zustand's `useShallow`. Returning a **fresh
object literal** (e.g. `?? []` or `.map(...)`) on every selector call
breaks `useSyncExternalStore`'s snapshot caching and triggers an infinite
render loop with a blank screen. Two patterns to use instead:

```ts
// ❌ Returns a new [] each call when bundle is null.
useShallow((s) => s.bundle?.scenes ?? [])

// ✅ Module-scope frozen empty (see apps/desktop/src/state/empty.ts).
useShallow((s) => s.bundle?.scenes ?? EMPTY_SCENES)

// ❌ .map / .filter inside the selector creates a new array every call.
useShallow((s) => s.bundle?.variables.variables.map((v) => v.name) ?? [])

// ✅ Stable read + useMemo for derivation.
const raw = useProjectStore((s) => s.bundle?.variables.variables);
const names = useMemo(() => (raw ?? []).map((v) => v.name), [raw]);
```

The whole app is wrapped in an `<ErrorBoundary>` that surfaces render
errors in-page, so blank-screen incidents are diagnosable.

## Tests

Vitest in every package. Run a single package with:

```bash
pnpm --filter @renpy-ui/codegen test
```

| Surface                   | What's covered                                       |
|---------------------------|------------------------------------------------------|
| `packages/spec`           | Schema validation, primitives, migrations            |
| `packages/codegen`        | Render utils, per-node emitters, fixtures (byte eq.) |
| `packages/validators`     | Each rule individually + the env-aware aggregator    |
| `packages/preview`        | Expression evaluator + playback machine              |
| `apps/desktop`            | Store actions, asset env, quick-fix mutations        |

A **fixture** under `fixtures/<name>/` with `spec/` and `expected/`
subdirectories is auto-discovered and asserted byte-equal by CI. Add one
whenever you change the emitter — see [`docs/codegen-reference.md`](./docs/codegen-reference.md).

## Commits & PRs

- Conventional prefixes are encouraged but not enforced: `feat:`, `fix:`,
  `docs:`, `chore:`, `refactor:`, `test:`.
- Keep changes scoped per package; prefer small PRs touching ≤ 2 packages.
- Spec or codegen changes must ship with a new or updated fixture.
- New rules, node types, or widgets must come with at least one test.
- The CI matrix (Linux / macOS / Windows × Node LTS × Rust stable) must be
  green before merge. `pnpm typecheck && pnpm test && pnpm lint &&
  pnpm --filter @renpy-ui/desktop build` reproduces it locally.

## Releasing

Tags follow semver. `1.0.0` is the first stable cut. Each release bumps:

1. Every `package.json` in the workspace (root + apps/* + packages/*)
2. `apps/desktop/src-tauri/Cargo.toml` (`[package].version`)
3. `apps/desktop/src-tauri/tauri.conf.json` (`version`)
4. `CHANGELOG.md` (a new dated section)

Once those are committed and a `v*.*.*` tag is pushed,
`.github/workflows/release.yml` builds installers in parallel on
Linux / macOS / Windows and uploads them as assets on the matching
GitHub Release:

```bash
# After version bumps + commit:
git tag -a v1.2.3 -m "Release 1.2.3"
git push origin main v1.2.3
# Watch the Release workflow: https://github.com/<repo>/actions
```

The `NO_STRIP=true` workaround is set inside `release.yml` so AppImage
builds don't fail on modern binutils.
