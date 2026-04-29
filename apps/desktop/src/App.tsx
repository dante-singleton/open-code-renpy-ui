import { useEffect } from 'react';
import { QuickInsert } from './components/QuickInsert';
import { StatusBar } from './components/StatusBar';
import { TopBar } from './components/TopBar';
import { WorkspaceTabs } from './components/WorkspaceTabs';
import { useGlobalShortcuts } from './lib/useGlobalShortcuts';
import { Canvas } from './panels/Canvas';
import { CodeLens } from './panels/CodeLens';
import { Inspector } from './panels/Inspector';
import { Problems } from './panels/Problems';
import { Sidebar } from './panels/Sidebar';
import { useProjectStore } from './state/project';
import { useWorkspaceStore } from './state/workspace';
import { createStorage } from './storage';
import { AssetsView } from './views/AssetsView';
import { CharactersView } from './views/CharactersView';
import { PreviewView } from './views/PreviewView';
import { VariablesView } from './views/VariablesView';

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

    // After the first successful project load, start watching for external
    // changes. The storage layer no-ops on backends that can't watch.
    void (async () => {
      // Wait one tick so the initial reload has a chance to set the bundle.
      await Promise.resolve();
      try {
        unsubscribe = await storage.watchSpec(() => {
          const state = useProjectStore.getState();
          if (state.dirty.size === 0) {
            void state.reloadProject();
          }
          // If there are dirty buffers, leave them alone for now. A merge
          // prompt is on the M8 polish list.
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
      <main className="flex-1 min-h-0 grid grid-cols-[260px_1fr] gap-2 p-2">
        <Sidebar />
        {tab === 'canvas' ? (
          <div className="grid grid-rows-[1fr_220px] gap-2 min-h-0">
            <div className="grid grid-cols-[1fr_320px] gap-2 min-h-0">
              <Canvas />
              <Inspector />
            </div>
            <div className="grid grid-cols-[1fr_1fr] gap-2 min-h-0">
              <Problems />
              <CodeLens />
            </div>
          </div>
        ) : tab === 'preview' ? (
          <PreviewView />
        ) : tab === 'characters' ? (
          <CharactersView />
        ) : tab === 'variables' ? (
          <VariablesView />
        ) : (
          <AssetsView />
        )}
      </main>
      <StatusBar />
      <QuickInsert />
    </div>
  );
}
