/**
 * @renpy-ui/preview
 *
 * HTML scene renderer. Stub in M0; real implementation lands in M6.
 */

export interface PreviewState {
  activeSceneId: string | null;
  activeNodeId: string | null;
}

export function createPreviewState(): PreviewState {
  return { activeSceneId: null, activeNodeId: null };
}
