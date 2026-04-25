import type { SpecBundle } from '@renpy-ui/codegen';
import {
  AssetIndex,
  CharacterCatalog,
  ProjectManifest,
  SPEC_PATHS,
  SceneSpec,
  ScreenSpec,
  VariableCatalog,
  migrate,
} from '@renpy-ui/spec';
import type { ProjectStorage } from '../storage';

/**
 * Browser-safe SpecBundle loader. Same shape as the Node loader in
 * `@renpy-ui/codegen/node`, but reads through the storage abstraction so it
 * works in both Tauri and the in-memory fallback.
 */
export class DesktopSpecLoadError extends Error {
  public readonly file: string;
  public readonly originalError?: unknown;

  constructor(message: string, file: string, originalError?: unknown) {
    super(message);
    this.name = 'DesktopSpecLoadError';
    this.file = file;
    this.originalError = originalError;
  }
}

export async function loadProjectFromStorage(storage: ProjectStorage): Promise<SpecBundle> {
  const project = await readAndParse(storage, SPEC_PATHS.project, ProjectManifest);
  const specDir = project.paths.specDir;

  const characters = await readAndParseOrDefault(
    storage,
    `${specDir}/characters.json`,
    CharacterCatalog,
    { specVersion: '1.0.0', characters: [] },
  );
  const variables = await readAndParseOrDefault(
    storage,
    `${specDir}/variables.json`,
    VariableCatalog,
    { specVersion: '1.0.0', variables: [] },
  );
  const assets = await readAndParseOrDefault(storage, `${specDir}/assets.json`, AssetIndex, {
    specVersion: '1.0.0',
    assets: [],
  });

  const sceneFiles = await storage.listSpecDir(`${specDir}/scenes`);
  const scenes: SceneSpec[] = [];
  for (const f of sceneFiles) {
    if (!f.endsWith('.json')) continue;
    scenes.push(await readAndParse(storage, f, SceneSpec));
  }

  const screenFiles = await storage.listSpecDir(`${specDir}/screens`);
  const screens: ScreenSpec[] = [];
  for (const f of screenFiles) {
    if (!f.endsWith('.json')) continue;
    screens.push(await readAndParse(storage, f, ScreenSpec));
  }

  return { project, characters, variables, assets, scenes, screens };
}

async function readAndParse<T>(
  storage: ProjectStorage,
  relPath: string,
  schema: { parse: (v: unknown) => T },
): Promise<T> {
  const text = await storage.readSpec(relPath);
  if (text == null) {
    throw new DesktopSpecLoadError(`Missing required spec file: ${relPath}`, relPath);
  }
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (err) {
    throw new DesktopSpecLoadError(`Invalid JSON in ${relPath}`, relPath, err);
  }
  const { doc } = migrate(json);
  try {
    return schema.parse(doc);
  } catch (err) {
    throw new DesktopSpecLoadError(`Schema validation failed for ${relPath}`, relPath, err);
  }
}

async function readAndParseOrDefault<T>(
  storage: ProjectStorage,
  relPath: string,
  schema: { parse: (v: unknown) => T },
  fallback: unknown,
): Promise<T> {
  const text = await storage.readSpec(relPath);
  if (text == null) return schema.parse(fallback);
  return readAndParse(storage, relPath, schema);
}
