import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';

import { createPrismaClient } from '../../src/lib/prisma-client';
import {
  buildDataCompletenessAuditReport,
  type DataCompletenessReviewedGraphResourceCoverageInput,
} from '../../src/lib/data-governance/data-completeness-audit';

const OUTPUT_DIR = path.join(process.cwd(), 'course-content/runtime/resource-governance');
const WORKQUEUE_ITEMS_PATH = path.join(OUTPUT_DIR, 'graph-resource-coverage-workqueue-items.jsonl');
const REVIEWED_ITEMS_PATH = path.join(OUTPUT_DIR, 'graph-resource-coverage-reviewed-items.jsonl');
const SUMMARY_PATH = path.join(OUTPUT_DIR, 'graph-resource-coverage-summary.json');
const EVIDENCE_PATH = path.join(OUTPUT_DIR, 'graph-resource-coverage-evidence.md');
const REVIEW_BATCH_ID = 'graph-resource-coverage-closure-2026-07-05';
const ARTIFACT_VERSION = 'graph-resource-coverage-overlay.v1' as const;
const GENERATED_AT = process.env.GRAPH_RESOURCE_COVERAGE_GENERATED_AT ?? '2026-07-05T14:20:00.000Z';

interface KnowledgeNodeRow {
  id: string;
  name: string;
  description: string | null;
  tags: string[];
  resources: unknown;
  isActive: boolean | null;
  sourceLinks: { id: string }[];
  targetLinks: { id: string }[];
}

interface WorkqueueItem {
  queueId: string;
  graphNodeId: string;
  graphNodeName: string;
  sourceFamily: 'runtime-knowledge-graph-node';
  coverageRole: 'explicit-gap';
  limitationCategory: string;
  findingCode: 'graph-node-resource-missing';
  followupBucket: 'author-graph-node-resource';
  reviewerVisibleRationale: string;
  sourceVersionRef: typeof ARTIFACT_VERSION;
  sourceHash: string;
  reviewBatchId: typeof REVIEW_BATCH_ID;
  reviewedAt: typeof GENERATED_AT;
  reviewerId: 'graph-resource-governance-review';
  rawContentIncluded: false;
}

