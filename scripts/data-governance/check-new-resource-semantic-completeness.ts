#!/usr/bin/env tsx

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { getAllRegisteredResourceMetadata } from '@/lib/resource-registry-metadata';
import {
  mergeGateResults,
  parseAddedRuntimeProjectionChanges,
  parseChangedRegisteredResourceIds,
  validateChangedRegisteredResources,
  validateChangedRuntimeResourceProjections,
  type NewResourceGateIssue,
  type NewResourceGateResult,
} from '@/lib/data-governance/new-resource-semantic-completeness-gate';

const REGISTERED_RESOURCE_METADATA_PATH = 'src/lib/resource-registry-metadata.ts';
const RESOURCE_COMPONENT_REGISTRY_PATH = 'src/lib/resource-registry.tsx';
const RUNTIME_RESOURCE_PROJECTIONS_PATH = 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl';
const RUNTIME_LESSON_MANIFEST_DIR = 'course-content/runtime/lessons';
const RUNTIME_TEXTBOOK_DIR = 'course-content/runtime/resources/textbooks';
const RUNTIME_KNOWLEDGE_CARD_DIR = 'course-content/runtime/knowledge/cards/nodes';
const RUNTIME_INFOGRAPH_MANIFEST_PATH = 'course-content/runtime/knowledge/infographs/manifest.json';
const RUNTIME_INFOGRAPH_NODE_DIR = 'course-content/runtime/knowledge/infographs/nodes';
const RUNTIME_PROJECTION_SOURCE_PATHS = [
  RUNTIME_LESSON_MANIFEST_DIR,
  RUNTIME_TEXTBOOK_DIR,
  RUNTIME_KNOWLEDGE_CARD_DIR,
  RUNTIME_INFOGRAPH_MANIFEST_PATH,
  RUNTIME_INFOGRAPH_NODE_DIR,
];
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

interface DiffLineRange {
  start: number;
  end: number;
}

