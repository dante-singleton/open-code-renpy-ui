import { emitCharacters } from './emitters/characters';
import { emitManifest } from './emitters/manifest';
import { emitScene } from './emitters/scene';
import { emitScreen } from './emitters/screens';
import { emitVariables } from './emitters/variables';
import { buildSymbolTable } from './symbols';
import type { GenerateResult, GeneratedFile, SpecBundle } from './types';

/**
 * Generate every .rpy file for a validated SpecBundle.
 *
 * Output files are always listed in deterministic order (sorted by path),
 * which snapshot tests rely on.
 */
export function generate(bundle: SpecBundle): GenerateResult {
  const sym = buildSymbolTable(bundle);
  const files: GeneratedFile[] = [];
  const warnings: string[] = [];
  const genDir = bundle.project.paths.generatedDir;

  files.push({
    path: `${genDir}/_manifest.rpy`,
    contents: emitManifest(bundle.project),
  });

  files.push({
    path: `${genDir}/characters.rpy`,
    contents: emitCharacters(bundle.characters),
  });

  files.push({
    path: `${genDir}/variables.rpy`,
    contents: emitVariables(bundle.variables),
  });

  const scenes = [...bundle.scenes].sort((a, b) =>
    a.label < b.label ? -1 : a.label > b.label ? 1 : 0,
  );
  for (const scene of scenes) {
    files.push({
      path: `${genDir}/scenes/${scene.label}.rpy`,
      contents: emitScene(scene, sym),
    });
  }

  const screens = [...bundle.screens].sort((a, b) =>
    a.name < b.name ? -1 : a.name > b.name ? 1 : 0,
  );
  for (const screen of screens) {
    files.push({
      path: `${genDir}/screens/${screen.name}.rpy`,
      contents: emitScreen(screen),
    });
  }

  files.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  return { files, warnings };
}
