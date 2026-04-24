export type Severity = 'error' | 'warning' | 'info';

export interface Diagnostic {
  severity: Severity;
  code: string;
  message: string;
  /** Path to the spec document (relative to project root) that triggered this. */
  source?: string;
  /** A node id, edge id, character id, etc. */
  location?: string;
}

export function emptyDiagnostics(): Diagnostic[] {
  return [];
}

export function hasErrors(d: Diagnostic[]): boolean {
  return d.some((x) => x.severity === 'error');
}
