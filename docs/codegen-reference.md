# Codegen reference

`@renpy-ui/codegen` is a pure TypeScript library that turns a validated
`SpecBundle` into deterministic Ren'Py source files. This page documents
what each spec node emits, the rules that keep output stable across
machines and runs, and how to add a fixture when you change the emitter.

## Output layout

For a project rooted at `<root>` with `paths.generatedDir = "game/generated"`:

```
<root>/game/generated/
├── _manifest.rpy        config.name + version (init python block)
├── characters.rpy       define <var> = Character(...) + image lines
├── variables.rpy        default / default persistent. lines
├── scenes/
│   └── <label>.rpy      one per SceneSpec
└── screens/
    └── <name>.rpy       one per ScreenSpec
```

Every generated file starts with a header that names its source spec and
the spec version, so reviewers can trace output back without context.

## Determinism rules

The emitter never produces different output on different runs for the same
input. Specifically:

- **Iteration order**: nodes are walked in `(y, x, id)` order. Ties are
  broken by id, so re-saving a scene with no graph changes never reshuffles
  output.
- **Object key order**: dictionaries serialize with sorted keys.
- **Indentation**: 4 spaces, matching Ren'Py convention.
- **Trailing newline**: every file ends with exactly one `\n`.
- **Skip-if-unchanged**: the writer compares each file against its on-disk
  contents and skips writes when the bytes match. This keeps mtimes stable
  for Ren'Py's compile cache.

CI runs the byte-equality fixture suite (`packages/codegen/test/fixtures.test.ts`)
on every change. The fixture-discovery test picks up any `fixtures/<name>/`
directory with a `spec/` and `expected/` pair, so adding a fixture is a
copy-and-rename away.

## Per-node emission

| Node            | Emits                                                                         |
|-----------------|-------------------------------------------------------------------------------|
| `start`         | nothing (entry marker)                                                        |
| `end` / `return`| `return`                                                                      |
| `label`         | a fresh `label <name>:` block                                                 |
| `jump`          | `jump <target>`                                                               |
| `call`          | `call <target>`                                                               |
| `say`           | `<var> [expr] "<text>"` (preceded by `voice "..."` if set)                    |
| `narration`     | `"<text>"`                                                                    |
| `menu`          | `menu:` block; one `"<choice text>" [if <condition>]:` per choice              |
| `pause`         | `pause [<seconds>]`                                                           |
| `sceneBg`       | `scene <tag> <imageName> [with <transition>]`                                 |
| `show`          | `show <tag> [<expr>] [at <pos>] [zorder <n>] [with <t>]`                      |
| `hide`          | `hide <tag> [with <t>]`                                                       |
| `transition`    | `with <name>`                                                                 |
| `camera`        | `# camera <action>` (placeholder; full transforms are post-1.0)               |
| `playMusic`     | `play [<channel>] "<asset>" [fadein <s>] [noloop]`                            |
| `stopMusic`     | `stop <channel> [fadeout <s>]`                                                |
| `playSound`     | `play <channel> "<asset>"`                                                    |
| `playVoice`     | `voice "<asset>"`                                                             |
| `queue`         | `queue <channel> "<asset>"`                                                   |
| `if`            | `if/elif/else` ladder; each branch indents its child block one level deeper   |
| `setVar`        | `$ <variable> = <expression>`                                                 |
| `increment`     | `$ <variable> += <delta>` (or `-= -<delta>`)                                  |
| `python`        | `python:` block; user code indented one level                                 |
| `inventoryOp`   | `$ inventory_<op>("<itemId>", <quantity>)`                                    |
| `statOp`        | `$ <stat> += <value>` (or `-=`, or `=`)                                        |
| `relationshipOp`| `$ relationship_<tag>_<track> <op> <value>`                                   |
| `showScreen`    | `show screen <name>(<args>)`                                                  |
| `hideScreen`    | `hide screen <name>`                                                          |
| `callScreen`    | `call screen <name>(<args>)`                                                  |

## DAG → Ren'Py block algorithm

Ren'Py's screen language is block-structured; spec graphs are DAGs. The
scene emitter bridges the two with this algorithm (see
[`ARCHITECTURE.md` §5.1](../ARCHITECTURE.md)):

1. Pick **entry points**: the scene's `entryNodeId`, every explicit
   `LabelNode`, plus any node with `>1` inbound edges (a re-merge join).
2. For each entry, depth-first walk the graph emitting one statement per
   node until you hit either a terminal or another entry.
3. When you hit another entry, emit `jump <synthetic-label>` and stop —
   the destination block has its own `label <name>:` header.

This keeps simple linear scenes flat, and only introduces synthetic labels
when graph structure (menu re-merges, loops) demands them.

## Screens emission

The screens emitter follows two paths:

- **`custom` template**: the user's raw block is written verbatim under a
  `screen <name>(<params>):` header, indented one level. Empty raw bodies
  emit `pass`.
- **`say` / `choice` / `mainMenu` templates**: a stable wrapper hosts
  user-supplied widget slots. Missing slots fall back to a sensible default
  so the screen is always functional. Parameters extend the standard
  signature without dropping required positional args (`who, what` for
  `say`, `items` for `choice`).

## Adding a fixture

The cleanest way to test a new emitter behaviour is by adding a fixture:

```bash
mkdir -p fixtures/my-feature/spec/.renpy-ui/scenes
mkdir -p fixtures/my-feature/expected/game/generated/scenes
# Author the spec under fixtures/my-feature/spec/.renpy-ui/
pnpm generate fixtures/my-feature/spec
cp -r fixtures/my-feature/spec/game/generated/. \
      fixtures/my-feature/expected/game/generated/
pnpm test
```

The fixture-discovery test will pick it up automatically and assert
byte-for-byte equality on every CI run. If you intentionally change the
emitter, regenerate the expected and review the diff in your PR.

## Hand-running the CLI

```bash
pnpm generate path/to/project   # write game/generated/*.rpy
pnpm lint-spec path/to/project  # validation only, exit 1 on errors
pnpm schemas                    # regenerate schemas/*.schema.json
```

`pnpm lint-spec` runs the env-aware validator: it walks the AssetIndex,
resolves each `ref` against `paths.assetsDir`, builds a hash map, then
calls `validateBundleWithEnv`. Missing files surface as
`MISSING_ASSET_FILE` errors and fail CI.
