import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
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
  type LearningGoalResourceBaselineArtifacts,
  type LearningGoalResourceBaselineCategorySummary,
} from '../learning-goal-resource-baseline';
import {
  FULL_RESOURCE_PATH_READINESS_GATE_VERSION,
  REQUIRED_PATH_READINESS_RESOURCE_FAMILIES,
  buildFullResourcePathReadinessGate,
  buildLearningGoalPathGenerationDiagnostics,
  validateLearningGoalBlockerReviews,
} from '../full-resource-path-readiness-gate';
import {
  buildResourceFieldCompletionAudit,
  buildResourceFieldCompletionAuditFromRows,
  RESOURCE_FIELD_COMPLETION_AUDIT_VERSION,
  YANGFAN_FIXTURE_OWNED_RESOURCE_IDS,
  canDowngradeEvidenceLineageBlockerWithDisposition,
  isRuntimeProjectionReviewAuditUsable,
  type ResourceFieldCompletionCoverageSummary,
  type ResourceFieldCompletionAuditRow,
} from '../resource-field-completion-audit';
import { buildKaqArtifactVersionRefs } from '../kaq-artifact-versioning';
import { buildResourceNodeRegistry } from '../resource-node-registry';
import { buildRuntimeResourceProjectionArtifacts } from '../runtime-resource-projections';
import {
  atomicWriteFileBatch,
  assertCoreSemanticMaterializationManifest,
  assertCoreSemanticReviewFreeze,
  assertFrozenCoreRegisteredKnowledgeResourceSemanticArtifacts,
  assertResidualKnowledgeCardDispositionReviewFreeze,
  buildCourseContentClearanceReviewOverlays,
  filterTextbookSearchDocumentsForCitationReviewScope,
  expectedCoreSemanticReviewFreezeForResourceId,
  expectedResidualKnowledgeCardDispositionReviewFreezeForResourceId,
  isRuntimeLessonMediaSourceFile,
  listIndexedAuthoringTextbookManifestPaths,
  loadCourseContentClearanceRecords,
  loadRuntimeLessonMediaSemanticReviewMap,
  parseResourceFieldCompletionAuditCliArgs,
  refreshFrozenPathGenerationDiagnostics,
  resolveResourceFieldCompletionGeneratedAt,
  runtimeLessonReviewSourceHash,
  runtimeLessonMediaSemanticFormalReviewOverlaysForRows,
  reviewedRuntimeStepCompletionForSource,
  type ReviewedRuntimeStepCompletion,
} from '../../../scripts/db/generate-resource-field-completion-audit';

