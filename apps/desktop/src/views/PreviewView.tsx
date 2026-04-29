import { ScenePreview } from '@renpy-ui/preview/react';
import { Panel } from '@renpy-ui/ui';
import { useCallback, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { EMPTY_ASSET_INDEX, EMPTY_CHARACTER_CATALOG, EMPTY_SCENES } from '../state/empty';
import { selectActiveScene, useProjectStore } from '../state/project';

/**
 * Preview tab. Wraps `ScenePreview` with a panel and adapters that pull the
 * current scene + characters + assets from the Zustand store and resolve
 * asset URLs through the active storage backend.
 */
export function PreviewView() {
  const scene = useProjectStore(selectActiveScene);
  const { scenes, characters, assets, storage, project, selectedNodeId } = useProjectStore(
    useShallow((s) => ({
      scenes: s.bundle?.scenes ?? EMPTY_SCENES,
      characters: s.bundle?.characters ?? EMPTY_CHARACTER_CATALOG,
      assets: s.bundle?.assets ?? EMPTY_ASSET_INDEX,
      storage: s.storage,
      project: s.bundle?.project ?? null,
      selectedNodeId: s.selectedNodeIds[0] ?? null,
    })),
  );
  const setActiveScene = useProjectStore((s) => s.setActiveScene);
  const selectNodes = useProjectStore((s) => s.selectNodes);

  const assetsDir = useMemo(
    () => (project ? project.paths.assetsDir.replace(/\/+$/, '') : 'game'),
    [project],
  );

  const resolveAsset = useCallback(
    (ref: string): string | null => {
      if (!storage) return null;
      const rooted = assetsDir ? `${assetsDir}/${ref}` : ref;
      return storage.resolveAssetUrl(rooted);
    },
    [storage, assetsDir],
  );

  const onRevealNode = useCallback(
    (nodeId: string) => {
      selectNodes([nodeId]);
    },
    [selectNodes],
  );

  // Memoise the input object so ScenePreview's createMachine doesn't re-run
  // on every render of this view.
  const input = useMemo(() => ({ scenes, characters, assets }), [scenes, characters, assets]);

  if (!scene) {
    return (
      <Panel heading="Preview">
        <div className="p-6 text-sm text-fg-muted">No scene selected.</div>
      </Panel>
    );
  }

  return (
    <Panel
      heading={`Preview · ${scene.title}`}
      scrollable={false}
      actions={
        <div className="flex items-center gap-1.5">
          <select
            value={scene.id}
            onChange={(e) => setActiveScene(e.target.value)}
            className="h-7 px-2 rounded-md bg-bg-0 text-fg text-xs border border-[color:var(--color-border)]"
          >
            {scenes.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>
        </div>
      }
    >
      <ScenePreview
        input={input}
        sceneId={scene.id}
        jumpToNodeId={selectedNodeId}
        resolveAsset={resolveAsset}
        onRevealNode={onRevealNode}
      />
    </Panel>
  );
}
