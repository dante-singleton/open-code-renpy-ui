import type {
  AssetIndex,
  CharacterCatalog,
  ProjectManifest,
  SceneSpec,
  ScreenSpec,
  VariableCatalog,
} from '@renpy-ui/spec';

/**
 * Re-export of the SpecBundle shape so validator consumers don't need a
 * dependency on @renpy-ui/codegen.
 */
export interface SpecBundle {
  project: ProjectManifest;
  characters: CharacterCatalog;
  variables: VariableCatalog;
  assets: AssetIndex;
  scenes: SceneSpec[];
  screens: ScreenSpec[];
}
