import { create } from 'zustand';

export type WorkspaceTab = 'canvas' | 'characters' | 'variables' | 'assets';

interface WorkspaceState {
  tab: WorkspaceTab;
  setTab(tab: WorkspaceTab): void;
}

/**
 * Workspace UI state: which top-level tab is visible. Kept in its own tiny
 * store so undo/redo never replays UI navigation.
 */
export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  tab: 'canvas',
  setTab(tab) {
    set({ tab });
  },
}));
