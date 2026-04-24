# Open-Code-RenPy-UI

A spec-driven, node/flow-based visual editor for authoring
[Ren'Py](https://www.renpy.org/) visual novels.

- **Local-first desktop app** — your project folder is the database.
- **Spec-driven** — every edit writes a JSON spec; `.rpy` is generated output.
- **Visual, not a toy** — full access to variables, conditions, and a raw
  Python escape hatch.
- **Dark theme**, orange + purple accents.

> Status: planning. Code lands milestone-by-milestone — see `ROADMAP.md`.

---

## Planning documents

Read these in order:

1. [`PLAN.md`](./PLAN.md) — vision, goals, scope, tech choices.
2. [`SPEC.md`](./SPEC.md) — the JSON spec (source of truth): project manifest,
   characters, variables, assets, scenes, screens, validation rules.
3. [`ARCHITECTURE.md`](./ARCHITECTURE.md) — monorepo layout, runtime design,
   state management, codegen pipeline, Tauri IPC, testing.
4. [`ROADMAP.md`](./ROADMAP.md) — milestones M0–M8 with concrete exit criteria.
5. [`design-tokens.md`](./design-tokens.md) — dark theme palette, typography,
   spacing, React Flow theming.

## Tech stack (chosen)

- **Shell:** Tauri 2 (Rust)
- **UI:** React 18 + TypeScript + Vite
- **Canvas:** `@xyflow/react` (React Flow v12)
- **State:** Zustand + Immer, zundo for undo/redo
- **Schema / validation:** Zod (+ JSON Schema export)
- **Styling:** Tailwind CSS + CSS custom properties
- **Codegen:** custom deterministic TypeScript emitter → `.rpy`
- **Testing:** Vitest (unit + snapshots), Playwright (e2e)

## Quick mental model

```
.renpy-ui/*.json   ── source of truth ──►   packages/codegen   ──►   game/generated/*.rpy
        ▲                                                                   │
        │                                                                   ▼
  Node canvas (view)  ◄──── Zustand store ────►  Inspector / Preview / Problems
```

## Contributing

Not yet accepting external contributions — scaffolding lands in **M0**.
Once the repo is bootstrapped, see `CONTRIBUTING.md` (to be written in M0).

## License

TBD (leaning MIT). Will be finalized before the first tagged release.
