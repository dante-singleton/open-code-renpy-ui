/**
 * Emit JSON Schemas (2020-12) from the Zod definitions into schemas/.
 * Run via `pnpm --filter @renpy-ui/spec build:schemas`.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { zodToJsonSchema } from 'zod-to-json-schema';

import {
  AssetIndex,
  CharacterCatalog,
  ProjectManifest,
  SceneSpec,
  ScreenSpec,
  VariableCatalog,
} from '../src';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(__dirname, '../../../schemas');

const schemas: Array<{ name: string; schema: unknown }> = [
  { name: 'project.schema.json', schema: ProjectManifest },
  { name: 'characters.schema.json', schema: CharacterCatalog },
  { name: 'variables.schema.json', schema: VariableCatalog },
  { name: 'assets.schema.json', schema: AssetIndex },
  { name: 'scene.schema.json', schema: SceneSpec },
  { name: 'screen.schema.json', schema: ScreenSpec },
];

mkdirSync(outDir, { recursive: true });

for (const entry of schemas) {
  // biome-ignore lint/suspicious/noExplicitAny: zod-to-json-schema wants a ZodType
  const json = zodToJsonSchema(entry.schema as any, {
    name: entry.name.replace('.schema.json', ''),
    target: 'jsonSchema2019-09',
  });
  const path = resolve(outDir, entry.name);
  writeFileSync(path, `${JSON.stringify(json, null, 2)}\n`, 'utf8');
  console.log(`wrote ${path}`);
}
