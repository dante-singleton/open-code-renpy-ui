import type { Asset, AssetKind, AssetSubkind } from '@renpy-ui/spec';
import { Input } from '@renpy-ui/ui';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useProjectStore } from '../state/project';

interface AssetPickerProps {
  /** Current value (an AssetRef relative to game/). */
  value: string;
  onChange: (ref: string) => void;
  /** Filter to a specific kind. */
  kind?: AssetKind;
  /** Optional subkind filter (e.g. show only "background" images). */
  subkind?: AssetSubkind;
  placeholder?: string;
  /** When the picker shows and a typed string doesn't match any asset, allow it. */
  allowCustom?: boolean;
}

/**
 * Combo control that lets the user pick an existing asset by its ref or type
 * a custom path (when `allowCustom` is true). Built as an Input + a popover
 * list rather than a native `<select>` so we can include thumbnails later.
 */
export function AssetPicker({
  value,
  onChange,
  kind,
  subkind,
  placeholder,
  allowCustom = true,
}: AssetPickerProps) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const wrapRef = useRef<HTMLDivElement>(null);

  const assets = useProjectStore(
    useShallow((s) =>
      (s.bundle?.assets.assets ?? []).filter(
        (a) => (kind ? a.kind === kind : true) && (subkind ? a.subkind === subkind : true),
      ),
    ),
  );

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return assets;
    return assets.filter(
      (a) => a.ref.toLowerCase().includes(q) || a.tags.some((t) => t.toLowerCase().includes(q)),
    );
  }, [assets, filter]);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [open]);

  const isKnown = assets.some((a) => a.ref === value);

  return (
    <div ref={wrapRef} className="relative">
      <Input
        value={value}
        onChange={(e) => {
          if (allowCustom) onChange(e.target.value);
        }}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        readOnly={!allowCustom}
        placeholder={placeholder}
        invalid={!!value && !isKnown && !allowCustom}
      />
      {open && (
        <div className="absolute z-[var(--z-popover)] left-0 right-0 mt-1 rounded-md border border-[color:var(--color-border)] bg-bg-1 shadow-md overflow-hidden">
          <div className="p-1.5 border-b border-[color:var(--color-border)]">
            <Input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter…"
              autoFocus
            />
          </div>
          <ul className="max-h-[240px] overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-fg-muted text-xs italic">
                No assets {kind ? `of kind "${kind}"` : ''}
                {subkind ? ` (${subkind})` : ''}
              </li>
            ) : (
              filtered.map((a) => (
                <Row
                  key={a.id}
                  asset={a}
                  active={a.ref === value}
                  onPick={(ref) => {
                    onChange(ref);
                    setOpen(false);
                    setFilter('');
                  }}
                />
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

function Row({
  asset,
  active,
  onPick,
}: {
  asset: Asset;
  active: boolean;
  onPick: (ref: string) => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={() => onPick(asset.ref)}
        aria-current={active}
        className={[
          'w-full flex items-center gap-2 px-3 py-1.5 text-left text-xs',
          active ? 'bg-bg-3 text-fg' : 'text-fg-secondary hover:bg-bg-2 hover:text-fg',
        ].join(' ')}
      >
        <span
          className={`inline-block w-1.5 h-1.5 rounded-full bg-${asset.kind === 'image' ? 'info' : asset.kind === 'audio' ? 'success' : 'warning'}`}
        />
        <span className="font-mono break-all">{asset.ref}</span>
        {asset.subkind && (
          <span className="ml-auto text-[10px] text-fg-muted">{asset.subkind}</span>
        )}
      </button>
    </li>
  );
}
