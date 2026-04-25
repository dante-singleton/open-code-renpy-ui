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
import { VariablesView } from './views/VariablesView';

export function App() {
  useGlobalShortcuts();
  const tab = useWorkspaceStore((s) => s.tab);

  useEffect(() => {
    const storage = createStorage();
    useProjectStore.getState().setStorage(storage);
    if (!storage.canPickProject) {
      void useProjectStore.getState().reloadProject();
    }
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
