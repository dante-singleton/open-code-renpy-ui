# Contributing

> The project is in early scaffolding (M0). External contributions will open up
> once M1 lands. In the meantime, issues and design feedback are welcome.

## Prerequisites

- **Node.js** >= 20
- **pnpm** >= 9
- **Rust** stable (`rustup default stable`) — only needed to run the Tauri shell
- **Tauri Linux prereqs** — see <https://v2.tauri.app/start/prerequisites/>.
  On Debian/Ubuntu this is roughly:
  `sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file
  libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev`

## Common commands

```bash
pnpm install              # install workspace deps
pnpm dev                  # Vite dev server (web only, http://localhost:1420)
pnpm tauri:dev            # Tauri dev shell (requires system deps above)
pnpm typecheck            # tsc --noEmit across every package
pnpm lint                 # Biome check
pnpm lint:fix             # Biome auto-fix + format
pnpm test                 # Vitest across every package
pnpm --filter @renpy-ui/desktop build   # build production web bundle
```

## Monorepo layout

See `ARCHITECTURE.md` §1. Briefly:

- `apps/desktop/` — Tauri 2 + React shell (the app users run).
- `packages/spec/` — Zod schemas + TS types for the spec.
- `packages/codegen/` — deterministic spec → `.rpy` emitter.
- `packages/validators/` — referential integrity + static analysis.
- `packages/graph/` — React Flow node types and layout helpers.
- `packages/preview/` — HTML scene renderer.
- `packages/ui/` — shared React primitives + design tokens.

## Code style

- **Biome** enforces formatting and lint (`pnpm lint`).
- Single quotes in JS/TS; double quotes in JSX attributes; trailing commas; 100-col.
- Strict TypeScript — no implicit `any`, unused locals are errors.
- Prefer `type` imports (`import type { Foo } from '...'`).

## Commits & PRs

- Use conventional-ish prefixes where helpful: `feat:`, `fix:`, `docs:`, `chore:`.
- Keep changes scoped per package; prefer small PRs that cross ≤ 2 packages.
- Spec/codegen changes must ship with or update a fixture under `fixtures/`.
