import { useEffect } from 'react';
import { useProjectStore } from '../state/project';

/**
 * Wires Ctrl/Cmd-Z / Shift+Cmd-Z / Cmd-S to the project store. The QuickInsert
 * palette handles "/" itself.
 */
export function useGlobalShortcuts(): void {
  const save = useProjectStore((s) => s.save);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const mod = e.ctrlKey || e.metaKey;
      const el = e.target as HTMLElement | null;
      const inField =
        el?.tagName === 'INPUT' || el?.tagName === 'TEXTAREA' || el?.tagName === 'SELECT';

      if (mod && (e.key === 'z' || e.key === 'Z')) {
        if (inField) return; // let undo work natively in text fields
        e.preventDefault();
        if (e.shiftKey) useProjectStore.temporal.getState().redo();
        else useProjectStore.temporal.getState().undo();
      } else if (mod && (e.key === 'y' || e.key === 'Y')) {
        if (inField) return;
        e.preventDefault();
        useProjectStore.temporal.getState().redo();
      } else if (mod && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        void save();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [save]);
}
