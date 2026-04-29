import type {
  Asset,
  AssetIndex,
  Character,
  CharacterCatalog,
  SceneSpec,
  ScreenSpec,
  Variable,
} from '@renpy-ui/spec';

/**
 * Stable, frozen empty arrays/objects shared across selectors.
 *
 * Returning a fresh `[]` (or `{ specVersion: '1.0.0', characters: [] }`) from
 * a `useShallow` / Zustand selector on every call breaks the snapshot
 * caching that React 18's `useSyncExternalStore` relies on. The result is
 * "Maximum update depth exceeded" and a blank screen.
 *
 * Importing the constants below gives every selector the same reference to
 * compare against — `Object.is` succeeds and the snapshot stays stable.
 *
 * The arrays are frozen at runtime to surface accidental mutation, but the
 * TypeScript types are intentionally `T[]` (not `readonly T[]`) so call
 * sites that take `T[]` parameters still type-check.
 */

const _EMPTY_FROZEN: never[] = Object.freeze([]) as never[];

export const EMPTY_SCENES = _EMPTY_FROZEN as unknown as SceneSpec[];
export const EMPTY_CHARACTERS = _EMPTY_FROZEN as unknown as Character[];
export const EMPTY_VARIABLES = _EMPTY_FROZEN as unknown as Variable[];
export const EMPTY_ASSETS = _EMPTY_FROZEN as unknown as Asset[];
export const EMPTY_SCREENS = _EMPTY_FROZEN as unknown as ScreenSpec[];
export const EMPTY_STRING_LIST = _EMPTY_FROZEN as unknown as string[];

export const EMPTY_CHARACTER_CATALOG: CharacterCatalog = Object.freeze({
  specVersion: '1.0.0' as const,
  characters: EMPTY_CHARACTERS,
}) as CharacterCatalog;

export const EMPTY_ASSET_INDEX: AssetIndex = Object.freeze({
  specVersion: '1.0.0' as const,
  assets: EMPTY_ASSETS,
}) as AssetIndex;
