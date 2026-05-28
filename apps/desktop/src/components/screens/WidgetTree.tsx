import type { ScreenWidget } from '@renpy-ui/spec';
import { Input, Select, cn } from '@renpy-ui/ui';
import { AssetPicker } from '../AssetPicker';
import { ExpressionBuilder } from '../ExpressionBuilder';
import { Field } from '../inspector/Field';
import {
  CONTAINER_KINDS,
  WIDGET_KINDS,
  type WidgetKind,
  type WidgetPath,
  appendChild,
  defaultWidget,
  isContainer,
  moveSibling,
  removeAt,
  replaceAt,
  switchKind,
  widgetAt,
} from './widgets';

interface WidgetTreeProps {
  /** Root widget for the slot. */
  root: ScreenWidget;
  /** Current editable selection within the tree (empty path = the root). */
  selectedPath: WidgetPath;
  onSelect(path: WidgetPath): void;
  onChange(next: ScreenWidget): void;
  onRemoveRoot?: () => void;
}

/**
 * Two-pane editor for a single screen slot:
 *   left: nested rows for the widget tree (click to select, ↑/↓ reorder, ×
 *         remove, "+" appends a child to a container)
 *   right: properties for the currently-selected widget
 */
export function WidgetTree({
  root,
  selectedPath,
  onSelect,
  onChange,
  onRemoveRoot,
}: WidgetTreeProps) {
  const selected = widgetAt(root, selectedPath);

  function patchSelected(next: ScreenWidget): void {
    onChange(replaceAt(root, selectedPath, next));
  }

  function appendTo(path: WidgetPath, kind: WidgetKind): void {
    const next = appendChild(root, path, defaultWidget(kind));
    onChange(next);
  }

  function remove(path: WidgetPath): void {
    if (path.length === 0) {
      onRemoveRoot?.();
      return;
    }
    onChange(removeAt(root, path));
    // Move selection to the parent on remove.
    onSelect(path.slice(0, -1));
  }

  function move(path: WidgetPath, delta: number): void {
    onChange(moveSibling(root, path, delta));
    const newIdx = (path[path.length - 1] ?? 0) + delta;
    onSelect([...path.slice(0, -1), newIdx]);
  }

  return (
    <div className="grid grid-cols-[260px_1fr] gap-2 min-h-0 h-full">
      <div className="bg-bg-1 border border-[color:var(--color-border)] rounded-md overflow-auto">
        <Tree
          widget={root}
          path={[]}
          selectedPath={selectedPath}
          onSelect={onSelect}
          onAppend={appendTo}
          onRemove={remove}
          onMove={move}
          isRoot
        />
      </div>
      <div className="bg-bg-1 border border-[color:var(--color-border)] rounded-md overflow-auto">
        {selected ? (
          <WidgetEditor
            widget={selected}
            isRoot={selectedPath.length === 0}
            onChange={patchSelected}
            onChangeKind={(kind) => patchSelected(switchKind(selected, kind))}
          />
        ) : (
          <div className="p-4 text-sm text-fg-muted">Select a widget on the left.</div>
        )}
      </div>
    </div>
  );
}

interface TreeProps {
  widget: ScreenWidget;
  path: WidgetPath;
  selectedPath: WidgetPath;
  onSelect(path: WidgetPath): void;
  onAppend(path: WidgetPath, kind: WidgetKind): void;
  onRemove(path: WidgetPath): void;
  onMove(path: WidgetPath, delta: number): void;
  isRoot?: boolean;
}

