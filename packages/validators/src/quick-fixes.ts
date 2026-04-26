import type { Diagnostic } from './types';

/**
 * Catalogue of available quick-fix actions per diagnostic code. The intent
 * is consumed by UIs (e.g. the Problems panel) to render an action button
 * next to a diagnostic. The actual mutation is performed by the consumer
 * because the validators package is intentionally I/O- and store-free.
 */
export type QuickFixKind =
  | 'remove-unreachable-node'
  | 'jump-to-node'
  | 'remove-asset-entry'
  | 'remove-dangling-edge';

export interface QuickFix {
  kind: QuickFixKind;
  label: string;
  /** Diagnostic source path (relative spec file) needed to act. */
  source: string;
  /** Diagnostic location (typically a node id). */
  location: string;
}

export function quickFixesFor(d: Diagnostic): QuickFix[] {
  if (!d.source || !d.location) return [];
  switch (d.code) {
    case 'UNREACHABLE_NODE':
      return [
        {
          kind: 'remove-unreachable-node',
          label: 'Remove node',
          source: d.source,
          location: d.location,
        },
      ];
    case 'DANGLING_CHOICE':
    case 'TRIVIAL_IF':
    case 'UNDECLARED_VARIABLE':
    case 'UNKNOWN_CHARACTER':
    case 'UNKNOWN_LABEL':
    case 'UNINDEXED_ASSET':
      return [
        {
          kind: 'jump-to-node',
          label: 'Reveal',
          source: d.source,
          location: d.location,
        },
      ];
    case 'MISSING_ASSET_FILE':
      return [
        {
          kind: 'remove-asset-entry',
          label: 'Remove asset entry',
          source: d.source,
          location: d.location,
        },
      ];
    default:
      return [];
  }
}
