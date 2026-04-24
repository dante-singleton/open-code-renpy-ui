import type { ProjectManifest } from '@renpy-ui/spec';
import { generatedHeader } from '../utils/header';
import { finalize, renPyString } from '../utils/render';

/**
 * Emit game/generated/_manifest.rpy — a light init block that sets
 * config.name / config.version so the game works out of the box.
 */
export function emitManifest(project: ProjectManifest): string {
  const lines: string[] = [...generatedHeader('.renpy-ui/project.json')];
  lines.push('init offset = -1');
  lines.push('');
  lines.push('init python:');
  lines.push(`    config.name = ${renPyString(project.name)}`);
  lines.push(`    config.version = ${renPyString(project.version)}`);
  return finalize(lines);
}
