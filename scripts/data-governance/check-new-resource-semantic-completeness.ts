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
const QUESTION_BANK_DIR = 'course-content/questions/questions';
const RUNTIME_ASSESSMENT_CATALOG_PATHS = [
  'course-content/runtime/resource-governance/adaptive-assessment-item-catalog-items.jsonl',
  'course-content/runtime/resource-governance/assessment-item-semantic-review-packets.jsonl',
  'course-content/runtime/resource-governance/assessment-item-semantic-review-snapshots.jsonl',
  'course-content/runtime/resource-governance/kaq-quiz-foundation-reviewed-items.jsonl',
];
const RUNTIME_PROJECTION_SOURCE_PATHS = [
  RUNTIME_LESSON_MANIFEST_DIR,
  RUNTIME_TEXTBOOK_DIR,
  RUNTIME_KNOWLEDGE_CARD_DIR,
  RUNTIME_INFOGRAPH_MANIFEST_PATH,
  RUNTIME_INFOGRAPH_NODE_DIR,
  QUESTION_BANK_DIR,
  ...RUNTIME_ASSESSMENT_CATALOG_PATHS,
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

interface RuntimeProjectionSourceChange {
  filePath: string;
  sourceDeleted: boolean;
  forceFullSource: boolean;
  renamed: boolean;
}

type RuntimeProjectionSourceFamily =
  | 'runtime-lesson'
  | 'runtime-source'
  | 'knowledge-card'
  | 'knowledge-infograph'
  | 'assessment-item';
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
  changeKind: 'upsert' | 'delete';
  filePath: string;
  family: RuntimeProjectionSourceFamily;
  recordKey: string;
  runtimeLessonIdentity?: {
    subtype: 'step' | 'module';
    lessonId: string;
    stepId: string;
    moduleId?: string;
    canonicalRecord: string;
  };
  sourcePathOrUrl?: string;
  sourceHash?: string;
  requireSourceHash?: boolean;
  allowUpdatedRowReplacement?: boolean;
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
  const runtimeProjectionSourceChanges = gitChangedRuntimeProjectionSourceChanges(options);
  const runtimeProjectionSourcePaths = uniqueSorted(runtimeProjectionSourceChanges.map(({ filePath }) => filePath));
  const runtimeProjectionSourceRequirements = runtimeProjectionSourceChanges
    .flatMap((change) => runtimeProjectionSourceRequirementsForPath(
      change.filePath,
      gitDiff(options, change.filePath),
      options,
      change,
    ));
  const runtimeProjectionChanges = parseAddedRuntimeProjectionChanges(runtimeProjectionDiff);
  const runtimeProjectionRows = runtimeProjectionChanges.rows;
  const deletedRuntimeProjectionRows = runtimeProjectionChanges.deletedRows;
  const runtimeProjectionRowSourcePaths = runtimeProjectionRows
    .flatMap((row) => runtimeProjectionRowEvidenceLocalSourcePaths(row));
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
      ...(hasDiff(runtimeProjectionDiff) ? [
        RUNTIME_RESOURCE_PROJECTIONS_PATH,
        ...runtimeProjectionRowSourcePaths,
      ] : []),
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
    validateDeletedRuntimeProjectionRows(
      deletedRuntimeProjectionRows,
      runtimeProjectionRows,
      runtimeProjectionSourceRequirements,
      options,
    ),
    validateRuntimeProjectionSourceCoverage(
      runtimeProjectionSourceRequirements,
      runtimeProjectionRows,
      deletedRuntimeProjectionRows,
    ),
    validateRuntimeProjectionRowSourceEvidence(runtimeProjectionRows, options),
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
  addedRows: readonly RuntimeProjectionRow[],
  deletedRows: readonly RuntimeProjectionRow[],
): NewResourceGateResult {
  const requirements = uniqueRuntimeProjectionSourceRequirements(requirementsInput);
  const issues = requirements.flatMap((requirement) => (
    (requirement.changeKind === 'delete'
      ? deletedRows.filter((deletedRow) => {
        const replacementRows = addedRows.filter((addedRow) => addedRow.id === deletedRow.id);
        if (replacementRows.length === 0) return true;
        return requirement.allowUpdatedRowReplacement === true &&
          replacementRows.every((replacementRow) => (
            !runtimeProjectionRowMatchesSourceRequirement(replacementRow, requirement)
          ));
      })
      : addedRows)
      .some((row) => runtimeProjectionRowMatchesSourceRequirement(row, requirement))
      ? []
      : [runtimeProjectionSourceIssue(requirement)]
  ));
  return {
    passed: issues.length === 0,
    checked: requirements.length,
    issues,
  };
}

