/**
 * React bindings for the preview runtime.
 *
 * The component is intentionally small: it owns a `PlaybackState` and
 * dispatches into the pure machine. Asset URL resolution is delegated to a
 * caller-supplied function so the component is agnostic of Tauri / browser
 * concerns.
 */
import type { Id } from '@renpy-ui/spec';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type PlaybackMachine, type PlaybackState, createMachine } from '../runtime';
import type { CreateMachineInput } from '../runtime/machine';

export type AssetResolver = (assetRef: string) => string | null;

export interface ScenePreviewProps {
  /** Project's scenes / characters / assets — feeds the machine. */
  input: CreateMachineInput;
  /** Scene to play; changes here re-init the machine. */
  sceneId: Id;
  /** Optional: jump to a particular node when it changes (Canvas integration). */
  jumpToNodeId?: Id | null;
  /** Resolves an `images/foo.png` asset ref to a URL the browser can load. */
  resolveAsset: AssetResolver;
  /** Notified when the user double-clicks a sprite/background to "open" it. */
  onRevealNode?: (nodeId: Id) => void;
}

export function ScenePreview({
  input,
  sceneId,
  jumpToNodeId,
  resolveAsset,
  onRevealNode,
}: ScenePreviewProps) {
  const machine = useMemo<PlaybackMachine>(() => createMachine(input), [input]);
  const [state, setState] = useState<PlaybackState>(() => machine.start(sceneId));
  const previousSceneId = useRef(sceneId);

  // Re-init when the scene changes externally.
  useEffect(() => {
    if (previousSceneId.current !== sceneId) {
      previousSceneId.current = sceneId;
      setState(machine.start(sceneId));
    }
  }, [machine, sceneId]);

  // Re-init when the machine input changes (graph mutated under us).
  useEffect(() => {
    setState((prev) => (prev.sceneId === sceneId ? machine.start(sceneId) : prev));
    // We only depend on `machine` (memoised by `input`) and `sceneId`.
  }, [machine, sceneId]);

  // Handle external jump-to-node requests.
  useEffect(() => {
    if (!jumpToNodeId) return;
    setState((prev) => machine.jumpToNode(prev, jumpToNodeId));
  }, [machine, jumpToNodeId]);

  const onStep = useCallback(() => setState((s) => machine.step(s)), [machine]);
  const onReset = useCallback(() => setState((s) => machine.reset(s)), [machine]);
  const onChoose = useCallback(
    (choiceId: string) => setState((s) => machine.step(s, { choiceId })),
    [machine],
  );

  return (
    <div className="flex flex-col w-full h-full bg-bg-0 text-fg overflow-hidden">
      <Stage state={state} resolveAsset={resolveAsset} onRevealNode={onRevealNode} />
      <Overlay state={state} onChoose={onChoose} onStep={onStep} />
      <Controls state={state} onStep={onStep} onReset={onReset} />
    </div>
  );
}

// ---------- subcomponents ----------

function Stage({
  state,
  resolveAsset,
  onRevealNode,
}: {
  state: PlaybackState;
  resolveAsset: AssetResolver;
  onRevealNode?: (nodeId: Id) => void;
}) {
  const bgUrl = state.stage.background ? resolveAsset(state.stage.background.asset) : null;
  const sprites = Object.values(state.stage.sprites).sort((a, b) => a.zorder - b.zorder);

  return (
    <div
      className="relative flex-1 min-h-0 overflow-hidden"
      style={{
        background: bgUrl
          ? `center / cover no-repeat url(${JSON.stringify(bgUrl)})`
          : 'radial-gradient(circle at 30% 20%, #1a1a26 0%, var(--color-bg-0) 70%)',
      }}
      data-testid="preview-stage"
    >
      {/* Sprite layer */}
      <div className="absolute inset-0 flex items-end justify-around pb-8 pointer-events-none">
        {sprites.map((sp) => {
          const url = sp.asset ? resolveAsset(sp.asset) : null;
          return (
            <button
              type="button"
              key={sp.tag}
              onClick={() => state.currentNodeId && onRevealNode?.(state.currentNodeId)}
              className="pointer-events-auto h-[80%] flex items-end justify-center transition-transform hover:-translate-y-1"
              style={positionStyle(sp.at)}
              aria-label={`Reveal ${sp.tag}`}
            >
              {url ? (
                <img
                  src={url}
                  alt={sp.tag}
                  className="max-h-full max-w-full object-contain drop-shadow-lg"
                />
              ) : (
                <PlaceholderSprite tag={sp.tag} expression={sp.expression} />
              )}
            </button>
          );
        })}
      </div>

      {/* Approximate-fidelity badge */}
      <div className="absolute top-2 right-2 px-2 py-0.5 text-[10px] uppercase tracking-wider rounded-md bg-bg-1/80 border border-[color:var(--color-border)] text-fg-muted">
        preview · approximate
      </div>
    </div>
  );
}

