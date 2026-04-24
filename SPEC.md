# SPEC — Open-Code-RenPy-UI

The spec is the **source of truth**. The node graph is a view over it; `.rpy` code
is generated output. This document defines the on-disk layout, versioning, and the
shape of every document type.

TypeScript types (via Zod) live in `packages/spec/` (see `ARCHITECTURE.md`) and
are generated from and validated against the shapes below.

---

## 1. On-disk layout

```
my-vn/                              # Ren'Py project root
├── game/                           # Ren'Py reads from here
│   ├── generated/                  # *** codegen output — never hand-edit ***
│   │   ├── _manifest.rpy
│   │   ├── characters.rpy
│   │   ├── variables.rpy
│   │   ├── scenes/
│   │   │   ├── chapter1_intro.rpy
│   │   │   └── chapter1_bedroom.rpy
│   │   └── screens/
│   │       └── say.rpy
│   ├── images/                     # user assets (tracked by spec)
│   ├── audio/
│   └── script.rpy                  # tiny hand-written entry that jumps into generated
├── .renpy-ui/                      # *** the spec (source of truth) ***
│   ├── project.json                # ProjectManifest
│   ├── characters.json             # CharacterCatalog
│   ├── variables.json              # VariableCatalog
│   ├── assets.json                 # AssetIndex
│   ├── screens/
│   │   └── say.json                # ScreenSpec
│   └── scenes/
│       ├── chapter1_intro.json     # SceneSpec
│       └── chapter1_bedroom.json
└── .renpy-ui.lock                  # editor lock file when app is open
```

Rules:

- Everything under `.renpy-ui/` is authored by the editor and committed to git.
- Everything under `game/generated/` is **regenerated on save** and should also
  be committed (so the project builds without the editor installed).
- `game/script.rpy` is hand-written once (boilerplate) and not overwritten.

---

## 2. Versioning & migrations

Every spec document carries a `specVersion` string (semver). On load, the editor
runs sequential migrations from the file's version up to the current version.
Missing/older files are migrated and rewritten on next save.

```jsonc
{ "specVersion": "1.0.0", ... }
```

Breaking schema changes bump the **major**; additive changes bump the **minor**.

---

## 3. Common primitives

```ts
// Stable IDs — ULIDs are preferred (sortable, URL-safe).
type Id = string;                         // e.g. "01HYZ..."
type RenPyIdentifier = string;            // /^[A-Za-z_][A-Za-z0-9_]*$/
type AssetRef = string;                   // relative to game/, e.g. "images/bg/room.png"

interface Position { x: number; y: number; }

// Expression is intentionally a raw Python string — Ren'Py evaluates it.
// The editor offers structured builders that emit into this field.
type Expression = string;                 // e.g. "love_points >= 3 and met_alice"
```

---

## 4. Project manifest — `.renpy-ui/project.json`

```ts
interface ProjectManifest {
  specVersion: "1.0.0";
  id: Id;
  name: string;                           // display name
  renpyPackage: RenPyIdentifier;          // define config.name, etc.
  version: string;                        // game version
  authors: string[];
  startLabel: RenPyIdentifier;            // entry label, default "start"
  locales: string[];                      // ["en"], future i18n
  paths: {
    specDir: string;                      // ".renpy-ui"
    generatedDir: string;                 // "game/generated"
    assetsDir: string;                    // "game"
  };
  renpy: {
    minVersion: string;                   // "8.2.0"
    buildWindows: boolean;
    buildMac: boolean;
    buildLinux: boolean;
    buildWeb: boolean;
  };
  scenes: Array<{ id: Id; label: RenPyIdentifier; file: string }>;
  screens: Array<{ id: Id; name: RenPyIdentifier; file: string }>;
}
```

---

## 5. Character catalog — `.renpy-ui/characters.json`

```ts
interface CharacterCatalog {
  specVersion: "1.0.0";
  characters: Character[];
}

interface Character {
  id: Id;
  varName: RenPyIdentifier;               // emits `define <varName> = Character(...)`
  displayName: string;                    // "Alice"
  color: string;                           // "#FF7A1A" (name color in game)
  voiceTag?: RenPyIdentifier;
  images: {
    tag: RenPyIdentifier;                  // sprite tag, e.g. "alice"
    expressions: Array<{
      name: string;                        // "happy", "sad"
      asset: AssetRef;                     // images/alice/happy.png
    }>;
    poses?: Array<{ name: string; asset: AssetRef }>;
  };
  sayAttributes?: Record<string, string>; // e.g. { "what_prefix": "\u2014 " }
}
```