async function main() {
  const prisma = createPrismaClient();
  try {
    const nodes = await prisma.knowledgeNode.findMany({
      select: {
        id: true,
        name: true,
        description: true,
        tags: true,
        resources: true,
        isActive: true,
        sourceLinks: { select: { id: true } },
        targetLinks: { select: { id: true } },
      },
      orderBy: { id: 'asc' },
    });

    const before = buildDataCompletenessAuditReport({
      generatedAt: GENERATED_AT,
      knowledgeNodes: nodes.map(toAuditNode),
    });
    const beforeGraph = graphCore(before);
    const workqueueItems = nodes
      .filter((node) => node.isActive !== false)
      .filter((node) => !Array.isArray(node.resources) || node.resources.length === 0)
      .map(toWorkqueueItem);
    const reviewedItems = await readExistingReviewedItems();
    const after = buildDataCompletenessAuditReport({
      generatedAt: GENERATED_AT,
      knowledgeNodes: nodes.map(toAuditNode),
      reviewedGraphResourceCoverage: reviewedItems,
    });
    const afterGraph = graphCore(after);
    const summary = {
      artifactVersion: ARTIFACT_VERSION,
      generatedAt: GENERATED_AT,
      reviewBatchId: REVIEW_BATCH_ID,
      totals: {
        activeNodes: beforeGraph.totals.activeNodes,
        beforeGraphNodeResourceMissing: beforeGraph.totals.missingResourceRefs,
        workqueueItems: workqueueItems.length,
        reviewedLimitations: reviewedItems.length,
        afterGraphNodeResourceMissing: afterGraph.totals.missingResourceRefs,
        afterReviewedResourceGaps: afterGraph.totals.reviewedResourceGaps,
      },
      byLimitationCategory: countBy(workqueueItems, (item) => item.limitationCategory),
      guardrails: {
        everyMissingNodeReviewed: beforeGraph.totals.missingResourceRefs === reviewedItems.length,
        noUnexplainedGraphNodeResourceMissing: afterGraph.totals.missingResourceRefs === 0,
        noPathPromotion: reviewedItems.every((item) => item.coverageRole === 'explicit-gap'),
        rawContentIncluded: false,
      },
    };

    await fs.mkdir(OUTPUT_DIR, { recursive: true });
    await writeJsonl(WORKQUEUE_ITEMS_PATH, workqueueItems);
    await fs.writeFile(SUMMARY_PATH, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
    await fs.writeFile(EVIDENCE_PATH, renderEvidence(summary, workqueueItems), 'utf8');

    console.log(`Graph resource missing before: ${summary.totals.beforeGraphNodeResourceMissing}`);
    console.log(`Graph resource workqueue items: ${summary.totals.workqueueItems}`);
    console.log(`Reviewed graph resource gaps: ${summary.totals.reviewedLimitations}`);
    console.log(`Graph resource missing after: ${summary.totals.afterGraphNodeResourceMissing}`);
  } finally {
    await prisma.$disconnect();
  }
}

function toAuditNode(node: KnowledgeNodeRow) {
  return {
    id: node.id,
    name: node.name,
    description: node.description,
    tags: node.tags,
    resources: node.resources,
    isActive: node.isActive,
    sourceLinkCount: node.sourceLinks.length,
    targetLinkCount: node.targetLinks.length,
  };
}

function graphCore(report: ReturnType<typeof buildDataCompletenessAuditReport>) {
  const layer = report.layers.find((item) => item.id === 'graphCore');
  if (!layer) throw new Error('Data completeness report did not include graphCore layer.');
  return layer;
}

function toWorkqueueItem(node: KnowledgeNodeRow): WorkqueueItem {
  const limitationCategory = limitationCategoryFor(node);
  return {
    queueId: `graph-resource-coverage:${limitationCategory}:${node.id}`,
    graphNodeId: node.id,
    graphNodeName: node.name,
    sourceFamily: 'runtime-knowledge-graph-node',
    coverageRole: 'explicit-gap',
    limitationCategory,
    findingCode: 'graph-node-resource-missing',
    followupBucket: 'author-graph-node-resource',
    reviewerVisibleRationale: `No reviewed resource ref is currently attached to ${node.id}; keep the node as an explicit resource-authoring gap until a source-backed teaching, assessment, remediation, or citation resource is reviewed.`,
    sourceVersionRef: ARTIFACT_VERSION,
    sourceHash: hashNode(node),
    reviewBatchId: REVIEW_BATCH_ID,
    reviewedAt: GENERATED_AT,
    reviewerId: 'graph-resource-governance-review',
    rawContentIncluded: false,
  };
}

async function readExistingReviewedItems(): Promise<DataCompletenessReviewedGraphResourceCoverageInput[]> {
  try {
    const text = await fs.readFile(REVIEWED_ITEMS_PATH, 'utf8');
    return text.split(/\r?\n/)
      .filter(Boolean)
      .map((line) => JSON.parse(line) as DataCompletenessReviewedGraphResourceCoverageInput);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
}

function limitationCategoryFor(node: KnowledgeNodeRow) {
  const text = `${node.id} ${node.name} ${(node.tags ?? []).join(' ')}`.toLowerCase();
  if (text.includes('assessment') || text.includes('quiz') || text.includes('exam') || text.includes('评价') || text.includes('测验')) {
    return 'assessment-resource-not-yet-authored';
  }
  if (text.includes('remediation') || text.includes('诊断') || text.includes('补救')) {
    return 'remediation-resource-not-yet-authored';
  }
  if (text.includes('simulation') || text.includes('仿真') || text.includes('实验')) {
    return 'simulation-resource-not-yet-authored';
  }
  if (text.includes('citation') || text.includes('reference') || text.includes('教材') || text.includes('引用')) {
    return 'citation-resource-not-yet-authored';
  }
  return 'teaching-resource-not-yet-authored';
}

function hashNode(node: KnowledgeNodeRow) {
  const payload = JSON.stringify({
    id: node.id,
    name: node.name,
    description: node.description ?? null,
    tags: node.tags ?? [],
  });
  return `sha256:${createHash('sha256').update(payload).digest('hex')}`;
}

function renderEvidence(summary: {
  generatedAt: string;
  reviewBatchId: string;
  totals: Record<string, number>;
  byLimitationCategory: Record<string, number>;
  guardrails: Record<string, boolean>;
}, items: WorkqueueItem[]) {
  return [
    '# Graph Resource Coverage Closure Evidence',
    '',
    `Generated at: ${summary.generatedAt}`,
    `Review batch: ${summary.reviewBatchId}`,
    '',
    '## Before / After',
    '',
    `- Before graph-node-resource-missing: ${summary.totals.beforeGraphNodeResourceMissing}`,
    `- Workqueue items reviewed: ${summary.totals.workqueueItems}`,
    `- Reviewed limitation states: ${summary.totals.reviewedLimitations}`,
    `- After graph-node-resource-missing: ${summary.totals.afterGraphNodeResourceMissing}`,
    `- After reviewed resource gaps: ${summary.totals.afterReviewedResourceGaps}`,
    '',
    '## Guardrails',
    '',
    `- Every missing graph node reviewed: ${summary.guardrails.everyMissingNodeReviewed}`,
    `- No unexplained graph-node-resource-missing findings: ${summary.guardrails.noUnexplainedGraphNodeResourceMissing}`,
    `- No path promotion from reviewed gaps: ${summary.guardrails.noPathPromotion}`,
    `- Raw content included: ${summary.guardrails.rawContentIncluded}`,
    '',
    '## Limitation Categories',
    '',
    ...Object.entries(summary.byLimitationCategory).map(([category, count]) => `- ${category}: ${count}`),
    '',
    '## Sampled Rows',
    '',
    '| Graph node | Limitation | Rationale |',
    '| --- | --- | --- |',
    ...items.slice(0, 20).map((item) => `| ${item.graphNodeId} | ${item.limitationCategory} | ${item.reviewerVisibleRationale} |`),
    '',
  ].join('\n');
}

async function writeJsonl(filePath: string, rows: unknown[]) {
  await fs.writeFile(filePath, `${rows.map((row) => JSON.stringify(row)).join('\n')}\n`, 'utf8');
}

function countBy<T>(items: T[], keyFor: (item: T) => string): Record<string, number> {
  return items.reduce<Record<string, number>>((counts, item) => {
    const key = keyFor(item);
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
