import { Suspense, lazy, useEffect } from 'react';
import { QuickInsert } from './components/QuickInsert';
import { ShortcutsHelp } from './components/ShortcutsHelp';
import { StatusBar } from './components/StatusBar';
import { TopBar } from './components/TopBar';
import { Welcome } from './components/Welcome';
import { WorkspaceTabs } from './components/WorkspaceTabs';
import { useGlobalShortcuts } from './lib/useGlobalShortcuts';
import { useProjectStore } from './state/project';
import { useWorkspaceStore } from './state/workspace';
import { createStorage } from './storage';

/**
 * Tab views are lazy-loaded so the initial bundle stays small. The Canvas
 * tab pulls in @xyflow/react (~150 KB) and the Preview tab pulls in
 * @renpy-ui/preview/react; neither is needed before the user navigates
 * to that surface.
 *
 * Each lazy chunk uses `Suspense` for fallback rendering. The loading
 * fallback is intentionally tiny so it never flashes for cached chunks.
 */
const CanvasView = lazy(() =>
  import('./views/CanvasView').then((m) => ({ default: m.CanvasView })),
);
const PreviewView = lazy(() =>
  import('./views/PreviewView').then((m) => ({ default: m.PreviewView })),
);
const CharactersView = lazy(() =>
  import('./views/CharactersView').then((m) => ({ default: m.CharactersView })),
);
const VariablesView = lazy(() =>
  import('./views/VariablesView').then((m) => ({ default: m.VariablesView })),
);
const AssetsView = lazy(() =>
  import('./views/AssetsView').then((m) => ({ default: m.AssetsView })),
);
const ScreensView = lazy(() =>
  import('./views/ScreensView').then((m) => ({ default: m.ScreensView })),
);

export function App() {
  useGlobalShortcuts();
  const tab = useWorkspaceStore((s) => s.tab);

  useEffect(() => {
    const storage = createStorage();
    useProjectStore.getState().setStorage(storage);
    let unsubscribe: (() => void) | null = null;
    if (!storage.canPickProject) {
      void useProjectStore.getState().reloadProject();
    }

    void (async () => {
      await Promise.resolve();
      try {
        unsubscribe = await storage.watchSpec(() => {
          const state = useProjectStore.getState();
          if (state.dirty.size === 0) {
            void state.reloadProject();
          }
        });
      } catch {
        // Watching is best-effort.
      }
    })();

    return () => {
      unsubscribe?.();
    };
  }, []);

  return (
    <div className="flex flex-col h-full bg-bg-0 text-fg relative">
      <TopBar />
      <WorkspaceTabs />
      <main className="flex-1 min-h-0 p-2">
        <Suspense fallback={<TabLoading />}>
          {tab === 'canvas' ? (
            <CanvasView />
          ) : tab === 'preview' ? (
            <PreviewView />
          ) : tab === 'characters' ? (
            <CharactersView />
          ) : tab === 'variables' ? (
            <VariablesView />
          ) : tab === 'assets' ? (
            <AssetsView />
          ) : (
            <ScreensView />
          )}
        </Suspense>
      </main>
      <StatusBar />
      <QuickInsert />
      <ShortcutsHelp />
      <Welcome />
    </div>
  );
}

function TabLoading() {
  return (
    <div className="flex items-center justify-center h-full text-xs text-fg-muted">Loading…</div>
  );
}
