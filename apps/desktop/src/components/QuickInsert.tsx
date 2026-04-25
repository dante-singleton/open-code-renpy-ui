import type { SceneNodeType } from '@renpy-ui/spec';
import { Input } from '@renpy-ui/ui';
import { useEffect, useMemo, useRef, useState } from 'react';
import { selectActiveScene, useProjectStore } from '../state/project';
import { CATEGORY_COLOR, NODE_CATALOG, makeNode } from '../state/templates';

/**
 * "/" command palette for inserting a node into the active scene.
 *
 * Shortcuts:
 *   /          open palette (when nothing else has focus)
 *   Enter      insert highlighted node
 *   Up / Down  move highlight
 *   Esc        close
 */
export function QuickInsert() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const scene = useProjectStore(selectActiveScene);
  const addNode = useProjectStore((s) => s.addNode);
  const selectNodes = useProjectStore((s) => s.selectNodes);

  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return NODE_CATALOG;
    return NODE_CATALOG.filter(
      (n) => n.label.toLowerCase().includes(q) || n.type.toLowerCase().includes(q),
    );
  }, [query]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const el = e.target as HTMLElement | null;
      const inField =
        el?.tagName === 'INPUT' ||
        el?.tagName === 'TEXTAREA' ||
        el?.tagName === 'SELECT' ||
        (el && el.getAttribute('contenteditable') === 'true');

      if (!open && e.key === '/' && !inField) {
        e.preventDefault();
        setOpen(true);
        setQuery('');
        setHighlight(0);
      } else if (open && e.key === 'Escape') {
        e.preventDefault();
        setOpen(false);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  function insert(type: SceneNodeType) {
    if (!scene) return;
    const center = computeInsertPosition(scene.nodes);
    const newNode = makeNode(type, center);
    addNode(newNode);
    selectNodes([newNode.id]);
    setOpen(false);
  }

  if (!open || !scene) return null;

  return (
    <div
      className="absolute inset-0 z-[var(--z-modal)] grid place-items-start pt-[15vh] bg-black/40 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) setOpen(false);
      }}
    >
      <section
        aria-label="Insert node"
        className="w-[480px] max-w-[92vw] rounded-lg border border-[color:var(--color-border)] bg-bg-1 shadow-lg overflow-hidden"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="p-2 border-b border-[color:var(--color-border)]">
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setHighlight(0);
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setHighlight((h) => Math.min(h + 1, items.length - 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setHighlight((h) => Math.max(h - 1, 0));
              } else if (e.key === 'Enter') {
                e.preventDefault();
                const item = items[highlight];
                if (item) insert(item.type);
              }
            }}
            placeholder="Type to insert a node…"
            autoComplete="off"
            spellCheck={false}
          />
        </div>
        <ul className="max-h-[50vh] overflow-y-auto py-1">
          {items.length === 0 && <li className="px-3 py-2 text-fg-muted text-sm">No matches</li>}
          {items.map((item, i) => (
            <li key={item.type}>
              <button
                type="button"
                aria-current={i === highlight}
                className={[
                  'w-full flex items-center gap-3 px-3 py-2 cursor-pointer select-none text-left',
                  i === highlight ? 'bg-bg-3' : 'hover:bg-bg-2',
                ].join(' ')}
                onMouseEnter={() => setHighlight(i)}
                onClick={() => insert(item.type)}
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ background: CATEGORY_COLOR[item.category] }}
                />
                <span className="text-sm text-fg">{item.label}</span>
                <span className="ml-auto text-xs font-mono text-fg-muted">{item.type}</span>
              </button>
            </li>
          ))}
        </ul>
        <div className="px-3 py-1.5 border-t border-[color:var(--color-border)] text-[10px] text-fg-muted flex justify-between">
          <span>↑↓ move · Enter insert · Esc cancel</span>
          <span>{items.length} item(s)</span>
        </div>
      </section>
    </div>
  );
}

function computeInsertPosition(nodes: { position: { x: number; y: number } }[]): {
  x: number;
  y: number;
} {
  if (nodes.length === 0) return { x: 60, y: 60 };
  let maxX = 0;
  let avgY = 0;
  for (const n of nodes) {
    if (n.position.x > maxX) maxX = n.position.x;
    avgY += n.position.y;
  }
  return { x: maxX + 240, y: avgY / nodes.length };
}