type RuntimeProjectionSourceFamily = 'runtime-lesson' | 'runtime-source' | 'knowledge-card' | 'knowledge-infograph';
type RuntimeProjectionRow = ReturnType<typeof parseAddedRuntimeProjectionChanges>['rows'][number] & {
  family?: string;
  sourceHash?: string;
  sourceRecord?: string;
  sourcePathOrUrl?: string;
  citationTargets?: string[];
  reviewAudit?: {
    independentEvidenceRef?: string | null;
    reviewedSourceHash?: string | null;
  };
};
interface RuntimeProjectionSourceRequirement {
  filePath: string;
  family: RuntimeProjectionSourceFamily;
  recordKey: string;
  sourcePathOrUrl?: string;
  sourceHash?: string;
  requireSourceHash?: boolean;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const presetLessonPaths = listPresetLessonResourcePaths(options);
  const teachingResourcePaths = [
    ...TEACHING_RESOURCE_SEED_PATHS,
    ...presetLessonPaths,
  ];
  const registeredResourceDiff = gitDiff(options, REGISTERED_RESOURCE_METADATA_PATH);
  const resourceComponentRegistryDiff = gitDiff(options, RESOURCE_COMPONENT_REGISTRY_PATH);
  const runtimeProjectionDiff = gitDiff(options, RUNTIME_RESOURCE_PROJECTIONS_PATH);
  const runtimeProjectionSourcePaths = gitChangedRuntimeProjectionSourcePaths(options);
  const runtimeProjectionSourceRequirements = runtimeProjectionSourcePaths
    .flatMap((filePath) => runtimeProjectionSourceRequirementsForPath(filePath, gitDiff(options, filePath)));
  const teachingResourceChanges = teachingResourcePaths.map((filePath) => ({
    filePath,
    diff: gitDiff(options, filePath),
  }));
  const repairDiff = gitDiff(options, TEACHING_RESOURCE_REPAIR_PATH);
  if (options.staged) {
    assertNoUnstagedTargetChanges([
      ...(hasDiff(registeredResourceDiff) ? [REGISTERED_RESOURCE_METADATA_PATH] : []),
      ...(hasDiff(resourceComponentRegistryDiff) ? [RESOURCE_COMPONENT_REGISTRY_PATH, REGISTERED_RESOURCE_METADATA_PATH] : []),
      ...teachingResourceChanges.flatMap(({ filePath, diff }) => (
        hasDiff(diff) ? [filePath, REGISTERED_RESOURCE_METADATA_PATH] : []
      )),
      ...(hasDiff(repairDiff) ? [TEACHING_RESOURCE_REPAIR_PATH, REGISTERED_RESOURCE_METADATA_PATH] : []),
      ...(runtimeProjectionSourcePaths.length > 0 ? [
        ...runtimeProjectionSourcePaths,
        RUNTIME_RESOURCE_PROJECTIONS_PATH,
      ] : []),
    ]);
  }
  const teachingResourceSources = teachingResourceChanges.map(({ filePath, diff }) => ({
    source: readTextIfExists(filePath),
    diff,
  }));
  const resourceIds = uniqueSorted([
    ...parseChangedRegisteredResourceIds(readText(REGISTERED_RESOURCE_METADATA_PATH), registeredResourceDiff),
    ...parseChangedResourceComponentRegistryIds(readTextIfExists(RESOURCE_COMPONENT_REGISTRY_PATH), resourceComponentRegistryDiff),
    ...teachingResourceSources.flatMap(({ source, diff }) => parseChangedTeachingResourceRegistryIds(source, diff)),
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
    validateRuntimeProjectionSourceCoverage(runtimeProjectionSourceRequirements, runtimeProjectionRows),
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

function validateRuntimeProjectionSourceCoverage(
  requirementsInput: readonly RuntimeProjectionSourceRequirement[],
  rows: readonly RuntimeProjectionRow[],
): NewResourceGateResult {
  const requirements = uniqueRuntimeProjectionSourceRequirements(requirementsInput);
  const issues = requirements.flatMap((requirement) => (
    rows.some((row) => runtimeProjectionRowMatchesSourceRequirement(row, requirement))
      ? []
      : [runtimeProjectionSourceIssue(requirement)]
  ));
  return {
    passed: issues.length === 0,
    checked: requirements.length,
    issues,
  };
}

function runtimeProjectionSourceIssue(requirement: RuntimeProjectionSourceRequirement): NewResourceGateIssue {
  const labels: Record<RuntimeProjectionSourceFamily, string> = {
    'runtime-lesson': 'runtime lesson manifest',
    'runtime-source': 'runtime source file',
    'knowledge-card': 'runtime knowledge card',
    'knowledge-infograph': 'knowledge infograph manifest',
  };
  return {
    family: 'runtime-resource-projection',
    resourceId: `runtime-source:${requirement.filePath}#${requirement.recordKey}`,
    code: `missing-${requirement.family}-runtime-projection-row`,
    message: `Changed ${labels[requirement.family]} source ${requirement.filePath}#${requirement.recordKey} requires matching runtime-resource-projections.jsonl added or updated rows in the same diff.`,
  };
}

function runtimeProjectionRowMatchesSourceRequirement(
  row: RuntimeProjectionRow,
  requirement: RuntimeProjectionSourceRequirement,
): boolean {
  const family = requirement.family;
  if (family === 'runtime-lesson') {
    return runtimeProjectionRowMatchesSourceFamily(row, family) &&
      row.sourcePathOrUrl === requirement.filePath &&
      runtimeProjectionRowMatchesRecord(row, requirement.recordKey);
  }
  if (family === 'knowledge-card') {
    return runtimeProjectionRowMatchesSourceFamily(row, family) &&
      row.sourcePathOrUrl === requirement.filePath &&
      runtimeProjectionRowMatchesRecord(row, requirement.recordKey);
  }
  if (family === 'runtime-source') {
    const sourceMatches = row.sourcePathOrUrl === requirement.filePath ||
      row.citationTargets?.includes(requirement.filePath) === true ||
      row.reviewAudit?.independentEvidenceRef === requirement.filePath ||
      runtimeProjectionRowMatchesRecord(row, requirement.recordKey);
    if (!sourceMatches) return false;
    if (!requirement.requireSourceHash) return true;
    return Boolean(requirement.sourceHash) &&
      row.sourceHash === requirement.sourceHash &&
      row.reviewAudit?.reviewedSourceHash === requirement.sourceHash;
  }
  return runtimeProjectionRowMatchesSourceFamily(row, family) &&
    (row.reviewAudit?.independentEvidenceRef === `${requirement.filePath}#${requirement.recordKey}` ||
      row.sourcePathOrUrl === requirement.sourcePathOrUrl ||
      runtimeProjectionRowMatchesRecord(row, requirement.recordKey));
}

function runtimeProjectionRowMatchesSourceFamily(
  row: RuntimeProjectionRow,
  family: RuntimeProjectionSourceFamily,
): boolean {
  if (family === 'runtime-lesson') {
    return row.family === 'runtime-lesson-step' ||
      row.family === 'runtime-lesson-module' ||
      row.family === 'runtime-lesson-media' ||
      row.sourceKind === 'runtime_lesson_step' ||
      row.sourceKind === 'runtime_lesson_media';
  }
  if (family === 'knowledge-card') {
    return row.family === 'knowledge-card' ||
      row.resourceType === 'knowledge_card' ||
      row.sourcePathOrUrl?.includes('/knowledge/cards/') === true;
  }
  if (family === 'runtime-source') {
    return true;
  }
  return row.family === 'knowledge-infograph' ||
    row.sourcePathOrUrl?.includes('/knowledge/infographs/') === true;
}

function runtimeProjectionRowMatchesRecord(row: RuntimeProjectionRow, recordKey: string): boolean {
  return row.sourceRecord === recordKey ||
    row.sourceRef === recordKey ||
    row.sourceRecord?.endsWith(`:${recordKey}`) === true ||
    row.sourceRef?.endsWith(`:${recordKey}`) === true ||
    row.sourceRecord?.endsWith(`#${recordKey}`) === true ||
    row.sourceRef?.endsWith(`#${recordKey}`) === true;
}

function uniqueRuntimeProjectionSourceRequirements(
  requirements: readonly RuntimeProjectionSourceRequirement[],
): RuntimeProjectionSourceRequirement[] {
  const seen = new Set<string>();
  const unique: RuntimeProjectionSourceRequirement[] = [];
  for (const requirement of requirements) {
    const key = `${requirement.family}:${requirement.filePath}:${requirement.recordKey}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(requirement);
  }
  return unique.sort((left, right) => left.filePath.localeCompare(right.filePath));
}

function runtimeProjectionSourceRequirementsForPath(
  filePath: string,
  diff: string,
): RuntimeProjectionSourceRequirement[] {
  const family = runtimeProjectionSourceFamilyForPath(filePath);
  if (!family) return [];
  const source = readTextIfExists(filePath);
  if (family === 'runtime-lesson') {
    return parseRuntimeLessonSourceRequirements(filePath, source, diff);
  }
  if (family === 'knowledge-infograph') {
    return parseInfographManifestSourceRequirements(filePath, source, diff);
  }
  if (family === 'runtime-source') {
    return [{
      filePath,
      family,
      recordKey: filePath,
      sourceHash: runtimeProjectionSourceHash(filePath),
      requireSourceHash: runtimeProjectionSourceRequiresHash(filePath),
    }];
  }
  const recordKey = path.basename(filePath, path.extname(filePath));
  return [{ filePath, family, recordKey }];
}

function parseRuntimeLessonSourceRequirements(
  filePath: string,
  source: string,
  diff: string,
): RuntimeProjectionSourceRequirement[] {
  const ranges = parseDiffCurrentLineRanges(diff);
  if (!source || ranges.length === 0) return [];
  const lessonId = parseJsonStringField(source, 'lesson_id') ??
    /^course-content\/runtime\/lessons\/([^/]+)\//.exec(filePath)?.[1] ??
    '';
  const lines = source.split(/\r?\n/);
  const requirements: RuntimeProjectionSourceRequirement[] = [];

  for (const step of parseJsonObjectEntries(lines, /^\s{4}"([^"]+)"\s*:\s*\{/)) {
    const matchingModules = parseRuntimeLessonModuleRequirements(lines, step, lessonId)
      .filter((entry) => ranges.some((range) => lineRangesOverlap(entry, range)));
    for (const moduleRequirement of matchingModules) {
      requirements.push({
        filePath,
        family: 'runtime-lesson',
        recordKey: moduleRequirement.recordKey,
      });
    }
    if (!ranges.some((range) => lineRangesOverlap(step, range))) {
      continue;
    }
    requirements.push({ filePath, family: 'runtime-lesson', recordKey: step.key });
  }
  return requirements;
}

function parseRuntimeLessonModuleRequirements(
  lines: readonly string[],
  step: { key: string; start: number; end: number },
  lessonId: string,
): Array<{ start: number; end: number; recordKey: string }> {
  const moduleArrayIndex = findStepModulesArrayIndex(lines, step);
  if (moduleArrayIndex === null) return [];
  const requirements: Array<{ start: number; end: number; recordKey: string }> = [];
  let arrayDepth = 0;
  let arrayStarted = false;

  for (let index = moduleArrayIndex; index < step.end; index += 1) {
    const line = lines[index];
    if (arrayStarted && arrayDepth === 1 && /^\s*\{\s*$/.test(line)) {
      const end = findJsonObjectEndLine(lines, index, step.end);
      if (end !== null) {
        const objectText = lines.slice(index, end).join('\n');
        const moduleId = parseJsonStringField(objectText, 'id');
        if (moduleId) {
          requirements.push({
            start: index + 1,
            end,
            recordKey: lessonId ? `${lessonId}:${step.key}:${moduleId}` : moduleId,
          });
        }
        index = end - 1;
        continue;
      }
    }

    const nextDepth = arrayDepth + squareBracketDelta(line);
    arrayStarted = arrayStarted || line.includes('[');
    arrayDepth = nextDepth;
    if (arrayStarted && arrayDepth <= 0 && index > moduleArrayIndex) break;
  }

  return requirements;
}

function findStepModulesArrayIndex(
  lines: readonly string[],
  step: { start: number; end: number },
): number | null {
  for (let index = step.start - 1; index < step.end; index += 1) {
    if (/^\s*"modules"\s*:\s*\[/.test(lines[index])) return index;
  }
  return null;
}

function findJsonObjectEndLine(
  lines: readonly string[],
  startIndex: number,
  maxEndLine: number,
): number | null {
  let depth = 0;
  for (let index = startIndex; index < maxEndLine; index += 1) {
    depth += braceDelta(lines[index]);
    if (depth <= 0 && (index > startIndex || /}\s*,?\s*$/.test(lines[index]))) {
      return index + 1;
    }
  }
  return null;
}

function parseInfographManifestSourceRequirements(
  filePath: string,
  source: string,
  diff: string,
): RuntimeProjectionSourceRequirement[] {
  const ranges = parseDiffCurrentLineRanges(diff);
  if (!source || ranges.length === 0) return [];
  const lines = source.split(/\r?\n/);
  return parseJsonObjectEntries(lines, /^\s{4}\{\s*$/)
    .filter((entry) => ranges.some((range) => lineRangesOverlap(entry, range)))
    .flatMap((entry) => {
      const objectText = lines.slice(entry.start - 1, entry.end).join('\n');
      const itemPath = parseJsonStringField(objectText, 'path');
      const recordKey = parseJsonStringField(objectText, 'nodeId') ??
        parseJsonStringField(objectText, 'sourceNodeId') ??
        path.basename(itemPath ?? '', path.extname(itemPath ?? ''));
      if (!recordKey) return [];
      return [{
        filePath,
        family: 'knowledge-infograph' as const,
        recordKey,
        sourcePathOrUrl: itemPath ?? undefined,
      }];
    });
}

function parseJsonObjectEntries(
  lines: readonly string[],
  startPattern: RegExp,
): Array<{ key: string; start: number; end: number }> {
  const entries: Array<{ key: string; start: number; end: number }> = [];
  for (let index = 0; index < lines.length; index += 1) {
    const match = startPattern.exec(lines[index]);
    if (!match) continue;
    let depth = 0;
    for (let inner = index; inner < lines.length; inner += 1) {
      depth += braceDelta(lines[inner]);
      if (inner > index && depth <= 0) {
        entries.push({ key: match[1] ?? '', start: index + 1, end: inner + 1 });
        break;
      }
    }
  }
  return entries;
}

function parseJsonStringField(source: string, field: string): string | null {
  const match = new RegExp(`"${field}"\\s*:\\s*"([^"]+)"`).exec(source);
  return match?.[1] ?? null;
}

function lineRangesOverlap(
  left: { start: number; end: number },
  right: DiffLineRange,
): boolean {
  return right.start <= left.end && right.end >= left.start;
}

function parseChangedTeachingResourceRegistryIds(source: string, diff: string): string[] {
  const ranges = parseDiffCurrentLineRanges(diff);
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

  return uniqueSorted([
    ...ids,
    ...parseTeachingResourceItemRegistryIds(source, ranges),
  ]);
}

function parseRegistryIdExpressionLiteralIds(line: string): string[] {
  const expressionStart = line.match(/\bregistryId\s*:/);
  const expression = expressionStart ? line.slice(expressionStart.index! + expressionStart[0].length) : line;
  return Array.from(expression.matchAll(/(?:^|[?:])\s*['"]([^'"]+)['"]/g), (match) => match[1]);
}

function parseTeachingResourceItemRegistryIds(source: string, ranges: readonly DiffLineRange[]): string[] {
  if (!source || ranges.length === 0) return [];
  const lines = source.split(/\r?\n/);
  return parseObjectLineRanges(lines)
    .filter((item) => ranges.some((range) => range.start <= item.end && range.end >= item.start))
    .flatMap((item) => parseRegistryIdPropertyLiteralIds(lines.slice(item.start - 1, item.end)));
}

function parseObjectLineRanges(lines: readonly string[]): Array<{ start: number; end: number }> {
  const ranges: Array<{ start: number; end: number }> = [];
  for (let index = 0; index < lines.length; index += 1) {
    const objectStart = lines[index].match(/^\s*(?:\{|.*=>\s*\(\s*\{)/);
    if (!objectStart) continue;
    let depth = 0;
    for (let inner = index; inner < lines.length; inner += 1) {
      depth += braceDelta(inner === index ? lines[inner].slice(objectStart[0].search(/\{/)) : lines[inner]);
      if (depth <= 0 && inner > index) {
        ranges.push({ start: index + 1, end: inner + 1 });
        break;
      }
    }
  }
  return ranges;
}

function parseRegistryIdPropertyLiteralIds(lines: readonly string[]): string[] {
  const ids: string[] = [];
  let pendingRegistryExpression = false;
  for (const line of lines) {
    if (/\bregistryId\s*:/.test(line)) {
      ids.push(...parseRegistryIdExpressionLiteralIds(line));
      pendingRegistryExpression = !line.includes(',');
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

function parseChangedResourceComponentRegistryIds(source: string, diff: string): string[] {
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
  return uniqueSorted([
    ...ids,
    ...parseResourceComponentRegistryEntryIds(source, parseDiffCurrentLineRanges(diff)),
  ]);
}

function parseResourceComponentRegistryEntryIds(source: string, ranges: readonly DiffLineRange[]): string[] {
  if (!source || ranges.length === 0) return [];
  const lines = source.split(/\r?\n/);
  const entries: Array<{ id: string; start: number; end: number }> = [];
  for (let index = 0; index < lines.length; index += 1) {
    const match = /^\s*['"]([^'"]+)['"]:\s*\{/.exec(lines[index]);
    if (!match) continue;
    let depth = 0;
    for (let inner = index; inner < lines.length; inner += 1) {
      depth += braceDelta(lines[inner]);
      if (inner > index && depth <= 0) {
        entries.push({ id: match[1], start: index + 1, end: inner + 1 });
        break;
      }
    }
  }
  return entries
    .filter((entry) => ranges.some((range) => range.start <= entry.end && range.end >= entry.start))
    .map((entry) => entry.id);
}

function parseChangedTeachingResourceRepairRegistryIds(diff: string): string[] {
  return diff
    .split(/\r?\n/)
    .filter((line) => line.startsWith('+') && !line.startsWith('+++'))
    .flatMap((line) => Array.from(line.matchAll(/^\+\s*(?:['"][^'"]+['"]|[A-Za-z0-9_$]+)\s*:\s*['"]([^'"]+)['"]/g), (match) => match[1]));
}

function parseDiffCurrentLineRanges(diff: string): DiffLineRange[] {
  return diff
    .split(/\r?\n/)
    .map((line) => /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/.exec(line))
    .filter((match): match is RegExpExecArray => Boolean(match))
    .flatMap((match) => {
      const start = Number(match[1]);
      const count = match[2] ? Number(match[2]) : 1;
      if (count === 0) return [];
      return [{ start, end: start + count - 1 }];
    });
}

function braceDelta(line: string): number {
  let delta = 0;
  for (const char of line) {
    if (char === '{') delta += 1;
    if (char === '}') delta -= 1;
  }
  return delta;
}

function squareBracketDelta(line: string): number {
  let delta = 0;
  for (const char of line) {
    if (char === '[') delta += 1;
    if (char === ']') delta -= 1;
  }
  return delta;
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

function gitChangedRuntimeProjectionSourcePaths(options: CliOptions): string[] {
  return gitChangedPathNames(options, RUNTIME_PROJECTION_SOURCE_PATHS, ['--diff-filter=ACMR'])
    .split(/\r?\n/)
    .filter((filePath) => runtimeProjectionSourceFamilyForPath(filePath));
}

function runtimeProjectionSourceFamilyForPath(filePath: string): RuntimeProjectionSourceFamily | null {
  if (/^course-content\/runtime\/lessons\/[^/]+\/interactive-manifest\.json$/.test(filePath)) {
    return 'runtime-lesson';
  }
  if (/^course-content\/runtime\/lessons\/.+\/media\/.+$/.test(filePath)) {
    return 'runtime-source';
  }
  if (/^course-content\/runtime\/lessons\/.+\/[^/]+-handout\.md$/.test(filePath)) {
    return 'runtime-source';
  }
  if (/^course-content\/runtime\/resources\/textbooks\/[^/]+\/(?:chunks|sections)\/.+\.md$/.test(filePath)) {
    return 'runtime-source';
  }
  if (/^course-content\/runtime\/knowledge\/cards\/nodes\/.+\.md$/.test(filePath)) {
    return 'knowledge-card';
  }
  if (filePath === RUNTIME_INFOGRAPH_MANIFEST_PATH) {
    return 'knowledge-infograph';
  }
  if (/^course-content\/runtime\/knowledge\/infographs\/nodes\/.+\.(?:png|jpe?g|webp|svg)$/.test(filePath)) {
    return 'runtime-source';
  }
  return null;
}

function runtimeProjectionSourceRequiresHash(filePath: string): boolean {
  return /^course-content\/runtime\/knowledge\/infographs\/nodes\/.+\.(?:png|jpe?g|webp|svg)$/.test(filePath);
}

function runtimeProjectionSourceHash(filePath: string): string | undefined {
  if (!runtimeProjectionSourceRequiresHash(filePath) || !existsSync(filePath)) return undefined;
  const digest = createHash('sha256').update(readFileSync(filePath)).digest('hex');
  return `sha256:${digest}`;
}

function assertNoUnstagedTargetChanges(filePaths: readonly string[]) {
  const unstagedFiles = uniqueSorted(filePaths).filter((filePath) => (
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

function hasDiff(diff: string): boolean {
  return diff.trim().length > 0;
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
  return gitChangedPathNames(options, [dirPath])
    .split(/\r?\n/)
    .filter((filePath) => /\.(?:ts|tsx)$/.test(filePath));
}

function gitChangedPathNames(
  options: CliOptions,
  pathspecs: readonly string[],
  diffOptions: readonly string[] = [],
): string {
  const args = options.staged
    ? ['diff', '--cached', '--name-only', ...diffOptions, '--', ...pathspecs]
    : ['diff', '--name-only', ...diffOptions, `${options.base}...HEAD`, '--', ...pathspecs];
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

function readTextIfExists(filePath: string): string {
  const fullPath = path.join(process.cwd(), filePath);
  return existsSync(fullPath) ? readFileSync(fullPath, 'utf8') : '';
}

function uniqueSorted(values: readonly string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

main();
