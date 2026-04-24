/**
 * @renpy-ui/validators
 *
 * Referential integrity + static analysis over the spec. Stub in M0; rules
 * from SPEC.md §10 are implemented in M1–M5.
 */

export type Severity = 'error' | 'warning' | 'info';

export interface Diagnostic {
  severity: Severity;
  code: string;
  message: string;
  /** Relative path to the spec document that triggered the diagnostic. */
  source?: string;
  /** Node/edge id within the document, if applicable. */
  location?: string;
}

export function emptyDiagnostics(): Diagnostic[] {
  return [];
}
