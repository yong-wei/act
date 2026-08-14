#!/usr/bin/env tsx

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { AdaptiveAssessmentCatalogItem } from '@/features/adaptive-assessment/adaptive-assessment-item-catalog';
import type { AssessmentItemSemanticReviewDecision } from '@/features/adaptive-assessment/adaptive-assessment-semantic-review';
import {
  buildMicroTutoringCoverageAuditReport,
  microTutoringCoverageAuditIsStrictlyComplete,
  microTutoringCoverageAuditMarkdown,
  type MicroTutoringOptionAttribution,
  type MicroTutoringPracticeBaseline,
} from '@/features/assessment/micro-tutoring-coverage-audit';
import {
  listGovernedRemediationResources,
  listGovernedRemediationValidationItems,
  remediationResourceSelect,
  type RemediationResourceRow,
  type RemediationValidationItemRow,
} from '@/features/assessment/remediation-orchestration';
import { AUTOCONTROL_KAQ_GRAPH_CATALOG } from '@/lib/data-governance/autocontrol-kaq-graph-catalog';
import { prisma } from '@/lib/prisma';

const GOVERNANCE_DIR = path.join(process.cwd(), 'course-content/runtime/resource-governance');
const DEFAULT_OUTPUT_DIR = path.join(process.cwd(), '.reports/micro-tutoring-coverage');

type Options = {
  strict: boolean;
  offline: boolean;
  outputDir: string;
};

function parseArgs(args: string[]): Options {
  const strict = args.includes('--strict');
  const outputIndex = args.indexOf('--output-dir');
  if (outputIndex >= 0 && !args[outputIndex + 1]) {
    throw new Error('--output-dir requires a directory');
  }
  return {
    strict,
    offline: args.includes('--offline'),
    outputDir: outputIndex >= 0 ? path.resolve(args[outputIndex + 1]!) : DEFAULT_OUTPUT_DIR,
  };
}

async function readJson<T>(fileName: string): Promise<T> {
  return JSON.parse(await readFile(path.join(GOVERNANCE_DIR, fileName), 'utf8')) as T;
}

async function readJsonl<T>(fileName: string): Promise<T[]> {
  return (await readFile(path.join(GOVERNANCE_DIR, fileName), 'utf8'))
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

async function loadGovernedRows(offline: boolean): Promise<{
  resources: RemediationResourceRow[];
  validations: RemediationValidationItemRow[];
  dependencyIssues: Array<'REFERENCE_DRIFT'>;
}> {
  if (offline) {
    return { resources: [], validations: [], dependencyIssues: ['REFERENCE_DRIFT'] };
  }
  try {
    const [resources, validations] = await Promise.all([
      prisma.teachingResource.findMany({ select: remediationResourceSelect() }),
      prisma.adaptiveAssessmentItemRef.findMany({
        select: { id: true, questionId: true, contentHash: true, metadata: true },
      }),
    ]);
    return {
      resources: resources as RemediationResourceRow[],
      validations: validations as RemediationValidationItemRow[],
      dependencyIssues: [],
    };
  } catch (error) {
    console.error(`微辅导覆盖审计无法读取受治理资源或验证题：${error instanceof Error ? error.message : String(error)}`);
    return { resources: [], validations: [], dependencyIssues: ['REFERENCE_DRIFT'] };
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const [catalogItems, reviewDecisions, baselineSource, attributionSource, governedRows] = await Promise.all([
    readJsonl<AdaptiveAssessmentCatalogItem>('adaptive-assessment-item-catalog-items.jsonl'),
    readJsonl<AssessmentItemSemanticReviewDecision>('assessment-item-semantic-review-snapshots.jsonl'),
    readJson<MicroTutoringPracticeBaseline>('micro-tutoring-practice-baseline.json'),
    readJson<{ entries: MicroTutoringOptionAttribution[] }>('micro-tutoring-option-attributions.json'),
    loadGovernedRows(options.offline),
  ]);
  const baseline: MicroTutoringPracticeBaseline = {
    version: baselineSource.version,
    entries: sourceEntries<MicroTutoringPracticeBaseline['entries'][number]>(baselineSource, 'practice baseline'),
  };
  const optionAttributions = sourceEntries<MicroTutoringOptionAttribution>(
    attributionSource,
    'option attributions',
  );
  const report = buildMicroTutoringCoverageAuditReport({
    catalogItems,
    reviewDecisions,
    baseline,
    optionAttributions,
    activeKnowledgeNodeIds: AUTOCONTROL_KAQ_GRAPH_CATALOG.nodes
      .filter((node) => node.status === 'active')
      .map((node) => node.id),
    resolveResources: (knowledgeNodeId, misconceptionTag) => listGovernedRemediationResources({
      rows: governedRows.resources,
      knowledgeNodeId,
      misconceptionTag,
    }).map(({ title: _title, tier: _tier, ...resource }) => resource),
    resolveValidationItems: (sourceQuestionId, _sourceContentHash, knowledgeNodeId, misconceptionTag) =>
      listGovernedRemediationValidationItems({
        rows: governedRows.validations,
        sourceQuestionId,
        knowledgeNodeId,
        misconceptionTag,
      }),
    dependencyIssues: governedRows.dependencyIssues,
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
    baselineIssues: report.baselineIssues.length,
  }, null, 2));

  if (options.strict && !microTutoringCoverageAuditIsStrictlyComplete(report)) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