function validateRuntimeProjectionRowSourceEvidence(
  rows: readonly RuntimeProjectionRow[],
  options: CliOptions,
): NewResourceGateResult {
  const issues = rows.flatMap((row) => {
    const sourcePathOrUrl = row.sourcePathOrUrl?.trim() ?? '';
    if (!sourcePathOrUrl) {
      return [{
        family: 'runtime-resource-projection' as const,
        resourceId: row.id,
        code: 'missing-runtime-projection-source-path',
        message: 'Runtime projection requires sourcePathOrUrl so review evidence can be revalidated.',
      }];
    }
    const sourcePath = runtimeProjectionPrimaryLocalSourcePath(row);
    const reviewEvidencePath = runtimeProjectionReviewHashLocalSourcePath(row);
    const evidencePaths = runtimeProjectionRowEvidenceLocalSourcePaths(row);
    const untrackedEvidencePath = options.staged
      ? evidencePaths.find((filePath) => (
        existsSync(filePath) && gitStatus(['ls-files', '--error-unmatch', '--', filePath]) !== 0
      ))
      : undefined;
    if (untrackedEvidencePath) {
      return [{
        family: 'runtime-resource-projection' as const,
        resourceId: row.id,
        code: 'untracked-runtime-projection-source-file',
        message: `Runtime projection local source or review evidence must be staged before validation: ${untrackedEvidencePath}.`,
      }];
    }
    if (!sourcePath && evidencePaths.length === 0) {
      return [{
        family: 'runtime-resource-projection' as const,
        resourceId: row.id,
        code: 'missing-runtime-projection-local-review-evidence',
        message: `Runtime projection sourcePathOrUrl requires a local source or independent review evidence file: ${sourcePathOrUrl}.`,
      }];
    }
    if (sourcePath && !runtimeProjectionSourceContent(sourcePath, options)) {
      return [{
        family: 'runtime-resource-projection' as const,
        resourceId: row.id,
        code: 'missing-runtime-projection-source-file',
        message: `Runtime projection sourcePathOrUrl points to a missing local source file: ${sourcePath}.`,
      }];
    }
    if (reviewEvidencePath && !runtimeProjectionSourceContent(reviewEvidencePath, options)) {
      return [{
        family: 'runtime-resource-projection' as const,
        resourceId: row.id,
        code: 'missing-runtime-projection-review-evidence-file',
        message: `Runtime projection independent review evidence points to a missing local file: ${reviewEvidencePath}.`,
      }];
    }
    const sourceHashPaths = sourcePath ? [sourcePath] : evidencePaths;
    const currentHashes = sourceHashPaths
      .map((filePath) => runtimeProjectionSourceHash(filePath, options));
    return currentHashes.includes(row.sourceHash)
      ? []
      : [{
        family: 'runtime-resource-projection' as const,
        resourceId: row.id,
        code: 'stale-runtime-projection-source-hash',
        message: `Runtime projection sourceHash must match a current local source or review evidence file hash for ${sourcePathOrUrl}.`,
      }];
  });
  return {
    passed: issues.length === 0,
    checked: rows.length,
    issues,
  };
}

function validateDeletedRuntimeProjectionRows(
  rows: readonly RuntimeProjectionRow[],
  addedRows: readonly RuntimeProjectionRow[],
  sourceRequirements: readonly RuntimeProjectionSourceRequirement[],
  options: CliOptions,
): NewResourceGateResult {
  const updatedIds = new Set(addedRows.map((row) => row.id));
  const deletedSourceRequirements = sourceRequirements
    .filter((requirement) => requirement.changeKind === 'delete');
  const issues = rows.flatMap((row) => (
    updatedIds.has(row.id) ||
      runtimeProjectionSourceDeletedInSameDiff(row, options) ||
      deletedSourceRequirements.some((requirement) => runtimeProjectionRowMatchesSourceRequirement(row, requirement))
      ? []
      : [{
        family: 'runtime-resource-projection' as const,
        resourceId: row.id,
        code: 'deleted-runtime-projection-row',
        message: 'Deleted runtime projection rows require the corresponding runtime source resource to be deleted in the same diff.',
      }]
  ));
  return {
    passed: issues.length === 0,
    checked: rows.length,
    issues,
  };
}

