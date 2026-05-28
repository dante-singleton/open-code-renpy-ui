# Open-Code-RenPy-UI

A spec-driven, node/flow-based visual editor for authoring
[Ren'Py](https://www.renpy.org/) visual novels.

- **Local-first desktop app** — your project folder is the database.
- **Spec-driven** — every edit writes a JSON spec; `.rpy` is generated output.
- **Visual, not a toy** — full access to variables, conditions, and a raw
  Python escape hatch.
- **Dark theme**, orange + purple accents.

> Status: **1.0.0** — Apache-2.0 licensed, tagged release.

---

## Quick start

```bash
pnpm install                         # one-time
pnpm dev                             # browser-only preview at http://localhost:1420
pnpm tauri:dev                       # full desktop shell (requires Tauri Linux deps)
```

Run the codegen against an existing project:

```bash
pnpm generate path/to/project        # validates spec, writes game/generated/*.rpy
pnpm lint-spec path/to/project       # validation only; exits 1 on errors
```

Sanity-check a fixture:

```bash
pnpm generate fixtures/demo-cafe/spec
cat fixtures/demo-cafe/spec/game/generated/scenes/cafe.rpy
```

---

## Documentation

- [`docs/getting-started.md`](./docs/getting-started.md) — install, the seeded
  demo, and a 10-minute tutorial that authors a tiny VN end-to-end.
- [`docs/spec-reference.md`](./docs/spec-reference.md) — every spec document
  and node type, with a worked example per section.
- [`docs/codegen-reference.md`](./docs/codegen-reference.md) — what each spec
  node emits, deterministic ordering rules, and how to regress your changes.

Design and milestone history (kept for reference):

- [`PLAN.md`](./PLAN.md) — vision and v1 scope
- [`SPEC.md`](./SPEC.md) — original schema design
- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — runtime, codegen, validators, Tauri IPC
- [`ROADMAP.md`](./ROADMAP.md) — milestones M0–M8 (all complete)
- [`design-tokens.md`](./design-tokens.md) — color, typography, spacing
- [`CHANGELOG.md`](./CHANGELOG.md) — what shipped per milestone

---

## Architecture at a glance

```
.renpy-ui/*.json   ── source of truth ──►   packages/codegen   ──►   game/generated/*.rpy
        ▲                                                                   │
        │                                                                   ▼
  Node canvas (view)  ◄──── Zustand store ────►  Inspector / Preview / Problems
```

Eight workspace packages:

| Package                     | What                                                      |
|-----------------------------|-----------------------------------------------------------|
| `@renpy-ui/spec`            | Zod schemas for every spec document and node              |
| `@renpy-ui/codegen`         | Deterministic spec → `.rpy` emitter                       |
| `@renpy-ui/validators`      | Pure + env-aware semantic rules + quick-fix catalog       |
| `@renpy-ui/preview`         | Pure playback machine + React `ScenePreview` bindings     |
| `@renpy-ui/graph`           | React Flow node/edge primitives                           |
| `@renpy-ui/ui`              | Shared React primitives + design tokens CSS               |
| `@renpy-ui/desktop`         | Tauri 2 + React app                                       |
| `@renpy-ui/cli`             | `renpy-ui` CLI for CI: generate / lint                    |

## Tech stack

- **Shell:** Tauri 2 (Rust)
- **UI:** React 18 + TypeScript + Vite, code-split per tab
- **Canvas:** `@xyflow/react` (React Flow v12)
- **State:** Zustand + Immer, zundo for undo/redo
- **Schema / validation:** Zod (+ JSON Schema export)
- **Styling:** Tailwind CSS + CSS custom properties
- **Codegen:** custom deterministic TypeScript emitter → `.rpy`
- **Testing:** Vitest

Initial JS bundle: **~85 KB gzipped**. Canvas chunk loads lazily on demand.

---

## Contributing

See [`CONTRIBUTING.md`](./CONTRIBUTING.md) for the toolchain, test matrix,
and PR conventions.

## License

[Apache-2.0](./LICENSE) © Open-Code-RenPy-UI contributors.
