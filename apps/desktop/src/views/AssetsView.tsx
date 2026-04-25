import type { Asset, AssetKind, AssetSubkind } from '@renpy-ui/spec';
import { Button, IconButton, Input, Panel, Select } from '@renpy-ui/ui';
import { useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useProjectStore } from '../state/project';

const KIND_OPTIONS: Array<{ value: AssetKind | 'all'; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'image', label: 'Images' },
  { value: 'audio', label: 'Audio' },
  { value: 'video', label: 'Video' },
  { value: 'font', label: 'Fonts' },
  { value: 'other', label: 'Other' },
];

const SUBKIND_OPTIONS: Array<{ value: AssetSubkind | ''; label: string }> = [
  { value: '', label: '(none)' },
  { value: 'background', label: 'background' },
  { value: 'sprite', label: 'sprite' },
  { value: 'ui', label: 'ui' },
  { value: 'music', label: 'music' },
  { value: 'sfx', label: 'sfx' },
  { value: 'voice', label: 'voice' },
];

export function AssetsView() {
  const [filterKind, setFilterKind] = useState<AssetKind | 'all'>('all');
  const [search, setSearch] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const assets = useProjectStore(useShallow((s) => s.bundle?.assets.assets ?? []));
  const upsertAsset = useProjectStore((s) => s.upsertAsset);
  const removeAsset = useProjectStore((s) => s.removeAsset);
  const importAssets = useProjectStore((s) => s.importAssets);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return assets.filter((a) => {
      if (filterKind !== 'all' && a.kind !== filterKind) return false;
      if (!q) return true;
      return (
        a.ref.toLowerCase().includes(q) ||
        a.tags.some((t) => t.toLowerCase().includes(q)) ||
        (a.subkind?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [assets, filterKind, search]);

  async function handleImport(kindHint?: AssetKind) {
    setErrorMsg(null);
    try {
      await importAssets({ kindHint });
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <Panel
      heading={`Assets (${assets.length})`}
      actions={
        <>
          <Button variant="ghost" size="sm" onClick={() => void handleImport('image')}>
            Import images…
          </Button>
          <Button variant="ghost" size="sm" onClick={() => void handleImport('audio')}>
            Import audio…
          </Button>
          <Button variant="primary" size="sm" onClick={() => void handleImport(undefined)}>
            Import…
          </Button>
        </>
      }
    >
      <div className="p-3 flex items-center gap-2 border-b border-[color:var(--color-divider)]">
        <Select
          value={filterKind}
          onChange={(e) => setFilterKind(e.target.value as AssetKind | 'all')}
          options={KIND_OPTIONS.map((k) => ({ value: k.value, label: k.label }))}
          className="w-32"
        />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by path, tag, or subkind…"
        />
      </div>

      {errorMsg && (
        <div className="px-3 py-2 text-xs text-[color:var(--color-danger)] bg-[color:var(--color-danger)]/10 border-b border-[color:var(--color-divider)]">
          {errorMsg}
        </div>
      )}

      <div className="p-3">
        {assets.length === 0 ? (
          <p className="text-sm text-fg-muted italic">
            No assets imported yet. Click "Import…" to add image, audio, or other files.
          </p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-fg-muted italic">No assets match the filter.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-fg-muted">
                <th className="py-1.5 pr-3 font-medium">Ref</th>
                <th className="py-1.5 pr-3 font-medium">Kind</th>
                <th className="py-1.5 pr-3 font-medium">Subkind</th>
                <th className="py-1.5 pr-3 font-medium">Tags</th>
                <th className="py-1.5 pr-3 font-medium">Size</th>
                <th className="py-1.5" aria-label="actions" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => (
                <Row
                  key={a.id}
                  asset={a}
                  onChange={(patch) => upsertAsset({ ...a, ...patch })}
                  onDelete={() => removeAsset(a.id)}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Panel>
  );
}

function Row({
  asset,
  onChange,
  onDelete,
}: {
  asset: Asset;
  onChange: (patch: Partial<Asset>) => void;
  onDelete: () => void;
}) {
  return (
    <tr className="border-t border-[color:var(--color-divider)] align-top">
      <td className="py-1.5 pr-3">
        <code className="text-xs font-mono text-fg break-all">{asset.ref}</code>
      </td>
      <td className="py-1.5 pr-3 text-xs text-fg-secondary capitalize">{asset.kind}</td>
      <td className="py-1.5 pr-3 w-32">
        <Select
          value={asset.subkind ?? ''}
          onChange={(e) =>
            onChange({
              subkind: (e.target.value || undefined) as AssetSubkind | undefined,
            })
          }
          options={SUBKIND_OPTIONS.map((s) => ({ value: s.value, label: s.label }))}
        />
      </td>
      <td className="py-1.5 pr-3">
        <Input
          value={asset.tags.join(', ')}
          onChange={(e) =>
            onChange({
              tags: e.target.value
                .split(',')
                .map((t) => t.trim())
                .filter(Boolean),
            })
          }
          placeholder="comma, separated"
        />
      </td>
      <td className="py-1.5 pr-3 text-xs text-fg-muted font-mono">{formatSize(asset.sizeBytes)}</td>
      <td className="py-1.5">
        <IconButton label="Remove asset" size="sm" onClick={onDelete}>
          <span aria-hidden>×</span>
        </IconButton>
      </td>
    </tr>
  );
}

function formatSize(bytes: number): string {
  if (bytes <= 0) return '—';
  const units = ['B', 'KB', 'MB', 'GB'];
  let v = bytes;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}
