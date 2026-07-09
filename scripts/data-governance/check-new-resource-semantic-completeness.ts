#!/usr/bin/env tsx

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
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
const RESOURCE_COMPONENT_REGISTRY_PATH = 'src/lib/resource-registry.tsx';
const RUNTIME_RESOURCE_PROJECTIONS_PATH = 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl';
const TEACHING_RESOURCE_SEED_PATHS = [
  'scripts/db/seed-interactive-resources.ts',
  'scripts/db/seed-demo-resources.mjs',
  'scripts/db/seed-lesson02-complete.mjs',
];
const TEACHING_RESOURCE_REPAIR_PATH = 'scripts/db/repair-resource-identity-bindings.ts';
const PRESET_LESSON_RESOURCE_DIR = 'src/features/teacher/preset-lessons/presets';

interface CliOptions {
  base: string | null;
  staged: boolean;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const presetLessonPaths = listPresetLessonResourcePaths(options);
  const teachingResourcePaths = [
    ...TEACHING_RESOURCE_SEED_PATHS,
    ...presetLessonPaths,
  ];
  if (options.staged) {
    assertNoUnstagedTargetChanges([
      REGISTERED_RESOURCE_METADATA_PATH,
      RESOURCE_COMPONENT_REGISTRY_PATH,
      RUNTIME_RESOURCE_PROJECTIONS_PATH,
      ...teachingResourcePaths,
      TEACHING_RESOURCE_REPAIR_PATH,
    ]);
  }
  const registeredResourceDiff = gitDiff(options, REGISTERED_RESOURCE_METADATA_PATH);
  const resourceComponentRegistryDiff = gitDiff(options, RESOURCE_COMPONENT_REGISTRY_PATH);
  const runtimeProjectionDiff = gitDiff(options, RUNTIME_RESOURCE_PROJECTIONS_PATH);
  const teachingResourceDiffs = teachingResourcePaths.map((filePath) => gitDiff(options, filePath));
  const repairDiff = gitDiff(options, TEACHING_RESOURCE_REPAIR_PATH);
  const resourceIds = uniqueSorted([
    ...parseChangedRegisteredResourceIds(readText(REGISTERED_RESOURCE_METADATA_PATH), registeredResourceDiff),
    ...parseChangedResourceComponentRegistryIds(resourceComponentRegistryDiff),
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
  const addedLines = diff
    .split(/\r?\n/)
    .filter((line) => line.startsWith('+') && !line.startsWith('+++'))
    .map((line) => line.slice(1));
  const ids: string[] = [];
  let pendingRegistryExpression = false;

  for (const line of addedLines) {
    if (/\bregistryId\s*:/.test(line)) {
      const sameLineMatches = parseRegistryIdExpressionLiteralIds(line);
      if (sameLineMatches.length > 0) {
        ids.push(...sameLineMatches);
        pendingRegistryExpression = !line.includes(',');
        continue;
      }
      pendingRegistryExpression = true;
      continue;
    }
    if (!pendingRegistryExpression) continue;
    ids.push(...parseRegistryIdExpressionLiteralIds(line));
    if (line.includes(',')) {
      pendingRegistryExpression = false;
    }
  }

  return ids;
}

function parseRegistryIdExpressionLiteralIds(line: string): string[] {
  const expressionStart = line.match(/\bregistryId\s*:/);
  const expression = expressionStart ? line.slice(expressionStart.index! + expressionStart[0].length) : line;
  return Array.from(expression.matchAll(/(?:^|[?:])\s*['"]([^'"]+)['"]/g), (match) => match[1]);
}

function parseChangedResourceComponentRegistryIds(diff: string): string[] {
  const ids: string[] = [];
  let awaitingEntryId = false;
  for (const rawLine of diff.split(/\r?\n/)) {
    if (!rawLine.startsWith('+') || rawLine.startsWith('+++')) continue;
    const line = rawLine.slice(1);
    const entryKeyMatch = line.match(/^\s*['"]([^'"]+)['"]\s*:\s*\{/);
    if (entryKeyMatch) {
      ids.push(entryKeyMatch[1]);
      awaitingEntryId = true;
      continue;
    }
    const idMatch = line.match(/^\s{2,8}id\s*:\s*['"]([^'"]+)['"]/);
    if ((awaitingEntryId || idMatch) && idMatch) {
      ids.push(idMatch[1]);
      awaitingEntryId = false;
      continue;
    }
    if (/^\s*(?:component\s*:|\},?)/.test(line)) {
      awaitingEntryId = false;
    }
  }
  return ids;
}

function parseChangedTeachingResourceRepairRegistryIds(diff: string): string[] {
  return diff
    .split(/\r?\n/)
    .filter((line) => line.startsWith('+') && !line.startsWith('+++'))
    .flatMap((line) => Array.from(line.matchAll(/^\+\s*(?:['"][^'"]+['"]|[A-Za-z0-9_$]+)\s*:\s*['"]([^'"]+)['"]/g), (match) => match[1]));
}

function listPresetLessonResourcePaths(options: CliOptions): string[] {
  const dir = path.join(process.cwd(), PRESET_LESSON_RESOURCE_DIR);
  const worktreePaths = existsSync(dir)
    ? readdirSync(dir)
      .filter((fileName) => /\.(?:ts|tsx)$/.test(fileName))
      .map((fileName) => `${PRESET_LESSON_RESOURCE_DIR}/${fileName}`)
    : [];
  return uniqueSorted([...worktreePaths, ...gitChangedPaths(options, PRESET_LESSON_RESOURCE_DIR)]);
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
  const args = options.staged
    ? ['diff', '--cached', '--unified=0', '--', filePath]
    : ['diff', '--unified=0', `${options.base}...HEAD`, '--', filePath];
  return execFileSync('git', args, { encoding: 'utf8' });
}

function gitChangedPaths(options: CliOptions, dirPath: string): string[] {
  const args = options.staged
    ? ['diff', '--cached', '--name-only', '--', dirPath]
    : ['diff', '--name-only', `${options.base}...HEAD`, '--', dirPath];
  return execFileSync('git', args, { encoding: 'utf8' })
    .split(/\r?\n/)
    .filter((filePath) => /\.(?:ts|tsx)$/.test(filePath));
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
