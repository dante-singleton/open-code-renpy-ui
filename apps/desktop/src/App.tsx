import { StatusBar } from './components/StatusBar';
import { TopBar } from './components/TopBar';
import { CanvasPlaceholder } from './panels/CanvasPlaceholder';
import { Inspector } from './panels/Inspector';
import { Sidebar } from './panels/Sidebar';

export function App() {
  return (
    <div className="flex flex-col h-full bg-bg-0 text-fg">
      <TopBar />
      <main className="flex-1 min-h-0 grid grid-cols-[260px_1fr_320px] gap-2 p-2">
        <Sidebar />
        <CanvasPlaceholder />
        <Inspector />
      </main>
      <StatusBar />
    </div>
  );
}
