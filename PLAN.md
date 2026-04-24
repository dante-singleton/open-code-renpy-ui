# Open-Code-RenPy-UI — Plan

> A spec-driven, node/flow-based visual editor for authoring Ren'Py visual novels.
> Local-first desktop app. Dark UI with orange and purple accents.

---

## 1. Vision

A visual authoring tool where writers and game designers build Ren'Py visual novels
by composing scenes on an infinite node canvas. The graph is never the source of
truth by itself — every edit is persisted to a human-readable **JSON spec**, and
`.rpy` code is deterministically generated from that spec.

**Core promises**

- **Spec-driven** — one JSON spec per scene + a project manifest; schema-validated.
- **Deterministic codegen** — the same spec always produces the same `.rpy`.
- **Local-first** — your project folder is the database; Git-friendly.
- **Visual without being a toy** — full access to variables, conditions, and Python
  escape hatches; the node graph mirrors real Ren'Py constructs.
- **Fast iteration** — in-app web preview of the current scene without launching
  the Ren'Py SDK.

---

## 2. Target users

| Persona               | Needs                                                          |
|-----------------------|----------------------------------------------------------------|
| Writer / narrative designer | Outline branching dialogue without learning Ren'Py syntax |
| Indie VN developer    | Faster scene scaffolding, asset wiring, visual branch audit    |
| Educator / hobbyist   | Low-friction entry into Ren'Py                                 |
| Team lead             | Git-reviewable spec files, validation, missing-asset reports   |

---

## 3. Goals (v1)

1. Node-based canvas with pan/zoom/minimap and typed node categories.
2. A JSON spec covering: dialogue & branching, characters, backgrounds, audio,
   variables & conditions, inventory/stats, screens/GUI, and asset tracking.
3. One-way codegen: **spec → `.rpy`**, overwriting only generated files.
4. Asset manager: import, organize, validate references, flag missing files.
5. Live in-app scene preview (HTML-based, no Ren'Py runtime required).
6. Project scaffolder: create a new Ren'Py-compatible folder layout from scratch.
7. Dark theme with orange (`#FF7A1A`) + purple (`#9D4EDD`) accents.

## 4. Non-goals (v1)

- Round-tripping existing `.rpy` code back into spec (planned later).
- Editing compiled `.rpyc` or in-game runtime behavior.
- Cloud sync, collaboration, or multi-user editing.
- Replacing Ren'Py's build pipeline — we generate sources; Ren'Py builds them.

---

## 5. Technology choices

| Layer             | Choice                                  | Why                                                |
|-------------------|-----------------------------------------|----------------------------------------------------|
| Shell             | **Tauri 2** (Rust)                      | Small binary, native FS access, can invoke Ren'Py SDK |
| UI framework      | **React 18 + TypeScript + Vite**        | Mature; pairs with React Flow                      |
| Node canvas       | **@xyflow/react (React Flow v12)**      | Industry-standard graph editor                     |
| State             | **Zustand** + **Immer**                 | Small, ergonomic for graph state                   |
| Schema / validation | **Zod** (mirrors a published JSON Schema) | Runtime validation + TS types from one source  |
| Styling           | **Tailwind CSS** + CSS custom props     | Theme tokens drive both Tailwind and React Flow    |
| Codegen           | **Custom TS emitter** → `.rpy`          | Deterministic, testable, no template engine needed |
| Preview           | **React HTML renderer** (no Ren'Py)     | Fast iteration; visual fidelity approximated       |
| Persistence       | Tauri FS plugin → project folder        | Git-friendly JSON on disk                          |
| Testing           | Vitest + Playwright                     | Unit + e2e coverage                                |

See `ARCHITECTURE.md` for module boundaries.

---

## 6. High-level scope

### Node categories (canvas)

- **Flow**: `Start`, `Label`, `Jump`, `Call`, `Return`, `End`
- **Narrative**: `Say`, `Narration`, `Menu` (choice branch), `Pause`
- **Stage**: `Scene` (background), `Show` (sprite), `Hide`, `Transition`, `Camera`
- **Audio**: `PlayMusic`, `StopMusic`, `PlaySound`, `PlayVoice`, `Queue`
- **Logic**: `If / Elif / Else`, `SetVariable`, `Increment`, `PythonBlock`
- **Systems**: `InventoryOp`, `StatOp`, `RelationshipOp`
- **Screens**: `ShowScreen`, `HideScreen`, `CallScreen`

### Panels (app chrome)

1. **Project sidebar** — scenes, characters, variables, assets, screens
2. **Canvas** — node graph for the active scene/label
3. **Inspector** — properties of the selected node(s)
4. **Preview** — HTML renderer for the current path
5. **Problems** — validation errors (missing assets, dangling jumps, etc.)
6. **Console** — codegen log, SDK output when invoked

---

## 7. Milestones (summary — see `ROADMAP.md`)

- **M0 — Foundations**: repo, Tauri+React scaffold, theme tokens, CI.
- **M1 — Spec & codegen core**: Zod schemas, `.rpy` emitter, snapshot tests.
- **M2 — Canvas MVP**: React Flow with Say/Menu/Jump/Label, save/load spec.
- **M3 — Stage & audio**: Scene/Show/Hide, audio nodes, characters panel.
- **M4 — Logic & systems**: variables, conditions, inventory/stats/relationships.
- **M5 — Assets & validation**: asset manager, missing-file diagnostics.
- **M6 — Preview**: in-app HTML scene player.
- **M7 — Screens/GUI**: visual editing of say/choice/main menu screens.
- **M8 — Polish & 1.0**: docs, examples, packaged installers.

---

## 8. Success criteria

- A new user can create a branching 3-scene VN with characters, music, and a
  choice, and launch it in Ren'Py within 15 minutes.
- `spec → .rpy` codegen is covered by snapshot tests with > 90% branch coverage.
- Opening a 500-node scene maintains 60 fps pan/zoom on mid-range hardware.
- Validation catches 100% of unreferenced assets and dangling jumps/labels.

---

## 9. Risks & mitigations

| Risk                                           | Mitigation                                         |
|-----------------------------------------------|----------------------------------------------------|
| Ren'Py grammar has many edge cases            | Start with a focused subset; Python escape hatch node |
| Graph becomes unreadable at scale             | Sub-labels as collapsible groups; mini-map; search |
| Spec churn breaks user files                   | Versioned spec + migration runners from day one    |
| Preview drifts from Ren'Py fidelity            | Label preview as "approximate"; optional SDK launch later |
| Tauri FS permissions friction                 | Scoped workspace permission + first-run picker     |

---

## 10. Deliverables of this plan

- `PLAN.md` (this file)
- `SPEC.md` — JSON spec schema reference
- `ARCHITECTURE.md` — modules, data flow, codegen pipeline
- `ROADMAP.md` — phased milestones with tasks
- `design-tokens.md` — color/typography/spacing tokens for the dark theme
- `README.md` — entry point
