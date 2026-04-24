import { readFile, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
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
import type { SpecBundle } from './types';

export class SpecLoadError extends Error {
  public readonly file: string;
  public readonly originalError?: unknown;

  constructor(message: string, file: string, originalError?: unknown) {
    super(message);
    this.name = 'SpecLoadError';
    this.file = file;
    this.originalError = originalError;
  }
}

/**
 * Load and Zod-validate every spec document in a project directory.
 * Missing optional files (characters/variables/assets/screens) are substituted
 * with empty defaults so the codegen can still run on greenfield projects.
 */
export async function loadProject(projectRoot: string): Promise<SpecBundle> {
  const root = resolve(projectRoot);

  const project = await readAndParse(join(root, SPEC_PATHS.project), ProjectManifest);
  const specDir = join(root, project.paths.specDir);

  const characters = await readAndParseOrDefault(
    join(specDir, 'characters.json'),
    CharacterCatalog,
    { specVersion: '1.0.0', characters: [] },
  );

  const variables = await readAndParseOrDefault(join(specDir, 'variables.json'), VariableCatalog, {
    specVersion: '1.0.0',
    variables: [],
  });

  const assets = await readAndParseOrDefault(join(specDir, 'assets.json'), AssetIndex, {
    specVersion: '1.0.0',
    assets: [],
  });

  const scenes = await readDirSpecs(join(specDir, 'scenes'), SceneSpec);
  const screens = await readDirSpecs(join(specDir, 'screens'), ScreenSpec);

  return { project, characters, variables, assets, scenes, screens };
}

async function readAndParse<T>(file: string, schema: { parse: (v: unknown) => T }): Promise<T> {
  let raw: string;
  try {
    raw = await readFile(file, 'utf8');
  } catch (err) {
    throw new SpecLoadError(`Missing required spec file: ${file}`, file, err);
  }
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (err) {
    throw new SpecLoadError(`Invalid JSON in ${file}`, file, err);
  }
  const { doc } = migrate(json);
  try {
    return schema.parse(doc);
  } catch (err) {
    throw new SpecLoadError(`Schema validation failed for ${file}`, file, err);
  }
}

async function readAndParseOrDefault<T>(
  file: string,
  schema: { parse: (v: unknown) => T },
  fallback: unknown,
): Promise<T> {
  try {
    await readFile(file, 'utf8');
  } catch {
    return schema.parse(fallback);
  }
  return readAndParse(file, schema);
}

async function readDirSpecs<T>(dir: string, schema: { parse: (v: unknown) => T }): Promise<T[]> {
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    return [];
  }
  const files = entries.filter((f) => f.endsWith('.json')).sort();
  const out: T[] = [];
  for (const f of files) {
    out.push(await readAndParse(join(dir, f), schema));
  }
  return out;
}
