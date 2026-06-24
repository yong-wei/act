import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { buildGraphCenterPayload } from '../data-governance/graph-center';
import { ADAPTIVE_LEARNING_GOAL_DEFINITIONS } from '../adaptive-learning-path-planner';
import {
  buildLearningGoalResourceBaselineArtifacts,
  FIRST_BATCH_LEARNING_GOAL_IDS,
  LEARNING_GOAL_RESOURCE_BASELINE_VERSION,
} from '../learning-goal-resource-baseline';
import {
  buildResourceFieldCompletionAudit,
  RESOURCE_FIELD_COMPLETION_AUDIT_VERSION,
  type ResourceFieldCompletionCoverageSummary,
  type ResourceFieldCompletionAuditRow,
} from '../resource-field-completion-audit';
import { buildKaqArtifactVersionRefs } from '../kaq-artifact-versioning';
import { buildResourceNodeRegistry } from '../resource-node-registry';

describe('resource field completion audit', () => {
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
      reviewStatus: 'human-confirmed',
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
      reviewStatus: 'human-confirmed',
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
      }],
    });

    expect(result.rows[0]).toMatchObject({
      sourceHash: 'sha256:confirmed',
      sourceVersionRef: 'external-resource.v1',
      completionMethod: 'already-governed',
      reviewStatus: 'human-confirmed',
      reviewAudit: {
        reviewedSourceHash: 'sha256:confirmed',
        reviewedVersionRef: 'external-resource.v1',
        reviewedAt: '2026-06-22T00:00:00.000Z',
        reviewBatchId: 'external-resource.v1',
        generationToolOrModel: 'local-model',
      },
      evidenceContract: {
        complete: true,
        privacyScope: true,
      },
      pathEligibility: {
        afterCompletion: true,
        masteryAffecting: true,
        blockedBy: [],
      },
    });
    expect(result.rows[0].missingFieldCodes).not.toContain('provisional-metadata');
    expect(result.rows[0].pathEligibility.blockedBy).not.toContain('provisional-metadata');
    expect(result.rows[0].missingFieldCodes).not.toContain('missing-evidence-contract');
  });

  it('materializes LearningGoal baseline artifacts for the fixed first batch', () => {
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

    expect(matrix.artifactVersion).toBe(LEARNING_GOAL_RESOURCE_BASELINE_VERSION);
    expect(matrix.batchLearningGoalIds).toEqual([...FIRST_BATCH_LEARNING_GOAL_IDS]);
    expect(matrix.rows.map((row) => row.learningGoalId)).toEqual([...FIRST_BATCH_LEARNING_GOAL_IDS]);
    expect(matrix.rows).toHaveLength(9);
    expect(matrix.totals.reviewedBindings).toBe(reviewedBindings.length);
    expect(matrix.totals.limited).toBe(9);
    expect(reviewedBindings.length).toBe(0);
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
    expect(limitations.totals.learningGoals).toBe(9);
    expect(limitations.totals.limited).toBe(9);
    expect(limitations.limitations.every((item) => item.severity === 'blocking')).toBe(true);
    expect(limitations.limitations.every((item) => item.studentSafeReason && !item.studentSafeReason.includes('internal'))).toBe(true);
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
    const result = buildLearningGoalResourceBaselineArtifacts({
      registeredGoals: ADAPTIVE_LEARNING_GOAL_DEFINITIONS,
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
      ],
    });
    const row = result.matrix.rows.find((item) => item.learningGoalId === 'frequency-response-foundations')!;
    const limitation = result.limitations.limitations.find((item) =>
      item.learningGoalId === 'frequency-response-foundations'
    )!;

    expect(row.categories.practice.resourceIds).toEqual([
      'quiz:frequency-practice-ready',
      'simulation:frequency-practice-locked',
    ]);
    expect(row.categories.practice.highComplexityLocked).toBe(1);
    expect(row.categories.practice.highComplexityLockedResourceIds).toEqual([
      'simulation:frequency-practice-locked',
    ]);
    expect(limitation.blockedHighComplexityResourceIds).toEqual([
      'simulation:frequency-practice-locked',
    ]);
  });

  it('does not count checkpoint rows as terminal validation unless the LearningGoal policy accepts checkpoints', () => {
    const result = buildLearningGoalResourceBaselineArtifacts({
      registeredGoals: ADAPTIVE_LEARNING_GOAL_DEFINITIONS,
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
