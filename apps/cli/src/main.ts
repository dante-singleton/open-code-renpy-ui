#!/usr/bin/env node
/**
 * @renpy-ui/cli
 *
 *   renpy-ui generate <projectRoot>      Validate spec and write .rpy files.
 *   renpy-ui lint     <projectRoot>      Validate spec; print diagnostics.
 *
 * Exits non-zero on validation errors so CI can use it.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { type SpecBundle, generate } from '@renpy-ui/codegen';
import { loadProject, writeGenerated } from '@renpy-ui/codegen/node';
import { hasErrors, validateBundleWithEnv } from '@renpy-ui/validators';

const args = process.argv.slice(2);

async function main(): Promise<number> {
  const [command, ...rest] = args;

  if (!command || command === 'help' || command === '--help' || command === '-h') {
    printUsage();
    return 0;
  }

  switch (command) {
    case 'generate':
      return runGenerate(rest);
    case 'lint':
    case 'lint-spec':
      return runLint(rest);
    default:
      console.error(`Unknown command: ${command}`);
      printUsage();
      return 1;
  }
}

function printUsage(): void {
  console.log(`renpy-ui — Open-Code-RenPy-UI CLI

Usage:
  renpy-ui generate <projectRoot>   Validate spec and write .rpy files.
  renpy-ui lint     <projectRoot>   Validate spec; print diagnostics.

Exits non-zero on validation errors.
`);
}

async function runGenerate(args: string[]): Promise<number> {
  const projectRoot = args[0];
  if (!projectRoot) {
    console.error('Missing <projectRoot>');
    return 2;
  }

  const bundle = await loadProject(projectRoot);
  const diagnostics = validateWithDisk(projectRoot, bundle);
  printDiagnostics(diagnostics);
  if (hasErrors(diagnostics)) {
    console.error('\nGeneration aborted: spec has errors.');
    return 1;
  }

  const result = generate(bundle);
  for (const w of result.warnings) console.warn(`! ${w}`);

  const report = await writeGenerated(projectRoot, result.files);
  console.log(`Wrote ${report.written.length} file(s); ${report.unchanged.length} unchanged.`);
  for (const path of report.written) console.log(`  + ${path}`);
  return 0;
}

async function runLint(args: string[]): Promise<number> {
  const projectRoot = args[0];
  if (!projectRoot) {
    console.error('Missing <projectRoot>');
    return 2;
  }

  const bundle = await loadProject(projectRoot);
  const diagnostics = validateWithDisk(projectRoot, bundle);
  printDiagnostics(diagnostics);
  return hasErrors(diagnostics) ? 1 : 0;
}

/**
 * Build the env from disk. We resolve every AssetIndex ref against the
 * project root, mark whichever exists, and (for the existing ones) compute
 * a SHA-256 hash so STALE_ASSET_HASH diagnostics surface in CI.
 */
function validateWithDisk(
  projectRoot: string,
  bundle: SpecBundle,
): ReturnType<typeof validateBundleWithEnv> {
  // AssetRef paths are relative to the assets dir (game/), not the project
  // root. Use the manifest's `paths.assetsDir` so projects can re-locate.
  const root = resolve(projectRoot);
  const assetsDir = resolve(root, bundle.project.paths.assetsDir);
  const existing = new Set<string>();
  const hashes = new Map<string, string>();
  for (const a of bundle.assets.assets) {
    const abs = resolve(assetsDir, a.ref);
    if (!existsSync(abs)) continue;
    try {
      if (!statSync(abs).isFile()) continue;
    } catch {
      continue;
    }
    existing.add(a.ref);
    try {
      const buf = readFileSync(abs);
      hashes.set(a.ref, createHash('sha256').update(buf).digest('hex'));
    } catch {
      // ignore hash failure; existence check still applies
    }
  }
  return validateBundleWithEnv(bundle, {
    existingAssetFiles: existing,
    currentAssetHashes: hashes,
  });
}

function printDiagnostics(
  diagnostics: readonly {
    severity: string;
    code: string;
    message: string;
    source?: string;
    location?: string;
  }[],
): void {
  if (diagnostics.length === 0) {
    console.log('No diagnostics.');
    return;
  }
  for (const d of diagnostics) {
    const where = [d.source, d.location].filter(Boolean).join(' :: ');
    const tag = d.severity.toUpperCase();
    const suffix = where ? ` (${where})` : '';
    const stream = d.severity === 'error' ? console.error : console.warn;
    stream(`${tag} [${d.code}] ${d.message}${suffix}`);
  }
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error('Fatal:', err instanceof Error ? err.message : err);
    if (err instanceof Error && err.stack) console.error(err.stack);
    process.exit(2);
  });
