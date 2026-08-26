#!/usr/bin/env tsx

import { spawnSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { AdaptiveAssessmentCatalogItem } from '@/features/adaptive-assessment/adaptive-assessment-item-catalog';
import type { AssessmentItemSemanticReviewDecision } from '@/features/adaptive-assessment/adaptive-assessment-semantic-review';
import {
  buildMicroTutoringCoverageAuditReport,
  microTutoringCoverageAuditIsGitContentComplete,
  microTutoringCoverageAuditIsStrictlyComplete,
  microTutoringCoverageAuditMarkdown,
  type MicroTutoringPracticeBaseline,
} from '@/features/assessment/micro-tutoring-coverage-audit';
import {
  listGovernedRemediationResources,
  remediationResourceSelect,
  type RemediationResourceRow,
  type RemediationValidationItemRow,
} from '@/features/assessment/remediation-orchestration';
import { listMicroTutoringGovernedResources } from '@/features/assessment/micro-tutoring-resource-registry';
import { listMicroTutoringGovernedValidationItems } from '@/features/assessment/micro-tutoring-validation-registry';
import { AUTOCONTROL_KAQ_GRAPH_CATALOG } from '@/lib/data-governance/autocontrol-kaq-graph-catalog';
import { ADAPTIVE_LEARNING_GOAL_DEFINITIONS } from '@/lib/adaptive-learning-path-planner';
import { prisma } from '@/lib/prisma';

const GOVERNANCE_DIR = 'course-content/runtime/resource-governance';
const DEFAULT_OUTPUT_DIR = path.join(process.cwd(), '.reports/micro-tutoring-coverage');
const SHARED_CAPTURE_PATHS = [
  `${GOVERNANCE_DIR}/adaptive-assessment-item-catalog-items.jsonl`,
  `${GOVERNANCE_DIR}/assessment-item-semantic-review-snapshots.jsonl`,
  `${GOVERNANCE_DIR}/micro-tutoring-goal-node-catalog.json`,
  'src/features/assessment/micro-tutoring-coverage-audit.ts',
  'src/features/assessment/micro-tutoring-production-qualification.ts',
  'scripts/data-governance/qualify-micro-tutoring.ts',
  'src/features/assessment/micro-tutoring-goal-node-catalog.ts',
  'src/features/assessment/micro-tutoring-resource-registry.ts',
  'src/features/assessment/micro-tutoring-validation-registry.ts',
  'src/features/assessment/micro-tutoring-learning-actions.ts',
  'src/features/assessment/remediation-orchestration.ts',
  'src/lib/adaptive-learning-path-planner.ts',
  'src/lib/data-governance/autocontrol-kaq-graph-catalog.ts',
  'scripts/data-governance/check-micro-tutoring-coverage.ts',
] as const;
const V1_CAPTURE_PATHS = [
  ...SHARED_CAPTURE_PATHS,
  `${GOVERNANCE_DIR}/micro-tutoring-practice-baseline.json`,
  `${GOVERNANCE_DIR}/micro-tutoring-option-attributions.json`,
  `${GOVERNANCE_DIR}/micro-tutoring-resource-projection.json`,
  `${GOVERNANCE_DIR}/micro-tutoring-validation-registry.json`,
] as const;
const V2_CAPTURE_PATHS = [
  ...SHARED_CAPTURE_PATHS,
  `${GOVERNANCE_DIR}/micro-tutoring-assessment-baseline-v2.json`,
  `${GOVERNANCE_DIR}/micro-tutoring-option-attributions-v2.json`,
  `${GOVERNANCE_DIR}/micro-tutoring-resource-projection-v2.json`,
  `${GOVERNANCE_DIR}/micro-tutoring-validation-registry-v2.json`,
  `${GOVERNANCE_DIR}/micro-tutoring-validation-purpose-reviews-v1.jsonl`,
] as const;
const GIT_REVISION = /^[a-f0-9]{40}$/u;

type CoverageProfile = 'v1' | 'v2';
type Options = {
  strict: boolean;
  offline: boolean;
  outputDir: string;
  profile: CoverageProfile;
};

function parseArgs(args: string[]): Options {
  const strict = args.includes('--strict');
  const outputIndex = args.indexOf('--output-dir');
  const profileIndex = args.indexOf('--profile');
  if (outputIndex >= 0 && !args[outputIndex + 1]) {
    throw new Error('--output-dir requires a directory');
  }
  const profileArg = profileIndex >= 0 ? args[profileIndex + 1] : 'v1';
  if (profileArg !== 'v1' && profileArg !== 'v2') {
    throw new Error('--profile must be v1 or v2');
  }
  return {
    strict,
    offline: args.includes('--offline'),
    outputDir: outputIndex >= 0 ? path.resolve(args[outputIndex + 1]!) : DEFAULT_OUTPUT_DIR,
    profile: profileArg,
  };
}

type GovernanceInputCapture = {
  sourceRevision: string;
  sourceInputsClean: boolean;
};

function git(args: string[]): string {
  const result = spawnSync('git', args, {
    cwd: process.cwd(),
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error(`微辅导覆盖审计无法执行 Git ${args.join(' ')}：${result.stderr.trim()}`);
  }
  return result.stdout;
}

function capturePaths(profile: CoverageProfile): readonly string[] {
  return profile === 'v2' ? V2_CAPTURE_PATHS : V1_CAPTURE_PATHS;
}

function captureGovernanceInputs(profile: CoverageProfile): GovernanceInputCapture {
  git(['ls-files', '--error-unmatch', '--', ...capturePaths(profile)]);
  const sourceRevision = git(['rev-parse', '--verify', 'HEAD']).trim();
  if (!GIT_REVISION.test(sourceRevision)) {
    throw new Error('微辅导覆盖审计无法解析有效的 Git 修订');
  }
  return {
    sourceRevision,
    sourceInputsClean: !git(['status', '--porcelain=v1', '--untracked-files=all']).trim(),
  };
}

function readCommittedSource(capture: GovernanceInputCapture, fileName: string): string {
  return git(['show', `${capture.sourceRevision}:${GOVERNANCE_DIR}/${fileName}`]);
}

function readJson<T>(capture: GovernanceInputCapture, fileName: string): T {
  return JSON.parse(readCommittedSource(capture, fileName)) as T;
}

function readJsonl<T>(capture: GovernanceInputCapture, fileName: string): T[] {
  return readCommittedSource(capture, fileName)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as T);
}

function sourceEntries<T>(value: unknown, label: string): T[] {
  if (!value || typeof value !== 'object' || !Array.isArray((value as { entries?: unknown }).entries)) {
    throw new Error(`${label} must contain an entries array`);
  }
  return (value as { entries: T[] }).entries;
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string') ? value : [];
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function resourceCaptureRevision(row: RemediationResourceRow): string | null {
  return nonEmptyString(record(record(row.config)?.remediation)?.captureRevision);
}

function validationCaptureRevision(row: RemediationValidationItemRow): string | null {
  const metadata = record(row.metadata);
  return nonEmptyString(
    record(metadata?.remediationValidation)?.captureRevision ??
      record(metadata?.adaptiveAssessmentItemRef)?.captureRevision,
  );
}

function governedProjectionCapture(input: {
  sourceRevision: string;
  resources: RemediationResourceRow[];
  validations: RemediationValidationItemRow[];
}): { governedProjectionRevision: string | null; dependencyIssues: Array<'REFERENCE_DRIFT'> } {
  const revisions = [
    ...input.resources
      .filter((row) => record(record(row.config)?.remediation) !== null)
      .map(resourceCaptureRevision),
    ...input.validations
      .filter((row) => record(row.metadata)?.adaptiveAssessmentItemRef !== undefined)
      .map(validationCaptureRevision),
  ];
  if (revisions.length === 0) {
    return { governedProjectionRevision: null, dependencyIssues: [] };
  }
  const validRevisions = revisions.filter((revision): revision is string =>
    revision !== null && GIT_REVISION.test(revision));
  const uniqueRevisions = [...new Set(validRevisions)];
  if (
    validRevisions.length !== revisions.length ||
    uniqueRevisions.length !== 1 ||
    uniqueRevisions[0] !== input.sourceRevision
  ) {
    return { governedProjectionRevision: uniqueRevisions[0] ?? null, dependencyIssues: ['REFERENCE_DRIFT'] };
  }
  return { governedProjectionRevision: input.sourceRevision, dependencyIssues: [] };
}

function resourceAccessDenied(rows: RemediationResourceRow[], knowledgeNodeId: string): boolean {
  return rows.some((row) => {
    const remediation = record(record(row.config)?.remediation);
    const referencesNode = row.knowledgeNodes.some((node) => node.id === knowledgeNodeId) ||
      stringArray(remediation?.prerequisiteKnowledgeNodeIds).includes(knowledgeNodeId);
    return referencesNode && row.teacherOnly;
  });
}

function validationAccessDenied(rows: RemediationValidationItemRow[], knowledgeNodeId: string): boolean {
  return rows.some((row) => {
    const metadata = record(row.metadata);
    const snapshot = record(metadata?.adaptiveAssessmentItemRef);
    const semanticRefs = record(snapshot?.semanticRefs);
    const validation = record(metadata?.remediationValidation);
    return stringArray(semanticRefs?.graphNodeIds).includes(knowledgeNodeId) && validation?.learnerVisible === false;
  });
}

async function loadGovernedRows(offline: boolean, sourceRevision: string): Promise<{
  resources: RemediationResourceRow[];
  validations: RemediationValidationItemRow[];
  dependencyIssues: Array<'REFERENCE_DRIFT'>;
  governedProjectionRevision: string | null;
}> {
  if (offline) {
    return {
      resources: [],
      validations: [],
      dependencyIssues: [],
      governedProjectionRevision: null,
    };
  }
  try {
    const [resources, validations] = await Promise.all([
      prisma.teachingResource.findMany({ select: remediationResourceSelect() }),
      prisma.adaptiveAssessmentItemRef.findMany({
        select: { id: true, questionId: true, contentHash: true, metadata: true },
      }),
    ]);
    const projectedResources = resources as RemediationResourceRow[];
    const projectedValidations = validations as RemediationValidationItemRow[];
    const capture = governedProjectionCapture({
      sourceRevision,
      resources: projectedResources,
      validations: projectedValidations,
    });
    return {
      resources: projectedResources,
      validations: projectedValidations,
      dependencyIssues: capture.dependencyIssues,
      governedProjectionRevision: capture.governedProjectionRevision,
    };
  } catch (error) {
    console.error(`微辅导覆盖审计无法读取受治理资源或验证题：${error instanceof Error ? error.message : String(error)}`);
    return {
      resources: [],
      validations: [],
      dependencyIssues: ['REFERENCE_DRIFT'],
      governedProjectionRevision: null,
    };
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const inputCapture = captureGovernanceInputs(options.profile);
  const optionReferenceSecret = nonEmptyString(process.env.MICRO_TUTORING_COVERAGE_OPTION_REFERENCE_SECRET);
  if (!optionReferenceSecret) {
    throw new Error('MICRO_TUTORING_COVERAGE_OPTION_REFERENCE_SECRET is required');
  }
  const [catalogItems, reviewDecisions, baselineSource, attributionSource, resourceProjectionSource, validationRegistrySource, governedRows] = await Promise.all([
    readJsonl<AdaptiveAssessmentCatalogItem>(inputCapture, 'adaptive-assessment-item-catalog-items.jsonl'),
    readJsonl<AssessmentItemSemanticReviewDecision>(inputCapture, 'assessment-item-semantic-review-snapshots.jsonl'),
    readJson<MicroTutoringPracticeBaseline>(
      inputCapture,
      options.profile === 'v2' ? 'micro-tutoring-assessment-baseline-v2.json' : 'micro-tutoring-practice-baseline.json',
    ),
    readJson<{ entries: unknown[]; stageCounts?: Record<string, number> }>(
      inputCapture,
      options.profile === 'v2' ? 'micro-tutoring-option-attributions-v2.json' : 'micro-tutoring-option-attributions.json',
    ),
    readJson<unknown>(
      inputCapture,
      options.profile === 'v2' ? 'micro-tutoring-resource-projection-v2.json' : 'micro-tutoring-resource-projection.json',
    ),
    readJson<unknown>(
      inputCapture,
      options.profile === 'v2' ? 'micro-tutoring-validation-registry-v2.json' : 'micro-tutoring-validation-registry.json',
    ),
    loadGovernedRows(options.offline, inputCapture.sourceRevision),
  ]);
  const baseline: MicroTutoringPracticeBaseline = {
    version: baselineSource.version,
    itemCount: baselineSource.itemCount,
    stageCounts: baselineSource.stageCounts,
    entries: sourceEntries<MicroTutoringPracticeBaseline['entries'][number]>(baselineSource, 'practice baseline'),
  };
  const optionAttributions = sourceEntries<unknown>(
    attributionSource,
    'option attributions',
  );
  const report = buildMicroTutoringCoverageAuditReport({
    catalogItems,
    reviewDecisions,
    baseline,
    coverageProfile: options.profile,
    optionAttributions,
    optionReferenceSecret,
    activeLearningGoalIds: Object.values(ADAPTIVE_LEARNING_GOAL_DEFINITIONS)
      .flatMap((definition) =>
        definition.learningGoal && definition.learningGoal.status !== 'draft'
          ? [definition.learningGoal.id]
          : []),
    activeKnowledgeNodeIds: AUTOCONTROL_KAQ_GRAPH_CATALOG.nodes
      .filter((node) => node.status === 'active')
      .map((node) => node.id),
    resolveResources: (knowledgeNodeId, misconceptionTag) => {
      const projected = listMicroTutoringGovernedResources({
        knowledgeNodeId,
        misconceptionTag,
        projection: resourceProjectionSource,
        optionAttributions: attributionSource,
        authorityRows: options.offline
          ? undefined
          : governedRows.resources.map((row) => ({
            id: row.id,
            registryId: row.registryId,
            teacherOnly: row.teacherOnly,
            config: row.config,
          })),
        captureRevision: options.offline ? undefined : inputCapture.sourceRevision,
      });
      if (options.offline) {
        return projected.map(({ registryId: _registryId, actionId: _actionId, actionVersion: _actionVersion, ...resource }) => resource);
      }
      const parsed = listGovernedRemediationResources({
        rows: governedRows.resources,
        knowledgeNodeId,
        misconceptionTag,
      });
      const parsedKeys = new Set(
        governedRows.resources
          .filter((row) => parsed.some((resource) => resource.id === row.id))
          .flatMap((row) => [row.id, row.registryId].filter((value): value is string => Boolean(value))),
      );
      return projected
        .filter((resource) => parsedKeys.has(resource.registryId))
        .map(({ registryId: _registryId, actionId: _actionId, actionVersion: _actionVersion, ...resource }) => resource);
    },
    resolveValidationItems: (sourceQuestionId, sourceContentHash, knowledgeNodeId, misconceptionTag) =>
      listMicroTutoringGovernedValidationItems({
        knowledgeNodeId,
        misconceptionTag,
        sourceQuestionId,
        sourceContentHash,
        registry: validationRegistrySource,
        optionAttributions: attributionSource,
        practiceBaseline: baselineSource,
        authorityRows: options.offline
          ? undefined
          : governedRows.validations.map((row) => ({
            id: row.id,
            questionId: row.questionId,
            contentHash: row.contentHash,
            metadata: row.metadata,
          })),
        captureRevision: options.offline ? undefined : inputCapture.sourceRevision,
      }),
    resolveResourceAccessDenied: (knowledgeNodeId) =>
      resourceAccessDenied(governedRows.resources, knowledgeNodeId),
    resolveValidationAccessDenied: (_sourceQuestionId, knowledgeNodeId) =>
      validationAccessDenied(governedRows.validations, knowledgeNodeId),
    dependencyIssues: [
      ...(inputCapture.sourceInputsClean ? [] : ['REFERENCE_DRIFT' as const]),
      ...governedRows.dependencyIssues,
    ],
    inputCapture: {
      ...inputCapture,
      governedProjectionRevision: governedRows.governedProjectionRevision,
    },
  });

  await mkdir(options.outputDir, { recursive: true });
  await Promise.all([
    writeFile(path.join(options.outputDir, 'micro-tutoring-coverage.json'), `${JSON.stringify(report, null, 2)}\n`),
    writeFile(path.join(options.outputDir, 'micro-tutoring-coverage.md'), microTutoringCoverageAuditMarkdown(report)),
  ]);
  console.log(JSON.stringify({
    outputDir: options.outputDir,
    qualifiedPracticeItemCount: report.qualifiedPracticeItemCount,
    errorOptionCount: report.errorOptionCount,
    completeOptionCount: report.completeOptionCount,
    gapOptionCount: report.gapOptionCount,
    contentDigest: report.contentDigest,
    baselineIssues: report.baselineIssues.length,
    attributionIssues: report.attributionIssueCount,
    sourceRevision: inputCapture.sourceRevision,
    sourceInputsClean: inputCapture.sourceInputsClean,
    governedProjectionRevision: governedRows.governedProjectionRevision,
  }, null, 2));

  if (
    options.strict &&
    (
      !microTutoringCoverageAuditIsStrictlyComplete(report) ||
      !microTutoringCoverageAuditIsGitContentComplete(report)
    )
  ) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