function Tree({
  widget,
  path,
  selectedPath,
  onSelect,
  onAppend,
  onRemove,
  onMove,
  isRoot,
}: TreeProps) {
  const isSelected = pathsEqual(path, selectedPath);
  const indentPx = path.length * 12;
  const container = isContainer(widget.kind);

  return (
    <div>
      <div
        className={cn(
          'flex items-center gap-1 pr-2 py-1 text-xs font-mono cursor-default select-none',
          isSelected ? 'bg-bg-3 text-fg' : 'text-fg-secondary hover:bg-bg-2 hover:text-fg',
        )}
        style={{ paddingLeft: 8 + indentPx }}
      >
        <button type="button" className="flex-1 text-left truncate" onClick={() => onSelect(path)}>
          <KindBadge kind={widget.kind} /> {summary(widget)}
        </button>
        {!isRoot && (
          <>
            <button
              type="button"
              className="text-[10px] text-fg-muted hover:text-fg px-1"
              onClick={() => onMove(path, -1)}
              title="Move up"
            >
              ↑
            </button>
            <button
              type="button"
              className="text-[10px] text-fg-muted hover:text-fg px-1"
              onClick={() => onMove(path, 1)}
              title="Move down"
            >
              ↓
            </button>
          </>
        )}
        <button
          type="button"
          className="text-[10px] text-fg-muted hover:text-fg px-1"
          onClick={() => onRemove(path)}
          title="Remove"
        >
          ×
        </button>
      </div>

      {container && (
        <div>
          {(widget as { children: ScreenWidget[] }).children.map((child, i) => {
            const childPath = [...path, i];
            return (
              <Tree
                // Path-derived keys give React stable identity per slot location.
                // ScreenWidget has no intrinsic id; positional keys work because
                // reorders go through `moveSibling`, which mutates the array.
                key={childPath.join('.')}
                widget={child}
                path={childPath}
                selectedPath={selectedPath}
                onSelect={onSelect}
                onAppend={onAppend}
                onRemove={onRemove}
                onMove={onMove}
              />
            );
          })}
          <AddChildRow indentPx={indentPx + 12} onAppend={(k) => onAppend(path, k)} />
        </div>
      )}
    </div>
  );
}

function AddChildRow({
  indentPx,
  onAppend,
}: {
  indentPx: number;
  onAppend: (k: WidgetKind) => void;
}) {
  return (
    <div className="flex items-center gap-2 py-1" style={{ paddingLeft: 8 + indentPx }}>
      <span className="text-[10px] text-fg-muted">+</span>
      <Select
        value=""
        onChange={(e) => {
          const kind = e.target.value as WidgetKind;
          if (kind) onAppend(kind);
          // The Select doesn't reset its DOM value automatically — set the
          // intent on the next tick so the user can pick the same kind twice.
          requestAnimationFrame(() => {
            (e.target as HTMLSelectElement).value = '';
          });
        }}
        options={[
          { value: '', label: 'Add child…' },
          ...WIDGET_KINDS.map((k) => ({ value: k, label: k })),
        ]}
        className="h-6 !text-[11px] w-32"
      />
    </div>
  );
}

function KindBadge({ kind }: { kind: WidgetKind }) {
  const isCt = CONTAINER_KINDS.has(kind);
  return (
    <span
      className={cn(
        'inline-block px-1 mr-1 rounded-xs text-[9px] uppercase tracking-wider align-middle',
        isCt
          ? 'bg-purple-700/40 text-purple-200 border border-purple-700/60'
          : 'bg-bg-3 text-fg-secondary border border-[color:var(--color-border)]',
      )}
    >
      {kind}
    </span>
  );
}

function summary(w: ScreenWidget): string {
  switch (w.kind) {
    case 'text':
      return short(w.text);
    case 'button':
      return short(w.text);
    case 'image':
      return short(w.asset);
    case 'bar':
      return `${short(w.value)} / ${short(w.range)}`;
    case 'frame':
    case 'vbox':
    case 'hbox': {
      const n = (w as { children: ScreenWidget[] }).children.length;
      return `${n} child${n === 1 ? '' : 'ren'}`;
    }
  }
}