describe('resource field completion audit', () => {
  it('allows the item-scoped unit 1-4 knowledge-card rereview freeze only for three exact resource ids', () => {
    const rereviewFreeze = {
      reviewBatchId: 'unit-1-4-knowledge-card-rereview-2026-07-17-1023',
      reviewedAt: '2026-07-17T02:23:59.000Z',
    };
    const rereviewResourceIds = [
      'knowledge-card:时域响应_1_1',
      'knowledge-card:频域分析_2_2e257d89',
      'knowledge-card:开环幅相特性曲线_5_fd86e289',
    ];

    for (const resourceId of rereviewResourceIds) {
      expect(expectedCoreSemanticReviewFreezeForResourceId(resourceId)).toEqual(rereviewFreeze);
      expect(() => assertCoreSemanticReviewFreeze({ resourceId, ...rereviewFreeze })).not.toThrow();
    }

    const unrelatedResourceId = 'knowledge-card:unrelated';
    const defaultFreeze = {
      reviewBatchId: 'core-registered-knowledge-resource-semantics-2026-07-09',
      reviewedAt: '2026-07-09T16:30:00.000Z',
    };
    expect(expectedCoreSemanticReviewFreezeForResourceId(unrelatedResourceId)).toEqual(defaultFreeze);
    expect(() => assertCoreSemanticReviewFreeze({
      resourceId: unrelatedResourceId,
      ...defaultFreeze,
    })).not.toThrow();
    expect(() => assertCoreSemanticReviewFreeze({
      resourceId: unrelatedResourceId,
      ...rereviewFreeze,
    })).toThrow(`Unexpected core semantic review batch for ${unrelatedResourceId}`);

    const residualRereviewFreeze = {
      ...rereviewFreeze,
      reviewerId: 'core-registered-knowledge-resource-implementing-agent',
    };
    for (const resourceId of rereviewResourceIds) {
      expect(expectedResidualKnowledgeCardDispositionReviewFreezeForResourceId(resourceId))
        .toEqual(residualRereviewFreeze);
      expect(() => assertResidualKnowledgeCardDispositionReviewFreeze({
        resourceId,
        ...residualRereviewFreeze,
      })).not.toThrow();
    }

    const defaultResidualFreeze = {
      reviewBatchId: 'residual-knowledge-card-disposition-review-2026-07-05',
      reviewerId: 'residual-knowledge-card-implementing-agent',
      reviewedAt: '2026-07-05T20:00:00.000Z',
    };
    expect(expectedResidualKnowledgeCardDispositionReviewFreezeForResourceId(unrelatedResourceId))
      .toEqual(defaultResidualFreeze);
    expect(() => assertResidualKnowledgeCardDispositionReviewFreeze({
      resourceId: unrelatedResourceId,
      ...residualRereviewFreeze,
    })).toThrow(`Unexpected residual knowledge-card review batch for ${unrelatedResourceId}`);
  });

  it('loads content clearance only for the three new lessons', async () => {
    const records = await loadCourseContentClearanceRecords();
    expect(records).toEqual(expect.arrayContaining([
      expect.objectContaining({ lesson_id: '1-3' }),
      expect.objectContaining({ lesson_id: '1-4' }),
      expect.objectContaining({ lesson_id: '1-5' }),
    ]));
    expect(records.map((record) => record.lesson_id)).toEqual([
      '1-3',
      '1-4',
      '1-5',
    ]);
  });

  it('loads lesson content clearance records and converts them to review overlays', async () => {
    const runtimeLessonsDir = mkdtempSync(join(tmpdir(), 'content-clearance-'));
    const reviewDir = join(runtimeLessonsDir, '1-3', 'review');
    mkdirSync(reviewDir, { recursive: true });
    writeFileSync(join(reviewDir, 'review-report.md'), '# Independent review evidence\n');
    const record = {
      lesson_id: '1-3',
      reviewer: 'course-reviewer',
      batch: 'lesson-1-3-clearance',
      time: '2026-07-14T08:00:00.000Z',
      model: 'gpt-5.6-sol',
      status: 'cleared',
      review_status: 'model-cleared',
      independent_evidence_ref: 'course-content/runtime/lessons/1-3/review/review-report.md',
      reviewed_resources: [
        {
          resourceId: 'runtime-handout:1-3',
          sourcePath: 'course-content/runtime/lessons/1-3/1-3-handout.md',
          sourceHash: 'sha256:handout',
          sourceVersionRef: 'runtime-handout.v1',
          graphNodeRefs: {
            knowledge: ['root-locus'],
            capability: ['controlModeling'],
            quality: ['systemsThinking'],
          },
          pathTarget: '/course-runtime/lessons/1-3/1-3-handout.md',
          currentPathEligible: false,
          rationale: 'The reviewed handout is mathematically correct and its graph references match the lesson overlay.',
        },
        {
          resourceId: 'runtime-media:1-3:diagram.png',
          sourcePath: 'course-content/runtime/lessons/1-3/media/diagram.png',
          sourceHash: 'sha256:diagram',
          sourceVersionRef: 'runtime-lesson-media.v1',
          graphNodeRefs: {
            knowledge: ['root-locus'],
            capability: [],
            quality: [],
          },
          pathTarget: '/course-runtime/lessons/1-3/media/diagram.png',
          currentPathEligible: false,
          rationale: 'The reviewed media index accurately lists the lesson media without claiming unavailable assets.',
        },
      ],
    } as const;
    writeFileSync(join(reviewDir, 'content-clearance.json'), JSON.stringify(record));

    try {
      const records = await loadCourseContentClearanceRecords(runtimeLessonsDir);
      const registry = buildResourceNodeRegistry({
        runtimeLessons: [{
          lessonId: '1-3',
          title: 'Root locus',
          knowledgeNodeIds: ['root-locus'],
          handoutPath: '/course-runtime/lessons/1-3/1-3-handout.md',
          handoutSourcePath: 'course-content/runtime/lessons/1-3/1-3-handout.md',
          handoutSourceHash: 'sha256:handout',
          handoutSourceVersionRef: 'runtime-handout.v1',
        }],
      });
      const mediaCandidate = {
        id: 'runtime-media:1-3:diagram.png',
        title: 'diagram.png',
        family: 'runtime-lesson-media' as const,
        sourcePathOrUrl: 'course-content/runtime/lessons/1-3/media/diagram.png',
        knowledgeNodeIds: [],
        capabilityTargetIds: [],
        qualityTargetIds: [],
        segmentRefs: ['diagram.png'],
        citationTargets: ['course-content/runtime/lessons/1-3/media/diagram.png'],
        pathTarget: '/course-runtime/lessons/1-3/media/diagram.png',
        contentHash: 'sha256:diagram',
        versionRef: 'runtime-lesson-media.v1',
        currentPathEligible: false,
      };
      const sourceRows = buildResourceFieldCompletionAudit({
        registry,
        candidates: [mediaCandidate],
      }).sourceRows;
      const overlays = buildCourseContentClearanceReviewOverlays(records, sourceRows);
      const reviewedAudit = buildResourceFieldCompletionAudit({
        registry,
        candidates: [mediaCandidate],
        reviewOverlays: overlays,
      });
      const reviewedRows = reviewedAudit.rows;

      expect(records).toEqual([record]);
      expect(sourceRows.find((row) => row.resourceId === 'runtime-handout:1-3')).toMatchObject({
        sourcePathOrUrl: 'course-content/runtime/lessons/1-3/1-3-handout.md',
        sourceHash: 'sha256:handout',
        sourceVersionRef: 'runtime-handout.v1',
      });
      expect(overlays).toHaveLength(2);
      expect(overlays.find((overlay) => overlay.resourceId === 'runtime-handout:1-3')).toMatchObject({
        expectedSourceHash: 'sha256:handout',
        expectedSourceVersionRef: 'runtime-handout.v1',
      });
      expect(overlays.find((overlay) => overlay.resourceId === 'runtime-media:1-3:diagram.png')).toMatchObject({
        reviewStatus: 'model-cleared',
        expectedSourceHash: 'sha256:diagram',
        expectedSourceVersionRef: 'runtime-lesson-media.v1',
        reviewAudit: expect.objectContaining({
          reviewerId: 'course-reviewer',
          reviewedAt: '2026-07-14T08:00:00.000Z',
          reviewBatchId: 'lesson-1-3-clearance',
          generationToolOrModel: 'gpt-5.6-sol',
          promptOrManifestHash: 'sha256:diagram',
          independentEvidenceRef: 'course-content/runtime/lessons/1-3/review/review-report.md',
        }),
      });
      const reviewedHandout = reviewedRows.find((row) => row.resourceId === 'runtime-handout:1-3');
      expect(reviewedHandout?.reviewStatus).toBe('model-cleared');
      expect(reviewedHandout?.pathEligibility).toMatchObject({
        current: false,
        afterCompletion: false,
        masteryAffecting: false,
      });
      expect(reviewedHandout?.evidenceContract.learningFactMaterializationPolicy).toBe('path-execution-evidence-only');
      expect(reviewedHandout?.coverage.denominatorKey.split('|')).toEqual(expect.arrayContaining([
        'controlModeling',
        'systemsThinking',
      ]));
      expect(reviewedAudit.integrityDiagnostics.humanConfirmedRows).toBe(0);
      const projection = buildRuntimeResourceProjectionArtifacts({ auditRows: reviewedRows }).rows
        .find((row) => row.id === 'runtime-media:1-3:diagram.png');
      expect(projection).toMatchObject({
        projectionLevel: 'ResourceSegment',
        routeTarget: null,
        graphNodeRefs: { knowledge: ['root-locus'] },
        reviewAudit: { status: 'model-cleared' },
        pathEligibility: { current: false, afterCompletion: false, masteryAffecting: false },
      });
    } finally {
      rmSync(runtimeLessonsDir, { recursive: true, force: true });
    }
  });

  it('projects stale content decisions without rewriting human provenance', () => {
    const reviewedResource = {
      resourceId: 'runtime-media:1-3:diagram.png',
      sourcePath: 'course-content/runtime/lessons/1-3/media/diagram.png',
      sourceHash: 'sha256:diagram',
      sourceVersionRef: 'runtime-lesson-media.v1',
      graphNodeRefs: { knowledge: ['root-locus'], capability: [], quality: [] },
      pathTarget: '/course-runtime/lessons/1-3/media/diagram.png',
      currentPathEligible: false,
      rationale: 'The reviewed diagram is mathematically correct and its labels match the lesson terminology.',
    };
    const record = {
      lesson_id: '1-3',
      reviewer: 'course-reviewer',
      batch: 'lesson-1-3-clearance',
      time: '2026-07-14T08:00:00.000Z',
      model: 'gpt-5.6-sol',
      status: 'cleared' as const,
      review_status: 'model-cleared' as const,
      independent_evidence_ref: 'course-content/runtime/lessons/1-3/review/review-report.md',
      reviewed_resources: [reviewedResource],
    };
    const candidate = {
      id: reviewedResource.resourceId,
      title: 'diagram.png',
      family: 'runtime-lesson-media' as const,
      sourcePathOrUrl: reviewedResource.sourcePath,
      knowledgeNodeIds: [],
      capabilityTargetIds: [],
      qualityTargetIds: [],
      pathTarget: reviewedResource.pathTarget,
      contentHash: reviewedResource.sourceHash,
      versionRef: reviewedResource.sourceVersionRef,
      currentPathEligible: false,
    };
    const sourceRow = buildResourceFieldCompletionAudit({
      registry: buildResourceNodeRegistry({}),
      candidates: [candidate],
    }).sourceRows[0];

    const [targetMigration] = buildCourseContentClearanceReviewOverlays(
      [record],
      [{ ...sourceRow, pathTarget: '/course-runtime/lessons/1-3/1-3-handout.md' }],
    );
    expect(targetMigration).toMatchObject({
      reviewStatus: 'stale',
      pathTarget: null,
      currentPathEligible: false,
      reviewAudit: {
        reviewerId: record.reviewer,
        reviewedAt: record.time,
        reviewBatchId: record.batch,
        reviewerVisibleRationale: reviewedResource.rationale,
        staleInvalidationRule: expect.stringContaining('pending-target-migration'),
      },
    });

    expect(buildCourseContentClearanceReviewOverlays(
      [record],
      [{ ...sourceRow, sourceHash: 'sha256:changed' }],
    )[0]).toMatchObject({ reviewStatus: 'stale' });
    expect(buildCourseContentClearanceReviewOverlays(
      [record],
      [{ ...sourceRow, sourceVersionRef: 'runtime-lesson-media.v2' }],
    )[0]).toMatchObject({ reviewStatus: 'stale' });
    expect(() => buildCourseContentClearanceReviewOverlays(
      [{ ...record, reviewed_resources: [reviewedResource, reviewedResource] }],
      [sourceRow],
    )).toThrow('Duplicate lesson content clearance resource');
    expect(() => buildCourseContentClearanceReviewOverlays(
      [{ ...record, reviewed_resources: [] }],
      [sourceRow],
    )).toThrow('Missing lesson content clearance resource');
  });

  it('preserves the latest integration knowledge-card review chronology', () => {
    const candidate = {
      id: 'knowledge-card:三域证据链_1_5',
      title: 'Existing reviewed card',
      family: 'knowledge-card' as const,
      sourcePathOrUrl: 'course-content/runtime/knowledge/cards/nodes/三域证据链_1_5.md',
      sourceRecord: '三域证据链_1_5',
      knowledgeNodeIds: ['existing-review'],
      segmentRefs: ['三域证据链_1_5'],
      citationTargets: ['course-content/runtime/knowledge/cards/nodes/三域证据链_1_5.md'],
      pathTarget: '/knowledge?node=existing-review',
      privacyScope: 'student-visible' as const,
      contentHash: 'sha256:existing-review',
      versionRef: 'runtime-knowledge-card.v1',
      humanConfirmed: true,
      reviewEvidence: {
        reviewerId: 'knowledge-card-reviewer',
        reviewerRole: 'curriculum-data-governance',
        reviewedAt: '2026-07-14T04:30:00.000Z',
        reviewBatchId: 'knowledge-card-review-2026-07-14',
        reviewerVisibleRationale: 'The card was reviewed against its source and retained as citation support.',
        independentEvidenceRef: 'review-packet:existing-review',
        reviewedSourceHash: 'sha256:existing-review',
        reviewedVersionRef: 'runtime-knowledge-card.v1',
      },
    };
    const sourceRow = buildResourceFieldCompletionAudit({
      registry: buildResourceNodeRegistry({}),
      candidates: [candidate],
    }).sourceRows[0];
    const [overlay] = buildCourseContentClearanceReviewOverlays([{
      lesson_id: '1-5',
      reviewer: 'course-reviewer',
      batch: 'lesson-clearance-2026-07-16',
      time: '2026-07-16T11:05:14.000Z',
      model: 'gpt-5.6-sol',
      status: 'cleared',
      review_status: 'model-cleared',
      independent_evidence_ref: 'course-content/runtime/lessons/1-5/review/review-report.md',
      reviewed_resources: [{
        resourceId: candidate.id,
        sourcePath: candidate.sourcePathOrUrl,
        sourceHash: candidate.contentHash,
        sourceVersionRef: candidate.versionRef,
        graphNodeRefs: { knowledge: ['existing-review'], capability: [], quality: [] },
        pathTarget: candidate.pathTarget,
        currentPathEligible: false,
        rationale: 'The lesson clearance confirms use of the already-reviewed card without replacing its review chronology.',
      }],
    }], [sourceRow]);

    expect(overlay.reviewAudit).toMatchObject({
      reviewedAt: '2026-07-16T11:05:14.000Z',
      reviewBatchId: 'unit-1-5-content-clearance-2026-07-16-1905',
    });
  });

  it('rejects invalid model clearance status and missing or self-referential evidence', async () => {
    const runtimeLessonsDir = mkdtempSync(join(tmpdir(), 'content-clearance-validation-'));
    const reviewDir = join(runtimeLessonsDir, '1-3', 'review');
    const clearancePath = join(reviewDir, 'content-clearance.json');
    const reviewReportPath = join(reviewDir, 'review-report.md');
    mkdirSync(reviewDir, { recursive: true });
    writeFileSync(reviewReportPath, '# Independent review evidence\n');
    const validRecord = {
      lesson_id: '1-3',
      reviewer: 'course-reviewer',
      batch: 'lesson-1-3-clearance',
      time: '2026-07-14T08:00:00.000Z',
      model: 'gpt-5.6-sol',
      status: 'cleared',
      review_status: 'model-cleared',
      independent_evidence_ref: 'course-content/runtime/lessons/1-3/review/review-report.md',
      reviewed_resources: [],
    };

    try {
      writeFileSync(clearancePath, JSON.stringify({ ...validRecord, model: 'unknown-model' }));
      await expect(loadCourseContentClearanceRecords(runtimeLessonsDir)).rejects.toThrow(
        'Invalid lesson content clearance model',
      );

      writeFileSync(clearancePath, JSON.stringify({ ...validRecord, review_status: 'human-confirmed' }));
      await expect(loadCourseContentClearanceRecords(runtimeLessonsDir)).rejects.toThrow(
        'Invalid lesson content clearance review_status',
      );

      writeFileSync(clearancePath, JSON.stringify({
        ...validRecord,
        independent_evidence_ref: 'course-content/runtime/lessons/1-3/review/content-clearance.json',
      }));
      await expect(loadCourseContentClearanceRecords(runtimeLessonsDir)).rejects.toThrow(
        'evidence must not self-reference',
      );

      writeFileSync(clearancePath, JSON.stringify(validRecord));
      rmSync(reviewReportPath);
      await expect(loadCourseContentClearanceRecords(runtimeLessonsDir)).rejects.toThrow(
        'Missing lesson content clearance independent evidence',
      );
    } finally {
      rmSync(runtimeLessonsDir, { recursive: true, force: true });
    }
  });

  it('excludes runtime media indexes and PDFs from media candidates', () => {
    expect(isRuntimeLessonMediaSourceFile('/runtime/1-3/media/1-3-media.md')).toBe(false);
    expect(isRuntimeLessonMediaSourceFile('/runtime/1-3/media/generated-data/metrics.txt')).toBe(true);
    expect(isRuntimeLessonMediaSourceFile('/runtime/1-3/media/diagram.png')).toBe(true);
    expect(isRuntimeLessonMediaSourceFile('/runtime/1-3/media/octave-intermediate.pdf')).toBe(false);
  });

  it('limits textbook search documents to explicitly reviewed rows in reviewed books', () => {
    const reviews = new Map([['textbook-search-document:shared-id', {
      resourceId: 'textbook-search-document:shared-id',
      citationAddress: { href: '/textbooks/reviewed-book/sections/1' },
    }]]) as never;
    const documents = [
      { id: 'shared-id', metadata: { bookId: 'reviewed-book' } },
      { id: 'shared-id', metadata: { bookId: 'other-book' } },
      { id: 'unreviewed-id', metadata: { bookId: 'reviewed-book' } },
    ];

    expect(filterTextbookSearchDocumentsForCitationReviewScope(documents, reviews)).toEqual([
      documents[0],
    ]);
  });

  it('applies historical runtime review overlays only to review source IDs', async () => {
    const reviewSources = await loadRuntimeLessonMediaSemanticReviewMap();
    const reviewSource = reviewSources.values().next().value;
    expect(reviewSource).toBeDefined();
    const auditRows = readFileSync(
      join(process.cwd(), 'course-content/runtime/resource-governance/resource-field-completion-audit.jsonl'),
      'utf8',
    ).split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line) as ResourceFieldCompletionAuditRow);
    const reviewedRow = auditRows.find((row) => row.resourceId === reviewSource!.resourceId);
    expect(reviewedRow).toBeDefined();
    const unrelatedNewCourseRow = {
      ...reviewedRow!,
      resourceId: 'runtime-handout:1-3',
      sourcePathOrUrl: 'course-content/runtime/lessons/1-3/1-3-handout.md',
      sourceRecord: '1-3',
    };

    const overlays = runtimeLessonMediaSemanticFormalReviewOverlaysForRows(
      [reviewedRow!, unrelatedNewCourseRow],
      new Map([[reviewSource!.resourceId, reviewSource!]]),
    );

    expect(overlays.map((overlay) => overlay.resourceId)).toEqual([reviewSource!.resourceId]);
  });

  it('rebuilds derived artifacts from frozen rows without changing non-reviewed rows', () => {
    const frozen = buildResourceFieldCompletionAudit({
      registry: buildResourceNodeRegistry({}),
      candidates: [
        {
          id: 'knowledge-card:frozen-review',
          title: 'Frozen review fixture',
          family: 'knowledge-card',
          sourcePathOrUrl: '/runtime/frozen-card.md',
          contentHash: 'sha256:frozen-card',
          versionRef: 'runtime-card.v1',
          generatedBy: 'template',
          currentPathEligible: false,
        },
        {
          id: 'runtime-handout:untouched',
          title: 'Untouched frozen fixture',
          family: 'runtime-handout',
          sourcePathOrUrl: '/runtime/handout.md',
          contentHash: 'sha256:handout',
          versionRef: 'runtime-handout.v1',
          generatedBy: 'template',
          currentPathEligible: false,
        },
      ],
      generatedAt: '2026-07-07T10:45:00.000Z',
      limitations: ['frozen limitation'],
    });
    const overlay = {
      resourceId: 'knowledge-card:frozen-review',
      expectedSourceHash: 'sha256:frozen-card',
      expectedSourceVersionRef: 'runtime-card.v1',
      pathTarget: null,
      currentPathEligible: false,
      reviewAudit: {
        reviewerId: 'reviewer',
        reviewerRole: 'curriculum-data-governance',
        reviewedAt: '2026-07-09T16:30:00.000Z',
        reviewBatchId: 'review-batch',
        reviewedSourceHash: 'sha256:frozen-card',
        reviewedVersionRef: 'runtime-card.v1',
        generationToolOrModel: null,
        promptOrManifestHash: null,
        reviewerVisibleRationale: 'The tracked review confirms the frozen resource semantics without changing unrelated rows.',
        independentEvidenceRef: 'review-source.jsonl#knowledge-card:frozen-review',
        confidence: 1,
        staleInvalidationRule: 'stale when source identity changes',
      },
    } as const;

    const result = buildResourceFieldCompletionAuditFromRows({
      sourceRows: frozen.rows,
      reviewOverlays: [overlay],
      requiredReviewResourceIds: ['knowledge-card:frozen-review'],
      generatedAt: frozen.summary.generatedAt,
      sourceWindow: frozen.summary.sourceWindow,
      versionRefs: frozen.summary.versionRefs,
      limitations: frozen.summary.limitations,
    });

    expect(result.sourceRows).toBe(frozen.rows);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[1]).toBe(frozen.rows[1]);
    expect(result.rows[0].reviewStatus).toBe('human-confirmed');
    expect(result.summary.generatedAt).toBe(frozen.summary.generatedAt);
    expect(result.summary.totals.denominator).toBe(2);
    expect(result.summary.byReviewStatus['human-confirmed']).toBe(1);
    expect(result.summary.totals).toMatchObject({
      humanConfirmed: 1,
      agentReviewed: 0,
      semanticReviewed: 1,
    });
    expect(result.workqueues.auditMissingFieldRows).toBe(2);
    expect(result.integrityDiagnostics.invalidHumanConfirmedRows).toBe(0);

    const agentReviewed = buildResourceFieldCompletionAuditFromRows({
      sourceRows: frozen.rows,
      reviewOverlays: [{ ...overlay, reviewStatus: 'agent-reviewed' }],
      requiredReviewResourceIds: ['knowledge-card:frozen-review'],
      generatedAt: frozen.summary.generatedAt,
      sourceWindow: frozen.summary.sourceWindow,
      versionRefs: frozen.summary.versionRefs,
    });
    expect(agentReviewed.rows[0]).toMatchObject({
      reviewStatus: 'agent-reviewed',
      pathEligibility: { current: false },
    });
    expect(agentReviewed.rows[0].missingFieldCodes).toContain('missing-human-review');
    expect(agentReviewed.rows[0].pathEligibility).toMatchObject({
      current: false,
      afterCompletion: false,
      masteryAffecting: false,
      blockedBy: expect.arrayContaining(['missing-human-review']),
    });
    expect(agentReviewed.summary.totals).toMatchObject({
      humanConfirmed: 0,
      agentReviewed: 1,
      semanticReviewed: 1,
    });
    expect(agentReviewed.integrityDiagnostics.humanConfirmedRows).toBe(0);

    expect(() => buildResourceFieldCompletionAuditFromRows({
      sourceRows: [...frozen.rows, frozen.rows[0]],
      reviewOverlays: [overlay],
      requiredReviewResourceIds: ['knowledge-card:frozen-review'],
      generatedAt: frozen.summary.generatedAt,
      sourceWindow: frozen.summary.sourceWindow,
      versionRefs: frozen.summary.versionRefs,
    })).toThrow('Duplicate frozen resource field completion audit row');
    expect(() => buildResourceFieldCompletionAuditFromRows({
      sourceRows: frozen.rows,
      reviewOverlays: [],
      requiredReviewResourceIds: ['knowledge-card:frozen-review'],
      generatedAt: frozen.summary.generatedAt,
      sourceWindow: frozen.summary.sourceWindow,
      versionRefs: frozen.summary.versionRefs,
    })).toThrow('Missing required resource field completion review overlay');
    expect(() => buildResourceFieldCompletionAuditFromRows({
      sourceRows: frozen.rows,
      reviewOverlays: [overlay],
      requiredReviewResourceIds: [],
      generatedAt: frozen.summary.generatedAt,
      sourceWindow: frozen.summary.sourceWindow,
      versionRefs: frozen.summary.versionRefs,
    })).toThrow('Unexpected resource field completion review overlay');
    expect(() => buildResourceFieldCompletionAuditFromRows({
      sourceRows: frozen.rows,
      reviewOverlays: [{ ...overlay, expectedSourceHash: 'sha256:changed' }],
      requiredReviewResourceIds: ['knowledge-card:frozen-review'],
      generatedAt: frozen.summary.generatedAt,
      sourceWindow: frozen.summary.sourceWindow,
      versionRefs: frozen.summary.versionRefs,
    })).toThrow('Resource field completion review source hash mismatch');
    expect(() => buildResourceFieldCompletionAuditFromRows({
      sourceRows: frozen.rows,
      reviewOverlays: [{
        ...overlay,
        reviewAudit: { ...overlay.reviewAudit, reviewedSourceHash: 'sha256:changed' },
      }],
      requiredReviewResourceIds: ['knowledge-card:frozen-review'],
      generatedAt: frozen.summary.generatedAt,
      sourceWindow: frozen.summary.sourceWindow,
      versionRefs: frozen.summary.versionRefs,
    })).toThrow('Resource field completion reviewed source hash mismatch');
    expect(() => buildResourceFieldCompletionAuditFromRows({
      sourceRows: frozen.rows,
      reviewOverlays: [{
        ...overlay,
        reviewAudit: { ...overlay.reviewAudit, reviewedVersionRef: 'runtime-card.v2' },
      }],
      requiredReviewResourceIds: ['knowledge-card:frozen-review'],
      generatedAt: frozen.summary.generatedAt,
      sourceWindow: frozen.summary.sourceWindow,
      versionRefs: frozen.summary.versionRefs,
    })).toThrow('Resource field completion reviewed source version mismatch');
  });

  it('parses only the two supported audit generator command forms', () => {
    expect(parseResourceFieldCompletionAuditCliArgs([])).toEqual({ materializeCoreSemanticReview: false });
    expect(parseResourceFieldCompletionAuditCliArgs(['--materialize-core-semantic-review'])).toEqual({
      materializeCoreSemanticReview: true,
    });
    expect(() => parseResourceFieldCompletionAuditCliArgs(['--unknown'])).toThrow('Unsupported arguments');
    expect(() => parseResourceFieldCompletionAuditCliArgs([
      '--materialize-core-semantic-review',
      '--materialize-core-semantic-review',
    ])).toThrow('Unsupported arguments');
    expect(() => parseResourceFieldCompletionAuditCliArgs([
      '--materialize-core-semantic-review',
      '--unknown',
    ])).toThrow('Unsupported arguments');
  });

  it('keeps frozen capture time separate from the current audit generation time', () => {
    expect(resolveResourceFieldCompletionGeneratedAt({
      now: () => '2026-07-25T10:30:00.000Z',
    })).toBe('2026-07-25T10:30:00.000Z');
    expect(resolveResourceFieldCompletionGeneratedAt({
      configuredGeneratedAt: '2026-07-25T10:00:00.000Z',
      now: () => '2026-07-25T10:30:00.000Z',
    })).toBe('2026-07-25T10:00:00.000Z');
    expect(resolveResourceFieldCompletionGeneratedAt({
      frozenGeneratedAt: '2026-07-23T08:30:00.000Z',
      configuredGeneratedAt: '2026-07-25T10:00:00.000Z',
      now: () => '2026-07-25T10:30:00.000Z',
    })).toBe('2026-07-23T08:30:00.000Z');
  });

  it('uses only tracked or staged authoring textbook manifests as candidate sources', () => {
    const repoRoot = mkdtempSync(join(tmpdir(), 'authoring-textbook-index-'));
    const textbookRoot = join(repoRoot, 'course-content/authoring/resources/textbooks');
    const runGit = (args: string[]) => execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8' });
    const writeManifest = (bookId: string) => {
      const manifestDir = join(textbookRoot, bookId, 'chapter-01');
      mkdirSync(manifestDir, { recursive: true });
      writeFileSync(join(manifestDir, 'manifest.json'), `${JSON.stringify({ id: 'chapter-01' })}\n`);
    };
    try {
      runGit(['init', '-q']);
      runGit(['config', 'user.email', 'resource-audit-test@example.invalid']);
      runGit(['config', 'user.name', 'Resource Audit Test']);
      writeManifest('tracked-book');
      runGit(['add', '.']);
      runGit(['commit', '-q', '-m', 'tracked textbook manifest']);
      writeManifest('staged-book');
      runGit(['add', 'course-content/authoring/resources/textbooks/staged-book/chapter-01/manifest.json']);
      writeManifest('untracked-book');
      writeFileSync(join(repoRoot, '.git', 'info', 'exclude'), 'course-content/authoring/resources/textbooks/ignored-book/\n');
      writeManifest('ignored-book');

      expect(listIndexedAuthoringTextbookManifestPaths({ repoRoot, authoringRoot: textbookRoot })
        .map((filePath) => filePath.slice(textbookRoot.length + 1)))
        .toEqual([
          'staged-book/chapter-01/manifest.json',
          'tracked-book/chapter-01/manifest.json',
        ]);
    } finally {
      rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it('runs main when invoked through the package script', () => {
    const result = spawnSync(
      'npm',
      ['run', 'db:resource-field-completion-audit', '--', '--definitely-unsupported'],
      { cwd: process.cwd(), encoding: 'utf8' },
    );
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('Unsupported arguments: --definitely-unsupported');
  });

  it('rejects inconsistent frozen core semantic sidecars before materialization', () => {
    const governanceDir = join(process.cwd(), 'course-content/runtime/resource-governance');
    const readJsonl = (filename: string) => readFileSync(join(governanceDir, filename), 'utf8')
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));
    const rawAuditText = readFileSync(join(governanceDir, 'resource-field-completion-audit.jsonl'), 'utf8');
    const frozenRows = readJsonl('resource-field-completion-audit.jsonl');
    const rawReviewSourceText = readFileSync(
      join(governanceDir, 'core-registered-knowledge-resource-semantic-review-source.jsonl'),
      'utf8',
    );
    const reviewSources = readJsonl('core-registered-knowledge-resource-semantic-review-source.jsonl');
    const reviewSourceIds = new Set(reviewSources.map((row) => row.resourceId));
    const reviewedFrozenCoreRows = frozenRows.filter((row) =>
      ['registered-resource', 'knowledge-card', 'knowledge-infograph'].includes(row.family) &&
      reviewSourceIds.has(row.resourceId)
    );
    expect(reviewSources).toHaveLength(606);
    expect(reviewSourceIds.size).toBe(reviewSources.length);
    expect(reviewedFrozenCoreRows.map((row) => row.resourceId).sort())
      .toEqual([...reviewSourceIds].sort());
    const workqueueItems = readJsonl('core-registered-knowledge-resource-semantic-workqueue-items.jsonl');
    const reviewItems = readJsonl('core-registered-knowledge-resource-semantic-review-items.jsonl');
    const firstScopedRowIndex = frozenRows.findIndex((row) => (
      ['registered-resource', 'knowledge-card', 'knowledge-infograph'].includes(row.family)
    ));
    const summary = JSON.parse(readFileSync(
      join(governanceDir, 'core-registered-knowledge-resource-semantic-summary.json'),
      'utf8',
    ));
    const materializationManifest = JSON.parse(readFileSync(
      join(governanceDir, 'core-registered-knowledge-resource-semantic-materialization-manifest.json'),
      'utf8',
    ));
    const manifestInput = {
      manifest: materializationManifest,
      rawAuditText,
      rows: frozenRows,
      summary: JSON.parse(readFileSync(
        join(governanceDir, 'resource-field-completion-summary.json'),
        'utf8',
      )),
      rawReviewSourceText,
    };
    expect(assertCoreSemanticMaterializationManifest(manifestInput)).toBe('materialized');
    expect(assertCoreSemanticMaterializationManifest({
      ...manifestInput,
      manifest: {
        ...materializationManifest,
        legacyAuditSha256: `sha256:${createHash('sha256').update(rawAuditText).digest('hex')}`,
      },
    })).toBe('legacy');
    const firstNonScopeRowIndex = frozenRows.findIndex((row) => (
      ![
        'registered-resource',
        'knowledge-card',
        'knowledge-infograph',
        'runtime-lesson-step',
        'runtime-lesson-module',
        'runtime-lesson-media',
        'runtime-handout',
      ].includes(row.family)
    ));
    expect(() => assertCoreSemanticMaterializationManifest({
      ...manifestInput,
      rows: frozenRows.map((row, index) => index === firstNonScopeRowIndex
        ? { ...row, title: 'tampered non-scope title' }
        : row),
    })).toThrow('Core semantic materialization non-scope rows mismatch');
    expect(() => assertCoreSemanticMaterializationManifest({
      ...manifestInput,
      rawReviewSourceText: `${rawReviewSourceText} `,
    })).toThrow('Core semantic materialization review source hash mismatch');
    const input = {
      frozenRows,
      reviewSources: new Map(reviewSources.map((row) => [row.resourceId, row])),
      materializationPhase: 'materialized' as const,
      workqueueItems,
      reviewItems,
      summary,
    };
    expect(() => assertFrozenCoreRegisteredKnowledgeResourceSemanticArtifacts(input)).not.toThrow();
    const workqueueById = new Map(workqueueItems.map((row) => [row.resourceId, row]));
    const legacyRows = frozenRows.map((row) => {
      const workqueue = workqueueById.get(row.resourceId);
      if (!workqueue) return row;
      return {
        ...row,
        missingFieldCodes: [...workqueue.startingBlockerCodes],
        reviewAudit: {
          ...row.reviewAudit,
          reviewBatchId: null,
          independentEvidenceRef: null,
        },
      };
    });
    expect(() => assertFrozenCoreRegisteredKnowledgeResourceSemanticArtifacts({
      ...input,
      frozenRows: legacyRows,
      materializationPhase: 'legacy',
    })).not.toThrow();
    expect(() => assertFrozenCoreRegisteredKnowledgeResourceSemanticArtifacts({
      ...input,
      frozenRows: legacyRows,
      materializationPhase: 'materialized',
    })).toThrow('Frozen core semantic formal row mismatch');
    expect(() => assertFrozenCoreRegisteredKnowledgeResourceSemanticArtifacts({
      ...input,
      reviewItems: [
        { ...reviewItems[0], sourceHash: 'sha256:tampered' },
        ...reviewItems.slice(1),
      ],
    })).toThrow('Frozen core semantic review item mismatch');
    expect(() => assertFrozenCoreRegisteredKnowledgeResourceSemanticArtifacts({
      ...input,
      reviewItems: [
        { ...reviewItems[0], startingBlockerCodes: [] },
        ...reviewItems.slice(1),
      ],
    })).toThrow('Frozen core semantic review item mismatch');
    expect(() => assertFrozenCoreRegisteredKnowledgeResourceSemanticArtifacts({
      ...input,
      workqueueItems: [
        { ...workqueueItems[0], startingBlockerCodes: [], startingBlockerCount: 0 },
        ...workqueueItems.slice(1),
      ],
    })).toThrow('Frozen core semantic formal blocker projection mismatch');
    expect(() => assertFrozenCoreRegisteredKnowledgeResourceSemanticArtifacts({
      ...input,
      reviewItems: [
        { ...reviewItems[0], disposition: 'excluded-with-rationale' },
        ...reviewItems.slice(1),
      ],
    })).toThrow('Frozen core semantic review item mismatch');
    expect(() => assertFrozenCoreRegisteredKnowledgeResourceSemanticArtifacts({
      ...input,
      reviewItems: [
        { ...reviewItems[0], reviewerVisibleRationale: 'tampered rationale' },
        ...reviewItems.slice(1),
      ],
    })).toThrow('Frozen core semantic review item mismatch');
    expect(() => assertFrozenCoreRegisteredKnowledgeResourceSemanticArtifacts({
      ...input,
      workqueueItems: [
        { ...workqueueItems[0], title: 'tampered title' },
        ...workqueueItems.slice(1),
      ],
    })).toThrow('Frozen core semantic workqueue mismatch');
    expect(() => assertFrozenCoreRegisteredKnowledgeResourceSemanticArtifacts({
      ...input,
      summary: {
        ...summary,
        byDisposition: { ...summary.byDisposition, 'path-plannable': 999 },
      },
    })).toThrow('Frozen core semantic summary mismatch');
    expect(() => assertFrozenCoreRegisteredKnowledgeResourceSemanticArtifacts({
      ...input,
      frozenRows: frozenRows.map((row, index) => index === firstScopedRowIndex
        ? {
          ...row,
          reviewAudit: {
            ...row.reviewAudit,
            reviewerVisibleRationale: 'tampered formal review rationale',
          },
        }
        : row),
    })).toThrow('Frozen core semantic formal row mismatch');
    expect(() => assertFrozenCoreRegisteredKnowledgeResourceSemanticArtifacts({
      ...input,
      frozenRows: frozenRows.map((row, index) => index === firstScopedRowIndex
        ? {
          ...row,
          pathEligibility: {
            ...row.pathEligibility,
            blockedBy: [...row.pathEligibility.blockedBy, 'tampered-blocker'],
          },
        }
        : row),
    })).toThrow('Frozen core semantic formal row mismatch');
    expect(() => assertFrozenCoreRegisteredKnowledgeResourceSemanticArtifacts({
      ...input,
      frozenRows: frozenRows.map((row, index) => index === firstScopedRowIndex
        ? {
          ...row,
          pathEligibility: {
            ...row.pathEligibility,
            afterCompletion: !row.pathEligibility.afterCompletion,
          },
        }
        : row),
    })).toThrow('Frozen core semantic formal row mismatch');
    const denominatorKeyParts = frozenRows[firstScopedRowIndex].coverage.denominatorKey.split('|');
    for (const tamperedDenominatorKey of [
      [...denominatorKeyParts, 'tampered-unrelated-denominator'].join('|'),
      denominatorKeyParts.slice(1).join('|'),
      ['tampered-unrelated-denominator', ...denominatorKeyParts.slice(1)].join('|'),
    ]) {
      expect(() => assertFrozenCoreRegisteredKnowledgeResourceSemanticArtifacts({
        ...input,
        frozenRows: frozenRows.map((row, index) => index === firstScopedRowIndex
          ? {
            ...row,
            coverage: {
              ...row.coverage,
              denominatorKey: tamperedDenominatorKey,
            },
          }
          : row),
      })).toThrow('Frozen core semantic formal row mismatch');
    }
    expect(() => assertFrozenCoreRegisteredKnowledgeResourceSemanticArtifacts({
      ...input,
      frozenRows: frozenRows.map((row, index) => index === firstScopedRowIndex
        ? {
          ...row,
          coverage: {
            ...row.coverage,
            limitationReason: 'tampered coverage limitation',
          },
        }
        : row),
    })).toThrow('Frozen core semantic formal row mismatch');
    expect(() => assertCoreSemanticMaterializationManifest({
      ...manifestInput,
      rows: frozenRows.map((row, index) => index === firstScopedRowIndex
        ? {
          ...row,
          evidenceContract: {
            ...row.evidenceContract,
            complete: !row.evidenceContract.complete,
          },
        }
        : row),
    })).toThrow('Core semantic materialization scope invariant rows mismatch');
    const reviewOnlyCodes = new Set(['missing-human-review', 'provisional-metadata', 'stale-review']);
    const realBlockerRowIndex = frozenRows.findIndex((row) => (
      ['registered-resource', 'knowledge-card', 'knowledge-infograph'].includes(row.family) &&
      row.missingFieldCodes.some((code: string) => !reviewOnlyCodes.has(code))
    ));
    const realBlocker = frozenRows[realBlockerRowIndex].missingFieldCodes.find(
      (code: string) => !reviewOnlyCodes.has(code),
    );
    const blockerToAdd = frozenRows
      .flatMap((row) => row.missingFieldCodes)
      .find((code: string) => (
        !reviewOnlyCodes.has(code) &&
        !frozenRows[firstScopedRowIndex].missingFieldCodes.includes(code)
      ));
    expect(realBlocker).toBeTruthy();
    expect(blockerToAdd).toBeTruthy();
    expect(() => assertCoreSemanticMaterializationManifest({
      ...manifestInput,
      rows: frozenRows.map((row, index) => index === firstScopedRowIndex
        ? { ...row, missingFieldCodes: [...row.missingFieldCodes, blockerToAdd] }
        : row),
    })).toThrow('Core semantic materialization scope invariant rows mismatch');
    expect(() => assertCoreSemanticMaterializationManifest({
      ...manifestInput,
      rows: frozenRows.map((row, index) => index === realBlockerRowIndex
        ? { ...row, missingFieldCodes: row.missingFieldCodes.filter((code: string) => code !== realBlocker) }
        : row),
    })).toThrow('Core semantic materialization scope invariant rows mismatch');
    expect(() => assertFrozenCoreRegisteredKnowledgeResourceSemanticArtifacts({
      ...input,
      frozenRows: frozenRows.map((row, index) => index === firstScopedRowIndex
        ? {
          ...row,
          reviewAudit: {
            ...row.reviewAudit,
            independentEvidenceRef: 'tampered-marker',
          },
        }
        : row),
    })).toThrow('Frozen core semantic formal row mismatch');
  });

  it('refreshes only frozen path diagnostic review and citation bindings', () => {
    const diagnostics = [{
      learningGoalId: 'goal-a',
      attempted: true,
      generationStatus: 'ready' as const,
      fallbackReasons: [],
      blockingReasons: [],
      selectedResourceIds: ['knowledge-card:frozen-review', 'binding-only', 'missing'],
      selectedResourceTypes: ['knowledge_card'],
      resourceCount: 3,
      resourceTypeCount: 1,
      unreviewedSelectedResourceIds: ['knowledge-card:frozen-review', 'binding-only', 'missing'],
      missingCitationMetadataResourceIds: ['knowledge-card:frozen-review', 'binding-only', 'missing'],
    }];
    const builtReviewedRow = buildResourceFieldCompletionAudit({
      registry: buildResourceNodeRegistry({}),
      candidates: [{
        id: 'knowledge-card:frozen-review',
        title: 'Reviewed',
        family: 'knowledge-card',
        sourcePathOrUrl: '/reviewed.md',
        contentHash: 'sha256:reviewed',
        versionRef: 'runtime-card.v1',
        generatedBy: 'template',
        humanConfirmed: true,
        reviewEvidence: {
          reviewerId: 'reviewer',
          reviewerRole: 'curriculum-data-governance',
          reviewedAt: '2026-07-09T00:00:00.000Z',
          reviewBatchId: 'batch',
          reviewedSourceHash: 'sha256:reviewed',
          reviewedVersionRef: 'runtime-card.v1',
          reviewerVisibleRationale: 'A complete fixture rationale for frozen path diagnostic refresh behavior.',
          independentEvidenceRef: 'fixture',
        },
      }],
    }).rows[0];
    const reviewedRow = [{
      ...builtReviewedRow,
      reviewStatus: 'human-confirmed' as const,
      pathEligibility: {
        ...builtReviewedRow.pathEligibility,
        afterCompletion: true,
        blockedBy: [],
      },
    }];

    const refreshed = refreshFrozenPathGenerationDiagnostics(diagnostics, reviewedRow, [{
      resourceId: 'binding-only',
      sourcePathOrUrl: '/binding.md',
      sourceHash: 'sha256:binding',
      sourceVersionRef: 'binding.v1',
    }]);

    expect(refreshed[0]).toMatchObject({
      unreviewedSelectedResourceIds: ['missing'],
      missingCitationMetadataResourceIds: ['missing'],
    });
    expect(refreshed[0].selectedResourceIds).toBe(diagnostics[0].selectedResourceIds);
    expect(diagnostics[0].unreviewedSelectedResourceIds).toHaveLength(3);
  });

  it('rolls back every output when an atomic batch rename fails', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'resource-audit-batch-'));
    const first = join(dir, 'first.json');
    const second = join(dir, 'second.json');
    writeFileSync(first, 'first-old\n');
    writeFileSync(second, 'second-old\n');
    let renameCount = 0;
    try {
      await expect(atomicWriteFileBatch([
        { path: first, content: 'first-new\n' },
        { path: second, content: 'second-new\n' },
      ], {
        beforeRename: () => {
          renameCount += 1;
          if (renameCount === 4) throw new Error('injected rename failure');
        },
      })).rejects.toThrow('injected rename failure');
      expect(readFileSync(first, 'utf8')).toBe('first-old\n');
      expect(readFileSync(second, 'utf8')).toBe('second-old\n');
      expect(readdirSync(dir).sort()).toEqual(['first.json', 'second.json']);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('applies reviewed overlays before deriving audit artifacts while retaining source rows', () => {
    const result = buildResourceFieldCompletionAudit({
      registry: buildResourceNodeRegistry({}),
      candidates: [{
        id: 'knowledge-card:review-overlay',
        title: 'Reviewed overlay fixture',
        family: 'knowledge-card',
        sourcePathOrUrl: '/runtime/card.md',
        contentHash: null,
        versionRef: 'runtime-card.v1',
        generatedBy: 'template',
        currentPathEligible: false,
      }],
      reviewOverlays: [{
        resourceId: 'knowledge-card:review-overlay',
        expectedSourceHash: null,
        expectedSourceVersionRef: 'runtime-card.v1',
        pathTarget: null,
        currentPathEligible: false,
        reviewAudit: {
          reviewerId: 'reviewer',
          reviewerRole: 'curriculum-data-governance',
          reviewedAt: '2026-07-09T16:30:00.000Z',
          reviewBatchId: 'review-batch',
          reviewedSourceHash: null,
          reviewedVersionRef: 'runtime-card.v1',
          generationToolOrModel: null,
          promptOrManifestHash: null,
          reviewerVisibleRationale: 'The tracked review confirms graph and citation semantics without inventing source identity.',
          independentEvidenceRef: 'course-content/runtime/resource-governance/review-source.jsonl#knowledge-card:review-overlay',
          confidence: 1,
          staleInvalidationRule: 'stale when source identity changes',
        },
      }],
    });

    expect(result.sourceRows[0].missingFieldCodes).toEqual(expect.arrayContaining([
      'missing-content-hash',
      'missing-human-review',
      'provisional-metadata',
    ]));
    expect(result.rows[0]).toMatchObject({
      reviewStatus: 'human-confirmed',
      completionMethod: result.sourceRows[0].completionMethod,
      sourceHash: null,
      sourceVersionRef: 'runtime-card.v1',
      pathTarget: null,
      graphNodeRefs: {
        knowledge: [],
        capability: [],
        quality: [],
      },
      citationTargets: [],
    });
    expect(result.rows[0].missingFieldCodes).toContain('missing-content-hash');
    expect(result.rows[0].missingFieldCodes).toContain('missing-evidence-contract');
    expect(result.rows[0].missingFieldCodes).toContain('missing-knowledge-binding');
    expect(result.rows[0].missingFieldCodes).toContain('missing-citation-target');
    expect(result.rows[0].missingFieldCodes).not.toContain('missing-human-review');
    expect(result.rows[0].missingFieldCodes).not.toContain('provisional-metadata');
    expect(result.rows[0].missingFieldCodes).not.toContain('stale-review');
    expect(result.workqueues.auditMissingFieldRows).toBe(1);
    expect(result.summary.byReviewStatus['human-confirmed']).toBe(1);
  });

  it('requires reviewed runtime step completions to match manifest and graph overlay hashes', () => {
    const reviewedSourceHash = runtimeLessonReviewSourceHash(
      'sha256:reviewed-manifest',
      'sha256:reviewed-overlay',
    );
    const reviewedCompletion: ReviewedRuntimeStepCompletion = {
      capabilityTargetIds: ['controlModeling'],
      estimatedTimeMinutes: 6,
      reviewedSourceHash: reviewedSourceHash!,
      reviewerVisibleRationale: 'Fixture verifies reviewed runtime step completion invalidation semantics.',
      independentEvidenceRef: 'test-fixture:reviewed-runtime-step-completion',
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
    const residualKnowledgeCardDispositionReviewItems = readFileSync(
      join(process.cwd(), 'course-content/runtime/resource-governance/residual-knowledge-card-disposition-review-items.jsonl'),
      'utf8',
    )
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));
    const dispositionReviewEvidence = readFileSync(
      join(process.cwd(), 'course-content/runtime/resource-governance/resource-disposition-backlog-review-evidence.md'),
      'utf8',
    );
    const knowledgeVisualSemanticReviewSummary = JSON.parse(readFileSync(
      join(process.cwd(), 'course-content/runtime/resource-governance/knowledge-visual-semantic-shard-summary.json'),
      'utf8',
    ));
    const knowledgeVisualSemanticReviewItems = readFileSync(
      join(process.cwd(), 'course-content/runtime/resource-governance/knowledge-visual-semantic-shard-review-items.jsonl'),
      'utf8',
    )
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));
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
    const generatedProvisionalKnowledgeCardRows = jsonlRows.filter((row) =>
      row.family === 'knowledge-card' && row.reviewStatus === 'generated-provisional'
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
        !['human-confirmed', 'agent-reviewed'].includes(row.reviewStatus) ||
        row.missingFieldCodes.includes('missing-human-review') ||
        row.missingFieldCodes.includes('provisional-metadata') ||
        row.pathEligibility.blockedBy.includes('missing-human-review') ||
        row.pathEligibility.blockedBy.includes('provisional-metadata')
      );
    });
    const stableSourceRefs = new Set(dispositionReviewItems.map((item) => item.stableSourceRef));
    const reviewedLongformRows = jsonlRows.filter((row) =>
      row.reviewAudit.reviewBatchId === 'longform-textbook-reference-resource-semantics-882-2026-07-17'
    );
    const reviewedRuntimeHandoutRows = dispositionReviewItems.filter((item) =>
      item.reviewBatchId === 'residual-runtime-handout-disposition-review-2026-07-05'
    );
    const reviewedKnowledgeInfographRows = dispositionReviewItems.filter((item) =>
      item.reviewBatchId === 'residual-knowledge-infograph-disposition-review-2026-07-05'
    );
    const rereviewedKnowledgeCardResourceIds = new Set([
      'knowledge-card:时域响应_1_1',
      'knowledge-card:频域分析_2_2e257d89',
      'knowledge-card:开环幅相特性曲线_5_fd86e289',
    ]);
    const reviewedKnowledgeCardRows = dispositionReviewItems.filter((item) =>
      item.reviewBatchId === 'residual-knowledge-card-disposition-review-2026-07-05'
    );
    const rereviewedKnowledgeCardRows = residualKnowledgeCardDispositionReviewItems.filter((item) =>
      item.reviewBatchId === 'unit-1-4-knowledge-card-rereview-2026-07-17-1023'
    );
    const unchangedKnowledgeCardRows = residualKnowledgeCardDispositionReviewItems.filter((item) =>
      !rereviewedKnowledgeCardResourceIds.has(item.resourceId)
    );
    const reviewedAuthoringTextbookFigureDispositionRows = dispositionReviewItems.filter((item) =>
      item.sourceFamily === 'authoring-textbook-figure' && item.changeScope === 'longform-882'
    );
    const reviewedAuthoringTextbookCaptionDispositionRows = dispositionReviewItems.filter((item) =>
      item.sourceFamily === 'authoring-textbook-caption' && item.changeScope === 'longform-882'
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
      return `sha256:${createHash('sha256').update(image.caption ?? '').digest('hex')}`;
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
    expect(evidenceLineageSummary.evidenceLineageBlockerCount).toBe(0);
    expect(evidenceLineageSummary.findingCounts['missing-evidence-contract']).toBeGreaterThan(0);
    expect(evidenceLineageSummary.contractFieldGaps.clientEventIdPolicy).toBeGreaterThan(0);
    expect(evidenceLineageSummary.followupBuckets['complete-evidence-lineage-bindings']).toBe(
      evidenceLineageItems.filter((item) => item.followupBucket === 'complete-evidence-lineage-bindings').length,
    );
    expect(evidenceLineageSummary.yangFanFixtureBlockers.blocked).toBe(false);
    expect(evidenceLineageSummary.yangFanFixtureBlockers.blockerCount).toBe(0);
    expect(evidenceLineageSummary.yangFanFixtureBlockers.scopedBlockerCount).toBe(0);
    expect(evidenceLineageSummary.yangFanFixtureBlockers.globalLimitationCount).toBe(
      evidenceLineageItems.filter((item) =>
        item.yangFanFixtureScope === 'global-resource-backlog' && item.evidenceEffectState !== 'ready'
      ).length,
    );
    expect(evidenceLineageSummary.yangFanFixtureBlockers.scopePolicy).toBe('yangfan-fixture-readiness-scope.v1');
    expect(evidenceLineageItems.every((item) => item.privacyMinimized === true)).toBe(true);
    expect(evidenceLineageItems.every((item) => item.rawContentIncluded === false)).toBe(true);
    expect(evidenceLineageItems.some((item) => 'rawContent' in item || 'markdown' in item || 'body' in item)).toBe(false);
    expect(evidenceLineageItems.every((item) =>
      item.followupBucket === 'complete-evidence-lineage-bindings' ||
      (item.evidenceEffectState === 'ready' && item.followupBucket === 'none')
    )).toBe(true);
    expect(evidenceLineageItems.some((item) => item.evidenceEffectState === 'reviewed-limitation')).toBe(true);
    expect(evidenceLineageItems
      .filter((item) => item.yangFanFixtureScope === 'fixture-owned')
      .every((item) => item.evidenceEffectState === 'ready')).toBe(true);
    expect(evidenceLineageItems
      .filter((item) => item.evidenceEffectState === 'reviewed-limitation')
      .every((item) => item.blocksYangFanFixture === false)).toBe(true);
    expect(evidenceLineageItems
      .filter((item) => item.yangFanFixtureScope === 'fixture-owned')
      .map((item) => item.resourceId)
      .sort()).toEqual([...YANGFAN_FIXTURE_OWNED_RESOURCE_IDS].sort());
    expect(evidenceLineageEvidence).toContain('## Yang Fan Fixture Precondition');
    expect(evidenceLineageEvidence).toContain('Scoped blocker count: 0');
    expect(evidenceLineageEvidence).toContain(`Global limitation count: ${evidenceLineageSummary.yangFanFixtureBlockers.globalLimitationCount}`);
    expect(evidenceLineageEvidence).toContain('Scope policy: yangfan-fixture-readiness-scope.v1');
    expect(evidenceLineageEvidence).toContain('Raw learner payloads and raw resource bodies are not included.');
    expect(dispositionReviewItems.length).toBeGreaterThanOrEqual(rowsMissingFields.length);
    expect(dispositionReviewSummary.totals.reviewedResources).toBe(dispositionReviewItems.length);
    expect(dispositionReviewSummary.totals.unresolvedDispositionBlockers).toBe(unresolvedDispositionRows.length);
    expect(generatedProvisionalKnowledgeCardRows).toHaveLength(541);
    expect(new Set(unresolvedDispositionRows.map((item) => item.resourceId))).toEqual(
      new Set(generatedProvisionalKnowledgeCardRows.map((row) => row.resourceId)),
    );
    expect(dispositionReviewSummary.totals.privacyMinimized).toBe(true);
    expect(dispositionReviewSummary.totals.rawContentIncluded).toBe(false);
    expect(dispositionReviewSummary.byClassification['path-plannable']).toBeGreaterThan(0);
    expect(dispositionReviewSummary.byClassification['supporting-citation']).toBeGreaterThan(0);
    expect(dispositionReviewSummary.byClassification['embedded-asset']).toBeGreaterThan(0);
    expect(dispositionReviewSummary.downstreamBlockers['evidence-lineage']).toBeGreaterThan(0);
    expect(dispositionReviewSummary.downstreamBlockers['runtime-identity']).toBeGreaterThan(0);
    expect(dispositionReviewSummary.evidence.beforeResidualDispositionReview.queuedResources).toBe(rowsMissingFields.length);
    expect(dispositionReviewSummary.evidence.afterResidualDispositionReview).toMatchObject({
      reviewedResources: dispositionReviewItems.length,
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
    const unresolvedSemanticReviewIds = new Set(unresolvedSemanticReviewRows.map((row) => row.resourceId));
    expect(unresolvedSemanticReviewRows.length).toBeGreaterThanOrEqual(unresolvedDispositionRows.length);
    expect(unresolvedDispositionRows.every((item) => unresolvedSemanticReviewIds.has(item.resourceId))).toBe(true);
    expect(dispositionReviewItems
      .filter((item) => !item.reviewedLimitationState.includes('unresolved-residual-disposition-review'))
      .every((item) => item.reviewedLimitationState.includes('residual-disposition-reviewed'))).toBe(true);
    expect(independentlyReviewedDispositionRows.length).toBeGreaterThan(0);
    expect(reviewedLongformRows).toHaveLength(3082);
    expect(new Set(reviewedLongformRows.map((row) => row.coverage.sourceWindow.to))).toEqual(
      new Set(['2026-07-18T05:00:00.000Z']),
    );
    expect(reviewedLongformRows[0].coverage.sourceWindow.to).not.toBe(summary.generatedAt);
    expect(reviewedLongformRows.every((row) =>
      row.reviewStatus === 'agent-reviewed' &&
      row.reviewAudit.reviewerRole === 'implementing-agent' &&
      row.reviewAudit.reviewedSourceHash?.replace(/^sha256:/, '') === row.sourceHash?.replace(/^sha256:/, '') &&
      row.graphNodeRefs.knowledge.length === 0 &&
      row.graphNodeRefs.capability.length === 0 &&
      row.graphNodeRefs.quality.length === 0 &&
      row.pathEligibility.current === false
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
    expect(unresolvedDispositionRows.filter((item) => item.sourceFamily === 'runtime-handout')).toHaveLength(0);
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
    expect(reviewedKnowledgeCardRows).toHaveLength(274);
    expect(rereviewedKnowledgeCardRows.map((item) => item.resourceId).sort())
      .toEqual([...rereviewedKnowledgeCardResourceIds].sort());
    expect(rereviewedKnowledgeCardRows.every((item) =>
      item.reviewerId === 'core-registered-knowledge-resource-implementing-agent' &&
      item.reviewedAt === '2026-07-17T02:23:59.000Z'
    )).toBe(true);
    expect(rereviewedKnowledgeCardRows.every((item) => {
      const sourcePath = join(
        process.cwd(),
        'course-content/runtime/knowledge/cards/nodes',
        `${item.resourceId.replace('knowledge-card:', '')}.md`,
      );
      const actualHash = `sha256:${createHash('sha256')
        .update(readFileSync(sourcePath))
        .digest('hex')}`;
      return item.sourceHash === actualHash;
    })).toBe(true);
    expect(unchangedKnowledgeCardRows.every((item) =>
      item.reviewBatchId === 'residual-knowledge-card-disposition-review-2026-07-05' &&
      item.reviewerId === 'residual-knowledge-card-implementing-agent' &&
      item.reviewedAt === '2026-07-05T20:00:00.000Z'
    )).toBe(true);
    expect(reviewedKnowledgeCardRows.some((item) => item.resourceId === 'knowledge-card:Bode图_1_1')).toBe(false);
    expect(reviewedKnowledgeCardRows.some((item) => item.resourceId === 'knowledge-card:Bode首轮骨架_5_1e07d9da')).toBe(false);
    expect(reviewedKnowledgeCardRows.every((item) =>
      item.classification === 'evidence-producing' &&
      item.sourceHash?.startsWith('sha256:') &&
      item.currentPathEligible === false &&
      item.reviewedLimitationState.includes('residual-disposition-reviewed') &&
      !item.reviewedLimitationState.includes('unresolved-residual-disposition-review')
    )).toBe(true);
    expect(reviewedKnowledgeCardRows.every((item) => {
      if (rereviewedKnowledgeCardResourceIds.has(item.resourceId)) return true;
      const actualHash = `sha256:${createHash('sha256')
        .update(readFileSync(item.sourcePathOrUrl))
        .digest('hex')}`;
      return item.sourceHash === actualHash;
    })).toBe(true);
    const unresolvedKnowledgeCardRows = unresolvedDispositionRows
      .filter((item) => item.sourceFamily === 'knowledge-card');
    expect(unresolvedKnowledgeCardRows).toHaveLength(generatedProvisionalKnowledgeCardRows.length);
    expect(knowledgeVisualSemanticReviewSummary).toMatchObject({
      selectedCount: 4,
      remainingSelectedSemanticReview: 0,
      residualUnselectedCounts: {
        'knowledge-card': 18 + generatedProvisionalKnowledgeCardRows.length,
        'knowledge-infograph': 0,
      },
      byDisposition: {
        'path-plannable': 2,
        'embedded-asset': 2,
      },
    });
    expect(knowledgeVisualSemanticReviewSummary.selectedResourceIds).toEqual([
      'knowledge-card:Bode图_1_1',
      'infograph:Bode图_1_1',
      'knowledge-card:Bode首轮骨架_5_1e07d9da',
      'infograph:传统设计四联图校正_4_47004',
    ]);
    expect(knowledgeVisualSemanticReviewItems.every((item) =>
      item.graphNodeIds.length > 0 &&
      item.learningGoalIds.length > 0 &&
      item.knowledgeObjectiveIds.length > 0 &&
      item.capabilityObjectiveIds.length > 0 &&
      item.qualityObjectiveIds.length > 0 &&
      item.sourceHash?.startsWith('sha256:') &&
      item.rawContentIncluded === false &&
      item.privacyMinimized === true
    )).toBe(true);
    expect(reviewedAuthoringTextbookFigureDispositionRows).toHaveLength(535);
    expect(reviewedAuthoringTextbookFigureDispositionRows.every((item) =>
      item.classification === 'embedded-asset' &&
      /^sha256:[0-9a-f]{64}$/.test(item.sourceHash ?? '') &&
      item.currentPathEligible === false &&
      item.reviewedLimitationState.includes('residual-disposition-reviewed') &&
      !item.reviewedLimitationState.includes('unresolved-residual-disposition-review')
    )).toBe(true);
    expect(reviewedAuthoringTextbookFigureDispositionRows.every((item) => {
      const actualHash = createHash('sha256')
        .update(readFileSync(item.sourcePathOrUrl))
        .digest('hex');
      return item.sourceHash === `sha256:${actualHash}`;
    })).toBe(true);
    expect(unresolvedDispositionRows.some((item) => item.sourceFamily === 'authoring-textbook-figure')).toBe(false);
    expect(reviewedAuthoringTextbookCaptionDispositionRows).toHaveLength(535);
    expect(reviewedAuthoringTextbookCaptionDispositionRows.every((item) =>
      (item.classification === 'supporting-citation' || item.classification === 'excluded-with-rationale') &&
      /^sha256:[0-9a-f]{64}$|^[0-9a-f]{64}$/.test(item.sourceHash ?? '') &&
      item.currentPathEligible === false &&
      item.reviewedLimitationState.includes('residual-disposition-reviewed') &&
      !item.reviewedLimitationState.includes('unresolved-residual-disposition-review')
    )).toBe(true);
    expect(reviewedAuthoringTextbookCaptionDispositionRows.filter((item) =>
      item.classification === 'excluded-with-rationale'
    )).toHaveLength(180);
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
    expect(reviewedRuntimeLessonStepRows.every((item) =>
      existsSync(item.sourcePathOrUrl) && /^sha256:[0-9a-f]{64}$/.test(item.sourceHash ?? '')
    )).toBe(true);
    const unresolvedRuntimeLessonStepRows = unresolvedDispositionRows
      .filter((item) => item.sourceFamily === 'runtime-lesson-step');
    expect(unresolvedRuntimeLessonStepRows).toHaveLength(0);
    expect(reviewedRuntimeLessonModuleRows).toHaveLength(1352);
    expect(reviewedRuntimeLessonModuleRows.every((item) =>
      item.classification === 'excluded-with-rationale' &&
      item.sourceHash?.startsWith('sha256:') &&
      item.currentPathEligible === false &&
      item.reviewedLimitationState.includes('residual-disposition-reviewed') &&
      !item.reviewedLimitationState.includes('unresolved-residual-disposition-review')
    )).toBe(true);
    expect(reviewedRuntimeLessonModuleRows.every((item) =>
      existsSync(item.sourcePathOrUrl) && /^sha256:[0-9a-f]{64}$/.test(item.sourceHash ?? '')
    )).toBe(true);
    const unresolvedRuntimeLessonModuleRows = unresolvedDispositionRows
      .filter((item) => item.sourceFamily === 'runtime-lesson-module');
    expect(unresolvedRuntimeLessonModuleRows).toHaveLength(0);
    expect(unresolvedRuntimeLessonModuleRows.every((item) => item.changeScope === 'out-of-scope-existing')).toBe(true);
    expect(reviewedRuntimeLessonMediaRows).toHaveLength(740);
    expect(reviewedRuntimeLessonMediaRows.every((item) =>
      ['embedded-asset', 'path-plannable'].includes(item.classification) &&
      item.reviewedLimitationState.includes('residual-disposition-reviewed') &&
      !item.reviewedLimitationState.includes('unresolved-residual-disposition-review')
    )).toBe(true);
    expect(reviewedRuntimeLessonMediaRows
      .filter((item) => item.sourceHash?.startsWith('sha256:'))
      .every((item) => existsSync(item.sourcePathOrUrl) && /^sha256:[0-9a-f]{64}$/.test(item.sourceHash))
    ).toBe(true);
    expect(reviewedRuntimeLessonMediaRows
      .filter((item) => item.sourceHash === null)
      .every((item) =>
        item.originalMissingFieldCodes.includes('missing-content-hash') &&
        item.reviewedLimitationState.includes('downstream-runtime-identity-blocker')
      )).toBe(true);
    const unresolvedRuntimeLessonMediaRows = unresolvedDispositionRows
      .filter((item) => item.sourceFamily === 'runtime-lesson-media');
    expect(unresolvedRuntimeLessonMediaRows).toHaveLength(0);
    const unit14LoopBodeAuditRow = jsonlRows.find((row) =>
      row.resourceId === 'runtime-media:1-4:1-4-fig-03b-loop-k8-bode.png'
    );
    const unit14ContentClearance = JSON.parse(readFileSync(
      join(process.cwd(), 'course-content/runtime/lessons/1-4/review/content-clearance.json'),
      'utf8',
    )) as {
      batch: string;
      review_status: string;
      independent_evidence_ref: string;
      reviewed_resources: Array<{
        resourceId: string;
        sourceHash: string;
        currentPathEligible: boolean;
      }>;
    };
    const unit14LoopBodeClearance = unit14ContentClearance.reviewed_resources.find((resource) =>
      resource.resourceId === 'runtime-media:1-4:1-4-fig-03b-loop-k8-bode.png'
    );
    expect(unit14LoopBodeAuditRow).toMatchObject({
      family: 'runtime-lesson-media',
      sourceHash: 'sha256:23f817e9487bcbcbbd892e16695bf5c0e1401ce8908a8639708a89621d4773c5',
      reviewStatus: 'model-cleared',
      pathEligibility: expect.objectContaining({ current: false }),
      reviewAudit: expect.objectContaining({
        reviewBatchId: unit14ContentClearance.batch,
        independentEvidenceRef: unit14ContentClearance.independent_evidence_ref,
      }),
    });
    expect(unit14ContentClearance.review_status).toBe('model-cleared');
    expect(unit14LoopBodeClearance).toMatchObject({
      sourceHash: 'sha256:23f817e9487bcbcbbd892e16695bf5c0e1401ce8908a8639708a89621d4773c5',
      currentPathEligible: false,
    });
    expect(reviewedRegisteredResourceRows).toHaveLength(166);
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
    expect(dispositionReviewEvidence).toContain(`After reviewed resources: ${dispositionReviewItems.length}`);
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
        unaccountedCount: generatedProvisionalKnowledgeCardRows.length,
        unreviewedSemanticCount: generatedProvisionalKnowledgeCardRows.length,
        unresolvedDownstreamPathBlockers: generatedProvisionalKnowledgeCardRows.length * 2,
        evidenceLineageBlockerCount: 0,
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
    expect(fullResourcePathReadinessGate.findings.map((finding: { id: string }) => finding.id)).toEqual(expect.arrayContaining([
      'yang-fan-fixture-limited-coverage',
      'learning-goal-path-generation-reviewed-blockers',
      'learning-goal-baseline-limited',
      'resource-type-audit-missing',
    ]));
    expect(fullResourcePathReadinessGate.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'resource-type-audit-missing',
        severity: 'warning',
      }),
    ]));
    expect(fullResourcePathReadinessEvidence).toContain('# Full Resource Path Readiness Gate');
    expect(fullResourcePathReadinessEvidence).toContain('Missing diagnostics: none');
    expect(fullResourcePathReadinessEvidence).toContain('frequency-response-foundations: limited');
    expect(fullResourcePathReadinessEvidence).toContain('Attempted path generations: 9');
    expect(fullResourcePathReadinessEvidence).toContain(
      `Unresolved downstream path blockers: ${generatedProvisionalKnowledgeCardRows.length * 2}`
    );
    expect(fullResourcePathReadinessEvidence).toContain('Resource mix not evaluated: 9');
    expect(fullResourcePathReadinessEvidence).toContain('Citation metadata not evaluated: 9');
    const knowledgeCardRows = jsonlRows.filter((row) => row.family === 'knowledge-card');
    const cardFiles = execFileSync('git', [
      '-c',
      'core.quotepath=false',
      'ls-tree',
      '-r',
      '--name-only',
      'HEAD',
      '--',
      'course-content/runtime/knowledge/cards/nodes',
    ], { cwd: process.cwd(), encoding: 'utf8' })
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((file) => file.split('/').at(-1) as string)
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

    const cardSourceRecords = new Set(cardFiles.map((file) => file.replace(/\.md$/, '')));
    expect(knowledgeCardRows.length).toBeGreaterThan(0);
    expect(knowledgeCardRows.every((row) => cardSourceRecords.has(row.sourceRecord))).toBe(true);
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
      if ([
        'knowledge-card:Bode图_1_1',
        'knowledge-card:Bode首轮骨架_5_1e07d9da',
      ].includes(row.resourceId)) {
        expect(row.pathEligibility.afterCompletion).toBe(true);
        expect(row.pathEligibility.current).toBe(true);
        expect(row.pathEligibility.masteryAffecting).toBe(false);
      } else {
        expect(row.pathEligibility.afterCompletion).toBe(false);
      }
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

  it('rejects runtime projection reviews with synthetic batches or invalid timestamps', () => {
    const validReview = {
      status: 'human-confirmed',
      reviewerId: 'reviewer-a',
      reviewerRole: 'resource-governance-reviewer',
      reviewedAt: '2026-06-21T00:00:00.000Z',
      reviewBatchId: 'review-batch-a',
      reviewerVisibleRationale: 'The current projection was independently reviewed.',
      independentEvidenceRef: 'review-source#a',
    };
    const generatedAt = '2026-06-22T00:00:00.000Z';

    expect(isRuntimeProjectionReviewAuditUsable(validReview, generatedAt)).toBe(true);
    expect(isRuntimeProjectionReviewAuditUsable({ ...validReview, reviewBatchId: null }, generatedAt)).toBe(false);
    expect(isRuntimeProjectionReviewAuditUsable({ ...validReview, reviewedAt: 'not-a-date' }, generatedAt)).toBe(false);
    expect(isRuntimeProjectionReviewAuditUsable({ ...validReview, reviewedAt: '2026-06-23T00:00:00.000Z' }, generatedAt)).toBe(false);
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

  it('downgrades human-confirmed rows when reviewed source hash is stale', () => {
    const result = buildResourceFieldCompletionAudit({
      registry: buildResourceNodeRegistry({}),
      generatedAt: '2026-06-22T00:00:00.000Z',
      candidates: [{
        id: 'knowledge-card:stale-source-review',
        title: 'Stale source review',
        family: 'knowledge-card',
        sourcePathOrUrl: 'course-content/runtime/knowledge/cards/nodes/stale-source-review.md',
        sourceRecord: 'stale-source-review',
        knowledgeNodeIds: ['Bode图_1_1'],
        capabilityTargetIds: ['capability:autocontrol:interpret-time-frequency-response'],
        segmentRefs: ['stale-source-review'],
        citationTargets: ['course-content/runtime/knowledge/cards/nodes/stale-source-review.md'],
        pathTarget: '/knowledge?node=stale-source-review',
        estimatedTimeMinutes: 4,
        evidenceInstrumentation: ['knowledge_card_open'],
        privacyScope: 'student-visible',
        contentHash: 'sha256:current-source',
        versionRef: 'runtime-knowledge-card.v1',
        generatedBy: 'template',
        humanConfirmed: true,
        currentPathEligible: true,
        reviewEvidence: {
          reviewerId: 'knowledge-card-reviewer',
          reviewerRole: 'curriculum-data-governance',
          reviewedAt: '2026-07-03T00:00:00.000Z',
          reviewBatchId: 'knowledge-card-review-batch',
          reviewerVisibleRationale: 'The stale source hash must invalidate this review.',
          independentEvidenceRef: 'review-packet:knowledge-card-stale-source-review',
          reviewedSourceHash: 'sha256:previous-source',
          reviewedVersionRef: 'runtime-knowledge-card.v1',
          promptOrManifestHash: 'sha256:knowledge-card-review',
        },
      }],
    });

    expect(result.rows[0]).toMatchObject({
      sourceHash: 'sha256:current-source',
      reviewStatus: 'stale',
      missingFieldCodes: expect.arrayContaining([
        'missing-human-review',
        'stale-review',
        'provisional-metadata',
      ]),
      pathEligibility: {
        current: false,
        afterCompletion: false,
        masteryAffecting: false,
      },
    });
  });

  it('downgrades knowledge visual reviews when reviewed source hash is missing', () => {
    const result = buildResourceFieldCompletionAudit({
      registry: buildResourceNodeRegistry({}),
      generatedAt: '2026-06-22T00:00:00.000Z',
      candidates: [{
        id: 'knowledge-card:missing-source-review-hash',
        title: 'Missing source review hash',
        family: 'knowledge-card',
        sourcePathOrUrl: 'course-content/runtime/knowledge/cards/nodes/missing-source-review-hash.md',
        sourceRecord: 'missing-source-review-hash',
        knowledgeNodeIds: ['Bode图_1_1'],
        capabilityTargetIds: ['capability:autocontrol:interpret-time-frequency-response'],
        segmentRefs: ['missing-source-review-hash'],
        citationTargets: ['course-content/runtime/knowledge/cards/nodes/missing-source-review-hash.md'],
        pathTarget: '/knowledge?node=missing-source-review-hash',
        estimatedTimeMinutes: 4,
        evidenceInstrumentation: ['knowledge_card_open'],
        privacyScope: 'student-visible',
        contentHash: 'sha256:current-source',
        versionRef: 'runtime-knowledge-card.v1',
        generatedBy: 'template',
        humanConfirmed: true,
        currentPathEligible: true,
        reviewEvidence: {
          reviewerId: 'knowledge-card-reviewer',
          reviewerRole: 'curriculum-data-governance',
          reviewedAt: '2026-07-03T00:00:00.000Z',
          reviewBatchId: 'knowledge-card-review-batch',
          reviewerVisibleRationale: 'Knowledge visual review must carry the independently reviewed source hash.',
          independentEvidenceRef: 'review-packet:knowledge-card-missing-source-review-hash',
          reviewedVersionRef: 'runtime-knowledge-card.v1',
          promptOrManifestHash: 'sha256:knowledge-card-review',
        },
      }],
    });

    expect(result.rows[0]).toMatchObject({
      sourceHash: 'sha256:current-source',
      reviewStatus: 'stale',
      missingFieldCodes: expect.arrayContaining([
        'missing-human-review',
        'stale-review',
        'provisional-metadata',
      ]),
      pathEligibility: {
        current: false,
        afterCompletion: false,
        masteryAffecting: false,
      },
    });
  });

  it('downgrades knowledge visual reviews when reviewed version ref is stale', () => {
    const result = buildResourceFieldCompletionAudit({
      registry: buildResourceNodeRegistry({}),
      generatedAt: '2026-06-22T00:00:00.000Z',
      candidates: [{
        id: 'knowledge-card:stale-version-review',
        title: 'Stale version review',
        family: 'knowledge-card',
        sourcePathOrUrl: 'course-content/runtime/knowledge/cards/nodes/stale-version-review.md',
        sourceRecord: 'stale-version-review',
        knowledgeNodeIds: ['Bode图_1_1'],
        capabilityTargetIds: ['capability:autocontrol:interpret-time-frequency-response'],
        segmentRefs: ['stale-version-review'],
        citationTargets: ['course-content/runtime/knowledge/cards/nodes/stale-version-review.md'],
        pathTarget: '/knowledge?node=stale-version-review',
        estimatedTimeMinutes: 4,
        evidenceInstrumentation: ['knowledge_card_open'],
        privacyScope: 'student-visible',
        contentHash: 'sha256:current-source',
        versionRef: 'runtime-knowledge-card.v2',
        generatedBy: 'template',
        humanConfirmed: true,
        currentPathEligible: true,
        reviewEvidence: {
          reviewerId: 'knowledge-card-reviewer',
          reviewerRole: 'curriculum-data-governance',
          reviewedAt: '2026-07-03T00:00:00.000Z',
          reviewBatchId: 'knowledge-card-review-batch',
          reviewerVisibleRationale: 'The stale reviewed version must invalidate this review.',
          independentEvidenceRef: 'review-packet:knowledge-card-stale-version-review',
          reviewedSourceHash: 'sha256:current-source',
          reviewedVersionRef: 'runtime-knowledge-card.v1',
          promptOrManifestHash: 'sha256:knowledge-card-review',
        },
      }],
    });

    expect(result.rows[0]).toMatchObject({
      sourceVersionRef: 'runtime-knowledge-card.v2',
      reviewAudit: {
        reviewedVersionRef: 'runtime-knowledge-card.v1',
      },
      reviewStatus: 'stale',
      missingFieldCodes: expect.arrayContaining([
        'missing-human-review',
        'stale-review',
        'provisional-metadata',
      ]),
      pathEligibility: {
        current: false,
        afterCompletion: false,
        masteryAffecting: false,
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
        evidenceLineageBlockers: 1,
        readyRows: 1,
      },
      evidenceLineageBlockerCount: 1,
      findingCounts: {
        'missing-evidence-contract': 1,
        'missing-evidence-instrumentation': 1,
      },
      followupBuckets: {
        'complete-evidence-lineage-bindings': 1,
      },
      yangFanFixtureBlockers: {
        blocked: false,
        blockerCount: 0,
        scopedBlockerCount: 0,
        globalLimitationCount: 1,
      },
    });
    expect(result.evidenceLineage.summary.contractFieldGaps).toMatchObject({
      eventType: 1,
      clientEventIdPolicy: 1,
      attemptKey: 1,
      sourceLogId: 1,
      timestamps: 1,
      learningFactPolicy: 1,
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
    expect(canDowngradeEvidenceLineageBlockerWithDisposition(result.evidenceLineage.items[0]!)).toBe(true);
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
      blockerCount: 1,
      scopedBlockerCount: 1,
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
      .toBe(1);
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
    expect(canDowngradeEvidenceLineageBlockerWithDisposition(itemRefBlocker!)).toBe(false);
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
      evidenceEffectState: 'ready',
      blocksYangFanFixture: false,
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
          reviewedVersionRef: 'runtime-knowledge-card.v1',
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
    expect(result.rows[0].pathEligibility.masteryAffecting).toBe(false);
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
    )) as LearningGoalResourceBaselineArtifacts['matrix'];
    const limitations = JSON.parse(readFileSync(
      join(process.cwd(), 'course-content/runtime/resource-governance/learning-goal-resource-baseline-limitations.json'),
      'utf8',
    )) as LearningGoalResourceBaselineArtifacts['limitations'];
    const reviewedBindings = readFileSync(
      join(process.cwd(), 'course-content/runtime/resource-governance/learning-goal-resource-baseline-reviewed-bindings.jsonl'),
      'utf8',
    )
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line) as LearningGoalResourceBaselineArtifacts['reviewedBindings'][number]);
    const reviewedBindingIds = new Set(reviewedBindings.map((row) => row.bindingId));
    const auditRows = readFileSync(
      join(process.cwd(), 'course-content/runtime/resource-governance/resource-field-completion-audit.jsonl'),
      'utf8',
    )
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line) as ResourceFieldCompletionAuditRow);
    const auditRowById = new Map(auditRows.map((row) => [row.resourceId, row]));
    const expectedLearningGoalIds = Object.values(ADAPTIVE_LEARNING_GOAL_DEFINITIONS)
      .map((definition) => definition.learningGoal!.id);
    const baselineRowFor = (learningGoalId: string): LearningGoalResourceBaselineArtifacts['matrix']['rows'][number] => {
      const row = matrix.rows.find((item) => item.learningGoalId === learningGoalId);
      if (!row) {
        throw new Error(`Missing LearningGoal baseline row: ${learningGoalId}`);
      }
      return row;
    };

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
      'frequency-response-foundations',
      'root-locus-analysis-foundations',
      'ship-ocean-transfer-application',
      'stability-margin-frequency-analysis',
    ]));
    expect(auditRowById.get('runtime-step:1-1:step-09')).toMatchObject({
      reviewStatus: 'stale',
      pathEligibility: {
        current: false,
        masteryAffecting: false,
      },
    });
    for (const goalId of [
      'feedback-loop-concept-foundations',
      'transfer-function-modeling-foundations',
      'time-domain-response-analysis',
    ]) {
      const row = baselineRowFor(goalId);
      expect(row.categories.concept.pathEligible).toBe(0);
      expect(row.categories.citation.pathEligible).toBe(0);
      expect(row.categories.diagnostic.pathEligible).toBe(0);
      expect(row.categories.practice.pathEligible).toBe(0);
      expect(row.categories.checkpoint.pathEligible).toBe(0);
      expect(row.categories.remediation.pathEligible).toBe(0);
      expect(row.missingBaselineCategories).toEqual([
        'concept',
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
      const row = baselineRowFor(goalId);
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
    const simulationValidationRow = baselineRowFor('simulation-validation-practice');
    expect(simulationValidationRow.categories.concept.pathEligible).toBe(0);
    expect(simulationValidationRow.categories.concept.pathEligibleResourceIds).toEqual([]);
    expect(simulationValidationRow.categories.citation.pathEligible).toBe(0);
    expect(simulationValidationRow.categories.citation.pathEligibleResourceIds).toEqual([]);
    expect(simulationValidationRow.categories.practice.pathEligible).toBe(0);
    expect(simulationValidationRow.categories.practice.highComplexityLocked).toBeGreaterThan(0);
    expect(simulationValidationRow.categories['terminal-validation'].pathEligible).toBe(0);
    expect(simulationValidationRow.categories['terminal-validation'].highComplexityLocked).toBeGreaterThan(0);
    expect(simulationValidationRow.missingBaselineCategories).toEqual([
      'concept',
      'diagnostic',
      'practice',
      'checkpoint',
      'remediation',
      'terminal-validation',
    ]);
    const shipOceanTransferRow = baselineRowFor('ship-ocean-transfer-application');
    expect(shipOceanTransferRow.categories.concept.pathEligible).toBe(0);
    expect(shipOceanTransferRow.categories.concept.pathEligibleResourceIds).toEqual([]);
    expect(shipOceanTransferRow.categories.citation.pathEligible).toBe(1);
    expect(shipOceanTransferRow.categories.citation.pathEligibleResourceIds).toEqual([
      'arena-task:task-cruise-roll-blackbox-identification',
    ]);
    expect(shipOceanTransferRow.categories.practice.pathEligible).toBe(1);
    expect(shipOceanTransferRow.categories.practice.highComplexityLocked).toBeGreaterThan(0);
    expect(shipOceanTransferRow.categories['terminal-validation'].pathEligible).toBe(1);
    expect(shipOceanTransferRow.categories['terminal-validation'].highComplexityLocked).toBeGreaterThan(0);
    expect(shipOceanTransferRow.missingBaselineCategories).toEqual([
      'concept',
      'diagnostic',
      'checkpoint',
      'remediation',
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
      for (const category of Object.values(row.categories) as LearningGoalResourceBaselineCategorySummary[]) {
        expect(category.pathEligible).toBeLessThanOrEqual(category.humanConfirmed);
        expect(category.pathEligibleResourceIds.filter((id) => category.provisionalResourceIds.includes(id))).toEqual([]);
      }
    }
    for (const binding of reviewedBindings) {
      const auditRow = auditRowById.get(binding.resourceId);
      expect(auditRow).toBeDefined();
      if (!auditRow) {
        throw new Error(`Missing resource field completion audit row: ${binding.resourceId}`);
      }
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
        reviewerId: auditRow.reviewAudit.reviewerId,
        reviewerRole: auditRow.reviewAudit.reviewerRole,
        reviewedAt: auditRow.reviewAudit.reviewedAt,
        reviewBatchId: auditRow.reviewAudit.reviewBatchId,
        reviewedSourceHash: auditRow.reviewAudit.reviewedSourceHash,
        reviewedVersionRef: auditRow.reviewAudit.reviewedVersionRef,
      });
    }
    const regeneratedFromCurrentAudit = buildLearningGoalResourceBaselineArtifacts({
      registeredGoals: ADAPTIVE_LEARNING_GOAL_DEFINITIONS,
      auditRows,
      generatedAt: matrix.generatedAt,
      sourceWindow: matrix.sourceWindow,
    });
    const regeneratedSimulationValidationRow = regeneratedFromCurrentAudit.matrix.rows.find((row) => (
      row.learningGoalId === 'simulation-validation-practice'
    ));
    expect(regeneratedSimulationValidationRow?.categories.concept.pathEligibleResourceIds).toEqual([]);
    expect(regeneratedSimulationValidationRow?.categories.concept.pathEligible).toBe(0);
    expect(regeneratedSimulationValidationRow?.categories.citation.pathEligibleResourceIds).toEqual([]);
    expect(regeneratedSimulationValidationRow?.categories.citation.pathEligible).toBe(0);
    const explicitlyNonPromotedRuntimeSteps = [
      'runtime-step:4-7:step-05',
      'runtime-step:4-7:step-06',
      'runtime-step:4-7:step-07',
      'runtime-step:4-7:step-08',
      'runtime-step:4-7:step-09',
      'runtime-step:4-7:step-10',
    ];
    for (const resourceId of explicitlyNonPromotedRuntimeSteps) {
      expect(auditRowById.get(resourceId)?.pathEligibility.current).toBe(false);
      expect(regeneratedSimulationValidationRow?.categories.concept.pathEligibleResourceIds).not.toContain(resourceId);
      expect(regeneratedSimulationValidationRow?.categories.citation.pathEligibleResourceIds).not.toContain(resourceId);
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
      learningGoalBlockerReviews: [{
        learningGoalId: 'goal-a',
        blockingReasons: ['different-blocker'],
        limitationReason: 'different-limitation',
        reviewerId: 'reviewer-a',
        reviewedAt: '2026-06-23T00:00:00.000Z',
        reviewBatchId: 'batch-a',
        sourceEvidenceRefs: ['evidence-a'],
        independentEvidenceRef: 'evidence-a#goal-a',
        reviewerVisibleRationale: 'The registered blocker was independently checked.',
      }],
      pathGenerationDiagnostics: [{
        learningGoalId: 'goal-a',
        attempted: true,
        generationStatus: 'blocked',
        fallbackReasons: [],
        blockingReasons: ['resource-mapping-insufficient'],
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
      'learning-goal-path-generation-blocked',
      'single-resource-fallback-risk',
      'single-family-fallback-risk',
      'learning-goal-citation-failures',
      'resource-family-audit-missing',
    ]));
  });

  it('rejects LearningGoal blocker reviews with invalid evidence, provenance, or time', () => {
    const learningGoalId = 'goal-a';
    const diagnostic = {
      learningGoalId,
      attempted: true,
      generationStatus: 'blocked' as const,
      fallbackReasons: [],
      blockingReasons: ['resource-mapping-insufficient'],
      selectedResourceIds: [],
      selectedResourceTypes: [],
      resourceCount: 0,
      resourceTypeCount: 0,
      unreviewedSelectedResourceIds: [],
      missingCitationMetadataResourceIds: [],
    };
    const baselineEvidenceRef = `course-content/runtime/resource-governance/learning-goal-resource-baseline-limitations.json#learningGoalId=${learningGoalId}`;
    const assessmentEvidenceRef = `course-content/runtime/resource-governance/learning-goal-assessment-coverage-matrix.json#learningGoalId=${learningGoalId}`;
    const validReview = {
      learningGoalId,
      blockingReasons: [...diagnostic.blockingReasons],
      limitationReason: 'missing-baseline-categories:practice',
      reviewerId: 'codex:issue-884-learning-goal-blocker-review',
      reviewedAt: '2026-06-23T00:00:00.000Z',
      reviewBatchId: 'full-resource-learning-goal-blocker-review-884.v1',
      sourceEvidenceRefs: [baselineEvidenceRef, assessmentEvidenceRef],
      independentEvidenceRef: assessmentEvidenceRef,
      reviewerVisibleRationale: 'The registered blocker was independently checked.',
    };
    const validate = (review: typeof validReview) => validateLearningGoalBlockerReviews({
      reviews: [review],
      diagnostics: [diagnostic],
      baselineByLearningGoalId: new Map([[learningGoalId, { limitationReason: validReview.limitationReason }]]),
      generatedAt: '2026-06-24T00:00:00.000Z',
    });

    expect(validate(validReview)).toEqual(new Set([learningGoalId]));
    expect(validate({ ...validReview, independentEvidenceRef: 'missing.json#goal-a' })).toEqual(new Set());
    expect(validate({ ...validReview, reviewerId: 'system-governed' })).toEqual(new Set());
    expect(validate({ ...validReview, reviewedAt: '2026-06-25T00:00:00.000Z' })).toEqual(new Set());
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
          terminalNodeTypes: ADAPTIVE_LEARNING_GOAL_DEFINITIONS['control-correction'].learningGoal!
            .terminalValidationPolicy.terminalNodeTypes.filter((type) => type === 'simulation'),
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
          "agentReviewed": 0,
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
          "reviewConcluded": 0,
          "sampleLimitations": [
            "registry:ready-bode: missing fields: missing-content-hash",
            "runtime-step:3-5:step-01: missing fields: missing-capability-target, missing-citation-target, missing-content-hash, missing-evidence-contract, missing-human-review, missing-knowledge-binding, missing-path-profile",
          ],
          "semanticReviewed": 0,
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
    agentReviewed: 0,
    reviewConcluded: 0,
    semanticReviewed: 0,
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
    reviewConcluded: false,
    semanticConfirmed: false,
    reviewAudit: {
      reviewerId: null,
      reviewerRole: null,
      reviewedAt: null,
      reviewBatchId: null,
      reviewedSourceHash: null,
      reviewedVersionRef: null,
      generationToolOrModel: null,
      promptOrManifestHash: null,
      reviewerVisibleRationale: null,
      independentEvidenceRef: null,
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
      learningFactMaterializationPolicy: 'materialized-learning-fact',
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
