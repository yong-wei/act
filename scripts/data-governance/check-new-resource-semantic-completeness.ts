#!/usr/bin/env tsx

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { getAllRegisteredResourceMetadata } from '@/lib/resource-registry-metadata';
import {
  mergeGateResults,
  parseAddedRuntimeProjectionChanges,
  parseChangedRegisteredResourceIds,
  validateChangedRegisteredResources,
  validateChangedRuntimeResourceProjections,
} from '@/lib/data-governance/new-resource-semantic-completeness-gate';

const REGISTERED_RESOURCE_METADATA_PATH = 'src/lib/resource-registry-metadata.ts';
const RUNTIME_RESOURCE_PROJECTIONS_PATH = 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl';
const TEACHING_RESOURCE_SEED_PATHS = [
  'scripts/db/seed-interactive-resources.ts',
  'scripts/db/seed-demo-resources.mjs',
  'scripts/db/seed-lesson02-complete.mjs',
];
const TEACHING_RESOURCE_REPAIR_PATH = 'scripts/db/repair-resource-identity-bindings.ts';

interface CliOptions {
  base: string | null;
  staged: boolean;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.staged) {
    assertNoUnstagedTargetChanges([
      REGISTERED_RESOURCE_METADATA_PATH,
      RUNTIME_RESOURCE_PROJECTIONS_PATH,
      ...TEACHING_RESOURCE_SEED_PATHS,
      TEACHING_RESOURCE_REPAIR_PATH,
    ]);
  }
  const registeredResourceDiff = gitDiff(options, REGISTERED_RESOURCE_METADATA_PATH);
  const runtimeProjectionDiff = gitDiff(options, RUNTIME_RESOURCE_PROJECTIONS_PATH);
  const teachingResourceDiffs = TEACHING_RESOURCE_SEED_PATHS.map((filePath) => gitDiff(options, filePath));
  const repairDiff = gitDiff(options, TEACHING_RESOURCE_REPAIR_PATH);
  const resourceIds = uniqueSorted([
    ...parseChangedRegisteredResourceIds(readText(REGISTERED_RESOURCE_METADATA_PATH), registeredResourceDiff),
    ...teachingResourceDiffs.flatMap(parseChangedTeachingResourceRegistryIds),
    ...parseChangedTeachingResourceRepairRegistryIds(repairDiff),
  ]);
  const registeredResourcesById = new Map(getAllRegisteredResourceMetadata().map((resource) => [resource.id, resource]));
  const missingRegisteredResourceIds = resourceIds.filter((id) => !registeredResourcesById.has(id));
  const registeredResources = resourceIds
    .map((id) => registeredResourcesById.get(id))
    .filter((resource): resource is NonNullable<typeof resource> => Boolean(resource));
  const runtimeProjectionChanges = parseAddedRuntimeProjectionChanges(runtimeProjectionDiff);
  const runtimeProjectionRows = runtimeProjectionChanges.rows;
  const result = mergeGateResults([
    {
      passed: missingRegisteredResourceIds.length === 0,
      checked: missingRegisteredResourceIds.length,
      issues: missingRegisteredResourceIds.map((id) => ({
        family: 'registered-resource',
        resourceId: id,
        code: 'missing-registered-resource-metadata',
        message: 'Changed registered resource id could not be loaded from materialized metadata; check object key and internal id consistency.',
      })),
    },
    validateChangedRegisteredResources(registeredResources),
    runtimeProjectionChanges.result,
    validateChangedRuntimeResourceProjections(runtimeProjectionRows),
  ]);

  if (result.passed) {
    console.log(`new-resource semantic completeness passed (${result.checked} changed resources checked)`);
    return;
  }

  console.error(`new-resource semantic completeness failed (${result.issues.length} issue(s))`);
  for (const item of result.issues) {
    console.error(`- ${item.family}:${item.resourceId} ${item.code}: ${item.message}`);
  }
  process.exit(1);
}

function parseChangedTeachingResourceRegistryIds(diff: string): string[] {
  return diff
    .split(/\r?\n/)
    .filter((line) => line.startsWith('+') && !line.startsWith('+++'))
    .flatMap((line) => Array.from(line.matchAll(/\bregistryId\s*:\s*['"]([^'"]+)['"]/g), (match) => match[1]));
}

function parseChangedTeachingResourceRepairRegistryIds(diff: string): string[] {
  return diff
    .split(/\r?\n/)
    .filter((line) => line.startsWith('+') && !line.startsWith('+++'))
    .flatMap((line) => Array.from(line.matchAll(/^\+\s*(?:['"][^'"]+['"]|[A-Za-z0-9_$]+)\s*:\s*['"]([^'"]+)['"]/g), (match) => match[1]));
}

function assertNoUnstagedTargetChanges(filePaths: readonly string[]) {
  const unstagedFiles = filePaths.filter((filePath) => (
    gitStatus(['diff', '--quiet', '--', filePath]) !== 0
  ));
  if (unstagedFiles.length === 0) return;
  console.error('new-resource semantic completeness cannot run with unstaged changes in gated resource files.');
  for (const filePath of unstagedFiles) {
    console.error(`- ${filePath}`);
  }
  console.error('Stage or discard those changes so the gate checks the exact commit content.');
  process.exit(1);
}

function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = { base: null, staged: true };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--base') {
      options.base = args[index + 1] ?? '';
      options.staged = false;
      index += 1;
      continue;
    }
    if (arg === '--staged') {
      options.base = null;
      options.staged = true;
      continue;
    }
    if (arg === '--help' || arg === '-h') {
      console.log('Usage: tsx scripts/data-governance/check-new-resource-semantic-completeness.ts [--staged|--base <ref>]');
      process.exit(0);
    }
    throw new Error(`Unknown argument: ${arg}`);
  }
  if (options.base !== null && options.base.trim() === '') {
    throw new Error('--base requires a Git ref');
  }
  return options;
}

function gitDiff(options: CliOptions, filePath: string): string {
  if (!existsSync(path.join(process.cwd(), filePath))) return '';
  const args = options.staged
    ? ['diff', '--cached', '--unified=0', '--', filePath]
    : ['diff', '--unified=0', `${options.base}...HEAD`, '--', filePath];
  return execFileSync('git', args, { encoding: 'utf8' });
}

function gitStatus(args: string[]): number {
  try {
    execFileSync('git', args, { stdio: 'ignore' });
    return 0;
  } catch (error) {
    if (error && typeof error === 'object' && 'status' in error && typeof error.status === 'number') {
      return error.status;
    }
    return 1;
  }
}

function readText(filePath: string): string {
  return readFileSync(path.join(process.cwd(), filePath), 'utf8');
}

function uniqueSorted(values: readonly string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

main();
