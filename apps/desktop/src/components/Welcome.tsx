import { Button } from '@renpy-ui/ui';
import { useEffect, useState } from 'react';

const STORAGE_KEY = 'renpy-ui:welcomed';

/**
 * Single-shot welcome dialog. Shown on the very first launch (or when
 * localStorage is wiped). Users dismiss with Esc, Enter, or "Get started"
 * and never see it again unless they reset state manually.
 */
export function Welcome() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY) !== 'yes') setOpen(true);
    } catch {
      // localStorage not available (e.g. SSR / private mode); skip silently.
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' || e.key === 'Enter') {
        e.preventDefault();
        dismiss();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  function dismiss() {
    try {
      localStorage.setItem(STORAGE_KEY, 'yes');
    } catch {
      // ignore
    }
    setOpen(false);
  }

  if (!open) return null;

  return (
    <div
      className="absolute inset-0 z-[var(--z-modal)] grid place-items-center bg-black/50 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) dismiss();
      }}
    >
      <section
        aria-label="Welcome"
        className="w-[520px] max-w-[92vw] rounded-xl border border-[color:var(--color-border)] bg-bg-1 shadow-lg overflow-hidden"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header
          className="px-5 py-4 flex items-center gap-3 border-b border-[color:var(--color-border)]"
          style={{
            background:
              'linear-gradient(135deg, var(--color-orange-500)20%, var(--color-purple-500)20%)',
          }}
        >
          <div
            className="w-8 h-8 rounded-md shrink-0"
            style={{
              background:
                'linear-gradient(135deg, var(--color-orange-500), var(--color-purple-500))',
            }}
          />
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Welcome to Open-Code-RenPy-UI</h1>
            <p className="text-xs text-fg-secondary">
              A spec-driven, node-based editor for Ren'Py visual novels.
            </p>
          </div>
        </header>

        <div className="p-5 space-y-4 text-sm">
          <p>Each tab at the top opens a different surface:</p>
          <ul className="space-y-1.5 pl-4 list-disc text-fg-secondary">
            <li>
              <span className="text-fg font-semibold">Canvas</span> — wire scenes by dropping nodes
              (press <kbd className={KBD}>/</kbd>) and connecting their handles. The right panel
              edits the selected node; the bottom strip shows problems and the live{' '}
              <code className="font-mono text-xs">.rpy</code> preview.
            </li>
            <li>
              <span className="text-fg font-semibold">Preview</span> — step through the active scene
              without launching Ren'Py. Useful for sanity-checking dialogue order and branching.
            </li>
            <li>
              <span className="text-fg font-semibold">
                Characters / Variables / Assets / Screens
              </span>{' '}
              — declare reusable spec entities. Imported assets, declared variables, and defined
              characters all appear in pickers throughout the canvas.
            </li>
          </ul>
          <p>
            Hit <kbd className={KBD}>Cmd</kbd>/<kbd className={KBD}>Ctrl</kbd> +{' '}
            <kbd className={KBD}>S</kbd> to save and codegen. Press <kbd className={KBD}>?</kbd> at
            any time to see all shortcuts.
          </p>
        </div>

        <footer className="px-5 py-3 border-t border-[color:var(--color-border)] flex items-center justify-end gap-2 bg-bg-2">
          <Button variant="primary" onClick={dismiss}>
            Get started
          </Button>
        </footer>
      </section>
    </div>
  );
}

const KBD =
  'inline-flex items-center justify-center min-w-[1.5rem] px-1 h-5 rounded-sm bg-bg-0 border border-[color:var(--color-border)] text-[10px] font-mono text-fg';
