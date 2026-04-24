import type {
  AssetIndex,
  CharacterCatalog,
  ProjectManifest,
  SceneSpec,
  ScreenSpec,
  VariableCatalog,
} from '@renpy-ui/spec';

/** Everything needed to run the emitter; caller is responsible for loading it. */
export interface SpecBundle {
  project: ProjectManifest;
  characters: CharacterCatalog;
  variables: VariableCatalog;
  assets: AssetIndex;
  scenes: SceneSpec[];
  screens: ScreenSpec[];
}

export interface GeneratedFile {
  /** Path relative to the project root, e.g. "game/generated/scenes/intro.rpy". */
  path: string;
  contents: string;
}

export interface GenerateResult {
  files: GeneratedFile[];
  warnings: string[];
}