function short(s: string, max = 40): string {
  const t = s.replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

function pathsEqual(a: WidgetPath, b: WidgetPath): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

// ---------- per-kind editor ----------

interface WidgetEditorProps {
  widget: ScreenWidget;
  isRoot: boolean;
  onChange(next: ScreenWidget): void;
  onChangeKind(next: WidgetKind): void;
}

function WidgetEditor({ widget, isRoot, onChange, onChangeKind }: WidgetEditorProps) {
  return (
    <div className="p-4 space-y-4">
      <header className="flex items-center justify-between">
        <div className="text-xs uppercase tracking-wide text-fg-muted">
          {isRoot ? 'Slot widget' : 'Widget'}
        </div>
        <Select
          value={widget.kind}
          onChange={(e) => onChangeKind(e.target.value as WidgetKind)}
          options={WIDGET_KINDS.map((k) => ({ value: k, label: k }))}
          className="w-32"
        />
      </header>

      <Field label="Style" hint="optional Ren'Py style name">
        <Input
          value={widget.style ?? ''}
          onChange={(e) =>
            onChange({ ...widget, style: e.target.value || undefined } as ScreenWidget)
          }
          placeholder="(default)"
        />
      </Field>

      <KindFields widget={widget} onChange={onChange} />
    </div>
  );
}

function KindFields({
  widget,
  onChange,
}: {
  widget: ScreenWidget;
  onChange(next: ScreenWidget): void;
}) {
  switch (widget.kind) {
    case 'frame':
      return (
        <>
          <Field label="Background" hint="hex / image / Ren'Py displayable">
            <Input
              value={widget.background ?? ''}
              onChange={(e) => onChange({ ...widget, background: e.target.value || undefined })}
              placeholder="#000a or images/ui/bg.png"
            />
          </Field>
          <Field label="Padding" hint="px on all sides">
            <Input
              type="number"
              value={widget.padding ?? ''}
              onChange={(e) =>
                onChange({
                  ...widget,
                  padding: e.target.value === '' ? undefined : Number(e.target.value),
                })
              }
            />
          </Field>
        </>
      );
    case 'vbox':
    case 'hbox':
      return (
        <Field label="Spacing" hint="px between children">
          <Input
            type="number"
            value={widget.spacing ?? ''}
            onChange={(e) =>
              onChange({
                ...widget,
                spacing: e.target.value === '' ? undefined : Number(e.target.value),
              })
            }
          />
        </Field>
      );
    case 'text':
      return (
        <>
          <Field label="Text" hint="Ren'Py text tags supported">
            <textarea
              value={widget.text}
              onChange={(e) => onChange({ ...widget, text: e.target.value })}
              className="w-full min-h-[80px] px-3 py-2 rounded-md bg-bg-0 text-fg font-serif border border-[color:var(--color-border)] focus-visible:outline-none focus-visible:border-orange-500 focus-visible:shadow-[var(--shadow-focus-orange)]"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Size" hint="px">
              <Input
                type="number"
                value={widget.size ?? ''}
                onChange={(e) =>
                  onChange({
                    ...widget,
                    size: e.target.value === '' ? undefined : Number(e.target.value),
                  })
                }
              />
            </Field>
            <Field label="Color" hint="hex">
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={widget.color ?? '#ffffff'}
                  onChange={(e) => onChange({ ...widget, color: e.target.value })}
                  className="w-9 h-9 rounded-md border border-[color:var(--color-border)] bg-bg-0 p-0"
                  aria-label="Pick text color"
                />
                <Input
                  value={widget.color ?? ''}
                  onChange={(e) => onChange({ ...widget, color: e.target.value || undefined })}
                  placeholder="#ffffff"
                />
              </div>
            </Field>
          </div>
        </>
      );
    case 'image':
      return (
        <>
          <Field label="Asset" hint="relative to game/">
            <AssetPicker
              value={widget.asset}
              onChange={(ref) => onChange({ ...widget, asset: ref })}
              kind="image"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="xalign" hint="0–1">
              <Input
                type="number"
                step="0.05"
                value={widget.xalign ?? ''}
                onChange={(e) =>
                  onChange({
                    ...widget,
                    xalign: e.target.value === '' ? undefined : Number(e.target.value),
                  })
                }
              />
            </Field>
            <Field label="yalign" hint="0–1">
              <Input
                type="number"
                step="0.05"
                value={widget.yalign ?? ''}
                onChange={(e) =>
                  onChange({
                    ...widget,
                    yalign: e.target.value === '' ? undefined : Number(e.target.value),
                  })
                }
              />
            </Field>
          </div>
        </>
      );
    case 'button':
      return (
        <>
          <Field label="Label">
            <Input
              value={widget.text}
              onChange={(e) => onChange({ ...widget, text: e.target.value })}
            />
          </Field>
          <Field label="Action" hint="Python expression evaluated by Ren'Py">
            <Input
              value={widget.action}
              onChange={(e) => onChange({ ...widget, action: e.target.value })}
              placeholder="Start(), Quit(confirm=False), …"
              className="font-mono text-xs"
            />
          </Field>
        </>
      );
    case 'bar':
      return (
        <>
          <Field label="Value" hint="Python expression">
            <ExpressionBuilder
              value={widget.value}
              onChange={(next) => onChange({ ...widget, value: next })}
              placeholder="love_points"
            />
          </Field>
          <Field label="Range" hint="Python expression">
            <ExpressionBuilder
              value={widget.range}
              onChange={(next) => onChange({ ...widget, range: next })}
              placeholder="100"
            />
          </Field>
        </>
      );
  }
}