---

## 6. Variable catalog — `.renpy-ui/variables.json`

```ts
interface VariableCatalog {
  specVersion: "1.0.0";
  variables: Variable[];
}

interface Variable {
  id: Id;
  name: RenPyIdentifier;
  kind: "bool" | "int" | "float" | "string" | "list" | "dict" | "python";
  default: string;                         // Python literal, e.g. "0", "False", "[]"
  persistent: boolean;                     // emits under `default persistent.` if true
  doc?: string;
}
```

---

## 7. Asset index — `.renpy-ui/assets.json`

```ts
interface AssetIndex {
  specVersion: "1.0.0";
  assets: Asset[];
}

interface Asset {
  id: Id;
  ref: AssetRef;                           // path relative to game/
  kind: "image" | "audio" | "video" | "font" | "other";
  subkind?: "background" | "sprite" | "ui" | "music" | "sfx" | "voice";
  tags: string[];
  hash: string;                            // content hash for change detection
  sizeBytes: number;
  importedAt: string;                      // ISO timestamp
}
```

Referential integrity: every `AssetRef` used by scenes/characters/screens must
resolve to an entry here; the validator reports mismatches.

---

## 8. Scene spec — `.renpy-ui/scenes/<slug>.json`

A scene is a graph of nodes plus layout metadata for the canvas.

```ts
interface SceneSpec {
  specVersion: "1.0.0";
  id: Id;
  label: RenPyIdentifier;                  // emits `label <label>:`
  title: string;                            // human label on the canvas
  entryNodeId: Id;                          // first node after the label
  nodes: SceneNode[];
  edges: SceneEdge[];
  viewport?: { x: number; y: number; zoom: number };
  notes?: string;
}

interface SceneEdge {
  id: Id;
  source: Id;                               // node id
  sourceHandle?: string;                    // "true" | "false" | "choice:<i>" | "next"
  target: Id;
  label?: string;
}

// Discriminated union of node kinds.
type SceneNode =
  | StartNode | EndNode | LabelNode | JumpNode | CallNode | ReturnNode
  | SayNode  | NarrationNode | MenuNode | PauseNode
  | SceneBgNode | ShowNode | HideNode | TransitionNode | CameraNode
  | PlayMusicNode | StopMusicNode | PlaySoundNode | PlayVoiceNode | QueueNode
  | IfNode | SetVarNode | IncrementNode | PythonBlockNode
  | InventoryOpNode | StatOpNode | RelationshipOpNode
  | ShowScreenNode | HideScreenNode | CallScreenNode;

interface NodeBase {
  id: Id;
  type: SceneNode["type"];
  position: Position;
  comment?: string;                         // emitted as `# comment` in .rpy
}
```

### 8.1 Flow nodes

```ts
interface StartNode   extends NodeBase { type: "start"; }
interface EndNode     extends NodeBase { type: "end"; }
interface LabelNode   extends NodeBase { type: "label";  name: RenPyIdentifier; }
interface JumpNode    extends NodeBase { type: "jump";   target: RenPyIdentifier; }
interface CallNode    extends NodeBase { type: "call";   target: RenPyIdentifier; }
interface ReturnNode  extends NodeBase { type: "return"; }
```

### 8.2 Narrative nodes

```ts
interface SayNode extends NodeBase {
  type: "say";
  characterId?: Id;                         // undefined = narrator
  expressionName?: string;                  // resolves to Character.images.expressions
  text: string;                             // may include Ren'Py tags {i}{/i} etc.
  attributes?: string[];                    // extra say attributes
  withTransition?: string;                  // e.g. "dissolve"
  voice?: AssetRef;
}

interface NarrationNode extends NodeBase {
  type: "narration";
  text: string;
}

interface MenuNode extends NodeBase {
  type: "menu";
  prompt?: string;                          // optional `"What do you do?"`
  choices: Array<{
    id: Id;
    text: string;
    condition?: Expression;                 // only show if true
    // outgoing edge from sourceHandle "choice:<id>"
  }>;
}

