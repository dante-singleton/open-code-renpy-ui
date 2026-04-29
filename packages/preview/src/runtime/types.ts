import type { AssetRef, Character, RenPyIdentifier, SceneNode, SceneSpec } from '@renpy-ui/spec';

/**
 * Snapshot of the visible game state at a single point in playback.
 *
 * The preview is intentionally an *approximation* of Ren'Py:
 * - `python` blocks are not executed (their code is shown as a debug note).
 * - Conditions in `if` and menu choices are evaluated against `vars`; only
 *   variables previously set by `setVar` / `increment` participate.
 * - `call` pushes a return address onto `callStack`; `return` pops.
 *
 * Fidelity caveats appear in the UI as a "preview · approximate" badge.
 */
export interface PlaybackState {
  /** Active scene id; null before the first step or after stop(). */
  sceneId: string | null;
  /** Node currently displayed; null when waiting at start or after end. */
  currentNodeId: string | null;
  /** Stage state at the moment the current node was rendered. */
  stage: StageState;
  /** Active say line (if any) currently on screen. */
  activeSay: ActiveSay | null;
  /** Active narration text, if any. */
  activeNarration: string | null;
  /** Active menu, when current node is a `menu`. */
  activeMenu: ActiveMenu | null;
  /** Variable values seen during this playback (preview-only, not Ren'Py). */
  vars: Record<string, PreviewValue>;
  /** Inventory state mirrored from inventoryOp nodes. */
  inventory: Record<RenPyIdentifier, number>;
  /** Stat state mirrored from statOp nodes. */
  stats: Record<RenPyIdentifier, number>;
  /** Relationships indexed by `<characterId>.<track>`. */
  relationships: Record<string, number>;
  /** Most-recent transition emitted (so the renderer can animate). */
  transition: string | null;
  /** Active call stack (target labels). Empty if not inside a call. */
  callStack: string[];
  /** Audio channels currently playing. Used by the renderer for indicators. */
  audio: AudioState;
  /** Reason the state machine is currently halted (waiting for user input). */
  halt: HaltReason | null;
  /** Recent debug log entries (e.g. python notes). Capped to ~20 lines. */
  log: string[];
}

export interface StageState {
  background: { tag: string; asset: AssetRef } | null;
  /** Currently-shown sprites, keyed by image tag (Ren'Py replaces by tag). */
  sprites: Record<string, ShownSprite>;
}

export interface ShownSprite {
  characterId: string | null; // may be missing if tag wasn't a known character
  tag: string;
  expression: string | undefined;
  at: string | undefined;
  zorder: number;
  asset: AssetRef | null;
}

export interface ActiveSay {
  characterId: string | undefined;
  /** Display name resolved against the catalog (or "Narrator" for sayless). */
  speaker: string;
  /** Color of the speaker label (resolved from the character or default). */
  color: string;
  text: string;
  voice: AssetRef | undefined;
  expression: string | undefined;
}

export interface ActiveMenu {
  prompt: string | undefined;
  choices: ActiveMenuChoice[];
}

export interface ActiveMenuChoice {
  id: string;
  text: string;
  /** False if the menu's `condition` evaluated to false; choice is grayed out. */
  enabled: boolean;
}

export interface AudioState {
  music: AssetRef | null;
  /** Last-played sounds (for indicator beeps; trimmed to last 4). */
  recentSounds: Array<{ asset: AssetRef; channel: string; at: number }>;
  /** Most recent voice line. */
  voice: AssetRef | null;
}

export type HaltReason =
  | { kind: 'awaitingSay'; nodeId: string }
  | { kind: 'awaitingNarration'; nodeId: string }
  | { kind: 'awaitingMenu'; nodeId: string }
  | { kind: 'awaitingPause'; nodeId: string; seconds: number | undefined }
  | { kind: 'sceneEnded'; nodeId: string | null }
  | { kind: 'error'; message: string };

export type PreviewValue = string | number | boolean;

/**
 * The world the playback machine consults while stepping. Bundles the lookup
 * tables it needs without forcing callers to pass entire SpecBundle.
 */
export interface PlaybackWorld {
  charactersById: Map<string, Character>;
  /** Lookup label name -> scene that owns it (project-wide). */
  scenesByLabel: Map<string, SceneSpec>;
}

/** Helper used by emitter and tests. */
export function getNode(scene: SceneSpec, id: string): SceneNode | undefined {
  return scene.nodes.find((n) => n.id === id);
}
