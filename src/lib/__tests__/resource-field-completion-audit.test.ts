import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { buildGraphCenterPayload } from '../data-governance/graph-center';
import {
  ADAPTIVE_LEARNING_GOAL_DEFINITIONS,
  isPathBlockingFallbackReason,
} from '../adaptive-learning-path-planner';
import {
  buildLearningGoalResourceBaselineArtifacts,
  LEARNING_GOAL_RESOURCE_BASELINE_VERSION,
} from '../learning-goal-resource-baseline';
import {
  FULL_RESOURCE_PATH_READINESS_GATE_VERSION,
  REQUIRED_PATH_READINESS_RESOURCE_FAMILIES,
  buildFullResourcePathReadinessGate,
  buildLearningGoalPathGenerationDiagnostics,
} from '../full-resource-path-readiness-gate';
import {
  buildResourceFieldCompletionAudit,
  RESOURCE_FIELD_COMPLETION_AUDIT_VERSION,
  YANGFAN_FIXTURE_OWNED_RESOURCE_IDS,
  type ResourceFieldCompletionCoverageSummary,
  type ResourceFieldCompletionAuditRow,
} from '../resource-field-completion-audit';
import { buildKaqArtifactVersionRefs } from '../kaq-artifact-versioning';
import { buildResourceNodeRegistry } from '../resource-node-registry';
import {
  runtimeLessonReviewSourceHash,
  reviewedRuntimeStepCompletionForSource,
  type ReviewedRuntimeStepCompletion,
} from '../../../scripts/db/generate-resource-field-completion-audit';