interface PauseNode extends NodeBase { type: "pause"; seconds?: number; }
```

### 8.3 Stage nodes

```ts
interface SceneBgNode extends NodeBase {
  type: "sceneBg";
  background: AssetRef;                     // e.g. images/bg/room.png
  imageTag?: RenPyIdentifier;               // optional override
  withTransition?: string;                  // "fade", "dissolve"
}

interface ShowNode extends NodeBase {
  type: "show";
  characterId: Id;
  expressionName?: string;
  at?: "left" | "center" | "right" | "offscreen_left" | "offscreen_right" | string;
  withTransition?: string;
  zorder?: number;
}

interface HideNode extends NodeBase {
  type: "hide";
  characterId: Id;
  withTransition?: string;
}

interface TransitionNode extends NodeBase {
  type: "transition";
  name: string;                             // "dissolve", "fade", custom
}

interface CameraNode extends NodeBase {
  type: "camera";
  action: "zoom" | "pan" | "shake" | "reset";
  params?: Record<string, number | string>;
}
```

### 8.4 Audio nodes

```ts
interface PlayMusicNode extends NodeBase {
  type: "playMusic";
  asset: AssetRef;
  fadeIn?: number;
  loop?: boolean;
  channel?: "music" | string;
}

interface StopMusicNode extends NodeBase {
  type: "stopMusic";
  channel?: string;
  fadeOut?: number;
}

interface PlaySoundNode extends NodeBase {
  type: "playSound";
  asset: AssetRef;
  channel?: "sound" | string;
}

interface PlayVoiceNode extends NodeBase {
  type: "playVoice";
  asset: AssetRef;
}

interface QueueNode extends NodeBase {
  type: "queue";
  channel: string;
  asset: AssetRef;
}
```

### 8.5 Logic nodes

```ts
interface IfNode extends NodeBase {
  type: "if";
  branches: Array<{                         // evaluated in order
    id: Id;
    condition: Expression;                  // last branch may be else: condition = ""
  }>;
  // outgoing edges use sourceHandle "branch:<id>"
}

interface SetVarNode extends NodeBase {
  type: "setVar";
  variable: RenPyIdentifier;
  expression: Expression;                   // e.g. "love_points + 1"
}

interface IncrementNode extends NodeBase {
  type: "increment";
  variable: RenPyIdentifier;
  delta: number;                            // emits `$ var += delta`
}

interface PythonBlockNode extends NodeBase {
  type: "python";
  code: string;                             // raw Python, emitted inside `python:`
}
```

### 8.6 Systems nodes

```ts
interface InventoryOpNode extends NodeBase {
  type: "inventoryOp";
  op: "add" | "remove" | "set";
  itemId: RenPyIdentifier;
  quantity?: number;
}

interface StatOpNode extends NodeBase {
  type: "statOp";
  stat: RenPyIdentifier;                    // e.g. "strength"
  op: "add" | "subtract" | "set";
  value: number;
}

interface RelationshipOpNode extends NodeBase {
  type: "relationshipOp";
  characterId: Id;
  op: "add" | "subtract" | "set";
  value: number;                            // affection / love / etc.
  track?: string;                           // "love" | "trust" | custom
}
```

### 8.7 Screen nodes

```ts
interface ShowScreenNode extends NodeBase {
  type: "showScreen";
  screenId: Id;
  args?: Record<string, string>;            // each value is an Expression
}
interface HideScreenNode extends NodeBase {
  type: "hideScreen";
  screenId: Id;
}
interface CallScreenNode extends NodeBase {
  type: "callScreen";
  screenId: Id;
  args?: Record<string, string>;
}
```

---

## 9. Screen spec — `.renpy-ui/screens/<name>.json`

Screens are described as a constrained tree that the codegen converts into
Ren'Py screen language. v1 ships built-in templates (Say, Choice, MainMenu) with
customizable slots; fully free-form screen authoring lands in M7.

```ts
interface ScreenSpec {
  specVersion: "1.0.0";
  id: Id;
  name: RenPyIdentifier;                    // `screen <name>():`
  template: "say" | "choice" | "mainMenu" | "custom";
  parameters?: Array<{ name: RenPyIdentifier; default?: string }>;
  slots: Record<string, ScreenWidget>;      // template-defined slot names
  raw?: string;                             // only for template "custom"
}

