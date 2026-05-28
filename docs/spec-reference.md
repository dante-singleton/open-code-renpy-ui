# Spec reference

The spec is the **source of truth** for an Open-Code-RenPy-UI project. Every
document is JSON, validated by Zod schemas in `@renpy-ui/spec`, and stored
under `.renpy-ui/` at the project root. The original schema design is in
[`SPEC.md`](../SPEC.md); this page is a quick lookup with concrete examples.

## On-disk layout

```
.renpy-ui/
├── project.json          ProjectManifest
├── characters.json       CharacterCatalog
├── variables.json        VariableCatalog
├── assets.json           AssetIndex
├── scenes/
│   ├── start.json        SceneSpec — one per scene
│   └── chapter1.json
└── screens/
    └── say.json          ScreenSpec — one per screen
```

Generated `.rpy` is written under `game/generated/` and should also be
committed so the project builds without the editor installed.

## ProjectManifest

```json
{
  "specVersion": "1.0.0",
  "id": "01HYZPROJECT_HELLO",
  "name": "Hello World",
  "renpyPackage": "hello_world",
  "version": "0.1.0",
  "authors": ["Open-Code-RenPy-UI"],
  "startLabel": "start",
  "locales": ["en"],
  "paths": {
    "specDir": ".renpy-ui",
    "generatedDir": "game/generated",
    "assetsDir": "game"
  },
  "renpy": {
    "minVersion": "8.2.0",
    "buildWindows": true,
    "buildMac": true,
    "buildLinux": true,
    "buildWeb": false
  },
  "scenes": [
    { "id": "01HYZSCENE_START", "label": "start", "file": "scenes/start.json" }
  ],
  "screens": []
}
```

## CharacterCatalog

```json
{
  "specVersion": "1.0.0",
  "characters": [
    {
      "id": "01HYZCHAR_ALICE",
      "varName": "alice",
      "displayName": "Alice",
      "color": "#FF7A1A",
      "images": {
        "tag": "alice",
        "expressions": [
          { "name": "happy", "asset": "images/alice/happy.png" },
          { "name": "sad",   "asset": "images/alice/sad.png" }
        ]
      }
    }
  ]
}
```

## VariableCatalog

```json
{
  "specVersion": "1.0.0",
  "variables": [
    { "id": "01HYZVAR_LOVE", "name": "love_points", "kind": "int",
      "default": "0", "persistent": false,
      "doc": "Tracks affection toward Alice." },
    { "id": "01HYZVAR_SEEN", "name": "seen_intro", "kind": "bool",
      "default": "False", "persistent": true }
  ]
}
```

`persistent: true` emits `default persistent.<name> = …`.

## AssetIndex

```json
{
  "specVersion": "1.0.0",
  "assets": [
    {
      "id": "01HYZASSET_HAPPY",
      "ref": "images/alice/happy.png",
      "kind": "image",
      "subkind": "sprite",
      "tags": ["alice", "happy"],
      "hash": "e3b0c44…",
      "sizeBytes": 0,
      "importedAt": "2026-01-01T00:00:00.000Z"
    }
  ]
}
```

`ref` is relative to the `paths.assetsDir` (default `game/`). `hash` is
SHA-256; the validator reports `STALE_ASSET_HASH` when the on-disk file
has changed since import.

## SceneSpec

A scene is a graph of nodes plus a list of edges connecting their handles.

```json
{
  "specVersion": "1.0.0",
  "id": "01HYZSCENE_START",
  "label": "start",
  "title": "Start",
  "entryNodeId": "n_start",
  "nodes": [
    { "id": "n_start", "type": "start", "position": { "x": 0, "y": 0 } },
    { "id": "n_say", "type": "say", "position": { "x": 200, "y": 0 },
      "characterId": "01HYZCHAR_ALICE",
      "expressionName": "happy",
      "text": "Hello, world!" },
    { "id": "n_end", "type": "end", "position": { "x": 400, "y": 0 } }
  ],
  "edges": [
    { "id": "e1", "source": "n_start", "target": "n_say" },
    { "id": "e2", "source": "n_say", "target": "n_end" }
  ]
}
```

### Node kinds

| Category   | Kinds                                                                      |
|------------|----------------------------------------------------------------------------|
| Flow       | `start`, `end`, `label`, `jump`, `call`, `return`                          |
| Narrative  | `say`, `narration`, `menu`, `pause`                                        |
| Stage      | `sceneBg`, `show`, `hide`, `transition`, `camera`                          |
| Audio      | `playMusic`, `stopMusic`, `playSound`, `playVoice`, `queue`                |
| Logic      | `if`, `setVar`, `increment`, `python`                                      |
| Systems    | `inventoryOp`, `statOp`, `relationshipOp`                                  |
| Screens    | `showScreen`, `hideScreen`, `callScreen`                                   |

Branching nodes use special edge handles:

- `menu` → `sourceHandle: "choice:<choiceId>"`
- `if` → `sourceHandle: "branch:<branchId>"`

## ScreenSpec

Four templates: `say`, `choice`, `mainMenu`, `custom`. The first three host
user-supplied widget trees in named **slots**; the last takes a raw block.

```json
{
  "specVersion": "1.0.0",
  "id": "01HYZSCREEN_SAY",
  "name": "say",
  "template": "say",
  "slots": {
    "window": {
      "kind": "frame",
      "background": "#0b0b10cc",
      "padding": 16,
      "children": [
        { "kind": "vbox", "spacing": 6, "children": [
          { "kind": "text", "text": "[who]", "size": 18, "color": "#FF7A1A" },
          { "kind": "text", "text": "[what]", "size": 22 }
        ]}
      ]
    }
  }
}
```

### Widget kinds

| Container  | Leaf                                |
|------------|-------------------------------------|
| `frame`    | `text`, `image`, `button`, `bar`    |
| `vbox`     |                                     |
| `hbox`     |                                     |

`button.action` and `bar.value` / `bar.range` accept raw Python expressions
that Ren'Py evaluates at runtime.

## Validation

See [`../ARCHITECTURE.md` §6](../ARCHITECTURE.md#6-validation-packagesvalidators)
for the rule catalog. The CLI exits 1 on any error-severity diagnostic:

```bash
pnpm lint-spec path/to/project
```

Rules range from "scene has a Start node" through "asset entry has a file
on disk" to "call chain doesn't form a cycle". Each rule emits a stable
diagnostic code (e.g. `MISSING_ASSET_FILE`, `UNKNOWN_LABEL`,
`UNINDEXED_ASSET`) that the Problems panel surfaces with quick-fix actions
where applicable.