function runtimeProjectionSourceDeletedInSameDiff(
  row: RuntimeProjectionRow,
  options: CliOptions,
): boolean {
  return runtimeProjectionLocalSourcePaths(row).some((filePath) => (
    gitChangedPathNames(options, [filePath], ['--diff-filter=D']).split(/\r?\n/).includes(filePath)
  ));
}

function runtimeProjectionLocalSourcePaths(row: RuntimeProjectionRow): string[] {
  return uniqueSorted([
    projectFilePathForProjectionSource(row.sourcePathOrUrl),
    ...(row.citationTargets ?? []),
    row.reviewAudit?.independentEvidenceRef,
  ]
    .map((value) => projectFilePathForProjectionSource(value))
    .filter((value): value is string => Boolean(value)));
}

function runtimeProjectionPrimaryLocalSourcePath(row: RuntimeProjectionRow): string | null {
  return projectFilePathForProjectionSource(row.sourcePathOrUrl);
}

function runtimeProjectionReviewHashLocalSourcePath(row: RuntimeProjectionRow): string | null {
  return projectFilePathForProjectionSource(row.reviewAudit?.independentEvidenceRef);
}

function runtimeProjectionRowEvidenceLocalSourcePaths(row: RuntimeProjectionRow): string[] {
  return uniqueSorted([
    runtimeProjectionPrimaryLocalSourcePath(row),
    runtimeProjectionReviewHashLocalSourcePath(row),
  ].filter((filePath): filePath is string => Boolean(filePath)));
}