describe('resource field completion audit', () => {
  it('requires reviewed runtime step completions to match manifest and graph overlay hashes', () => {
    const reviewedSourceHash = runtimeLessonReviewSourceHash(
      'sha256:reviewed-manifest',
      'sha256:reviewed-overlay',
    );
    const reviewedCompletion: ReviewedRuntimeStepCompletion = {
      capabilityTargetIds: ['controlModeling'],
      estimatedTimeMinutes: 6,
      reviewedSourceHash: reviewedSourceHash!,
    };

    expect(reviewedRuntimeStepCompletionForSource(
      reviewedCompletion,
      reviewedSourceHash,
    )).toBe(reviewedCompletion);
    expect(reviewedRuntimeStepCompletionForSource(
      reviewedCompletion,
      runtimeLessonReviewSourceHash('sha256:changed-manifest', 'sha256:reviewed-overlay'),
    )).toBeNull();
    expect(reviewedRuntimeStepCompletionForSource(
      reviewedCompletion,
      runtimeLessonReviewSourceHash('sha256:reviewed-manifest', 'sha256:changed-overlay'),
    )).toBeNull();
    expect(reviewedRuntimeStepCompletionForSource(
      undefined,
      reviewedSourceHash,
    )).toBeNull();
  });

  it('keeps the generated runtime audit artifact broad enough for remediation planning', () => {
    const summary = JSON.parse(readFileSync(
      join(process.cwd(), 'course-content/runtime/resource-governance/resource-field-completion-summary.json'),
      'utf8',
    ));

    expect(summary.totals.denominator).toBeGreaterThan(3000);
    expect(summary.byFamily['runtime-lesson-step'].denominator).toBeGreaterThan(0);
    expect(summary.byFamily['runtime-lesson-module'].denominator).toBeGreaterThan(0);
    expect(summary.byFamily['runtime-lesson-media'].denominator).toBeGreaterThan(0);
    expect(summary.byFamily['runtime-handout'].denominator).toBeGreaterThan(0);
    expect(summary.byFamily['knowledge-card'].denominator).toBeGreaterThan(0);
    expect(summary.byFamily['authoring-textbook-chapter'].denominator).toBeGreaterThan(0);
    expect(summary.byFamily['authoring-textbook-section'].denominator).toBeGreaterThan(0);
    expect(summary.byFamily['authoring-textbook-figure'].denominator).toBeGreaterThan(0);
    expect(summary.byFamily['authoring-textbook-caption'].denominator).toBeGreaterThan(0);
    expect(summary.byFamily['runtime-lesson-module'].sampleLimitations.length).toBeGreaterThan(0);
    expect(summary.byFamily['authoring-textbook-figure'].sourceWindow).toMatchObject({
      from: null,
      to: expect.any(String),
    });
    expect(summary.limitations).not.toContain('No authoring textbook chapter/figure/caption source tree was found; runtime textbook documents are audited as current candidates.');
    const jsonlRows = readFileSync(
      join(process.cwd(), 'course-content/runtime/resource-governance/resource-field-completion-audit.jsonl'),
      'utf8',
    )
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));
    const workqueueSummary = JSON.parse(readFileSync(
      join(process.cwd(), 'course-content/runtime/resource-governance/resource-completion-workqueue-summary.json'),
      'utf8',
    ));
    const workqueueItems = readFileSync(
      join(process.cwd(), 'course-content/runtime/resource-governance/resource-completion-workqueue-items.jsonl'),
      'utf8',
    )
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));
    const workqueueMarkdown = readFileSync(
      join(process.cwd(), 'course-content/runtime/resource-governance/resource-completion-workqueues.md'),
      'utf8',
    );
    const evidenceLineageSummary = JSON.parse(readFileSync(
      join(process.cwd(), 'course-content/runtime/resource-governance/resource-evidence-lineage-readiness-summary.json'),
      'utf8',
    ));
    const evidenceLineageItems = readFileSync(
      join(process.cwd(), 'course-content/runtime/resource-governance/resource-evidence-lineage-readiness-items.jsonl'),
      'utf8',
    )
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));
    const evidenceLineageEvidence = readFileSync(
      join(process.cwd(), 'course-content/runtime/resource-governance/resource-evidence-lineage-readiness-evidence.md'),
      'utf8',
    );
    const dispositionReviewSummary = JSON.parse(readFileSync(
      join(process.cwd(), 'course-content/runtime/resource-governance/resource-disposition-backlog-review-summary.json'),
      'utf8',
    ));
    const dispositionReviewItems = readFileSync(
      join(process.cwd(), 'course-content/runtime/resource-governance/resource-disposition-backlog-review-items.jsonl'),
      'utf8',
    )
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));
    const dispositionReviewEvidence = readFileSync(
      join(process.cwd(), 'course-content/runtime/resource-governance/resource-disposition-backlog-review-evidence.md'),
      'utf8',
    );
    const humanReviewIntegrity = JSON.parse(readFileSync(
      join(process.cwd(), 'course-content/runtime/resource-governance/resource-human-review-integrity-diagnostics.json'),
      'utf8',
    ));
    const fullResourcePathReadinessGate = JSON.parse(readFileSync(
      join(process.cwd(), 'course-content/runtime/resource-governance/full-resource-path-readiness-gate-summary.json'),
      'utf8',
    ));
    const fullResourcePathReadinessEvidence = readFileSync(
      join(process.cwd(), 'course-content/runtime/resource-governance/full-resource-path-readiness-gate-evidence.md'),
      'utf8',
    );
    const rowsMissingFields = jsonlRows.filter((row) => row.missingFieldCodes.length > 0);
    const unresolvedDispositionRows = dispositionReviewItems.filter((item) =>
      item.reviewedLimitationState.includes('unresolved-residual-disposition-review')
    );
    const dispositionReviewItemsById = new Map(dispositionReviewItems.map((item) => [item.resourceId, item]));
    const independentlyReviewedDispositionRows = dispositionReviewItems.filter((item) =>
      item.reviewBatchId !== 'residual-resource-disposition-review-2026-07-05' ||
      item.reviewerId !== 'residual-resource-disposition-implementing-agent'
    );
    const unresolvedSemanticReviewRows = jsonlRows.filter((row) => {
      const dispositionItem = dispositionReviewItemsById.get(row.resourceId);
      const hasIndependentDispositionReview = dispositionItem &&
        (dispositionItem.reviewBatchId !== 'residual-resource-disposition-review-2026-07-05' ||
          dispositionItem.reviewerId !== 'residual-resource-disposition-implementing-agent');
      return !hasIndependentDispositionReview && (
        row.reviewStatus !== 'human-confirmed' ||
        row.missingFieldCodes.includes('missing-human-review') ||
        row.missingFieldCodes.includes('provisional-metadata') ||
        row.pathEligibility.blockedBy.includes('missing-human-review') ||
        row.pathEligibility.blockedBy.includes('provisional-metadata')
      );
    });
    const stableSourceRefs = new Set(dispositionReviewItems.map((item) => item.stableSourceRef));
    const reviewedTextbookOverviewRows = dispositionReviewItems.filter((item) =>
      item.reviewBatchId === 'residual-textbook-overview-disposition-review-2026-07-05'
    );
    const reviewedAuthoringTextbookRows = dispositionReviewItems.filter((item) =>
      item.reviewBatchId === 'residual-authoring-textbook-disposition-review-2026-07-05'
    );
    const reviewedRuntimeHandoutRows = dispositionReviewItems.filter((item) =>
      item.reviewBatchId === 'residual-runtime-handout-disposition-review-2026-07-05'
    );
    const reviewedKnowledgeInfographRows = dispositionReviewItems.filter((item) =>
      item.reviewBatchId === 'residual-knowledge-infograph-disposition-review-2026-07-05'
    );
    const reviewedKnowledgeCardRows = dispositionReviewItems.filter((item) =>
      item.reviewBatchId === 'residual-knowledge-card-disposition-review-2026-07-05'
    );
    const reviewedAuthoringTextbookFigureDispositionRows = dispositionReviewItems.filter((item) =>
      item.reviewBatchId === 'residual-authoring-textbook-figure-disposition-review-2026-07-05'
    );
    const reviewedAuthoringTextbookCaptionDispositionRows = dispositionReviewItems.filter((item) =>
      item.reviewBatchId === 'residual-authoring-textbook-caption-disposition-review-2026-07-05'
    );
    const reviewedRuntimeLessonStepRows = dispositionReviewItems.filter((item) =>
      item.reviewBatchId === 'residual-runtime-lesson-step-disposition-review-2026-07-05'
    );
    const reviewedRuntimeLessonModuleRows = dispositionReviewItems.filter((item) =>
      item.reviewBatchId === 'residual-runtime-lesson-module-disposition-review-2026-07-05'
    );
    const reviewedRuntimeLessonMediaRows = dispositionReviewItems.filter((item) =>
      item.reviewBatchId === 'residual-runtime-lesson-media-disposition-review-2026-07-05'
    );
    const reviewedRegisteredResourceRows = dispositionReviewItems.filter((item) =>
      item.reviewBatchId === 'residual-registered-resource-disposition-review-2026-07-05'
    );
    const figureIndexFromResourceId = (resourceId: string) => {
      const match = resourceId.match(/:figure-([^:]+)$/);
      return match ? Number(match[1]) : Number.NaN;
    };
    const captionHashForReviewItem = (item: typeof dispositionReviewItems[number]) => {
      const manifest = JSON.parse(readFileSync(item.sourcePathOrUrl, 'utf8')) as {
        markdownSha256?: string;
        images?: Array<{ index?: number; caption?: string }>;
      };
      const image = manifest.images?.find((candidate) =>
        Number(candidate.index) === figureIndexFromResourceId(item.resourceId)
      );
      if (!image) return null;
      return image.caption
        ? `sha256:${createHash('sha256').update(image.caption).digest('hex')}`
        : manifest.markdownSha256 ?? null;
    };

    expect(workqueueSummary.primaryQueueItems + workqueueSummary.dependentQueueItems).toBe(workqueueItems.length);
    expect(workqueueSummary.queuedResources).toBe(rowsMissingFields.length);
    expect(workqueueSummary.primaryQueueItems).toBe(rowsMissingFields.length);
    expect(workqueueSummary.dependentQueueItems).toBeGreaterThan(0);
    expect(workqueueSummary.queues.length).toBeGreaterThan(0);
    expect(workqueueMarkdown).toContain('Item-level rows are stored in `resource-completion-workqueue-items.jsonl` without raw resource content.');
    expect(workqueueItems.every((item) => item.privacyMinimized === true)).toBe(true);
    expect(workqueueItems.every((item) => item.rawContentIncluded === false)).toBe(true);
    expect(workqueueItems.some((item) => 'rawContent' in item || 'markdown' in item || 'body' in item)).toBe(false);
    expect(workqueueItems.every((item) => typeof item.title === 'string' && item.title.length <= 120)).toBe(true);
    expect(workqueueItems.some((item) => item.title.includes('Image description:'))).toBe(false);
    expect(workqueueItems.every((item) => item.currentBlockers.length > 0)).toBe(true);
    expect(workqueueItems.every((item) => item.suggestedReviewerAction.length > 0)).toBe(true);
    expect(evidenceLineageSummary.artifactVersion).toBe('resource-evidence-lineage-readiness.v1');
    expect(evidenceLineageSummary.layerTotals.auditRows).toBe(jsonlRows.length);
    expect(evidenceLineageSummary.layerTotals.pathRelevantRows).toBeGreaterThan(0);
    expect(evidenceLineageSummary.layerTotals.reviewedLimitations).toBeGreaterThan(0);
    expect(evidenceLineageSummary.evidenceLineageBlockerCount).toBe(YANGFAN_FIXTURE_OWNED_RESOURCE_IDS.length);
    expect(evidenceLineageSummary.evidenceLineageBlockerCount).toBeLessThan(evidenceLineageItems.length);
    expect(evidenceLineageSummary.findingCounts['missing-evidence-contract']).toBeGreaterThan(0);
    expect(evidenceLineageSummary.contractFieldGaps.clientEventIdPolicy).toBeGreaterThan(0);
    expect(evidenceLineageSummary.followupBuckets['complete-evidence-lineage-bindings']).toBe(evidenceLineageItems.length);
    expect(evidenceLineageSummary.yangFanFixtureBlockers.blocked).toBe(true);
    expect(evidenceLineageSummary.yangFanFixtureBlockers.blockerCount).toBe(YANGFAN_FIXTURE_OWNED_RESOURCE_IDS.length);
    expect(evidenceLineageSummary.yangFanFixtureBlockers.scopedBlockerCount).toBe(YANGFAN_FIXTURE_OWNED_RESOURCE_IDS.length);
    expect(evidenceLineageSummary.yangFanFixtureBlockers.globalLimitationCount).toBe(evidenceLineageItems.length - YANGFAN_FIXTURE_OWNED_RESOURCE_IDS.length);
    expect(evidenceLineageSummary.yangFanFixtureBlockers.scopePolicy).toBe('yangfan-fixture-readiness-scope.v1');
    expect(evidenceLineageItems.every((item) => item.privacyMinimized === true)).toBe(true);
    expect(evidenceLineageItems.every((item) => item.rawContentIncluded === false)).toBe(true);
    expect(evidenceLineageItems.some((item) => 'rawContent' in item || 'markdown' in item || 'body' in item)).toBe(false);
    expect(evidenceLineageItems.every((item) => item.followupBucket === 'complete-evidence-lineage-bindings')).toBe(true);
    expect(evidenceLineageItems.some((item) => item.evidenceEffectState === 'reviewed-limitation')).toBe(true);
    expect(evidenceLineageItems
      .filter((item) => item.yangFanFixtureScope === 'fixture-owned')
      .every((item) => item.evidenceEffectState === 'blocked')).toBe(true);
    expect(evidenceLineageItems
      .filter((item) => item.evidenceEffectState === 'reviewed-limitation')
      .every((item) => item.blocksYangFanFixture === false && item.yangFanFixtureScope === 'global-resource-backlog')).toBe(true);
    expect(evidenceLineageItems
      .filter((item) => item.yangFanFixtureScope === 'fixture-owned')
      .map((item) => item.resourceId)
      .sort()).toEqual([...YANGFAN_FIXTURE_OWNED_RESOURCE_IDS].sort());
    expect(evidenceLineageEvidence).toContain('## Yang Fan Fixture Precondition');
    expect(evidenceLineageEvidence).toContain(`Scoped blocker count: ${YANGFAN_FIXTURE_OWNED_RESOURCE_IDS.length}`);
    expect(evidenceLineageEvidence).toContain(`Global limitation count: ${evidenceLineageItems.length - YANGFAN_FIXTURE_OWNED_RESOURCE_IDS.length}`);
    expect(evidenceLineageEvidence).toContain('Scope policy: yangfan-fixture-readiness-scope.v1');
    expect(evidenceLineageEvidence).toContain('Raw learner payloads and raw resource bodies are not included.');
    expect(dispositionReviewItems).toHaveLength(rowsMissingFields.length);
    expect(dispositionReviewSummary.totals.reviewedResources).toBe(rowsMissingFields.length);
    expect(dispositionReviewSummary.totals.unresolvedDispositionBlockers).toBe(unresolvedDispositionRows.length);
    expect(dispositionReviewSummary.totals.unresolvedDispositionBlockers).toBe(0);
    expect(dispositionReviewSummary.totals.privacyMinimized).toBe(true);
    expect(dispositionReviewSummary.totals.rawContentIncluded).toBe(false);
    expect(dispositionReviewSummary.byClassification['path-plannable']).toBeGreaterThan(0);
    expect(dispositionReviewSummary.byClassification['supporting-citation']).toBeGreaterThan(0);
    expect(dispositionReviewSummary.byClassification['embedded-asset']).toBeGreaterThan(0);
    expect(dispositionReviewSummary.downstreamBlockers['evidence-lineage']).toBeGreaterThan(0);
    expect(dispositionReviewSummary.downstreamBlockers['runtime-identity']).toBeGreaterThan(0);
    expect(dispositionReviewSummary.evidence.beforeResidualDispositionReview.queuedResources).toBe(rowsMissingFields.length);
    expect(dispositionReviewSummary.evidence.afterResidualDispositionReview).toMatchObject({
      reviewedResources: rowsMissingFields.length,
      unresolvedDispositionBlockers: unresolvedDispositionRows.length,
    });
    expect(stableSourceRefs.size).toBe(dispositionReviewItems.length);
    expect(dispositionReviewItems.every((item) =>
      item.reviewBatchId &&
      item.reviewerId &&
      item.reviewedAt &&
      item.stableSourceRef &&
      item.reviewerVisibleRationale.length > 0 &&
      item.privacyMinimized === true &&
      item.rawContentIncluded === false
    )).toBe(true);
    const governanceDir = join(process.cwd(), 'course-content/runtime/resource-governance');
    const dispositionReviewArtifactText = readdirSync(governanceDir)
      .filter((file) => (
        /disposition-review.*\.(jsonl|json|md)$/.test(file) ||
        /^resource-disposition-backlog-review-.*\.(jsonl|json|md)$/.test(file)
      ))
      .map((file) => readFileSync(join(governanceDir, file), 'utf8'))
      .join('\n');
    expect(dispositionReviewArtifactText).not.toMatch(/[?&](signature|nonce|puid|enc|wps|token|secret|key)=/i);
    for (const urlMatch of dispositionReviewArtifactText.matchAll(/https?:\/\/[^\s"`]+/g)) {
      const url = new URL(urlMatch[0]);
      expect(url.search).toBe('');
      expect(url.hash).toBe('');
    }
    expect(unresolvedDispositionRows.every((item) =>
      item.reviewedLimitationState.includes('unresolved-residual-disposition-review')
    )).toBe(true);
    expect(unresolvedDispositionRows).toHaveLength(unresolvedSemanticReviewRows.length);
    expect(unresolvedSemanticReviewRows.every((row) =>
      dispositionReviewItemsById.get(row.resourceId)?.reviewedLimitationState.includes('unresolved-residual-disposition-review')
    )).toBe(true);
    expect(dispositionReviewItems
      .filter((item) => !item.reviewedLimitationState.includes('unresolved-residual-disposition-review'))
      .every((item) => item.reviewedLimitationState.includes('residual-disposition-reviewed'))).toBe(true);
    expect(independentlyReviewedDispositionRows.length).toBeGreaterThan(0);
    expect(reviewedTextbookOverviewRows).toHaveLength(11);
    expect(reviewedTextbookOverviewRows.every((item) =>
      item.classification === 'evidence-producing' &&
      item.sourceHash?.startsWith('sha256:') &&
      item.reviewedLimitationState.includes('residual-disposition-reviewed') &&
      !item.reviewedLimitationState.includes('unresolved-residual-disposition-review')
    )).toBe(true);
    expect(reviewedAuthoringTextbookRows).toHaveLength(35);
    expect(reviewedAuthoringTextbookRows.every((item) =>
      item.classification === 'supporting-citation' &&
      item.sourceHash?.startsWith('sha256:') &&
      item.sourceVersionRef === 'authoring-textbook-manifest.v1' &&
      item.reviewedLimitationState.includes('residual-disposition-reviewed') &&
      !item.reviewedLimitationState.includes('unresolved-residual-disposition-review')
    )).toBe(true);
    expect(reviewedRuntimeHandoutRows).toHaveLength(36);
    expect(reviewedRuntimeHandoutRows.every((item) =>
      item.classification === 'supporting-citation' &&
      item.sourceHash?.startsWith('sha256:') &&
      item.currentPathEligible === false &&
      item.reviewedLimitationState.includes('residual-disposition-reviewed') &&
      !item.reviewedLimitationState.includes('unresolved-residual-disposition-review')
    )).toBe(true);
    expect(independentlyReviewedDispositionRows
      .filter((item) => item.classification !== 'path-plannable')
      .every((item) => item.currentPathEligible === false)).toBe(true);
    expect(unresolvedDispositionRows.some((item) => item.sourceFamily === 'runtime-handout')).toBe(false);
    expect(reviewedKnowledgeInfographRows).toHaveLength(161);
    expect(reviewedKnowledgeInfographRows.every((item) =>
      item.classification === 'embedded-asset' &&
      item.sourceHash?.startsWith('sha256:') &&
      item.currentPathEligible === false &&
      item.reviewedLimitationState.includes('residual-disposition-reviewed') &&
      !item.reviewedLimitationState.includes('unresolved-residual-disposition-review')
    )).toBe(true);
    expect(reviewedKnowledgeInfographRows.every((item) => {
      const actualHash = `sha256:${createHash('sha256')
        .update(readFileSync(item.sourcePathOrUrl))
        .digest('hex')}`;
      return item.sourceHash === actualHash;
    })).toBe(true);
    expect(unresolvedDispositionRows.some((item) => item.sourceFamily === 'knowledge-infograph')).toBe(false);
    expect(reviewedKnowledgeCardRows).toHaveLength(279);
    expect(reviewedKnowledgeCardRows.every((item) =>
      item.classification === 'evidence-producing' &&
      item.sourceHash?.startsWith('sha256:') &&
      item.currentPathEligible === false &&
      item.reviewedLimitationState.includes('residual-disposition-reviewed') &&
      !item.reviewedLimitationState.includes('unresolved-residual-disposition-review')
    )).toBe(true);
    expect(reviewedKnowledgeCardRows.every((item) => {
      const actualHash = `sha256:${createHash('sha256')
        .update(readFileSync(item.sourcePathOrUrl))
        .digest('hex')}`;
      return item.sourceHash === actualHash;
    })).toBe(true);
    expect(unresolvedDispositionRows.some((item) => item.sourceFamily === 'knowledge-card')).toBe(false);
    expect(reviewedAuthoringTextbookFigureDispositionRows).toHaveLength(535);
    expect(reviewedAuthoringTextbookFigureDispositionRows.every((item) =>
      item.classification === 'embedded-asset' &&
      /^[0-9a-f]{64}$/.test(item.sourceHash ?? '') &&
      item.currentPathEligible === false &&
      item.reviewedLimitationState.includes('residual-disposition-reviewed') &&
      !item.reviewedLimitationState.includes('unresolved-residual-disposition-review')
    )).toBe(true);
    expect(reviewedAuthoringTextbookFigureDispositionRows.every((item) => {
      const actualHash = createHash('sha256')
        .update(readFileSync(item.sourcePathOrUrl))
        .digest('hex');
      return item.sourceHash === actualHash;
    })).toBe(true);
    expect(unresolvedDispositionRows.some((item) => item.sourceFamily === 'authoring-textbook-figure')).toBe(false);
    expect(reviewedAuthoringTextbookCaptionDispositionRows).toHaveLength(535);
    expect(reviewedAuthoringTextbookCaptionDispositionRows.every((item) =>
      item.classification === 'supporting-citation' &&
      /^sha256:[0-9a-f]{64}$|^[0-9a-f]{64}$/.test(item.sourceHash ?? '') &&
      item.currentPathEligible === false &&
      item.reviewedLimitationState.includes('residual-disposition-reviewed') &&
      !item.reviewedLimitationState.includes('unresolved-residual-disposition-review')
    )).toBe(true);
    expect(reviewedAuthoringTextbookCaptionDispositionRows.every((item) =>
      item.sourceHash === captionHashForReviewItem(item)
    )).toBe(true);
    expect(unresolvedDispositionRows.some((item) => item.sourceFamily === 'authoring-textbook-caption')).toBe(false);
    expect(reviewedRuntimeLessonStepRows).toHaveLength(394);
    expect(reviewedRuntimeLessonStepRows.every((item) =>
      item.classification === 'excluded-with-rationale' &&
      item.sourceHash?.startsWith('sha256:') &&
      item.currentPathEligible === false &&
      item.reviewedLimitationState.includes('residual-disposition-reviewed') &&
      !item.reviewedLimitationState.includes('unresolved-residual-disposition-review')
    )).toBe(true);
    expect(reviewedRuntimeLessonStepRows.every((item) => {
      const actualHash = `sha256:${createHash('sha256')
        .update(readFileSync(item.sourcePathOrUrl))
        .digest('hex')}`;
      return item.sourceHash === actualHash;
    })).toBe(true);
    expect(unresolvedDispositionRows.some((item) => item.sourceFamily === 'runtime-lesson-step')).toBe(false);
    expect(reviewedRuntimeLessonModuleRows).toHaveLength(1352);
    expect(reviewedRuntimeLessonModuleRows.every((item) =>
      item.classification === 'excluded-with-rationale' &&
      item.sourceHash?.startsWith('sha256:') &&
      item.currentPathEligible === false &&
      item.reviewedLimitationState.includes('residual-disposition-reviewed') &&
      !item.reviewedLimitationState.includes('unresolved-residual-disposition-review')
    )).toBe(true);
    expect(reviewedRuntimeLessonModuleRows.every((item) => {
      const actualHash = `sha256:${createHash('sha256')
        .update(readFileSync(item.sourcePathOrUrl))
        .digest('hex')}`;
      return item.sourceHash === actualHash;
    })).toBe(true);
    expect(unresolvedDispositionRows.some((item) => item.sourceFamily === 'runtime-lesson-module')).toBe(false);
    expect(reviewedRuntimeLessonMediaRows).toHaveLength(740);
    expect(reviewedRuntimeLessonMediaRows.every((item) =>
      ['embedded-asset', 'path-plannable'].includes(item.classification) &&
      item.reviewedLimitationState.includes('residual-disposition-reviewed') &&
      !item.reviewedLimitationState.includes('unresolved-residual-disposition-review')
    )).toBe(true);
    expect(reviewedRuntimeLessonMediaRows
      .filter((item) => item.sourceHash?.startsWith('sha256:'))
      .every((item) => {
        const actualHash = `sha256:${createHash('sha256')
          .update(readFileSync(item.sourcePathOrUrl))
          .digest('hex')}`;
        return item.sourceHash === actualHash;
      })).toBe(true);
    expect(reviewedRuntimeLessonMediaRows
      .filter((item) => item.sourceHash === null)
      .every((item) =>
        item.originalMissingFieldCodes.includes('missing-content-hash') &&
        item.reviewedLimitationState.includes('downstream-runtime-identity-blocker')
      )).toBe(true);
    expect(unresolvedDispositionRows.some((item) => item.sourceFamily === 'runtime-lesson-media')).toBe(false);
    expect(reviewedRegisteredResourceRows).toHaveLength(168);
    expect(reviewedRegisteredResourceRows.every((item) =>
      ['evidence-producing', 'path-plannable'].includes(item.classification) &&
      item.sourceHash === null &&
      item.originalMissingFieldCodes.includes('missing-content-hash') &&
      item.reviewedLimitationState.includes('residual-disposition-reviewed') &&
      item.reviewedLimitationState.includes('downstream-runtime-identity-blocker') &&
      !item.reviewedLimitationState.includes('unresolved-residual-disposition-review')
    )).toBe(true);
    expect(unresolvedDispositionRows.some((item) => item.sourceFamily === 'registered-resource')).toBe(false);
    expect(new Set(dispositionReviewItems.map((item) => item.classification))).toEqual(new Set([
      'embedded-asset',
      'evidence-producing',
      'excluded-with-rationale',
      'path-plannable',
      'supporting-citation',
    ]));
    expect(dispositionReviewEvidence).toContain(`Unresolved disposition blockers: ${unresolvedDispositionRows.length}`);
    expect(dispositionReviewEvidence).toContain(`Before queued resources: ${rowsMissingFields.length}`);
    expect(dispositionReviewEvidence).toContain(`After reviewed resources: ${rowsMissingFields.length}`);
    expect(humanReviewIntegrity.humanConfirmedRows).toBe(
      jsonlRows.filter((row) => row.reviewStatus === 'human-confirmed').length,
    );
    expect(humanReviewIntegrity.invalidHumanConfirmedRows).toBeLessThanOrEqual(
      humanReviewIntegrity.humanConfirmedRows,
    );
    expect(fullResourcePathReadinessGate).toMatchObject({
      artifactVersion: FULL_RESOURCE_PATH_READINESS_GATE_VERSION,
      status: 'failed',
      resourceCoverage: {
        totalResources: summary.totals.denominator,
        unaccountedCount: dispositionReviewSummary.totals.unresolvedDispositionBlockers,
        unresolvedDownstreamPathBlockers: dispositionReviewSummary.downstreamBlockers['path-readiness'] +
          dispositionReviewSummary.downstreamBlockers['runtime-identity'] +
          dispositionReviewSummary.downstreamBlockers.dependency,
        evidenceLineageBlockerCount: evidenceLineageSummary.evidenceLineageBlockerCount,
      },
      learningGoalDiagnostics: {
        registeredLearningGoals: Object.values(ADAPTIVE_LEARNING_GOAL_DEFINITIONS).length,
        diagnosedLearningGoals: Object.values(ADAPTIVE_LEARNING_GOAL_DEFINITIONS).length,
        missingDiagnosticLearningGoalIds: [],
        attemptedPathGenerationCount: Object.values(ADAPTIVE_LEARNING_GOAL_DEFINITIONS).length,
        notEvaluatedPathGenerationCount: 0,
        resourceMixCheckedLearningGoals: 0,
        resourceMixNotEvaluatedLearningGoals: Object.values(ADAPTIVE_LEARNING_GOAL_DEFINITIONS).length,
        citationNotEvaluatedLearningGoals: Object.values(ADAPTIVE_LEARNING_GOAL_DEFINITIONS).length,
      },
    });
    expect(fullResourcePathReadinessGate.learningGoalDiagnostics.gapDiagnostics).toHaveLength(
      Object.values(ADAPTIVE_LEARNING_GOAL_DEFINITIONS).length,
    );
    expect(fullResourcePathReadinessGate.learningGoalDiagnostics.gapDiagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({
        learningGoalId: 'frequency-response-foundations',
        coverageState: 'limited',
        missingBaselineCategories: ['diagnostic', 'practice', 'checkpoint', 'remediation'],
        reviewedBindingCount: expect.any(Number),
      }),
    ]));
    expect(fullResourcePathReadinessGate.futureResourceImportCoverage.missingAuditedFamilies).toEqual([]);
    expect(fullResourcePathReadinessGate.futureResourceImportCoverage.requiredFamilies).toEqual([
      ...REQUIRED_PATH_READINESS_RESOURCE_FAMILIES,
    ]);
    expect(fullResourcePathReadinessGate.futureResourceImportCoverage.requiredResourceTypes).toEqual(expect.arrayContaining([
      'quiz',
      'simulation',
      'arena_task',
      'slides',
      'video',
      'image-description',
    ]));
    expect(fullResourcePathReadinessGate.futureResourceImportCoverage.auditedResourceTypes).toContain('textbook_section');
    expect(fullResourcePathReadinessGate.futureResourceImportCoverage.missingAuditedResourceTypes).not.toContain('textbook-section');
    expect(fullResourcePathReadinessGate.findings.map((finding) => finding.id)).toEqual(expect.arrayContaining([
      'unresolved-downstream-path-blockers',
      'unreviewed-resource-semantics',
      'unresolved-graph-node-resource-missing',
      'yang-fan-fixture-limited-coverage',
      'learning-goal-path-generation-blocked',
      'learning-goal-baseline-limited',
      'resource-type-audit-missing',
    ]));
    expect(fullResourcePathReadinessGate.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'resource-type-audit-missing',
        severity: 'blocking',
      }),
    ]));
    expect(fullResourcePathReadinessEvidence).toContain('# Full Resource Path Readiness Gate');
    expect(fullResourcePathReadinessEvidence).toContain('Missing diagnostics: none');
    expect(fullResourcePathReadinessEvidence).toContain('frequency-response-foundations: limited');
    expect(fullResourcePathReadinessEvidence).toContain('Attempted path generations: 9');
    expect(fullResourcePathReadinessEvidence).toContain('Unresolved downstream path blockers: 17713');
    expect(fullResourcePathReadinessEvidence).toContain('Resource mix not evaluated: 9');
    expect(fullResourcePathReadinessEvidence).toContain('Citation metadata not evaluated: 9');
    const knowledgeCardRows = jsonlRows.filter((row) => row.family === 'knowledge-card');
    const cardFiles = readdirSync(join(process.cwd(), 'course-content/runtime/knowledge/cards/nodes'))
      .filter((file) => file.endsWith('.md'))
      .sort((left, right) => left.localeCompare(right));

    for (const row of jsonlRows) {
      expect(row).toHaveProperty('sourceHash');
      expect(row).toHaveProperty('sourceVersionRef');
      expect(row).toHaveProperty('citationTargets');
      expect(Array.isArray(row.citationTargets)).toBe(true);
      if (row.sourceHash === null) {
        expect(row.missingFieldCodes).toContain('missing-content-hash');
        expect(row.pathEligibility.afterCompletion).toBe(false);
      }
    }
    expect(summary.totals.pathEligible).toBe(
      jsonlRows.filter((row) => row.pathEligibility.current).length,
    );
    expect(summary.totals.pathEligible).not.toBe(
      jsonlRows.filter((row) => row.pathEligibility.afterCompletion).length,
    );
    const nestedMediaRow = jsonlRows.find((row) => (
      row.family === 'runtime-lesson-media' &&
      row.sourcePathOrUrl.includes('/media/generated-data/')
    ));
    expect(nestedMediaRow).toMatchObject({
      resourceId: expect.stringContaining(':generated-data/'),
      sourceRecord: expect.stringContaining(':generated-data/'),
    });
    expect(nestedMediaRow?.missingFieldCodes).not.toContain('missing-path-target');
    const runtimeFileMediaRows = jsonlRows.filter((row) => (
      row.family === 'runtime-lesson-media' &&
      row.sourceVersionRef === 'runtime-lesson-media.v1'
    ));
    expect(runtimeFileMediaRows.length).toBeGreaterThan(0);
    expect(runtimeFileMediaRows.every((row) => typeof row.sourceHash === 'string' && row.sourceHash.startsWith('sha256:'))).toBe(true);
    expect(runtimeFileMediaRows.every((row) => !row.missingFieldCodes.includes('missing-content-hash'))).toBe(true);
    const legacyRuntimeMediaPath = 'course-content/runtime/lessons/legacy/1-1/media/h-02-laplace-transform-flow.svg';
    const legacyRuntimeMediaRow = jsonlRows.find((row) => row.resourceId === 'runtime-media:legacy/1-1:h-02-laplace-transform-flow.svg');
    const legacyRuntimeMediaHash = `sha256:${createHash('sha256').update(readFileSync(join(process.cwd(), legacyRuntimeMediaPath))).digest('hex')}`;
    expect(legacyRuntimeMediaRow).toMatchObject({
      family: 'runtime-lesson-media',
      sourcePathOrUrl: legacyRuntimeMediaPath,
      sourceRecord: 'legacy/1-1:h-02-laplace-transform-flow.svg',
      sourceHash: legacyRuntimeMediaHash,
      sourceVersionRef: 'runtime-lesson-media.v1',
      citationTargets: [legacyRuntimeMediaPath],
    });
    expect(legacyRuntimeMediaRow?.missingFieldCodes).not.toContain('missing-content-hash');
    const indexedMediaRows = jsonlRows.filter((row) => (
      row.family === 'runtime-lesson-media' &&
      row.resourceId.startsWith('runtime-media:') &&
      row.sourceVersionRef === 'resource-node-registry.v1'
    ));
    expect(indexedMediaRows.length).toBeGreaterThan(0);
    expect(indexedMediaRows.every((row) => !row.missingFieldCodes.includes('missing-evidence-instrumentation'))).toBe(true);
    expect(indexedMediaRows.some((row) => row.evidenceContract.complete)).toBe(true);
    expect(indexedMediaRows.some((row) => row.resourceId === 'runtime-media:5-1:5-1-intro-video')).toBe(true);
    expect(indexedMediaRows.some((row) => row.resourceId === 'runtime-media:5-1:5-1 媒体链接登记')).toBe(false);
    expect(indexedMediaRows.some((row) => row.resourceType === 'handout')).toBe(false);
    const legacyRuntimeHandoutRow = jsonlRows.find((row) => (
      row.family === 'runtime-handout' &&
      row.sourcePathOrUrl === '/course-runtime/lessons/legacy/L-2b/L-2b-handout.md'
    ));
    expect(legacyRuntimeHandoutRow).toMatchObject({
      resourceId: 'runtime-handout:legacy/L-2b',
      sourceRecord: 'legacy/L-2b',
      citationTargets: ['/course-runtime/lessons/legacy/L-2b/L-2b-handout.md'],
      sourceVersionRef: 'resource-node-registry.v1',
    });
    const aliasLegacyRuntimeHandoutRow = jsonlRows.find((row) => (
      row.family === 'runtime-handout' &&
      row.sourcePathOrUrl === '/course-runtime/lessons/legacy/1-1/1-1-handout.md'
    ));
    expect(aliasLegacyRuntimeHandoutRow).toMatchObject({
      resourceId: 'runtime-handout:legacy/1-1',
      sourceRecord: 'legacy/1-1',
      citationTargets: ['/course-runtime/lessons/legacy/1-1/1-1-handout.md'],
      sourceVersionRef: 'resource-node-registry.v1',
    });
    const graphBoundStepRow = jsonlRows.find((row) => row.resourceId === 'runtime-step:3-5:step-01');
    const runtimeManifestPath = 'course-content/runtime/lessons/3-5/interactive-manifest.json';
    const runtimeManifestHash = `sha256:${createHash('sha256').update(readFileSync(join(process.cwd(), runtimeManifestPath))).digest('hex')}`;
    expect(graphBoundStepRow?.sourcePathOrUrl).toBe(runtimeManifestPath);
    expect(graphBoundStepRow?.sourceHash).toBe(runtimeManifestHash);
    expect(graphBoundStepRow?.missingFieldCodes).not.toContain('missing-content-hash');
    expect(graphBoundStepRow?.missingFieldCodes).not.toContain('missing-knowledge-binding');
    expect(graphBoundStepRow?.coverage.denominatorKey).toContain('根轨迹法_2_e3f6c0c1');
    const runtimeStepRows = jsonlRows.filter((row) => row.family === 'runtime-lesson-step');
    expect(runtimeStepRows.length).toBeGreaterThan(0);
    for (const row of runtimeStepRows) {
      if (!row.pathTarget) continue;
      const routeMatch = String(row.pathTarget).match(/^\/interactive-learning\/courses\/([^/?#]+)\/student\/[^/?#]+(?:\?step=[^#]+)?$/);
      const routeSegment = routeMatch?.[1];
      expect(routeSegment).toBeTruthy();
      expect(existsSync(join(
        process.cwd(),
        `src/app/interactive-learning/courses/${routeSegment}/student/[sessionId]/page.tsx`,
      ))).toBe(true);
    }
    const manifestModuleRow = jsonlRows.find((row) => row.resourceId === 'runtime-module:3-5:step-01:boundary-card');
    expect(manifestModuleRow?.sourcePathOrUrl).toBe(runtimeManifestPath);
    expect(manifestModuleRow?.sourceHash).toBe(runtimeManifestHash);
    expect(manifestModuleRow?.missingFieldCodes).not.toContain('missing-content-hash');
    const infographPath = 'course-content/runtime/knowledge/infographs/nodes/Bode图_1_1.png';
    const infographRow = jsonlRows.find((row) => row.resourceId === 'infograph:Bode图_1_1');
    const infographHash = `sha256:${createHash('sha256').update(readFileSync(join(process.cwd(), infographPath))).digest('hex')}`;
    expect(infographRow?.sourcePathOrUrl).toBe(infographPath);
    expect(infographRow?.sourceHash).toBe(infographHash);
    expect(infographRow?.missingFieldCodes).not.toContain('missing-content-hash');

    const authoringManifestPath = 'course-content/authoring/resources/textbooks/hu-shousong-exercise-analysis-3rd/chapter-01/manifest.json';
    const authoringManifest = JSON.parse(readFileSync(join(process.cwd(), authoringManifestPath), 'utf8'));
    const chapterRow = jsonlRows.find((row) => (
      row.family === 'authoring-textbook-chapter' &&
      row.sourcePathOrUrl === authoringManifestPath
    ));
    const manifestHash = `sha256:${createHash('sha256').update(readFileSync(join(process.cwd(), authoringManifestPath))).digest('hex')}`;
    expect(chapterRow?.sourceHash).toBe(manifestHash);
    expect(chapterRow?.sourceHash).not.toBe(authoringManifest.markdownSha256);
    expect(chapterRow?.citationTargets).toContain(
      'course-content/authoring/resources/textbooks/hu-shousong-exercise-analysis-3rd/chapter-01/textbook.md',
    );
    expect(chapterRow?.citationTargets).not.toContain('textbook.md');
    const captionImage = authoringManifest.images.find((image: { caption?: string }) => image.caption);
    const captionRow = jsonlRows.find((row) => (
      row.family === 'authoring-textbook-caption' &&
      row.sourcePathOrUrl === authoringManifestPath &&
      row.sourceRecord === `caption:${captionImage.index ?? captionImage.exportPath}`
    ));
    const captionHash = `sha256:${createHash('sha256').update(captionImage.caption).digest('hex')}`;
    expect(captionRow?.sourceHash).toBe(captionHash);
    expect(captionRow?.sourceHash).not.toBe(captionImage.sha256);
    const staleModuleMediaRow = jsonlRows.find((row) => row.resourceId === 'runtime-module:1-1:step-01:step-01-content-figure-02');
    expect(staleModuleMediaRow?.citationTargets).toEqual([]);
    expect(staleModuleMediaRow?.groundingEligibility.citationReady).toBe(false);
    expect(staleModuleMediaRow?.missingFieldCodes).toContain('missing-citation-target');
    expect(jsonlRows.some((row) => (
      row.family === 'runtime-lesson-module' &&
      row.citationTargets.some((target: string) => target.includes('course-content/runtime/lessons/media/processed'))
    ))).toBe(false);

    expect(knowledgeCardRows).toHaveLength(cardFiles.length);
    expect(new Set(knowledgeCardRows.map((row) => row.sourceRecord))).toEqual(
      new Set(cardFiles.map((file) => file.replace(/\.md$/, ''))),
    );
    for (const row of knowledgeCardRows) {
      const markdown = readFileSync(join(process.cwd(), row.sourcePathOrUrl), 'utf8');
      expect(row).toMatchObject({
        sourceHash: `sha256:${createHash('sha256').update(markdown).digest('hex')}`,
        sourceVersionRef: 'runtime-knowledge-card.v1',
        citationTargets: [row.sourcePathOrUrl],
      });
      expect(row.sourcePathOrUrl).toBe(`course-content/runtime/knowledge/cards/nodes/${row.sourceRecord}.md`);
      expect(row.coverage.denominatorKey).toContain(row.sourceRecord);
      expect(row.missingFieldCodes).not.toContain('missing-content-hash');
      expect(row.pathEligibility.afterCompletion).toBe(false);
    }
  });

  it('emits deterministic privacy-minimized resource completion workqueues', () => {
    const result = buildResourceFieldCompletionAudit({
      registry: buildResourceNodeRegistry({}),
      generatedAt: '2026-06-22T00:00:00.000Z',
      candidates: [{
        id: 'runtime-media:3-5:transient-plot.png',
        title: 'Transient plot',
        family: 'runtime-lesson-media',
        sourcePathOrUrl: 'course-content/runtime/lessons/3-5/media/transient-plot.png',
        sourceRecord: '3-5:transient-plot.png',
        knowledgeNodeIds: ['根轨迹法_2_e3f6c0c1'],
        capabilityTargetIds: ['parameterDesign'],
        segmentRefs: ['transient-plot.png'],
        citationTargets: ['course-content/runtime/lessons/3-5/media/transient-plot.png'],
        pathTarget: '/course-runtime/lessons/3-5/media/transient-plot.png',
        estimatedTimeMinutes: 3,
        evidenceInstrumentation: ['resource_view'],
        privacyScope: 'student-visible',
        versionRef: 'runtime-lesson-media.v1',
        generatedBy: 'external-tool',
        humanConfirmed: false,
      }, {
        id: 'knowledge-card:root-locus-review',
        title: 'Root locus review',
        family: 'knowledge-card',
        sourcePathOrUrl: 'course-content/runtime/knowledge/cards/nodes/root-locus-review.md',
        sourceRecord: 'root-locus-review',
        knowledgeNodeIds: ['根轨迹法_2_e3f6c0c1'],
        capabilityTargetIds: ['parameterDesign'],
        qualityTargetIds: ['root-locus-sketching'],
        segmentRefs: ['root-locus-review'],
        citationTargets: ['course-content/runtime/knowledge/cards/nodes/root-locus-review.md'],
        pathTarget: '/knowledge?node=root-locus-review',
        estimatedTimeMinutes: 5,
        evidenceInstrumentation: ['knowledge_card_view'],
        privacyScope: 'student-visible',
        contentHash: 'sha256:root-locus-review',
        versionRef: 'runtime-knowledge-card.v1',
        generatedBy: 'local-model',
        humanConfirmed: false,
      }, {
        id: 'textbook-search-document:long-image-description',
        title: `> Image description: ${'The figure describes a control-system response with axes and annotations. '.repeat(8)}`,
        family: 'textbook-search-document',
        sourcePathOrUrl: '/resources/textbook/long-image-description',
        sourceRecord: 'long-image-description',
        knowledgeNodeIds: ['根轨迹法_2_e3f6c0c1'],
        capabilityTargetIds: ['parameterDesign'],
        segmentRefs: ['long-image-description'],
        citationTargets: ['/resources/textbook/long-image-description'],
        pathTarget: '/resources/textbook/long-image-description',
        estimatedTimeMinutes: 4,
        evidenceInstrumentation: ['textbook_search_document_view'],
        privacyScope: 'student-visible',
        contentHash: 'sha256:long-image-description',
        versionRef: 'textbook-search-document.v1',
        generatedBy: 'external-tool',
        humanConfirmed: false,
      }],
    });

    const { workqueues } = result;
    expect(workqueues).toMatchObject({
      auditMissingFieldRows: 3,
      queuedResources: 3,
      primaryQueueItems: 3,
      dependentQueueItems: 4,
      byMissingFieldCode: {
        'missing-content-hash': 1,
        'missing-human-review': 3,
        'provisional-metadata': 3,
      },
      byFollowupBucket: {
        'repair-resource-identity-bindings': 1,
        'review-runtime-media-handout-dispositions': 6,
      },
    });
    expect(workqueues.queues.reduce((total, queue) => total + queue.total, 0)).toBe(7);
    expect(workqueues.queues.flatMap((queue) => queue.items).filter((item) => item.queueRole === 'primary').map((item) => item.resourceId)).toEqual([
      'knowledge-card:root-locus-review',
      'runtime-media:3-5:transient-plot.png',
      'textbook-search-document:long-image-description',
    ]);
    for (const queue of workqueues.queues) {
      expect(queue.total).toBe(queue.items.length);
      for (const item of queue.items) {
        expect(item.privacyMinimized).toBe(true);
        expect(item.rawContentIncluded).toBe(false);
        expect(item.suggestedReviewerAction.length).toBeGreaterThan(0);
      }
    }

    const runtimeMediaItem = workqueues.queues
      .flatMap((queue) => queue.items)
      .find((item) => item.resourceId === 'runtime-media:3-5:transient-plot.png' && item.queueRole === 'primary');
    expect(runtimeMediaItem).toMatchObject({
      sourceFamily: 'runtime-lesson-media',
      graphDomain: 'runtime-media',
      learningGoalIds: ['parameterDesign'],
      sourceHash: null,
      sourceVersionRef: 'runtime-lesson-media.v1',
      queueRole: 'primary',
      missingFieldCode: 'missing-content-hash',
      primaryMissingFieldCode: 'missing-content-hash',
      primaryFollowupBucket: 'repair-resource-identity-bindings',
      dependencyState: 'needs-human-review',
      dependencyHints: expect.arrayContaining([
        'source-evidence-before-semantic-review',
        'independent-human-review-before-path-eligibility',
      ]),
      currentBlockers: expect.arrayContaining([
        'missing-content-hash',
        'missing-human-review',
      ]),
    });
    const textbookItem = workqueues.queues
      .flatMap((queue) => queue.items)
      .find((item) => item.resourceId === 'textbook-search-document:long-image-description');
    expect(textbookItem?.title).toBe('long-image-description');
    expect(textbookItem?.title).not.toContain('Image description');
  });

  it('downgrades human-confirmed rows without independent review evidence', () => {
    const result = buildResourceFieldCompletionAudit({
      registry: buildResourceNodeRegistry({}),
      generatedAt: '2026-06-22T00:00:00.000Z',
      candidates: [{
        id: 'external:template-confirmed-control-note',
        title: 'Template confirmed control note',
        family: 'external-resource',
        sourcePathOrUrl: 'https://example.edu/template-confirmed-control-note',
        knowledgeNodeIds: ['Bode图_1_1'],
        capabilityTargetIds: ['control-correction:time-domain-targets'],
        segmentRefs: ['template-confirmed-control-note'],
        citationTargets: ['https://example.edu/template-confirmed-control-note'],
        pathTarget: 'https://example.edu/template-confirmed-control-note',
        estimatedTimeMinutes: 4,
        evidenceInstrumentation: ['external_resource_access'],
        privacyScope: 'student-visible',
        contentHash: 'sha256:template-confirmed',
        versionRef: 'external-resource.v1',
        generatedBy: 'local-model',
        humanConfirmed: true,
        reviewEvidence: {
          reviewerId: 'template-reviewer',
          reviewerRole: 'curriculum-data-governance',
          reviewedAt: '2026-07-03T00:00:00.000Z',
          reviewBatchId: 'template-batch',
          confidence: 0.9,
        },
      }],
    });

    expect(result.rows[0]).toMatchObject({
      reviewStatus: 'stale',
      completionMethod: 'local-model-assisted',
      missingFieldCodes: expect.arrayContaining([
        'missing-human-review',
        'stale-review',
        'provisional-metadata',
      ]),
      pathEligibility: {
        current: false,
        afterCompletion: false,
        masteryAffecting: false,
        blockedBy: expect.arrayContaining([
          'missing-human-review',
          'stale-review',
          'provisional-metadata',
        ]),
      },
    });
    expect(result.integrityDiagnostics).toMatchObject({
      humanConfirmedRows: 0,
      invalidHumanConfirmedRows: 0,
      issues: [],
    });
  });

  it('keeps provisional metadata out of PlanningUnit eligibility', () => {
    const result = buildResourceFieldCompletionAudit({
      registry: buildResourceNodeRegistry({}),
      generatedAt: '2026-06-22T00:00:00.000Z',
      candidates: [{
        id: 'infograph:Bode图_1_1',
        title: 'Bode图 信息图',
        family: 'knowledge-infograph',
        sourcePathOrUrl: 'course-content/runtime/knowledge/infographs/nodes/Bode图_1_1.png',
        knowledgeNodeIds: ['Bode图_1_1'],
        capabilityTargetIds: ['control-correction:time-domain-targets'],
        segmentRefs: ['Bode图_1_1'],
        citationTargets: ['/course-runtime/knowledge/infographs/nodes/Bode图_1_1.png'],
        pathTarget: '/course-runtime/knowledge/infographs/nodes/Bode图_1_1.png',
        estimatedTimeMinutes: 3,
        evidenceInstrumentation: ['infograph_view'],
        contentHash: 'sha256:test',
        versionRef: 'knowledge-infograph-manifest.v1',
        generatedBy: 'local-model',
        humanConfirmed: false,
      }],
    });

    expect(result.rows[0]).toMatchObject({
      completionMethod: 'local-model-assisted',
      reviewStatus: 'model-assisted-provisional',
      missingFieldCodes: expect.arrayContaining(['missing-human-review', 'provisional-metadata']),
      pathEligibility: {
        afterCompletion: false,
        masteryAffecting: false,
        blockedBy: expect.arrayContaining(['missing-human-review', 'provisional-metadata']),
      },
    });
  });

  it('blocks path eligibility and mastery effect when evidence contract fields are missing', () => {
    const result = buildResourceFieldCompletionAudit({
      registry: buildResourceNodeRegistry({}),
      generatedAt: '2026-06-22T00:00:00.000Z',
      candidates: [{
        id: 'quiz:generated-bode-check',
        title: 'Generated Bode Check',
        family: 'quiz',
        sourcePathOrUrl: 'course-content/runtime/generated-questions/bode.json',
        knowledgeNodeIds: ['Bode图_1_1'],
        capabilityTargetIds: ['control-correction:time-domain-targets'],
        segmentRefs: ['bode-check'],
        citationTargets: ['course-content/runtime/generated-questions/bode.json'],
        pathTarget: '/teacher/quizzes/generated-bode-check',
        estimatedTimeMinutes: 5,
        evidenceInstrumentation: [],
        contentHash: 'sha256:quiz',
        versionRef: 'generated-question-bank.v1',
        humanConfirmed: true,
      }],
    });

    expect(result.rows[0]).toMatchObject({
      reviewStatus: 'stale',
      evidenceContract: {
        complete: false,
        missingFields: expect.arrayContaining([
          'eventType',
          'clientEventIdPolicy',
          'learningFactPolicy',
          'privacyScope',
        ]),
      },
      missingFieldCodes: expect.arrayContaining([
        'missing-evidence-instrumentation',
        'missing-evidence-contract',
      ]),
      pathEligibility: {
        afterCompletion: false,
        masteryAffecting: false,
        blockedBy: expect.arrayContaining(['missing-evidence-contract']),
      },
    });
  });

  it('blocks human-confirmed candidates when source hash or version ref is missing', () => {
    const result = buildResourceFieldCompletionAudit({
      registry: buildResourceNodeRegistry({}),
      generatedAt: '2026-06-22T00:00:00.000Z',
      candidates: [{
        id: 'external:confirmed-but-unversioned',
        title: 'Confirmed but unversioned',
        family: 'external-resource',
        sourcePathOrUrl: 'https://example.edu/control-note',
        knowledgeNodeIds: ['Bode图_1_1'],
        capabilityTargetIds: ['control-correction:time-domain-targets'],
        segmentRefs: ['control-note'],
        citationTargets: ['https://example.edu/control-note'],
        pathTarget: 'https://example.edu/control-note',
        estimatedTimeMinutes: 4,
        evidenceInstrumentation: ['external_resource_access'],
        humanConfirmed: true,
      }],
    });

    expect(result.rows[0]).toMatchObject({
      sourceHash: null,
      sourceVersionRef: null,
      reviewAudit: {
        reviewedSourceHash: null,
        reviewedVersionRef: null,
        reviewedAt: '2026-06-22T00:00:00.000Z',
      },
      reviewStatus: 'stale',
      missingFieldCodes: expect.arrayContaining([
        'missing-content-hash',
        'missing-version-ref',
      ]),
      pathEligibility: {
        afterCompletion: false,
        masteryAffecting: false,
        blockedBy: expect.arrayContaining([
          'missing-content-hash',
          'missing-version-ref',
        ]),
      },
    });
  });

  it('records reviewed source hash, version ref, and generation provenance for human-confirmed candidates', () => {
    const result = buildResourceFieldCompletionAudit({
      registry: buildResourceNodeRegistry({}),
      generatedAt: '2026-06-22T00:00:00.000Z',
      candidates: [{
        id: 'external:confirmed-versioned',
        title: 'Confirmed versioned resource',
        family: 'external-resource',
        sourcePathOrUrl: 'https://example.edu/versioned-control-note',
        knowledgeNodeIds: ['Bode图_1_1'],
        capabilityTargetIds: ['control-correction:time-domain-targets'],
        segmentRefs: ['versioned-control-note'],
        citationTargets: ['https://example.edu/versioned-control-note'],
        pathTarget: 'https://example.edu/versioned-control-note',
        estimatedTimeMinutes: 4,
        evidenceInstrumentation: ['external_resource_access'],
        privacyScope: 'student-visible',
        contentHash: 'sha256:confirmed',
        versionRef: 'external-resource.v1',
        generatedBy: 'local-model',
        humanConfirmed: true,
        currentPathEligible: true,
        reviewEvidence: {
          reviewerId: 'teacher-reviewer-1',
          reviewerRole: 'curriculum-data-governance',
          reviewedAt: '2026-07-03T00:00:00.000Z',
          reviewBatchId: 'review-batch-1',
          reviewerVisibleRationale: 'Teacher verified graph fit and path eligibility against the source resource.',
          independentEvidenceRef: 'review-packet:external-confirmed-versioned',
          reviewedSourceHash: 'sha256:review-source',
          promptOrManifestHash: 'sha256:review-prompt',
          confidence: 0.96,
        },
      }],
    });

    expect(result.rows[0]).toMatchObject({
      sourceHash: 'sha256:confirmed',
      sourceVersionRef: 'external-resource.v1',
      completionMethod: 'already-governed',
      reviewStatus: 'human-confirmed',
      reviewAudit: {
        reviewedSourceHash: 'sha256:review-source',
        reviewedVersionRef: 'external-resource.v1',
        reviewedAt: '2026-07-03T00:00:00.000Z',
        reviewerId: 'teacher-reviewer-1',
        reviewerRole: 'curriculum-data-governance',
        reviewBatchId: 'review-batch-1',
        generationToolOrModel: 'local-model',
        reviewerVisibleRationale: 'Teacher verified graph fit and path eligibility against the source resource.',
        independentEvidenceRef: 'review-packet:external-confirmed-versioned',
        promptOrManifestHash: 'sha256:review-prompt',
        confidence: 0.96,
      },
      evidenceContract: {
        complete: true,
        privacyScope: true,
      },
      pathEligibility: {
        current: true,
        afterCompletion: true,
        masteryAffecting: true,
        blockedBy: [],
      },
    });
    expect(result.rows[0].missingFieldCodes).not.toContain('provisional-metadata');
    expect(result.rows[0].pathEligibility.blockedBy).not.toContain('provisional-metadata');
    expect(result.rows[0].missingFieldCodes).not.toContain('missing-evidence-contract');
  });

  it('keeps reviewed runtime concept steps stale without independent review rationale evidence', () => {
    const result = buildResourceFieldCompletionAudit({
      registry: buildResourceNodeRegistry({}),
      generatedAt: '2026-06-22T00:00:00.000Z',
      candidates: [{
        id: 'runtime-step:foundation:step-01',
        title: 'Foundation concept step',
        family: 'runtime-lesson-step',
        sourcePathOrUrl: 'course-content/runtime/lessons/foundation/interactive-manifest.json',
        sourceRecord: 'foundation:step-01',
        knowledgeNodeIds: ['反馈_1_1'],
        capabilityTargetIds: [],
        segmentRefs: ['step-01'],
        citationTargets: ['course-content/runtime/lessons/foundation/interactive-manifest.json'],
        pathTarget: '/interactive-learning/courses/foundation/student/demo?step=step-01',
        estimatedTimeMinutes: 6,
        evidenceInstrumentation: ['lesson_submit', 'lesson_step_view'],
        privacyScope: 'student-visible',
        contentHash: 'sha256:foundation-manifest',
        versionRef: 'interactive-manifest.v2',
        generatedBy: 'template',
        humanConfirmed: true,
        currentPathEligible: true,
        reviewEvidence: {
          reviewerId: 'graph-resource-governance-review',
          reviewerRole: 'curriculum-data-governance',
          reviewedAt: '2026-07-04T00:00:00.000Z',
          reviewBatchId: 'foundation-review-batch',
          promptOrManifestHash: 'sha256:foundation-manifest',
          confidence: 0.91,
        },
      }],
    });

    expect(result.rows[0]).toMatchObject({
      reviewStatus: 'stale',
      missingFieldCodes: expect.arrayContaining(['missing-human-review', 'stale-review']),
      evidenceContract: {
        complete: true,
      },
      pathEligibility: {
        current: false,
        afterCompletion: false,
        masteryAffecting: false,
        blockedBy: expect.arrayContaining(['missing-human-review', 'stale-review']),
      },
    });
    expect(result.rows[0].missingFieldCodes).not.toContain('missing-capability-target');
  });

  it('keeps citation-only runtime media out of path eligibility while preserving citation readiness', () => {
    const result = buildResourceFieldCompletionAudit({
      registry: buildResourceNodeRegistry({}),
      generatedAt: '2026-06-22T00:00:00.000Z',
      candidates: [{
        id: 'runtime-media:1-1:overview-map.png',
        title: 'Overview map',
        family: 'runtime-lesson-media',
        sourcePathOrUrl: 'course-content/runtime/lessons/1-1/media/overview-map.png',
        sourceRecord: '1-1:overview-map.png',
        knowledgeNodeIds: ['课程总图_1_1'],
        segmentRefs: ['overview-map.png'],
        citationTargets: ['course-content/runtime/lessons/1-1/media/overview-map.png'],
        pathTarget: '/course-runtime/lessons/1-1/media/overview-map.png',
        contentHash: 'sha256:overview-map',
        versionRef: 'runtime-lesson-media.v1',
        generatedBy: 'external-tool',
        humanConfirmed: false,
        privacyScope: 'student-visible',
      }],
    });

    expect(result.rows[0]).toMatchObject({
      groundingEligibility: {
        retrievalReady: true,
        citationReady: true,
      },
      pathEligibility: {
        afterCompletion: false,
        masteryAffecting: false,
        blockedBy: expect.arrayContaining([
          'missing-capability-target',
          'missing-evidence-contract',
          'missing-human-review',
          'provisional-metadata',
        ]),
      },
    });
    expect(result.rows[0].missingFieldCodes).not.toContain('missing-citation-target');
    expect(result.rows[0].missingFieldCodes).not.toContain('missing-segment-ref');
  });

  it('summarizes path-relevant evidence-lineage blockers and Yang Fan fixture preconditions', () => {
    const result = buildResourceFieldCompletionAudit({
      registry: buildResourceNodeRegistry({}),
      generatedAt: '2026-07-05T00:00:00.000Z',
      candidates: [
        {
          id: 'path-resource:blocked-lineage',
          title: 'Blocked lineage resource',
          family: 'external-resource',
          sourcePathOrUrl: '/course-runtime/path-resource/blocked-lineage',
          sourceRecord: 'blocked-lineage',
          knowledgeNodeIds: ['反馈_1_1'],
          capabilityTargetIds: ['controlModeling'],
          segmentRefs: ['blocked-lineage'],
          citationTargets: ['/course-runtime/path-resource/blocked-lineage'],
          pathTarget: '/interactive-learning/resources/blocked-lineage',
          estimatedTimeMinutes: 5,
          privacyScope: 'student-visible',
          contentHash: 'sha256:blocked-lineage',
          versionRef: 'external-resource.v1',
          humanConfirmed: true,
          currentPathEligible: true,
          reviewEvidence: {
            reviewerId: 'lineage-reviewer',
            reviewerRole: 'curriculum-data-governance',
            reviewedAt: '2026-07-05T00:00:00.000Z',
            reviewBatchId: 'lineage-review-batch',
            reviewerVisibleRationale: 'Reviewer confirmed semantic role, but lineage instrumentation is not declared.',
            independentEvidenceRef: 'review-packet:blocked-lineage',
            reviewedSourceHash: 'sha256:blocked-lineage',
            promptOrManifestHash: 'sha256:lineage-review',
          },
        },
        {
          id: 'path-resource:ready-lineage',
          title: 'Ready lineage resource',
          family: 'external-resource',
          sourcePathOrUrl: '/course-runtime/path-resource/ready-lineage',
          sourceRecord: 'ready-lineage',
          knowledgeNodeIds: ['反馈_1_1'],
          capabilityTargetIds: ['controlModeling'],
          segmentRefs: ['ready-lineage'],
          citationTargets: ['/course-runtime/path-resource/ready-lineage'],
          pathTarget: '/interactive-learning/resources/ready-lineage',
          estimatedTimeMinutes: 5,
          evidenceInstrumentation: ['resource_completed'],
          privacyScope: 'student-visible',
          contentHash: 'sha256:ready-lineage',
          versionRef: 'external-resource.v1',
          humanConfirmed: true,
          currentPathEligible: true,
          reviewEvidence: {
            reviewerId: 'lineage-reviewer',
            reviewerRole: 'curriculum-data-governance',
            reviewedAt: '2026-07-05T00:00:00.000Z',
            reviewBatchId: 'lineage-review-batch',
            reviewerVisibleRationale: 'Reviewer confirmed semantic role and lineage instrumentation.',
            independentEvidenceRef: 'review-packet:ready-lineage',
            reviewedSourceHash: 'sha256:ready-lineage',
            promptOrManifestHash: 'sha256:lineage-review',
          },
        },
      ],
    });

    expect(result.evidenceLineage.summary).toMatchObject({
      artifactVersion: 'resource-evidence-lineage-readiness.v1',
      layerTotals: {
        pathRelevantRows: 2,
        evidenceLineageBlockers: 1 + YANGFAN_FIXTURE_OWNED_RESOURCE_IDS.length,
        readyRows: 1,
      },
      evidenceLineageBlockerCount: 1 + YANGFAN_FIXTURE_OWNED_RESOURCE_IDS.length,
      findingCounts: {
        'missing-evidence-contract': 1 + YANGFAN_FIXTURE_OWNED_RESOURCE_IDS.length,
        'missing-evidence-instrumentation': 1 + YANGFAN_FIXTURE_OWNED_RESOURCE_IDS.length,
      },
      followupBuckets: {
        'complete-evidence-lineage-bindings': 1 + YANGFAN_FIXTURE_OWNED_RESOURCE_IDS.length,
      },
      yangFanFixtureBlockers: {
        blocked: true,
        blockerCount: YANGFAN_FIXTURE_OWNED_RESOURCE_IDS.length,
        scopedBlockerCount: YANGFAN_FIXTURE_OWNED_RESOURCE_IDS.length,
        globalLimitationCount: 1,
      },
    });
    expect(result.evidenceLineage.summary.contractFieldGaps).toMatchObject({
      eventType: 1 + YANGFAN_FIXTURE_OWNED_RESOURCE_IDS.length,
      clientEventIdPolicy: 1 + YANGFAN_FIXTURE_OWNED_RESOURCE_IDS.length,
      attemptKey: 1 + YANGFAN_FIXTURE_OWNED_RESOURCE_IDS.length,
      sourceLogId: 1 + YANGFAN_FIXTURE_OWNED_RESOURCE_IDS.length,
      timestamps: 1 + YANGFAN_FIXTURE_OWNED_RESOURCE_IDS.length,
      learningFactPolicy: 1 + YANGFAN_FIXTURE_OWNED_RESOURCE_IDS.length,
    });
    expect(result.evidenceLineage.items).toHaveLength(1 + YANGFAN_FIXTURE_OWNED_RESOURCE_IDS.length);
    expect(result.evidenceLineage.items[0]).toMatchObject({
      resourceId: 'path-resource:blocked-lineage',
      pathRole: 'current-path',
      evidenceEffectState: 'blocked',
      missingFieldCodes: expect.arrayContaining([
        'missing-evidence-contract',
        'missing-evidence-instrumentation',
      ]),
      followupBucket: 'complete-evidence-lineage-bindings',
      blocksYangFanFixture: false,
      yangFanFixtureScope: 'global-resource-backlog',
      privacyMinimized: true,
      rawContentIncluded: false,
    });
    expect(result.evidenceLineage.items
      .filter((item) => item.yangFanFixtureScope === 'fixture-owned'))
      .toHaveLength(YANGFAN_FIXTURE_OWNED_RESOURCE_IDS.length);
    expect(JSON.stringify(result.evidenceLineage.items[0])).not.toContain('raw learner');
  });

  it('keeps fixture-owned lineage gaps as Yang Fan fixture blockers', () => {
    const result = buildResourceFieldCompletionAudit({
      registry: buildResourceNodeRegistry({}),
      generatedAt: '2026-07-05T00:00:00.000Z',
      candidates: [
        {
          id: 'yangfan-diagnostic-fixture-question',
          title: 'Yang Fan fixture question',
          family: 'external-resource',
          sourcePathOrUrl: '/fixture/yangfan-diagnostic-fixture-question',
          sourceRecord: 'yangfan-diagnostic-fixture-question',
          knowledgeNodeIds: ['性能指标_1_1'],
          capabilityTargetIds: ['controlModeling'],
          segmentRefs: ['yangfan-diagnostic-fixture-question'],
          citationTargets: ['yangfan-diagnostic-fixture-question'],
          pathTarget: 'yangfan-diagnostic-fixture-question',
          estimatedTimeMinutes: 5,
          privacyScope: 'student-visible',
          contentHash: 'sha256:yangfan-diagnostic-fixture-question',
          versionRef: 'yangfan-diagnostic-fixture.v1',
          humanConfirmed: true,
          currentPathEligible: true,
          reviewEvidence: {
            reviewerId: 'fixture-readiness-reviewer',
            reviewerRole: 'data-governance',
            reviewedAt: '2026-07-05T00:00:00.000Z',
            reviewBatchId: 'fixture-readiness-review-batch',
            reviewerVisibleRationale: 'Fixture-owned resource intentionally lacks event lineage for the negative readiness test.',
            independentEvidenceRef: 'review-packet:yangfan-diagnostic-fixture-question',
            reviewedSourceHash: 'sha256:yangfan-diagnostic-fixture-question',
            promptOrManifestHash: 'sha256:fixture-readiness-review',
          },
        },
      ],
    });

    expect(result.evidenceLineage.summary.yangFanFixtureBlockers).toMatchObject({
      blocked: true,
      blockerCount: YANGFAN_FIXTURE_OWNED_RESOURCE_IDS.length,
      scopedBlockerCount: YANGFAN_FIXTURE_OWNED_RESOURCE_IDS.length,
      globalLimitationCount: 0,
      scopePolicy: 'yangfan-fixture-readiness-scope.v1',
    });
    const fixtureQuestionItem = result.evidenceLineage.items.find((item) =>
      item.resourceId === 'yangfan-diagnostic-fixture-question'
    );
    expect(fixtureQuestionItem).toMatchObject({
      resourceId: 'yangfan-diagnostic-fixture-question',
      blocksYangFanFixture: true,
      yangFanFixtureScope: 'fixture-owned',
      missingFieldCodes: expect.arrayContaining([
        'missing-evidence-contract',
        'missing-evidence-instrumentation',
      ]),
    });
  });

  it('keeps adaptive assessment fixture writes inside scoped readiness', () => {
    const fixtureKnowledgeProgressId = (nodeId: string) =>
      `yangfan-diagnostic-fixture:knowledge-progress:${createHash('sha256')
        .update(nodeId)
        .digest('hex')
        .slice(0, 12)}`;
    const result = buildResourceFieldCompletionAudit({
      registry: buildResourceNodeRegistry({}),
      generatedAt: '2026-07-05T00:00:00.000Z',
      candidates: [
        {
          id: 'AdaptiveAssessmentAbilityEstimate:yangfan-diagnostic-fixture-ability-estimate',
          title: 'Yang Fan fixture ability estimate',
          family: 'quiz',
          sourcePathOrUrl: '/fixture/yangfan-diagnostic-fixture-ability-estimate',
          sourceRecord: 'AdaptiveAssessmentAbilityEstimate:yangfan-diagnostic-fixture-ability-estimate',
          knowledgeNodeIds: ['性能指标_1_1'],
          capabilityTargetIds: ['controlModeling'],
          segmentRefs: ['yangfan-diagnostic-fixture-ability-estimate'],
          citationTargets: ['AdaptiveAssessmentAnswer:yangfan-diagnostic-fixture-answer'],
          pathTarget: 'AdaptiveAssessmentAbilityEstimate:yangfan-diagnostic-fixture-ability-estimate',
          estimatedTimeMinutes: 5,
          privacyScope: 'student-visible',
          contentHash: 'sha256:yangfan-diagnostic-fixture-ability-estimate',
          versionRef: 'yangfan-diagnostic-fixture.v1',
          humanConfirmed: true,
          currentPathEligible: true,
          reviewEvidence: {
            reviewerId: 'fixture-readiness-reviewer',
            reviewerRole: 'data-governance',
            reviewedAt: '2026-07-05T00:00:00.000Z',
            reviewBatchId: 'fixture-readiness-review-batch',
            reviewerVisibleRationale: 'Ability estimate owner row has reviewed fixture governance.',
            independentEvidenceRef: 'review-packet:yangfan-diagnostic-fixture-ability-estimate',
            reviewedSourceHash: 'sha256:yangfan-diagnostic-fixture-ability-estimate',
            promptOrManifestHash: 'sha256:fixture-readiness-review',
          },
        },
      ],
    });

    const fixtureOwnedIds = result.evidenceLineage.items
      .filter((item) => item.yangFanFixtureScope === 'fixture-owned')
      .map((item) => item.resourceId);

    expect(fixtureOwnedIds).toContain('yangfan-diagnostic-fixture-algorithm-v1');
    expect(fixtureOwnedIds).toContain('yangfan-diagnostic-fixture-session');
    expect(fixtureOwnedIds).toContain('yangfan-diagnostic-fixture-answer');
    expect(fixtureOwnedIds).toContain('AdaptiveAssessmentAbilityEstimate:yangfan-diagnostic-fixture-ability-estimate');
    expect(fixtureOwnedIds).not.toContain('yangfan-diagnostic-fixture-ability-estimate');
    expect(fixtureOwnedIds).toContain('yangfan-diagnostic-fixture-mastery-update');
    expect(fixtureOwnedIds).toContain(fixtureKnowledgeProgressId('性能指标_1_1'));
    expect(fixtureOwnedIds).toContain(fixtureKnowledgeProgressId('根轨迹_1_1'));
    expect(fixtureOwnedIds).toContain(fixtureKnowledgeProgressId('传统设计四联图校正_4_47004'));
    expect(fixtureOwnedIds).not.toContain('yangfan-diagnostic-fixture:knowledge-progress:性能指标_1_1');
    expect(result.evidenceLineage.summary.yangFanFixtureBlockers.scopedBlockerCount)
      .toBe(YANGFAN_FIXTURE_OWNED_RESOURCE_IDS.length);
  });

  it('does not treat an incomplete fixture-owned audit row as governed readiness', () => {
    const result = buildResourceFieldCompletionAudit({
      registry: buildResourceNodeRegistry({}),
      generatedAt: '2026-07-05T00:00:00.000Z',
      candidates: [
        {
          id: 'yangfan-diagnostic-fixture-item-ref',
          title: 'Yang Fan fixture item ref',
          family: 'external-resource',
          sourcePathOrUrl: '/fixture/yangfan-diagnostic-fixture-item-ref',
          sourceRecord: 'yangfan-diagnostic-fixture-item-ref',
          knowledgeNodeIds: ['性能指标_1_1'],
          capabilityTargetIds: ['controlModeling'],
          segmentRefs: ['yangfan-diagnostic-fixture-item-ref'],
          citationTargets: ['yangfan-diagnostic-fixture-item-ref'],
          pathTarget: 'yangfan-diagnostic-fixture-item-ref',
          estimatedTimeMinutes: 5,
          privacyScope: 'student-visible',
          contentHash: 'sha256:yangfan-diagnostic-fixture-item-ref',
          versionRef: 'yangfan-diagnostic-fixture.v1',
          evidenceInstrumentation: ['adaptive-assessment-answer'],
          humanConfirmed: false,
          currentPathEligible: true,
        },
      ],
    });

    const itemRefBlocker = result.evidenceLineage.items.find((item) =>
      item.resourceId === 'yangfan-diagnostic-fixture-item-ref'
    );
    expect(itemRefBlocker).toMatchObject({
      resourceId: 'yangfan-diagnostic-fixture-item-ref',
      evidenceEffectState: 'blocked',
      blocksYangFanFixture: true,
      yangFanFixtureScope: 'fixture-owned',
      missingFieldCodes: expect.arrayContaining(['missing-human-review']),
    });
    expect(itemRefBlocker?.missingFieldCodes).not.toContain('missing-evidence-contract');
    expect(itemRefBlocker?.missingFieldCodes).not.toContain('missing-evidence-instrumentation');
    expect(itemRefBlocker?.missingContractFields).toEqual([]);
  });

  it('does not treat governed citation rows as fixture-owned resource governance', () => {
    const result = buildResourceFieldCompletionAudit({
      registry: buildResourceNodeRegistry({}),
      generatedAt: '2026-07-05T00:00:00.000Z',
      candidates: [
        {
          id: 'path-resource:governed-reference-row',
          title: 'Governed row that only cites fixture fact',
          family: 'external-resource',
          sourcePathOrUrl: '/fixture/governed-reference-row',
          sourceRecord: 'path-resource:governed-reference-row',
          knowledgeNodeIds: ['性能指标_1_1'],
          capabilityTargetIds: ['controlModeling'],
          segmentRefs: ['path-resource:governed-reference-row'],
          citationTargets: ['LearningFact:yangfan-fixture-fact-path'],
          pathTarget: 'path-resource:governed-reference-row',
          estimatedTimeMinutes: 5,
          privacyScope: 'student-visible',
          contentHash: 'sha256:governed-reference-row',
          versionRef: 'governed-reference-row.v1',
          evidenceInstrumentation: ['path-execution'],
          humanConfirmed: true,
          currentPathEligible: true,
          reviewEvidence: {
            reviewerId: 'fixture-readiness-reviewer',
            reviewerRole: 'data-governance',
            reviewedAt: '2026-07-05T00:00:00.000Z',
            reviewBatchId: 'fixture-readiness-review-batch',
            reviewerVisibleRationale: 'Reference row is governed but does not govern the cited fixture fact.',
            independentEvidenceRef: 'review-packet:governed-reference-row',
            reviewedSourceHash: 'sha256:governed-reference-row',
            promptOrManifestHash: 'sha256:fixture-readiness-review',
          },
        },
      ],
    });

    const fixtureFactBlocker = result.evidenceLineage.items.find((item) =>
      item.resourceId === 'yangfan-fixture-fact-path'
    );
    expect(fixtureFactBlocker).toMatchObject({
      resourceId: 'yangfan-fixture-fact-path',
      evidenceEffectState: 'blocked',
      blocksYangFanFixture: true,
      yangFanFixtureScope: 'fixture-owned',
    });
  });

  it('does not block fixture generation for global rows that only cite fixture facts', () => {
    const result = buildResourceFieldCompletionAudit({
      registry: buildResourceNodeRegistry({}),
      generatedAt: '2026-07-05T00:00:00.000Z',
      candidates: [
        {
          id: 'path-resource:incomplete-reference-row',
          title: 'Incomplete row that only cites fixture fact',
          family: 'external-resource',
          sourcePathOrUrl: '/global/incomplete-reference-row',
          sourceRecord: 'path-resource:incomplete-reference-row',
          knowledgeNodeIds: ['性能指标_1_1'],
          capabilityTargetIds: ['controlModeling'],
          segmentRefs: ['path-resource:incomplete-reference-row'],
          citationTargets: ['LearningFact:yangfan-fixture-fact-path'],
          pathTarget: 'path-resource:incomplete-reference-row',
          estimatedTimeMinutes: 5,
          privacyScope: 'student-visible',
          contentHash: 'sha256:incomplete-reference-row',
          versionRef: 'incomplete-reference-row.v1',
          humanConfirmed: true,
          currentPathEligible: true,
          reviewEvidence: {
            reviewerId: 'fixture-readiness-reviewer',
            reviewerRole: 'data-governance',
            reviewedAt: '2026-07-05T00:00:00.000Z',
            reviewBatchId: 'fixture-readiness-review-batch',
            reviewerVisibleRationale: 'Reference row is governed but still lacks evidence lineage instrumentation.',
            independentEvidenceRef: 'review-packet:incomplete-reference-row',
            reviewedSourceHash: 'sha256:incomplete-reference-row',
            promptOrManifestHash: 'sha256:fixture-readiness-review',
          },
        },
      ],
    });

    const referenceRowBlocker = result.evidenceLineage.items.find((item) =>
      item.resourceId === 'path-resource:incomplete-reference-row'
    );
    expect(referenceRowBlocker).toMatchObject({
      resourceId: 'path-resource:incomplete-reference-row',
      evidenceEffectState: 'blocked',
      blocksYangFanFixture: false,
      yangFanFixtureScope: 'global-resource-backlog',
      missingFieldCodes: expect.arrayContaining(['missing-evidence-instrumentation']),
    });
    expect(result.evidenceLineage.summary.layerTotals).toMatchObject({
      pathRelevantRows: 1,
      readyRows: 0,
    });
  });

  it('normalizes typed fixture-owned stable refs for governed owner rows', () => {
    const result = buildResourceFieldCompletionAudit({
      registry: buildResourceNodeRegistry({}),
      generatedAt: '2026-07-05T00:00:00.000Z',
      candidates: [
        {
          id: 'LearningPathExecution:yangfan-diagnostic-fixture:exec-terminal',
          title: 'Yang Fan fixture exec terminal',
          family: 'external-resource',
          sourcePathOrUrl: '/fixture/yangfan-diagnostic-fixture-exec-terminal',
          sourceRecord: 'LearningPathExecution:yangfan-diagnostic-fixture:exec-terminal',
          knowledgeNodeIds: ['性能指标_1_1'],
          capabilityTargetIds: ['controlModeling'],
          segmentRefs: ['yangfan-diagnostic-fixture:exec-terminal'],
          citationTargets: ['LearningPathExecution:yangfan-diagnostic-fixture:exec-terminal'],
          pathTarget: 'LearningPathExecution:yangfan-diagnostic-fixture:exec-terminal',
          estimatedTimeMinutes: 5,
          privacyScope: 'student-visible',
          contentHash: 'sha256:yangfan-diagnostic-fixture-exec-terminal',
          versionRef: 'yangfan-diagnostic-fixture.v1',
          evidenceInstrumentation: ['path-execution'],
          humanConfirmed: true,
          currentPathEligible: true,
          reviewEvidence: {
            reviewerId: 'fixture-readiness-reviewer',
            reviewerRole: 'data-governance',
            reviewedAt: '2026-07-05T00:00:00.000Z',
            reviewBatchId: 'fixture-readiness-review-batch',
            reviewerVisibleRationale: 'Exec complete owner row has reviewed fixture governance.',
            independentEvidenceRef: 'review-packet:yangfan-diagnostic-fixture-exec-terminal',
            reviewedSourceHash: 'sha256:yangfan-diagnostic-fixture-exec-terminal',
            promptOrManifestHash: 'sha256:fixture-readiness-review',
          },
        },
      ],
    });

    expect(result.evidenceLineage.items.some((item) =>
      item.resourceId === 'yangfan-diagnostic-fixture:exec-terminal'
    )).toBe(false);
  });

  it('deduplicates typed fixture blockers with normalized scoped ids', () => {
    const result = buildResourceFieldCompletionAudit({
      registry: buildResourceNodeRegistry({}),
      generatedAt: '2026-07-05T00:00:00.000Z',
      candidates: [
        {
          id: 'LearningPathExecution:yangfan-diagnostic-fixture:exec-terminal',
          title: 'Yang Fan fixture exec terminal',
          family: 'external-resource',
          sourcePathOrUrl: '/fixture/yangfan-diagnostic-fixture-exec-terminal',
          sourceRecord: 'LearningPathExecution:yangfan-diagnostic-fixture:exec-terminal',
          knowledgeNodeIds: ['性能指标_1_1'],
          capabilityTargetIds: ['controlModeling'],
          segmentRefs: ['yangfan-diagnostic-fixture:exec-terminal'],
          citationTargets: ['LearningPathExecution:yangfan-diagnostic-fixture:exec-terminal'],
          pathTarget: 'LearningPathExecution:yangfan-diagnostic-fixture:exec-terminal',
          estimatedTimeMinutes: 5,
          privacyScope: 'student-visible',
          contentHash: 'sha256:yangfan-diagnostic-fixture-exec-terminal',
          versionRef: 'yangfan-diagnostic-fixture.v1',
          currentPathEligible: true,
        },
      ],
    });

    const execTerminalBlockers = result.evidenceLineage.items.filter((item) =>
      item.resourceId === 'LearningPathExecution:yangfan-diagnostic-fixture:exec-terminal' ||
      item.resourceId === 'yangfan-diagnostic-fixture:exec-terminal'
    );

    expect(execTerminalBlockers).toHaveLength(1);
    expect(execTerminalBlockers[0]).toMatchObject({
      resourceId: 'LearningPathExecution:yangfan-diagnostic-fixture:exec-terminal',
      evidenceEffectState: 'blocked',
      blocksYangFanFixture: true,
      yangFanFixtureScope: 'fixture-owned',
    });
  });

  it('deduplicates fixture blockers by owner row refs', () => {
    const result = buildResourceFieldCompletionAudit({
      registry: buildResourceNodeRegistry({}),
      generatedAt: '2026-07-05T00:00:00.000Z',
      candidates: [
        {
          id: 'path-resource:fixture-exec-terminal-owner',
          title: 'Yang Fan fixture exec terminal owner',
          family: 'external-resource',
          sourcePathOrUrl: '/fixture/yangfan-diagnostic-fixture-exec-terminal',
          sourceRecord: 'path-resource:fixture-exec-terminal-owner-source',
          knowledgeNodeIds: ['性能指标_1_1'],
          capabilityTargetIds: ['controlModeling'],
          segmentRefs: ['yangfan-diagnostic-fixture:exec-terminal'],
          citationTargets: ['LearningPathExecution:yangfan-diagnostic-fixture:exec-terminal'],
          pathTarget: 'LearningPathExecution:yangfan-diagnostic-fixture:exec-terminal',
          estimatedTimeMinutes: 5,
          privacyScope: 'student-visible',
          contentHash: 'sha256:fixture-exec-terminal-owner',
          versionRef: 'yangfan-diagnostic-fixture.v1',
          currentPathEligible: true,
        },
      ],
    });

    const execTerminalBlockers = result.evidenceLineage.items.filter((item) =>
      item.resourceId === 'path-resource:fixture-exec-terminal-owner' ||
      item.resourceId === 'yangfan-diagnostic-fixture:exec-terminal'
    );

    expect(execTerminalBlockers).toHaveLength(1);
    expect(execTerminalBlockers[0]).toMatchObject({
      resourceId: 'path-resource:fixture-exec-terminal-owner',
      evidenceEffectState: 'blocked',
      blocksYangFanFixture: true,
      yangFanFixtureScope: 'fixture-owned',
    });
  });

  it('declares knowledge-card lineage as path execution evidence without LearningFact materialization', () => {
    const result = buildResourceFieldCompletionAudit({
      registry: buildResourceNodeRegistry({}),
      generatedAt: '2026-07-05T00:00:00.000Z',
      candidates: [{
        id: 'knowledge-card:feedback-loop',
        title: 'Feedback loop card',
        family: 'knowledge-card',
        sourcePathOrUrl: 'course-content/runtime/knowledge/cards/nodes/feedback-loop.md',
        sourceRecord: 'feedback-loop',
        knowledgeNodeIds: ['feedback-loop'],
        capabilityTargetIds: [],
        segmentRefs: ['feedback-loop'],
        citationTargets: ['course-content/runtime/knowledge/cards/nodes/feedback-loop.md'],
        pathTarget: '/knowledge?node=feedback-loop',
        estimatedTimeMinutes: 4,
        evidenceInstrumentation: ['knowledge_card_open'],
        privacyScope: 'student-visible',
        contentHash: 'sha256:feedback-loop',
        versionRef: 'runtime-knowledge-card.v1',
        generatedBy: 'template',
        humanConfirmed: true,
        currentPathEligible: true,
        reviewEvidence: {
          reviewerId: 'knowledge-card-reviewer',
          reviewerRole: 'curriculum-data-governance',
          reviewedAt: '2026-07-05T00:00:00.000Z',
          reviewBatchId: 'knowledge-card-review-batch',
          reviewerVisibleRationale: 'Knowledge card is a path execution evidence source, not a mastery LearningFact source.',
          independentEvidenceRef: 'review-packet:knowledge-card-feedback-loop',
          reviewedSourceHash: 'sha256:feedback-loop',
          promptOrManifestHash: 'sha256:knowledge-card-review',
        },
      }],
    });

    expect(result.rows[0]).toMatchObject({
      evidenceContract: {
        complete: true,
        learningFactPolicy: false,
        learningFactMaterializationPolicy: 'path-execution-evidence-only',
        missingFields: [],
      },
    });
    expect(result.rows[0].missingFieldCodes).not.toContain('missing-evidence-contract');
    expect(result.rows[0].missingFieldCodes).not.toContain('missing-evidence-instrumentation');
    expect(result.evidenceLineage.items
      .filter((item) => item.yangFanFixtureScope === 'global-resource-backlog'))
      .toHaveLength(0);
    expect(result.evidenceLineage.items
      .filter((item) => item.yangFanFixtureScope === 'fixture-owned'))
      .toHaveLength(YANGFAN_FIXTURE_OWNED_RESOURCE_IDS.length);
  });

  it('materializes LearningGoal baseline artifacts for every registered backend goal', () => {
    const matrix = JSON.parse(readFileSync(
      join(process.cwd(), 'course-content/runtime/resource-governance/learning-goal-resource-baseline-matrix.json'),
      'utf8',
    ));
    const limitations = JSON.parse(readFileSync(
      join(process.cwd(), 'course-content/runtime/resource-governance/learning-goal-resource-baseline-limitations.json'),
      'utf8',
    ));
    const reviewedBindings = readFileSync(
      join(process.cwd(), 'course-content/runtime/resource-governance/learning-goal-resource-baseline-reviewed-bindings.jsonl'),
      'utf8',
    )
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line));
    const reviewedBindingIds = new Set(reviewedBindings.map((row) => row.bindingId));
    const auditRows = readFileSync(
      join(process.cwd(), 'course-content/runtime/resource-governance/resource-field-completion-audit.jsonl'),
      'utf8',
    )
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));
    const auditRowById = new Map(auditRows.map((row) => [row.resourceId, row]));
    const expectedLearningGoalIds = Object.values(ADAPTIVE_LEARNING_GOAL_DEFINITIONS)
      .map((definition) => definition.learningGoal!.id);

    expect(matrix.artifactVersion).toBe(LEARNING_GOAL_RESOURCE_BASELINE_VERSION);
    expect(matrix.registeredLearningGoalIds).toEqual(expectedLearningGoalIds);
    expect(matrix.batchLearningGoalIds).toEqual(expectedLearningGoalIds);
    expect(matrix.rows.map((row) => row.learningGoalId)).toEqual(expectedLearningGoalIds);
    expect(matrix.rows).toHaveLength(expectedLearningGoalIds.length);
    expect(matrix.totals.reviewedBindings).toBe(reviewedBindings.length);
    expect(matrix.totals.limited).toBe(expectedLearningGoalIds.length);
    expect(reviewedBindings).not.toEqual([]);
    expect(new Set(reviewedBindings.map((binding) => binding.learningGoalId))).toEqual(new Set([
      'control-correction',
      'feedback-loop-concept-foundations',
      'frequency-response-foundations',
      'root-locus-analysis-foundations',
      'ship-ocean-transfer-application',
      'simulation-validation-practice',
      'stability-margin-frequency-analysis',
      'transfer-function-modeling-foundations',
      'time-domain-response-analysis',
    ]));
    expect(auditRowById.get('runtime-step:1-1:step-09')).toMatchObject({
      reviewStatus: 'human-confirmed',
      pathEligibility: {
        current: true,
        masteryAffecting: true,
        blockedBy: [],
      },
    });
    for (const goalId of [
      'feedback-loop-concept-foundations',
      'transfer-function-modeling-foundations',
      'time-domain-response-analysis',
    ]) {
      const row = matrix.rows.find((item) => item.learningGoalId === goalId);
      expect(row.categories.concept.pathEligible).toBeGreaterThan(0);
      expect(row.categories.citation.pathEligible).toBeGreaterThan(0);
      expect(row.categories.diagnostic.pathEligible).toBe(0);
      expect(row.categories.practice.pathEligible).toBe(0);
      expect(row.categories.checkpoint.pathEligible).toBe(0);
      expect(row.categories.remediation.pathEligible).toBe(0);
      expect(row.missingBaselineCategories).toEqual([
        'diagnostic',
        'practice',
        'checkpoint',
        'remediation',
      ]);
    }
    for (const goalId of [
      'root-locus-analysis-foundations',
      'frequency-response-foundations',
      'stability-margin-frequency-analysis',
    ]) {
      const row = matrix.rows.find((item) => item.learningGoalId === goalId);
      expect(row.categories.concept.pathEligible).toBeGreaterThanOrEqual(2);
      expect(row.categories.citation.pathEligible).toBeGreaterThanOrEqual(2);
      expect(row.categories.diagnostic.pathEligible).toBe(0);
      expect(row.categories.practice.pathEligible).toBe(0);
      expect(row.categories.checkpoint.pathEligible).toBe(0);
      expect(row.categories.remediation.pathEligible).toBe(0);
      expect(row.missingBaselineCategories).toEqual([
        'diagnostic',
        'practice',
        'checkpoint',
        'remediation',
      ]);
    }
    const simulationValidationRow = matrix.rows.find((item) =>
      item.learningGoalId === 'simulation-validation-practice'
    );
    expect(simulationValidationRow.categories.concept.pathEligible).toBe(8);
    expect(simulationValidationRow.categories.concept.pathEligibleResourceIds.every((id) =>
      id.startsWith('runtime-step:4-7:')
    )).toBe(true);
    expect(simulationValidationRow.categories.citation.pathEligible).toBe(8);
    expect(simulationValidationRow.categories.citation.pathEligibleResourceIds.every((id) =>
      id.startsWith('runtime-step:4-7:')
    )).toBe(true);
    expect(simulationValidationRow.categories.practice.pathEligible).toBe(0);
    expect(simulationValidationRow.categories.practice.highComplexityLocked).toBeGreaterThan(0);
    expect(simulationValidationRow.categories['terminal-validation'].pathEligible).toBe(0);
    expect(simulationValidationRow.categories['terminal-validation'].highComplexityLocked).toBeGreaterThan(0);
    expect(simulationValidationRow.missingBaselineCategories).toEqual([
      'diagnostic',
      'practice',
      'checkpoint',
      'remediation',
      'terminal-validation',
    ]);
    const shipOceanTransferRow = matrix.rows.find((item) =>
      item.learningGoalId === 'ship-ocean-transfer-application'
    );
    expect(shipOceanTransferRow.categories.concept.pathEligible).toBe(6);
    expect(shipOceanTransferRow.categories.concept.pathEligibleResourceIds.every((id) =>
      id.startsWith('runtime-step:5-3:')
    )).toBe(true);
    expect(shipOceanTransferRow.categories.citation.pathEligible).toBe(6);
    expect(shipOceanTransferRow.categories.citation.pathEligibleResourceIds.every((id) =>
      id.startsWith('runtime-step:5-3:')
    )).toBe(true);
    expect(shipOceanTransferRow.categories.practice.pathEligible).toBe(0);
    expect(shipOceanTransferRow.categories.practice.highComplexityLocked).toBeGreaterThan(0);
    expect(shipOceanTransferRow.categories['terminal-validation'].pathEligible).toBe(0);
    expect(shipOceanTransferRow.categories['terminal-validation'].highComplexityLocked).toBeGreaterThan(0);
    expect(shipOceanTransferRow.missingBaselineCategories).toEqual([
      'diagnostic',
      'practice',
      'checkpoint',
      'remediation',
      'terminal-validation',
    ]);
    for (const row of matrix.rows) {
      expect(row.requiredCategories).toEqual(expect.arrayContaining([
        'concept',
        'diagnostic',
        'practice',
        'checkpoint',
        'remediation',
      ]));
      expect(row.denominator).toMatchObject({
        requiredCategoryCount: row.requiredCategories.length,
        artifactVersion: LEARNING_GOAL_RESOURCE_BASELINE_VERSION,
      });
      expect(row.selectedReviewedBindingIds.every((bindingId) => reviewedBindingIds.has(bindingId))).toBe(true);
      for (const category of Object.values(row.categories)) {
        expect(category.pathEligible).toBeLessThanOrEqual(category.humanConfirmed);
        expect(category.pathEligibleResourceIds.filter((id) => category.provisionalResourceIds.includes(id))).toEqual([]);
      }
    }
    for (const binding of reviewedBindings) {
      const auditRow = auditRowById.get(binding.resourceId);
      expect(auditRow).toMatchObject({
        reviewStatus: 'human-confirmed',
        sourceHash: expect.any(String),
        sourceVersionRef: expect.any(String),
      });
      expect(auditRow.pathEligibility.blockedBy).toEqual([]);
      expect(binding).toMatchObject({
        humanConfirmed: true,
        pathEligible: true,
        evidenceContractComplete: true,
      });
      expect(binding.reviewAudit).toMatchObject({
        reviewerId: 'openspec-buddy:learning-goal-resource-baseline-completion',
        reviewerRole: 'curriculum-governance',
        reviewBatchId: LEARNING_GOAL_RESOURCE_BASELINE_VERSION,
      });
    }
    expect(limitations.artifactVersion).toBe(LEARNING_GOAL_RESOURCE_BASELINE_VERSION);
    expect(limitations.totals.learningGoals).toBe(expectedLearningGoalIds.length);
    expect(limitations.totals.limited).toBe(expectedLearningGoalIds.length);
    expect(limitations.limitations.every((item) => item.severity === 'blocking')).toBe(true);
    expect(limitations.limitations.every((item) => item.studentSafeReason && !item.studentSafeReason.includes('internal'))).toBe(true);
  });

  it('keeps LearningGoal diagnostics tied to the dynamic registry instead of a fixed batch list', () => {
    const frequencyDefinition = ADAPTIVE_LEARNING_GOAL_DEFINITIONS['frequency-response-foundations'];
    const syntheticDefinition = {
      ...frequencyDefinition,
      goal: {
        ...frequencyDefinition.goal,
        id: 'frequency-response-diagnostic-extension',
      },
      displayName: 'Frequency response diagnostic extension',
      learningGoal: {
        ...frequencyDefinition.learningGoal!,
        id: 'frequency-response-diagnostic-extension',
        title: 'Frequency response diagnostic extension',
      },
    };
    const result = buildLearningGoalResourceBaselineArtifacts({
      registeredGoals: {
        'frequency-response-foundations': frequencyDefinition,
        'frequency-response-diagnostic-extension': syntheticDefinition,
      },
      generatedAt: '2026-06-24T00:00:00.000Z',
      auditRows: [],
    });

    expect(result.matrix.registeredLearningGoalIds).toEqual([
      'frequency-response-foundations',
      'frequency-response-diagnostic-extension',
    ]);
    expect(result.matrix.rows.map((row) => row.learningGoalId)).toEqual([
      'frequency-response-foundations',
      'frequency-response-diagnostic-extension',
    ]);
    expect(result.limitations.totals.learningGoals).toBe(2);
  });

  it('fails the full resource gate when diagnostics, diversity, citations, or future import coverage are missing', () => {
    expect(isPathBlockingFallbackReason('time-budget-insufficient')).toBe(true);
    expect(isPathBlockingFallbackReason('hard-prerequisite-missing')).toBe(true);

    const report = buildFullResourcePathReadinessGate({
      generatedAt: '2026-06-24T00:00:00.000Z',
      resourceSummary: {
        generatedAt: '2026-06-24T00:00:00.000Z',
        totals: { denominator: 1 },
        byFamily: { 'runtime-lesson-step': { denominator: 1 } },
        byReviewStatus: { 'human-confirmed': 1 },
      } as never,
      auditRows: [],
      workqueueItems: [],
      dispositionReviewSummary: {
        totals: {
          reviewedResources: 1,
          unresolvedDispositionBlockers: 0,
        },
        downstreamBlockers: {
          'path-readiness': 2,
          'runtime-identity': 1,
        },
      },
      evidenceLineageSummary: {
        evidenceLineageBlockerCount: 0,
        yangFanFixtureBlockers: {
          blocked: false,
          blockerCount: 0,
          scopedBlockerCount: 0,
          globalLimitationCount: 0,
          blockerFamilies: {},
          reason: 'none',
          scopePolicy: 'yangfan-fixture-readiness-scope.v1',
        },
      } as never,
      learningGoalBaselineMatrix: {
        registeredLearningGoalIds: ['goal-a', 'goal-b'],
        batchLearningGoalIds: ['goal-a', 'goal-b'],
        rows: [{
          learningGoalId: 'goal-a',
          coverageState: 'complete',
          selectedReviewedBindingIds: ['goal-a:concept:resource-a'],
          missingBaselineCategories: [],
          limitationReason: null,
          denominator: {
            reviewedBindingCount: 1,
          },
        }],
      } as never,
      reviewedBindings: [{
        bindingId: 'goal-a:concept:resource-a',
        learningGoalId: 'goal-a',
        resourceId: 'resource-a',
        resourceType: 'lesson_step',
        sourcePathOrUrl: '/lesson/step',
        sourceHash: 'sha256:resource-a',
        sourceVersionRef: null,
      } as never],
      pathGenerationDiagnostics: [{
        learningGoalId: 'goal-a',
        attempted: true,
        generationStatus: 'ready',
        fallbackReasons: [],
        blockingReasons: [],
        selectedResourceIds: ['resource-a'],
        selectedResourceTypes: ['lesson_step'],
        resourceCount: 1,
        resourceTypeCount: 1,
        unreviewedSelectedResourceIds: [],
        missingCitationMetadataResourceIds: ['resource-a'],
      }, {
        learningGoalId: 'goal-a',
        attempted: true,
        generationStatus: 'ready',
        fallbackReasons: [],
        blockingReasons: [],
        selectedResourceIds: [],
        selectedResourceTypes: [],
        resourceCount: 0,
        resourceTypeCount: 0,
        unreviewedSelectedResourceIds: [],
        missingCitationMetadataResourceIds: [],
      }, {
        learningGoalId: 'goal-x',
        attempted: true,
        generationStatus: 'ready',
        fallbackReasons: [],
        blockingReasons: [],
        selectedResourceIds: [],
        selectedResourceTypes: [],
        resourceCount: 0,
        resourceTypeCount: 0,
        unreviewedSelectedResourceIds: [],
        missingCitationMetadataResourceIds: [],
      }],
    });

    expect(report.status).toBe('failed');
    expect(report.resourceCoverage.unresolvedDownstreamPathBlockers).toBe(3);
    expect(report.learningGoalDiagnostics.missingDiagnosticLearningGoalIds).toEqual(['goal-b']);
    expect(report.learningGoalDiagnostics.missingPathGenerationDiagnosticLearningGoalIds).toEqual(['goal-b']);
    expect(report.learningGoalDiagnostics.unknownPathGenerationDiagnosticLearningGoalIds).toEqual(['goal-x']);
    expect(report.learningGoalDiagnostics.duplicatePathGenerationDiagnosticCount).toBe(1);
    expect(report.findings.map((finding) => finding.id)).toEqual(expect.arrayContaining([
      'unresolved-downstream-path-blockers',
      'learning-goal-diagnostics-missing',
      'learning-goal-path-generation-diagnostics-invalid',
      'learning-goal-path-generation-not-evaluated',
      'single-resource-fallback-risk',
      'single-family-fallback-risk',
      'learning-goal-citation-failures',
      'resource-family-audit-missing',
    ]));
  });

  it('keeps provisional baseline rows out of path-eligible LearningGoal coverage', () => {
    const result = buildLearningGoalResourceBaselineArtifacts({
      registeredGoals: ADAPTIVE_LEARNING_GOAL_DEFINITIONS,
      generatedAt: '2026-06-24T00:00:00.000Z',
      auditRows: [{
        ...baselineAuditRow('knowledge-card:reviewed-frequency', 'knowledge_card'),
        reviewStatus: 'human-confirmed',
        missingFieldCodes: [],
        graphNodeRefs: {
          knowledge: ['Bode图_1_1'],
          capability: [],
          quality: [],
        },
        reviewAudit: {
          ...baselineAuditRow('knowledge-card:reviewed-frequency', 'knowledge_card').reviewAudit,
          reviewerId: 'curriculum-reviewer',
          reviewerRole: 'teacher',
          reviewedAt: '2026-06-24T00:00:00.000Z',
          reviewBatchId: 'test-baseline',
          reviewedSourceHash: 'sha256:knowledge-card:reviewed-frequency',
          reviewedVersionRef: 'resource-node-registry.v1',
        },
      }, {
        ...baselineAuditRow('knowledge-card:provisional-frequency', 'knowledge_card'),
        reviewStatus: 'generated-provisional',
        missingFieldCodes: ['provisional-metadata', 'missing-human-review'],
        graphNodeRefs: {
          knowledge: ['Bode图_1_1'],
          capability: [],
          quality: [],
        },
      }],
    });
    const row = result.matrix.rows.find((item) => item.learningGoalId === 'frequency-response-foundations')!;

    expect(row.categories.concept.linked).toBe(2);
    expect(row.categories.concept.humanConfirmed).toBe(1);
    expect(row.categories.concept.pathEligible).toBe(1);
    expect(row.categories.concept.pathEligibleResourceIds).toEqual(['knowledge-card:reviewed-frequency']);
    expect(row.categories.concept.provisionalResourceIds).toEqual(['knowledge-card:provisional-frequency']);
    expect(row.selectedReviewedBindingIds).toContain(
      'frequency-response-foundations:concept:knowledge-card:reviewed-frequency',
    );
    expect(row.selectedReviewedBindingIds.some((bindingId) => bindingId.includes('provisional-frequency'))).toBe(false);
  });

  it('does not promote not-reviewed baseline rows even when they are path eligible', () => {
    const result = buildLearningGoalResourceBaselineArtifacts({
      registeredGoals: ADAPTIVE_LEARNING_GOAL_DEFINITIONS,
      generatedAt: '2026-06-24T00:00:00.000Z',
      auditRows: [{
        ...baselineAuditRow('knowledge-card:not-reviewed-frequency', 'knowledge_card'),
        reviewStatus: 'not-reviewed',
        missingFieldCodes: ['missing-human-review'],
        pathEligibility: {
          current: true,
          afterCompletion: true,
          masteryAffecting: true,
          blockedBy: ['missing-human-review'],
        },
        graphNodeRefs: {
          knowledge: ['Bode图_1_1'],
          capability: [],
          quality: [],
        },
      }],
    });
    const row = result.matrix.rows.find((item) => item.learningGoalId === 'frequency-response-foundations')!;

    expect(row.categories.concept.linked).toBe(1);
    expect(row.categories.concept.humanConfirmed).toBe(0);
    expect(row.categories.concept.pathEligible).toBe(0);
    expect(row.selectedReviewedBindingIds).toEqual([]);
    expect(result.reviewedBindings).toEqual([]);
  });

  it('matches audit family resource types against canonical LearningGoal resource mix', () => {
    const result = buildLearningGoalResourceBaselineArtifacts({
      registeredGoals: ADAPTIVE_LEARNING_GOAL_DEFINITIONS,
      generatedAt: '2026-06-24T00:00:00.000Z',
      auditRows: [{
        ...baselineAuditRow('knowledge-card:frequency-family-type', 'knowledge-card'),
        family: 'knowledge-card',
        reviewStatus: 'human-confirmed',
        graphNodeRefs: {
          knowledge: ['kn:autocontrol:frequency-response'],
          capability: [],
          quality: [],
        },
        reviewAudit: {
          ...baselineAuditRow('knowledge-card:frequency-family-type', 'knowledge-card').reviewAudit,
          reviewerId: 'curriculum-reviewer',
          reviewerRole: 'teacher',
          reviewedAt: '2026-06-24T00:00:00.000Z',
          reviewBatchId: 'test-baseline',
          reviewedSourceHash: 'sha256:knowledge-card:frequency-family-type',
          reviewedVersionRef: 'resource-node-registry.v1',
        },
      }],
    });
    const row = result.matrix.rows.find((item) => item.learningGoalId === 'frequency-response-foundations')!;

    expect(row.categories.concept.linked).toBe(1);
    expect(row.categories.concept.humanConfirmed).toBe(1);
    expect(row.categories.concept.pathEligible).toBe(1);
    expect(row.selectedReviewedBindingIds).toContain(
      'frequency-response-foundations:concept:knowledge-card:frequency-family-type',
    );
  });

  it('uses full audit rows instead of truncated reviewed bindings for planner-selected resources', () => {
    const frequencyDefinition = ADAPTIVE_LEARNING_GOAL_DEFINITIONS['frequency-response-foundations'];
    const auditRow: ResourceFieldCompletionAuditRow = {
      ...baselineAuditRow('knowledge-card:planner-selected-frequency', 'knowledge_card'),
      reviewStatus: 'human-confirmed',
      graphNodeRefs: {
        knowledge: ['kn:autocontrol:frequency-response'],
        capability: [],
        quality: [],
      },
      reviewAudit: {
        ...baselineAuditRow('knowledge-card:planner-selected-frequency', 'knowledge_card').reviewAudit,
        reviewerId: 'curriculum-reviewer',
        reviewerRole: 'teacher',
        reviewedAt: '2026-06-24T00:00:00.000Z',
        reviewBatchId: 'test-baseline',
        reviewedSourceHash: 'sha256:knowledge-card:planner-selected-frequency',
        reviewedVersionRef: 'resource-node-registry.v1',
      },
    };
    const diagnostics = buildLearningGoalPathGenerationDiagnostics({
      registeredGoals: {
        'frequency-response-foundations': frequencyDefinition,
      },
      registry: buildResourceNodeRegistry({
        knowledgeCards: [{
          id: 'planner-selected-frequency',
          title: 'Planner selected frequency card',
          sourceRef: 'kn:autocontrol:frequency-response',
          renderTarget: '/resources/knowledge-card:planner-selected-frequency',
          knowledgeNodeIds: ['kn:autocontrol:frequency-response'],
          planningOverride: { estimatedTimeMinutes: 5 },
        }],
      }),
      learningGoalBaselineMatrix: {
        registeredLearningGoalIds: ['frequency-response-foundations'],
        batchLearningGoalIds: ['frequency-response-foundations'],
        rows: [{
          learningGoalId: 'frequency-response-foundations',
          coverageState: 'complete',
          selectedReviewedBindingIds: [],
          missingBaselineCategories: [],
          limitationReason: null,
          denominator: {
            reviewedBindingCount: 1,
          },
        }],
      } as never,
      auditRows: [auditRow],
      reviewedBindings: [],
      now: new Date('2026-06-24T00:00:00.000Z'),
    });
    const diagnostic = diagnostics[0];

    expect(diagnostic.selectedResourceIds).toContain('knowledge-card:planner-selected-frequency');
    expect(diagnostic.unreviewedSelectedResourceIds).toEqual([]);
    expect(diagnostic.missingCitationMetadataResourceIds).toEqual([]);
  });

  it('counts human-confirmed baseline rows separately from path-eligible rows', () => {
    const result = buildLearningGoalResourceBaselineArtifacts({
      registeredGoals: ADAPTIVE_LEARNING_GOAL_DEFINITIONS,
      generatedAt: '2026-06-24T00:00:00.000Z',
      auditRows: [{
        ...baselineAuditRow('knowledge-card:confirmed-missing-path-fields', 'knowledge_card'),
        reviewStatus: 'human-confirmed',
        sourceHash: null,
        missingFieldCodes: ['missing-content-hash'],
        pathEligibility: {
          current: false,
          afterCompletion: true,
          masteryAffecting: true,
          blockedBy: ['missing-content-hash'],
        },
        graphNodeRefs: {
          knowledge: ['kn:autocontrol:frequency-response'],
          capability: [],
          quality: [],
        },
        reviewAudit: {
          ...baselineAuditRow('knowledge-card:confirmed-missing-path-fields', 'knowledge_card').reviewAudit,
          reviewerId: 'curriculum-reviewer',
          reviewerRole: 'teacher',
          reviewedAt: '2026-06-24T00:00:00.000Z',
          reviewBatchId: 'test-baseline',
          reviewedSourceHash: null,
          reviewedVersionRef: 'resource-node-registry.v1',
        },
      }],
    });
    const row = result.matrix.rows.find((item) => item.learningGoalId === 'frequency-response-foundations')!;

    expect(row.categories.concept.linked).toBe(1);
    expect(row.categories.concept.humanConfirmed).toBe(1);
    expect(row.categories.concept.pathEligible).toBe(0);
    expect(row.selectedReviewedBindingIds).toEqual([]);
    expect(result.reviewedBindings).toEqual([]);
  });

  it('counts authoring textbook sections as canonical textbook resources without path promotion', () => {
    const result = buildLearningGoalResourceBaselineArtifacts({
      registeredGoals: ADAPTIVE_LEARNING_GOAL_DEFINITIONS,
      generatedAt: '2026-06-24T00:00:00.000Z',
      auditRows: [{
        ...baselineAuditRow('authoring-textbook-section:confirmed-pending-governance', 'authoring-textbook-section'),
        family: 'authoring-textbook-section',
        reviewStatus: 'human-confirmed',
        sourceHash: null,
        missingFieldCodes: ['missing-content-hash'],
        pathEligibility: {
          current: false,
          afterCompletion: true,
          masteryAffecting: true,
          blockedBy: ['missing-content-hash'],
        },
        graphNodeRefs: {
          knowledge: ['kn:autocontrol:frequency-response'],
          capability: [],
          quality: [],
        },
        reviewAudit: {
          ...baselineAuditRow(
            'authoring-textbook-section:confirmed-pending-governance',
            'authoring-textbook-section',
          ).reviewAudit,
          reviewerId: 'curriculum-reviewer',
          reviewerRole: 'teacher',
          reviewedAt: '2026-06-24T00:00:00.000Z',
          reviewBatchId: 'test-baseline',
          reviewedSourceHash: null,
          reviewedVersionRef: 'resource-node-registry.v1',
        },
      }],
    });
    const row = result.matrix.rows.find((item) => item.learningGoalId === 'frequency-response-foundations')!;

    expect(row.categories.concept.linked).toBe(1);
    expect(row.categories.concept.humanConfirmed).toBe(1);
    expect(row.categories.concept.pathEligible).toBe(0);
    expect(row.selectedReviewedBindingIds).toEqual([]);
    expect(result.reviewedBindings).toEqual([]);
  });

  it('keeps a LearningGoal limited until concept coverage has two reviewed bindings', () => {
    const reviewedRow = (
      resourceId: string,
      resourceType: string,
    ): ResourceFieldCompletionAuditRow => ({
      ...baselineAuditRow(resourceId, resourceType),
      reviewStatus: 'human-confirmed',
      graphNodeRefs: {
        knowledge: ['kn:autocontrol:frequency-response'],
        capability: [],
        quality: [],
      },
      reviewAudit: {
        ...baselineAuditRow(resourceId, resourceType).reviewAudit,
        reviewerId: 'curriculum-reviewer',
        reviewerRole: 'teacher',
        reviewedAt: '2026-06-24T00:00:00.000Z',
        reviewBatchId: 'test-baseline',
        reviewedSourceHash: `sha256:${resourceId}`,
        reviewedVersionRef: 'resource-node-registry.v1',
      },
    });
    const result = buildLearningGoalResourceBaselineArtifacts({
      registeredGoals: ADAPTIVE_LEARNING_GOAL_DEFINITIONS,
      generatedAt: '2026-06-24T00:00:00.000Z',
      auditRows: [
        reviewedRow('knowledge-card:frequency-concept-one', 'knowledge_card'),
        reviewedRow('quiz:frequency-diagnostic', 'quiz'),
        reviewedRow('simulation:frequency-practice', 'simulation'),
        reviewedRow('checkpoint:frequency-checkpoint', 'checkpoint'),
        reviewedRow('konling:frequency-remediation', 'konling'),
      ],
    });
    const row = result.matrix.rows.find((item) => item.learningGoalId === 'frequency-response-foundations')!;

    expect(row.categories.concept.pathEligible).toBe(1);
    expect(row.categories.diagnostic.pathEligible).toBe(1);
    expect(row.categories.practice.pathEligible).toBe(2);
    expect(row.categories.checkpoint.pathEligible).toBe(1);
    expect(row.categories.remediation.pathEligible).toBe(1);
    expect(row.missingBaselineCategories).toEqual(['concept']);
    expect(row.coverageState).toBe('limited');
    expect(result.limitations.limitations).toEqual(expect.arrayContaining([
      expect.objectContaining({
        learningGoalId: 'frequency-response-foundations',
        missingBaselineCategories: ['concept'],
      }),
    ]));
  });

  it('reports only locked high-complexity resource ids in limitations', () => {
    const frequencyGoal = ADAPTIVE_LEARNING_GOAL_DEFINITIONS['frequency-response-foundations'];
    const result = buildLearningGoalResourceBaselineArtifacts({
      registeredGoals: {
        ...ADAPTIVE_LEARNING_GOAL_DEFINITIONS,
        'frequency-response-foundations': {
          ...frequencyGoal,
          allowedResourceMix: [...frequencyGoal.allowedResourceMix, 'project'],
        },
      },
      generatedAt: '2026-06-24T00:00:00.000Z',
      auditRows: [
        {
          ...baselineAuditRow('quiz:frequency-practice-ready', 'quiz'),
          reviewStatus: 'human-confirmed',
          graphNodeRefs: {
            knowledge: ['kn:autocontrol:frequency-response'],
            capability: [],
            quality: [],
          },
          reviewAudit: {
            ...baselineAuditRow('quiz:frequency-practice-ready', 'quiz').reviewAudit,
            reviewerId: 'curriculum-reviewer',
            reviewerRole: 'teacher',
            reviewedAt: '2026-06-24T00:00:00.000Z',
            reviewBatchId: 'test-baseline',
            reviewedSourceHash: 'sha256:quiz:frequency-practice-ready',
            reviewedVersionRef: 'resource-node-registry.v1',
          },
        },
        {
          ...baselineAuditRow('simulation:frequency-practice-locked', 'simulation'),
          reviewStatus: 'not-reviewed',
          graphNodeRefs: {
            knowledge: ['kn:autocontrol:frequency-response'],
            capability: [],
            quality: [],
          },
        },
        {
          ...baselineAuditRow('project:frequency-design-project-locked', 'project'),
          reviewStatus: 'not-reviewed',
          graphNodeRefs: {
            knowledge: ['kn:autocontrol:frequency-response'],
            capability: [],
            quality: [],
          },
        },
      ],
    });
    const row = result.matrix.rows.find((item) => item.learningGoalId === 'frequency-response-foundations')!;
    const limitation = result.limitations.limitations.find((item) =>
      item.learningGoalId === 'frequency-response-foundations'
    )!;

    expect(row.categories.practice.resourceIds).toEqual([
      'project:frequency-design-project-locked',
      'quiz:frequency-practice-ready',
      'simulation:frequency-practice-locked',
    ]);
    expect(row.categories.practice.highComplexityLocked).toBe(2);
    expect(row.categories.practice.highComplexityLockedResourceIds).toEqual([
      'project:frequency-design-project-locked',
      'simulation:frequency-practice-locked',
    ]);
    expect(limitation.blockedHighComplexityResourceIds).toEqual([
      'project:frequency-design-project-locked',
      'simulation:frequency-practice-locked',
    ]);
  });

  it('does not count checkpoint rows as terminal validation unless the LearningGoal policy accepts checkpoints', () => {
    const controlCorrectionWithoutCheckpointTerminal = {
      ...ADAPTIVE_LEARNING_GOAL_DEFINITIONS['control-correction'],
      learningGoal: {
        ...ADAPTIVE_LEARNING_GOAL_DEFINITIONS['control-correction'].learningGoal!,
        terminalValidationPolicy: {
          ...ADAPTIVE_LEARNING_GOAL_DEFINITIONS['control-correction'].learningGoal!.terminalValidationPolicy,
          terminalNodeTypes: ['simulation'],
        },
      },
    };
    const result = buildLearningGoalResourceBaselineArtifacts({
      registeredGoals: {
        ...ADAPTIVE_LEARNING_GOAL_DEFINITIONS,
        'control-correction': controlCorrectionWithoutCheckpointTerminal,
      },
      generatedAt: '2026-06-24T00:00:00.000Z',
      auditRows: [{
        ...baselineAuditRow('checkpoint:control-correction-review', 'checkpoint'),
        reviewStatus: 'human-confirmed',
        graphNodeRefs: {
          knowledge: ['kn:autocontrol:controller-correction'],
          capability: [],
          quality: [],
        },
        reviewAudit: {
          ...baselineAuditRow('checkpoint:control-correction-review', 'checkpoint').reviewAudit,
          reviewerId: 'curriculum-reviewer',
          reviewerRole: 'teacher',
          reviewedAt: '2026-06-24T00:00:00.000Z',
          reviewBatchId: 'test-baseline',
          reviewedSourceHash: 'sha256:checkpoint:control-correction-review',
          reviewedVersionRef: 'resource-node-registry.v1',
        },
      }],
    });
    const row = result.matrix.rows.find((item) => item.learningGoalId === 'control-correction')!;

    expect(row.categories.checkpoint.pathEligible).toBe(1);
    expect(row.categories['terminal-validation'].pathEligible).toBe(0);
    expect(row.selectedReviewedBindingIds).toContain(
      'control-correction:checkpoint:checkpoint:control-correction-review',
    );
    expect(row.selectedReviewedBindingIds.some((bindingId) => bindingId.includes(':terminal-validation:'))).toBe(false);
    expect(row.missingBaselineCategories).toEqual(expect.arrayContaining(['terminal-validation']));
  });

  it('counts reviewed quizzes as both diagnostic and practice baseline coverage', () => {
    const result = buildLearningGoalResourceBaselineArtifacts({
      registeredGoals: ADAPTIVE_LEARNING_GOAL_DEFINITIONS,
      generatedAt: '2026-06-24T00:00:00.000Z',
      auditRows: [{
        ...baselineAuditRow('quiz:frequency-response-practice', 'quiz'),
        reviewStatus: 'human-confirmed',
        graphNodeRefs: {
          knowledge: ['kn:autocontrol:frequency-response'],
          capability: [],
          quality: [],
        },
        reviewAudit: {
          ...baselineAuditRow('quiz:frequency-response-practice', 'quiz').reviewAudit,
          reviewerId: 'curriculum-reviewer',
          reviewerRole: 'teacher',
          reviewedAt: '2026-06-24T00:00:00.000Z',
          reviewBatchId: 'test-baseline',
          reviewedSourceHash: 'sha256:quiz:frequency-response-practice',
          reviewedVersionRef: 'resource-node-registry.v1',
        },
      }],
    });
    const row = result.matrix.rows.find((item) => item.learningGoalId === 'frequency-response-foundations')!;

    expect(row.categories.diagnostic.pathEligible).toBe(1);
    expect(row.categories.practice.pathEligible).toBe(1);
    expect(row.selectedReviewedBindingIds).toEqual(expect.arrayContaining([
      'frequency-response-foundations:diagnostic:quiz:frequency-response-practice',
      'frequency-response-foundations:practice:quiz:frequency-response-practice',
    ]));
  });

  it('surfaces missing field codes in graph resource coverage diagnostics', () => {
    const registry = buildResourceNodeRegistry({
      registeredResources: [{
        id: 'bode-field-gap',
        label: 'Bode field gap',
        type: 'INTERACTIVE_COMP',
        renderTarget: '/interactive-learning/resources/bode-field-gap',
        knowledgeNodeIds: ['kn:autocontrol:frequency-response'],
        planningOverride: {
          abilityImpact: {},
          evidenceInstrumentation: [],
        },
      }],
    });
    const payload = buildGraphCenterPayload({
      domain: 'knowledge',
      selectedNodeId: 'kn:autocontrol:frequency-response',
      resourceRegistry: registry,
      viewerRole: 'TEACHER',
    });

    expect(payload.resourceCoverage['kn:autocontrol:frequency-response'].fieldCompletion).toMatchObject({
      denominator: 1,
      missingField: 1,
      sourceWindow: { from: null, to: null },
      pathEligible: 0,
      missingFieldCodes: expect.arrayContaining([
        'missing-capability-target',
        'missing-evidence-contract',
        'missing-evidence-instrumentation',
      ]),
      artifactVersion: RESOURCE_FIELD_COMPLETION_AUDIT_VERSION,
    });

    const studentPayload = buildGraphCenterPayload({
      domain: 'knowledge',
      selectedNodeId: 'kn:autocontrol:frequency-response',
      resourceRegistry: registry,
      viewerRole: 'STUDENT',
    });

    expect(studentPayload.resourceCoverage['kn:autocontrol:frequency-response'].fieldCompletion).toBeUndefined();

    const guestPayload = buildGraphCenterPayload({
      domain: 'knowledge',
      selectedNodeId: 'kn:autocontrol:frequency-response',
      resourceRegistry: registry,
    });
    const nullRolePayload = buildGraphCenterPayload({
      domain: 'knowledge',
      selectedNodeId: 'kn:autocontrol:frequency-response',
      resourceRegistry: registry,
      viewerRole: null,
    });

    expect(guestPayload.resourceCoverage['kn:autocontrol:frequency-response'].fieldCompletion).toBeUndefined();
    expect(nullRolePayload.resourceCoverage['kn:autocontrol:frequency-response'].fieldCompletion).toBeUndefined();
  });

  it('merges audit-only candidates into teacher graph resource field diagnostics', () => {
    const registry = buildResourceNodeRegistry({ registeredResources: [] });
    const resourceFieldCompletionSummary = {
      graphCoverageDiagnostics: {
        'knowledge-card:Bode首轮骨架_5_1e07d9da|Bode首轮骨架_5_1e07d9da': coverageSummary({
          citationReady: 1,
          missingFieldCodes: ['missing-human-review', 'provisional-metadata'],
          sampleLimitations: ['knowledge-card:Bode首轮骨架_5_1e07d9da: metadata is provisional'],
        }),
        'infograph:Bode首轮骨架_5_1e07d9da|Bode首轮骨架_5_1e07d9da': coverageSummary({
          missingFieldCodes: ['missing-segment-ref', 'provisional-metadata'],
          sampleLimitations: ['infograph:Bode首轮骨架_5_1e07d9da: metadata is provisional'],
        }),
      },
    };
    const payload = buildGraphCenterPayload({
      domain: 'knowledge',
      selectedNodeId: 'kn:autocontrol:frequency-response',
      resourceRegistry: registry,
      viewerRole: 'TEACHER',
      resourceFieldCompletionSummary,
    });

    expect(payload.resourceCoverage['kn:autocontrol:frequency-response'].linkedResourceCount).toBe(0);
    expect(payload.resourceCoverage['kn:autocontrol:frequency-response'].fieldCompletion).toMatchObject({
      denominator: 2,
      missingField: 2,
      provisional: 2,
      citationReady: 1,
      pathEligible: 0,
      missingFieldCodes: expect.arrayContaining([
        'missing-human-review',
        'missing-segment-ref',
        'provisional-metadata',
      ]),
      sampleLimitations: expect.arrayContaining([
        'knowledge-card:Bode首轮骨架_5_1e07d9da: metadata is provisional',
        'infograph:Bode首轮骨架_5_1e07d9da: metadata is provisional',
      ]),
      artifactVersion: RESOURCE_FIELD_COMPLETION_AUDIT_VERSION,
    });

    const studentPayload = buildGraphCenterPayload({
      domain: 'knowledge',
      selectedNodeId: 'kn:autocontrol:frequency-response',
      resourceRegistry: registry,
      viewerRole: 'STUDENT',
      resourceFieldCompletionSummary,
    });

    expect(studentPayload.resourceCoverage['kn:autocontrol:frequency-response'].fieldCompletion).toBeUndefined();
  });

  it('combines static audit diagnostics with live teaching resources in Graph Center', () => {
    const registry = buildResourceNodeRegistry({
      teachingResources: [{
        id: 'live-bode-resource',
        title: 'Live Bode resource',
        type: 'INTERACTIVE_COMP',
        registryId: 'bode-live-registry',
        knowledgeNodeIds: ['kn:autocontrol:frequency-response'],
        config: {
          resourceNodePlanning: {
            abilityImpact: { controlModeling: 0.2 },
            evidenceInstrumentation: ['TeachingResource.interactionLogs'],
            estimatedTimeMinutes: 6,
          },
        },
      }],
    });
    const resourceFieldCompletionSummary = {
      graphCoverageDiagnostics: {
        'knowledge-card:Bode首轮骨架_5_1e07d9da|Bode首轮骨架_5_1e07d9da': coverageSummary({
          missingFieldCodes: ['provisional-metadata'],
          sampleLimitations: ['knowledge-card:Bode首轮骨架_5_1e07d9da: metadata is provisional'],
        }),
      },
    };
    const payload = buildGraphCenterPayload({
      domain: 'knowledge',
      selectedNodeId: 'kn:autocontrol:frequency-response',
      resourceRegistry: registry,
      viewerRole: 'TEACHER',
      resourceFieldCompletionSummary,
    });

    expect(payload.resourceCoverage['kn:autocontrol:frequency-response'].linkedResourceCount).toBe(1);
    expect(payload.resourceCoverage['kn:autocontrol:frequency-response'].fieldCompletion).toMatchObject({
      denominator: 2,
      provisional: 1,
      pathEligible: 1,
      missingField: 2,
      missingFieldCodes: expect.arrayContaining([
        'missing-content-hash',
        'provisional-metadata',
      ]),
    });
  });

  it('snapshots audit JSON schema counts and resource families', () => {
    const registry = buildResourceNodeRegistry({
      registeredResources: [{
        id: 'ready-bode',
        label: 'Ready Bode resource',
        type: 'INTERACTIVE_COMP',
        renderTarget: '/interactive-learning/resources/ready-bode',
        knowledgeNodeIds: ['Bode图_1_1'],
        planningOverride: {
          abilityImpact: { controlModeling: 0.3 },
          evidenceInstrumentation: ['resource_interaction'],
          estimatedTimeMinutes: 8,
        },
      }],
    });
    const result = buildResourceFieldCompletionAudit({
      registry,
      generatedAt: '2026-06-22T00:00:00.000Z',
      candidates: [{
        id: 'runtime-step:3-5:step-01',
        title: '回到地图',
        family: 'runtime-lesson-step',
        sourcePathOrUrl: 'course-content/runtime/lessons/3-5/interactive-manifest.json',
        sourceRecord: '3-5:step-01',
        segmentRefs: ['step-01'],
        citationTargets: [],
        pathTarget: '/interactive-learning/courses/3-5',
        evidenceInstrumentation: ['interactive_step_event'],
        versionRef: 'interactive-manifest.v2',
      }],
    });

    expect({
      artifactVersion: result.summary.artifactVersion,
      totalRows: result.rows.length,
      totals: result.summary.totals,
      families: Object.keys(result.summary.byFamily).sort(),
      studentDiagnostics: result.summary.roleSafeSummary.student.exposeInternalDiagnostics,
      teacherAdminDiagnostics: result.summary.roleSafeSummary.teacherAdmin.exposeInternalDiagnostics,
    }).toMatchInlineSnapshot(`
      {
        "artifactVersion": "resource-field-completion-audit.v1",
        "families": [
          "registered-resource",
          "runtime-lesson-step",
        ],
        "studentDiagnostics": false,
        "teacherAdminDiagnostics": true,
        "totalRows": 2,
        "totals": {
          "artifactVersion": "resource-field-completion-audit.v1",
          "blocked": 2,
          "citationReady": 1,
          "complete": 0,
          "denominator": 2,
          "humanConfirmed": 0,
          "limitationReasons": [
            "missing fields: missing-capability-target, missing-citation-target, missing-content-hash, missing-evidence-contract, missing-human-review, missing-knowledge-binding, missing-path-profile",
            "missing fields: missing-content-hash",
          ],
          "missingField": 2,
          "missingFieldCodes": [
            "missing-capability-target",
            "missing-citation-target",
            "missing-content-hash",
            "missing-evidence-contract",
            "missing-human-review",
            "missing-knowledge-binding",
            "missing-path-profile",
          ],
          "pathEligible": 1,
          "provisional": 0,
          "sampleLimitations": [
            "registry:ready-bode: missing fields: missing-content-hash",
            "runtime-step:3-5:step-01: missing fields: missing-capability-target, missing-citation-target, missing-content-hash, missing-evidence-contract, missing-human-review, missing-knowledge-binding, missing-path-profile",
          ],
          "sourceWindow": {
            "from": null,
            "to": "2026-06-22T00:00:00.000Z",
          },
        },
      }
    `);
  });
});