type ScreenWidget =
  | { kind: "frame";   background?: string; padding?: number; children: ScreenWidget[] }
  | { kind: "vbox" | "hbox"; spacing?: number; children: ScreenWidget[] }
  | { kind: "text";    text: string; style?: string; size?: number; color?: string }
  | { kind: "image";   asset: AssetRef; xalign?: number; yalign?: number }
  | { kind: "button";  text: string; action: Expression; style?: string }
  | { kind: "bar";     value: Expression; range: Expression; style?: string };
```

---

## 10. Validation rules (enforced pre-save and pre-generate)

1. Every `RenPyIdentifier` matches `/^[A-Za-z_][A-Za-z0-9_]*$/` and is not a
   Ren'Py/Python reserved word.
2. Every `AssetRef` in any spec document resolves to an `AssetIndex` entry and
   that file exists on disk.
3. Every `JumpNode.target` / `CallNode.target` resolves to a known label
   (a `LabelNode` or a scene's `label`).
4. Every scene has exactly one reachable `StartNode` and at least one terminal
   node (`end` | `return` | `jump`).
5. `MenuNode` has >= 1 choice; each choice has a connected outgoing edge.
6. `IfNode` last branch with empty condition is treated as `else`; no branches
   after else.
7. Variables referenced by `SetVarNode` / `IncrementNode` / expressions exist in
   the `VariableCatalog` (warning, not error, if referenced-only from Python).
8. No cyclic `CallNode` chains without a `ReturnNode`.

---

## 11. Example: minimal scene

```jsonc
{
  "specVersion": "1.0.0",
  "id": "01HYZSCENE0001",
  "label": "chapter1_intro",
  "title": "Chapter 1 — Intro",
  "entryNodeId": "n_start",
  "nodes": [
    { "id": "n_start", "type": "start",    "position": { "x": 0,   "y": 0 } },
    { "id": "n_bg",    "type": "sceneBg",  "position": { "x": 200, "y": 0 },
      "background": "images/bg/room.png", "withTransition": "fade" },
    { "id": "n_music", "type": "playMusic","position": { "x": 400, "y": 0 },
      "asset": "audio/music/calm.ogg", "fadeIn": 1.0 },
    { "id": "n_say",   "type": "say",      "position": { "x": 600, "y": 0 },
      "characterId": "01HYZCHAR_ALICE", "expressionName": "happy",
      "text": "Good morning!" },
    { "id": "n_menu",  "type": "menu",     "position": { "x": 800, "y": 0 },
      "prompt": "How do you respond?",
      "choices": [
        { "id": "c_warm",  "text": "\"Good morning, Alice.\"" },
        { "id": "c_grunt", "text": "\"...hnngh.\"" }
      ]
    },
    { "id": "n_end",   "type": "end",      "position": { "x": 1000, "y": 0 } }
  ],
  "edges": [
    { "id": "e1", "source": "n_start", "target": "n_bg" },
    { "id": "e2", "source": "n_bg",    "target": "n_music" },
    { "id": "e3", "source": "n_music", "target": "n_say" },
    { "id": "e4", "source": "n_say",   "target": "n_menu" },
    { "id": "e5", "source": "n_menu",  "sourceHandle": "choice:c_warm",  "target": "n_end" },
    { "id": "e6", "source": "n_menu",  "sourceHandle": "choice:c_grunt", "target": "n_end" }
  ]
}
```

Generated `.rpy` (excerpt):

```renpy
label chapter1_intro:
    scene bg room with fade
    play music "audio/music/calm.ogg" fadein 1.0
    alice happy "Good morning!"
    menu:
        "How do you respond?"
        "\"Good morning, Alice.\"":
            return
        "\"...hnngh.\"":
            return
```

---

## 12. JSON Schema

A companion `schemas/*.schema.json` (JSON Schema 2020-12) is generated from the
Zod definitions via `zod-to-json-schema` and checked into the repo so non-TS
tools (linters, CI, third-party editors) can validate spec files independently.