function projectFilePathForProjectionSource(sourcePathOrUrl: string | null | undefined): string | null {
  const sourcePath = sourcePathOrUrl?.split('#')[0]?.trim() ?? '';
  if (!sourcePath || /^https?:\/\//i.test(sourcePath)) return null;
  if (sourcePath.startsWith('course-content/')) return sourcePath;
  if (sourcePath.startsWith('/course-runtime/lessons/')) {
    return sourcePath.replace(/^\/course-runtime\/lessons\//, 'course-content/runtime/lessons/');
  }
  return null;
}

function runtimeProjectionSourceIssue(requirement: RuntimeProjectionSourceRequirement): NewResourceGateIssue {
  const labels: Record<RuntimeProjectionSourceFamily, string> = {
    'runtime-lesson': 'runtime lesson manifest',
    'runtime-source': 'runtime source file',
    'knowledge-card': 'runtime knowledge card',
    'knowledge-infograph': 'knowledge infograph manifest',
    'assessment-item': 'quiz/exercise assessment source',
  };
  return {
    family: 'runtime-resource-projection',
    resourceId: `runtime-source:${requirement.filePath}#${requirement.recordKey}`,
    code: requirement.changeKind === 'delete'
      ? 'missing-deleted-runtime-projection-row'
      : `missing-${requirement.family}-runtime-projection-row`,
    message: requirement.changeKind === 'delete'
      ? `Deleted ${labels[requirement.family]} record ${runtimeProjectionRequirementDisplayIdentity(requirement)} requires a matching deleted-only runtime-resource-projections.jsonl row in the same diff.`
      : `Changed ${labels[requirement.family]} source ${runtimeProjectionRequirementDisplayIdentity(requirement)} requires matching runtime-resource-projections.jsonl added or updated rows in the same diff.`,
  };
}

function runtimeProjectionRequirementDisplayIdentity(requirement: RuntimeProjectionSourceRequirement): string {
  return `${requirement.filePath}#${requirement.runtimeLessonIdentity?.canonicalRecord ?? requirement.recordKey}`;
}

function runtimeProjectionRowMatchesSourceRequirement(
  row: RuntimeProjectionRow,
  requirement: RuntimeProjectionSourceRequirement,
): boolean {
  const family = requirement.family;
  if (family === 'runtime-lesson') {
    return runtimeProjectionRowMatchesRuntimeLessonIdentity(row, requirement) &&
      runtimeProjectionRowMatchesCurrentSourceHash(row, requirement);
  }
  if (family === 'knowledge-card') {
    return runtimeProjectionRowMatchesSourceFamily(row, family) &&
      row.sourcePathOrUrl === requirement.filePath &&
      runtimeProjectionRowMatchesRecord(row, requirement.recordKey) &&
      runtimeProjectionRowMatchesCurrentSourceHash(row, requirement);
  }
  if (family === 'runtime-source') {
    const sourceMatches = runtimeProjectionLocalSourcePaths(row).includes(requirement.filePath) ||
      row.citationTargets?.includes(requirement.filePath) === true ||
      row.reviewAudit?.independentEvidenceRef === requirement.filePath ||
      runtimeProjectionRowMatchesRecord(row, requirement.recordKey);
    if (!sourceMatches) return false;
    return runtimeProjectionRowMatchesCurrentSourceHash(row, requirement);
  }
  if (family === 'assessment-item') {
    return runtimeProjectionRowMatchesSourceFamily(row, family) &&
      runtimeProjectionLocalSourcePaths(row).includes(requirement.filePath) &&
      runtimeProjectionRowMatchesRecord(row, requirement.recordKey) &&
      runtimeProjectionRowMatchesCurrentSourceHash(row, requirement);
  }
  return runtimeProjectionRowMatchesSourceFamily(row, family) &&
    (row.reviewAudit?.independentEvidenceRef === `${requirement.filePath}#${requirement.recordKey}` ||
      row.sourcePathOrUrl === requirement.sourcePathOrUrl ||
      runtimeProjectionRowMatchesRecord(row, requirement.recordKey)) &&
    runtimeProjectionRowMatchesCurrentSourceHash(row, requirement);
}

function runtimeProjectionRowMatchesRuntimeLessonIdentity(
  row: RuntimeProjectionRow,
  requirement: RuntimeProjectionSourceRequirement,
): boolean {
  const identity = requirement.runtimeLessonIdentity;
  if (!identity || row.sourcePathOrUrl !== requirement.filePath) return false;
  const expectedFamily = identity.subtype === 'step'
    ? 'runtime-lesson-step'
    : 'runtime-lesson-module';
  if (row.family !== expectedFamily) return false;
  return row.sourceRecord === identity.canonicalRecord ||
    row.sourceRef === identity.canonicalRecord;
}

function runtimeProjectionRowMatchesCurrentSourceHash(
  row: RuntimeProjectionRow,
  requirement: RuntimeProjectionSourceRequirement,
): boolean {
  if (!requirement.requireSourceHash) return true;
  if (!requirement.sourceHash) return false;
  const audit = row.reviewAudit;
  const knowledgeProjection = isKnowledgeRuntimeProjection(row);
  const coverageHashMatches = row.sourceHash === requirement.sourceHash ||
    (knowledgeProjection && audit?.promptOrManifestHash === requirement.sourceHash);
  const reviewHashMatches = knowledgeProjection
    ? audit?.reviewedSourceHash === row.sourceHash
    : audit?.promptOrManifestHash
      ? audit.reviewedSourceHash === audit.promptOrManifestHash
      : audit?.reviewedSourceHash === requirement.sourceHash;
  return coverageHashMatches && reviewHashMatches;
}

function isKnowledgeRuntimeProjection(row: RuntimeProjectionRow): boolean {
  return row.sourceKind === 'knowledge_graph' ||
    row.family === 'knowledge-card' ||
    row.family === 'knowledge-infograph';
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
  if (family === 'assessment-item') {
    return row.family === 'quiz' ||
      row.family === 'adaptive_quiz' ||
      row.family === 'adaptive-quiz' ||
      row.family === 'assessment-item' ||
      row.family === 'adaptive-assessment-item' ||
      row.resourceType === 'quiz' ||
      row.resourceType === 'adaptive_quiz' ||
      row.sourcePathOrUrl?.includes('/questions/questions/') === true;
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
    const identity = requirement.runtimeLessonIdentity;
    const recordIdentity = identity
      ? `${identity.subtype}:${identity.lessonId}:${identity.stepId}:${identity.moduleId ?? ''}`
      : requirement.recordKey;
    const key = `${requirement.changeKind}:${requirement.family}:${requirement.filePath}:${recordIdentity}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(requirement);
  }
  return unique.sort((left, right) => left.filePath.localeCompare(right.filePath));
}

function runtimeProjectionSourceRequirementsForPath(
  filePath: string,
  diff: string,
  options: CliOptions,
  change: RuntimeProjectionSourceChange,
): RuntimeProjectionSourceRequirement[] {
  const family = runtimeProjectionSourceFamilyForPath(filePath);
  if (!family) return [];
  const source = runtimeProjectionSourceContent(filePath, options)?.toString('utf8') ?? '';
  const previousSource = runtimeProjectionSourceBaseContent(filePath, options)?.toString('utf8') ?? '';
  const { sourceDeleted, forceFullSource } = change;
  if (family === 'runtime-lesson') {
    const currentLessonId = parseRuntimeLessonId(filePath, source);
    const previousLessonId = parseRuntimeLessonId(filePath, previousSource);
    const lessonIdentityChanged = Boolean(
      currentLessonId && previousLessonId && currentLessonId !== previousLessonId,
    );
    const currentRanges = lessonIdentityChanged || forceFullSource
      ? fullSourceLineRange(source)
      : parseDiffCurrentLineRanges(diff);
    const previousRanges = sourceDeleted || lessonIdentityChanged || forceFullSource
      ? fullSourceLineRange(previousSource)
      : parseDiffBaseLineRanges(diff);
    const currentRequirements = parseRuntimeLessonSourceRequirementsInRanges(
      filePath,
      source,
      currentRanges,
      'upsert',
    )
      .map((requirement) => withCurrentSourceHash(requirement, options));
    const currentFullRequirements = parseRuntimeLessonSourceRequirementsInRanges(
      filePath,
      source,
      fullSourceLineRange(source),
      'upsert',
    );
    const currentRequirementsByIdentity = new Map(currentFullRequirements.map((requirement) => [
      runtimeLessonRequirementIdentityKey(requirement),
      requirement,
    ]));
    const requirementsFromPreviousRanges = parseRuntimeLessonSourceRequirementsInRanges(
      filePath,
      previousSource,
      previousRanges,
      'delete',
    ).map((previousRequirement) => {
      const currentRequirement = currentRequirementsByIdentity.get(
        runtimeLessonRequirementIdentityKey(previousRequirement),
      );
      return currentRequirement
        ? withCurrentSourceHash(currentRequirement, options)
        : previousRequirement;
    });
    return withRuntimeProjectionSourceChangeMetadata(uniqueRuntimeProjectionSourceRequirements([
      ...currentRequirements,
      ...requirementsFromPreviousRanges,
    ]), change);
  }
  if (family === 'knowledge-infograph') {
    return withRuntimeProjectionSourceChangeMetadata(
      parseInfographManifestSourceRequirements(filePath, source, diff)
        .map((requirement) => withCurrentSourceHash(requirement, options)),
      change,
    );
  }
  if (family === 'runtime-source') {
    const requirement: RuntimeProjectionSourceRequirement = {
      changeKind: sourceDeleted ? 'delete' : 'upsert',
      filePath,
      family,
      recordKey: filePath,
    };
    return withRuntimeProjectionSourceChangeMetadata(
      [sourceDeleted ? requirement : withCurrentSourceHash(requirement, options)],
      change,
    );
  }
  if (family === 'assessment-item' && RUNTIME_ASSESSMENT_CATALOG_PATHS.includes(filePath)) {
    const requirements = sourceDeleted || forceFullSource
      ? parseAssessmentCatalogSourceRequirementsFromContent(
        filePath,
        sourceDeleted ? previousSource : source,
        sourceDeleted ? 'delete' : 'upsert',
      )
      : parseAssessmentCatalogSourceRequirements(filePath, diff);
    return withRuntimeProjectionSourceChangeMetadata(
      requirements.map((requirement) => (
        requirement.changeKind === 'delete' ? requirement : withCurrentSourceHash(requirement, options)
      )),
      change,
    );
  }
  const recordKey = path.basename(filePath, path.extname(filePath));
  const requirement: RuntimeProjectionSourceRequirement = {
    changeKind: sourceDeleted ? 'delete' : 'upsert',
    filePath,
    family,
    recordKey,
  };
  return withRuntimeProjectionSourceChangeMetadata(
    [sourceDeleted ? requirement : withCurrentSourceHash(requirement, options)],
    change,
  );
}

function withRuntimeProjectionSourceChangeMetadata(
  requirements: RuntimeProjectionSourceRequirement[],
  change: RuntimeProjectionSourceChange,
): RuntimeProjectionSourceRequirement[] {
  if (!change.renamed || !change.sourceDeleted) return requirements;
  return requirements.map((requirement) => ({ ...requirement, allowUpdatedRowReplacement: true }));
}

function fullSourceLineRange(source: string): DiffLineRange[] {
  return source ? [{ start: 1, end: source.split(/\r?\n/).length }] : [];
}

function runtimeLessonRequirementIdentityKey(requirement: RuntimeProjectionSourceRequirement): string {
  const identity = requirement.runtimeLessonIdentity;
  return identity
    ? `${identity.subtype}:${identity.lessonId}:${identity.stepId}:${identity.moduleId ?? ''}`
    : requirement.recordKey;
}

function withCurrentSourceHash(
  requirement: RuntimeProjectionSourceRequirement,
  options: CliOptions,
): RuntimeProjectionSourceRequirement {
  const sourceHash = runtimeProjectionSourceHash(requirement.filePath, options);
  return sourceHash
    ? { ...requirement, sourceHash, requireSourceHash: true }
    : requirement;
}

function parseAssessmentCatalogSourceRequirements(
  filePath: string,
  diff: string,
): RuntimeProjectionSourceRequirement[] {
  return uniqueSorted(diff
    .split(/\r?\n/)
    .filter((line) => line.startsWith('+') && !line.startsWith('+++'))
    .flatMap((line) => assessmentCatalogRecordKeysForLine(line.slice(1))))
    .map((recordKey) => ({ changeKind: 'upsert', filePath, family: 'assessment-item', recordKey }));
}

function parseAssessmentCatalogSourceRequirementsFromContent(
  filePath: string,
  source: string,
  changeKind: RuntimeProjectionSourceRequirement['changeKind'],
): RuntimeProjectionSourceRequirement[] {
  return uniqueSorted(source
    .split(/\r?\n/)
    .flatMap((line) => assessmentCatalogRecordKeysForLine(line)))
    .map((recordKey) => ({ changeKind, filePath, family: 'assessment-item', recordKey }));
}

function assessmentCatalogRecordKeysForLine(line: string): string[] {
  const trimmed = line.trim();
  if (!trimmed.startsWith('{')) return [];
  try {
    const row = JSON.parse(trimmed) as {
      id?: unknown;
      catalogItemId?: unknown;
      questionId?: unknown;
      sourceReference?: {
        sourceId?: unknown;
      };
    };
    return uniqueSorted([
      stringValue(row.id),
      stringValue(row.catalogItemId),
      stringValue(row.questionId),
      stringValue(row.sourceReference?.sourceId),
    ].filter((value): value is string => Boolean(value)));
  } catch {
    return [];
  }
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function parseRuntimeLessonSourceRequirementsInRanges(
  filePath: string,
  source: string,
  ranges: readonly DiffLineRange[],
  changeKind: RuntimeProjectionSourceRequirement['changeKind'],
): RuntimeProjectionSourceRequirement[] {
  if (!source || ranges.length === 0) return [];
  const lessonId = parseRuntimeLessonId(filePath, source);
  const lines = source.split(/\r?\n/);
  const requirements: RuntimeProjectionSourceRequirement[] = [];

  for (const step of parseJsonObjectEntries(lines, /^\s{4}"([^"]+)"\s*:\s*\{/)) {
    const matchingModules = parseRuntimeLessonModuleRequirements(lines, step, lessonId)
      .filter((entry) => ranges.some((range) => lineRangesOverlap(entry, range)));
    for (const moduleRequirement of matchingModules) {
      requirements.push({
        changeKind,
        filePath,
        family: 'runtime-lesson',
        recordKey: moduleRequirement.recordKey,
        runtimeLessonIdentity: {
          subtype: 'module',
          lessonId,
          stepId: step.key,
          moduleId: moduleRequirement.moduleId,
          canonicalRecord: moduleRequirement.recordKey,
        },
      });
    }
    if (!ranges.some((range) => lineRangesOverlap(step, range))) {
      continue;
    }
    requirements.push({
      changeKind,
      filePath,
      family: 'runtime-lesson',
      recordKey: step.key,
      runtimeLessonIdentity: {
        subtype: 'step',
        lessonId,
        stepId: step.key,
        canonicalRecord: `${lessonId}:${step.key}`,
      },
    });
  }
  return requirements;
}

function parseRuntimeLessonId(filePath: string, source: string): string {
  return parseJsonStringField(source, 'lesson_id') ??
    /^course-content\/runtime\/lessons\/([^/]+)\//.exec(filePath)?.[1] ??
    '';
}

function parseRuntimeLessonModuleRequirements(
  lines: readonly string[],
  step: { key: string; start: number; end: number },
  lessonId: string,
): Array<{ start: number; end: number; moduleId: string; recordKey: string }> {
  const moduleArrayIndex = findStepModulesArrayIndex(lines, step);
  if (moduleArrayIndex === null) return [];
  const requirements: Array<{ start: number; end: number; moduleId: string; recordKey: string }> = [];
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
            moduleId,
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
        changeKind: 'upsert' as const,
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

function parseDiffBaseLineRanges(diff: string): DiffLineRange[] {
  return diff
    .split(/\r?\n/)
    .map((line) => /^@@ -(\d+)(?:,(\d+))? \+\d+(?:,\d+)? @@/.exec(line))
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

function gitChangedRuntimeProjectionSourceChanges(options: CliOptions): RuntimeProjectionSourceChange[] {
  const changes = gitChangedPathStatuses(options, RUNTIME_PROJECTION_SOURCE_PATHS, ['--diff-filter=ACDMR'])
    .split(/\r?\n/)
    .filter(Boolean)
    .flatMap((line): RuntimeProjectionSourceChange[] => {
      const [status, firstPath, secondPath] = line.split('\t');
      if (!status || !firstPath) return [];
      if (status.startsWith('R') && secondPath) {
        const targetIsGoverned = Boolean(runtimeProjectionSourceFamilyForPath(secondPath));
        return [
          { filePath: firstPath, sourceDeleted: true, forceFullSource: true, renamed: targetIsGoverned },
          { filePath: secondPath, sourceDeleted: false, forceFullSource: true, renamed: true },
        ];
      }
      if (status.startsWith('C') && secondPath) {
        return [{ filePath: secondPath, sourceDeleted: false, forceFullSource: true, renamed: false }];
      }
      return [{
        filePath: firstPath,
        sourceDeleted: status.startsWith('D'),
        forceFullSource: false,
        renamed: false,
      }];
    })
    .filter(({ filePath }) => runtimeProjectionSourceFamilyForPath(filePath));
  const seen = new Set<string>();
  return changes.filter((change) => {
    const key = `${change.sourceDeleted ? 'delete' : 'upsert'}:${change.filePath}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
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
  if (/^course-content\/questions\/questions\/.+\.(?:json|md)$/.test(filePath)) {
    return 'assessment-item';
  }
  if (RUNTIME_ASSESSMENT_CATALOG_PATHS.includes(filePath)) {
    return 'assessment-item';
  }
  return null;
}

function runtimeProjectionSourceHash(filePath: string, options: CliOptions): string | undefined {
  const content = runtimeProjectionSourceContent(filePath, options);
  if (!content) return undefined;
  const digest = createHash('sha256').update(content).digest('hex');
  return `sha256:${digest}`;
}

function runtimeProjectionSourceContent(filePath: string, options: CliOptions): Buffer | undefined {
  if (options.staged) {
    return existsSync(filePath) ? readFileSync(filePath) : undefined;
  }
  try {
    return execFileSync('git', ['show', `HEAD:${filePath}`], { maxBuffer: 64 * 1024 * 1024 });
  } catch {
    return undefined;
  }
}

function runtimeProjectionSourceBaseContent(filePath: string, options: CliOptions): Buffer | undefined {
  try {
    const revision = options.staged
      ? 'HEAD'
      : execFileSync('git', ['merge-base', options.base!, 'HEAD'], { encoding: 'utf8' }).trim();
    return execFileSync('git', ['show', `${revision}:${filePath}`], {
      maxBuffer: 64 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    return undefined;
  }
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

function gitChangedPathStatuses(
  options: CliOptions,
  pathspecs: readonly string[],
  diffOptions: readonly string[] = [],
): string {
  const args = options.staged
    ? ['diff', '--cached', '--name-status', '--find-renames', ...diffOptions, '--', ...pathspecs]
    : ['diff', '--name-status', '--find-renames', ...diffOptions, `${options.base}...HEAD`, '--', ...pathspecs];
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