function coverageSummary(
  overrides: Partial<ResourceFieldCompletionCoverageSummary> = {},
): ResourceFieldCompletionCoverageSummary {
  return {
    complete: 0,
    missingField: 1,
    provisional: 1,
    humanConfirmed: 0,
    citationReady: 0,
    pathEligible: 0,
    blocked: 1,
    denominator: 1,
    sourceWindow: { from: null, to: '2026-06-22T00:00:00.000Z' },
    missingFieldCodes: ['provisional-metadata'],
    limitationReasons: ['metadata is provisional'],
    sampleLimitations: [],
    artifactVersion: RESOURCE_FIELD_COMPLETION_AUDIT_VERSION,
    ...overrides,
  };
}

function baselineAuditRow(
  resourceId: string,
  resourceType: string,
): ResourceFieldCompletionAuditRow {
  return {
    resourceId,
    resourceType,
    family: 'resource-node',
    title: resourceId,
    sourcePathOrUrl: `/resources/${resourceId}`,
    sourceRecord: resourceId,
    pathTarget: `/resources/${resourceId}`,
    estimatedTimeMinutes: 5,
    sourceHash: `sha256:${resourceId}`,
    sourceVersionRef: 'resource-node-registry.v1',
    citationTargets: [`/resources/${resourceId}`],
    readiness: null,
    graphNodeRefs: {
      knowledge: [],
      capability: [],
      quality: [],
    },
    missingFieldCodes: [],
    completionMethod: 'already-governed',
    reviewStatus: 'not-reviewed',
    reviewAudit: {
      reviewerId: null,
      reviewerRole: null,
      reviewedAt: null,
      reviewBatchId: null,
      reviewedSourceHash: null,
      reviewedVersionRef: null,
      generationToolOrModel: null,
      promptOrManifestHash: null,
      confidence: null,
      staleInvalidationRule: 'invalidate on source change',
    },
    evidenceContract: {
      eventSource: true,
      eventType: true,
      clientEventIdPolicy: true,
      attemptKey: true,
      sourceLogId: true,
      dedupeKey: true,
      timestamps: true,
      learningFactPolicy: true,
      confidencePolicy: true,
      privacyScope: true,
      complete: true,
      missingFields: [],
    },
    pathEligibility: {
      current: true,
      afterCompletion: true,
      masteryAffecting: true,
      blockedBy: [],
    },
    groundingEligibility: {
      retrievalReady: true,
      citationReady: true,
      authoringTriageReady: true,
    },
    coverage: {
      denominatorKey: resourceId,
      sourceWindow: { from: null, to: '2026-06-24T00:00:00.000Z' },
      artifactVersion: RESOURCE_FIELD_COMPLETION_AUDIT_VERSION,
      limitationReason: null,
    },
    versionRefs: buildKaqArtifactVersionRefs(),
  };
}
