/**
 * @renpy-ui/spec
 *
 * Source-of-truth types and Zod schemas for the Ren'Py UI spec. See SPEC.md
 * for the conceptual overview and on-disk layout.
 *
 * This is a stub in M0 — full schemas land in M1.
 */

export const SPEC_VERSION = '1.0.0' as const;

export type SpecVersion = typeof SPEC_VERSION;

/** Placeholder types; real Zod schemas ship in M1. */
export interface ProjectManifestStub {
  specVersion: SpecVersion;
  id: string;
  name: string;
}
