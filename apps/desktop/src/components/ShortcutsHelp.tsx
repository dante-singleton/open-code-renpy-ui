import { useEffect, useState } from 'react';

const KBD =
  'inline-flex items-center justify-center min-w-[1.5rem] px-1 h-5 rounded-sm bg-bg-0 border border-[color:var(--color-border)] text-[10px] font-mono text-fg';

const SHORTCUTS: Array<{ section: string; rows: Array<{ keys: string[]; desc: string }> }> = [
  {
    section: 'Workspace',
    rows: [
      { keys: ['?'], desc: 'Show this help' },
      { keys: ['Esc'], desc: 'Close any open overlay' },
    ],
  },
  {
    section: 'Editing',
    rows: [
      { keys: ['Cmd/Ctrl', 'S'], desc: 'Save the project (also runs codegen)' },
      { keys: ['Cmd/Ctrl', 'Z'], desc: 'Undo' },
      { keys: ['Cmd/Ctrl', 'Shift', 'Z'], desc: 'Redo' },
      { keys: ['Cmd/Ctrl', 'Y'], desc: 'Redo (alternate)' },
    ],
  },
  {
    section: 'Canvas',
    rows: [
      { keys: ['/'], desc: 'Open the quick-insert palette' },
      { keys: ['Backspace', 'Delete'], desc: 'Remove the selected nodes / edges' },
      { keys: ['Cmd/Ctrl + click'], desc: 'Add to current selection' },
    ],
  },
];

/**
 * Press `?` (Shift + /) anywhere outside of a text field to open. The overlay
 * dismisses on Esc, click outside, or `?` again.
 */
export function ShortcutsHelp() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement | null;
      const inField =
        el?.tagName === 'INPUT' ||
        el?.tagName === 'TEXTAREA' ||
        el?.tagName === 'SELECT' ||
        (el && el.getAttribute('contenteditable') === 'true');

      if (!inField && e.key === '?') {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (open && e.key === 'Escape') {
        e.preventDefault();
        setOpen(false);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="absolute inset-0 z-[var(--z-modal)] grid place-items-center bg-black/40 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) setOpen(false);
      }}
    >
      <section
        aria-label="Keyboard shortcuts"
        className="w-[520px] max-w-[92vw] rounded-lg border border-[color:var(--color-border)] bg-bg-1 shadow-lg overflow-hidden"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="px-4 py-3 border-b border-[color:var(--color-border)] flex items-center justify-between">
          <h2 className="text-md font-semibold">Keyboard shortcuts</h2>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-xs text-fg-muted hover:text-fg"
            aria-label="Close"
          >
            ✕
          </button>
        </header>
        <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
          {SHORTCUTS.map((s) => (
            <div key={s.section}>
              <div className="text-[10px] uppercase tracking-wider text-fg-muted mb-1.5">
                {s.section}
              </div>
              <ul className="space-y-1">
                {s.rows.map((row) => (
                  <li key={row.desc} className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-fg-secondary">{row.desc}</span>
                    <span className="flex items-center gap-1">
                      {row.keys.map((k, i) => (
                        <span
                          // Index key is fine here: a section's row.keys array is
                          // a stable string list bound to the static SHORTCUTS table.
                          key={`${row.desc}-${i}`}
                          className="flex items-center gap-1"
                        >
                          {i > 0 && <span className="text-[10px] text-fg-muted">+</span>}
                          <kbd className={KBD}>{k}</kbd>
                        </span>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