function positionStyle(at: string | undefined): React.CSSProperties {
  switch (at) {
    case 'left':
      return { marginRight: 'auto', marginLeft: '5%' };
    case 'right':
      return { marginLeft: 'auto', marginRight: '5%' };
    case 'offscreen_left':
      return { marginRight: 'auto', marginLeft: '-30%', opacity: 0.4 };
    case 'offscreen_right':
      return { marginLeft: 'auto', marginRight: '-30%', opacity: 0.4 };
    default:
      return {};
  }
}

function PlaceholderSprite({ tag, expression }: { tag: string; expression: string | undefined }) {
  // When the asset can't be resolved we still want a visual cue.
  return (
    <div className="w-32 h-48 rounded-lg border-2 border-dashed border-[color:var(--color-border-strong)] bg-bg-1/60 flex flex-col items-center justify-center text-xs text-fg-muted">
      <span className="font-mono">{tag}</span>
      {expression && <span className="font-mono opacity-70">{expression}</span>}
    </div>
  );
}

function Overlay({
  state,
  onChoose,
  onStep,
}: {
  state: PlaybackState;
  onChoose: (choiceId: string) => void;
  onStep: () => void;
}) {
  if (state.activeMenu) {
    return (
      <div className="border-t border-[color:var(--color-border)] bg-bg-1 p-3 space-y-2">
        {state.activeMenu.prompt && (
          <p className="font-serif text-md text-fg-secondary italic">{state.activeMenu.prompt}</p>
        )}
        <ul className="space-y-1.5">
          {state.activeMenu.choices.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                disabled={!c.enabled}
                onClick={() => onChoose(c.id)}
                className={`w-full text-left px-3 py-2 rounded-md font-serif text-md ${
                  c.enabled
                    ? 'bg-bg-2 hover:bg-bg-3 text-fg border border-[color:var(--color-border)]'
                    : 'bg-bg-1 text-fg-muted line-through cursor-not-allowed border border-[color:var(--color-border)]'
                }`}
              >
                {c.text}
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (state.activeSay) {
    return (
      <button
        type="button"
        onClick={onStep}
        className="w-full text-left border-t border-[color:var(--color-border)] bg-bg-1 p-3 hover:bg-bg-2"
      >
        <div
          className="text-xs uppercase tracking-wide font-semibold mb-1"
          style={{ color: state.activeSay.color }}
        >
          {state.activeSay.speaker}
          {state.activeSay.expression && (
            <span className="ml-2 text-fg-muted text-[10px]">· {state.activeSay.expression}</span>
          )}
        </div>
        <div className="font-serif text-md text-fg leading-snug">{state.activeSay.text}</div>
      </button>
    );
  }

  if (state.activeNarration) {
    return (
      <button
        type="button"
        onClick={onStep}
        className="w-full text-left border-t border-[color:var(--color-border)] bg-bg-1 p-3 hover:bg-bg-2"
      >
        <div className="font-serif text-md italic text-fg-secondary leading-snug">
          {state.activeNarration}
        </div>
      </button>
    );
  }

  if (state.halt?.kind === 'sceneEnded') {
    return (
      <div className="border-t border-[color:var(--color-border)] bg-bg-1 p-3 text-center text-xs text-fg-muted">
        Scene ended.
      </div>
    );
  }

  if (state.halt?.kind === 'error') {
    return (
      <div className="border-t border-[color:var(--color-border)] bg-bg-1 p-3 text-xs text-[color:var(--color-danger)]">
        {state.halt.message}
      </div>
    );
  }

  return (
    <div className="border-t border-[color:var(--color-border)] bg-bg-1 p-3 text-center text-xs text-fg-muted">
      Click "Step" to begin.
    </div>
  );
}

function Controls({
  state,
  onStep,
  onReset,
}: {
  state: PlaybackState;
  onStep: () => void;
  onReset: () => void;
}) {
  const ended = state.halt?.kind === 'sceneEnded';
  const errored = state.halt?.kind === 'error';
  return (
    <div className="border-t border-[color:var(--color-border)] bg-bg-2 px-3 h-9 flex items-center gap-2 text-xs">
      <button
        type="button"
        onClick={onReset}
        className="px-2 py-1 rounded-md hover:bg-bg-3 text-fg-secondary"
      >
        Reset
      </button>
      <button
        type="button"
        onClick={onStep}
        disabled={ended || errored || state.activeMenu != null}
        className={`px-2 py-1 rounded-md ${
          ended || errored || state.activeMenu != null
            ? 'text-fg-muted cursor-not-allowed'
            : 'text-orange-400 hover:bg-bg-3'
        }`}
      >
        Step
      </button>
      <span className="ml-auto text-fg-muted font-mono">node {state.currentNodeId ?? '—'}</span>
      {state.audio.music && (
        <span className="text-fg-muted" title={state.audio.music}>
          ♪ {state.audio.music.split('/').pop()}
        </span>
      )}
    </div>
  );
}
