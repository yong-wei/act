import { describe, expect, it } from 'vitest';

import {
  buildRuntimeResourceProjectionArtifacts,
  RUNTIME_RESOURCE_PROJECTION_ARTIFACT_VERSION,
} from '../runtime-resource-projections';
import { buildResourceFieldCompletionAudit } from '../resource-field-completion-audit';
import {
  buildResourceNodeRegistry,
  type RuntimeResourceProjectionSemanticEvidence,
} from '../resource-node-registry';

describe('runtime resource projections', () => {
  it('builds sidecar rows for runtime lessons, knowledge cards, and infographs', () => {
    const audit = buildResourceFieldCompletionAudit({
      registry: buildResourceNodeRegistry({}),
      generatedAt: '2026-06-22T00:00:00.000Z',
      candidates: [
        {
          id: 'runtime-step:unit-demo:step-1',
          title: 'Runtime step',
          family: 'runtime-lesson-step',
          sourcePathOrUrl: 'course-content/runtime/lessons/unit-demo/interactive-manifest.json',
          sourceRecord: 'unit-demo:step-1',
          knowledgeNodeIds: ['kn-demo'],
          capabilityTargetIds: ['controlModeling'],
          segmentRefs: ['step-1'],
          citationTargets: ['course-content/runtime/lessons/unit-demo/interactive-manifest.json'],
          pathTarget: '/interactive-learning/courses/unit-demo/student/demo?step=step-1',
          estimatedTimeMinutes: 8,
          evidenceInstrumentation: ['lesson_step_view'],
          privacyScope: 'student-visible',
          contentHash: 'sha256:step',
          versionRef: 'interactive-manifest.v2',
          humanConfirmed: true,
          reviewEvidence: {
            reviewerId: 'teacher-reviewer-1',
            reviewerRole: 'curriculum-data-governance',
            reviewedAt: '2026-07-03T00:00:00.000Z',
            reviewBatchId: 'review-batch-1',
            reviewerVisibleRationale: 'Teacher verified graph fit and path eligibility against the runtime source.',
            independentEvidenceRef: 'review-packet:runtime-step-1',
            reviewedSourceHash: 'sha256:step',
          },
          readiness: {
            minimumCompetency: {
              controlModeling: 0.2,
            },
            minimumEvidenceCount: 1,
            requiredCompletedNodeIds: [],
            requiredOutcomeRefs: [],
            unlockMessage: '完成本单元前序学习证据后进入该步骤。',
            fallbackNodeIds: [],
          },
        },
        {
          id: 'runtime-module:unit-demo:step-1:figure',
          title: 'Runtime figure module',
          family: 'runtime-lesson-module',
          sourcePathOrUrl: 'course-content/runtime/lessons/unit-demo/interactive-manifest.json',
          sourceRecord: 'unit-demo:step-1:figure',
          knowledgeNodeIds: ['kn-demo'],
          segmentRefs: ['step-1', 'figure'],
          citationTargets: [],
          pathTarget: null,
          evidenceInstrumentation: [],
          privacyScope: 'student-visible',
          contentHash: 'sha256:step',
          versionRef: 'interactive-manifest.v2',
          generatedBy: 'template',
          humanConfirmed: false,
        },
        {
          id: 'runtime-media:unit-demo:figure.png',
          title: 'Runtime figure',
          family: 'runtime-lesson-media',
          sourcePathOrUrl: 'course-content/runtime/lessons/unit-demo/media/figure.png',
          sourceRecord: 'unit-demo:figure.png',
          knowledgeNodeIds: ['kn-demo'],
          segmentRefs: ['figure.png'],
          citationTargets: ['course-content/runtime/lessons/unit-demo/media/figure.png'],
          pathTarget: '/course-runtime/lessons/unit-demo/media/figure.png',
          evidenceInstrumentation: [],
          privacyScope: 'student-visible',
          contentHash: 'sha256:figure',
          versionRef: 'runtime-lesson-media.v1',
          generatedBy: 'external-tool',
          humanConfirmed: false,
        },
        {
          id: 'knowledge-card:kn-demo',
          title: 'Demo card',
          family: 'knowledge-card',
          sourcePathOrUrl: 'course-content/runtime/knowledge/cards/nodes/kn-demo.md',
          sourceRecord: 'kn-demo',
          knowledgeNodeIds: ['kn-demo'],
          segmentRefs: ['kn-demo'],
          citationTargets: ['course-content/runtime/knowledge/cards/nodes/kn-demo.md'],
          pathTarget: '/knowledge?node=kn-demo',
          evidenceInstrumentation: [],
          privacyScope: 'student-visible',
          contentHash: 'sha256:card',
          versionRef: 'runtime-knowledge-card.v1',
          generatedBy: 'template',
          humanConfirmed: false,
        },
        {
          id: 'infograph:kn-demo',
          title: 'Demo infograph',
          family: 'knowledge-infograph',
          sourcePathOrUrl: 'course-content/runtime/knowledge/infographs/nodes/kn-demo.png',
          sourceRecord: 'kn-demo',
          knowledgeNodeIds: ['kn-demo'],
          segmentRefs: [],
          citationTargets: ['course-content/runtime/knowledge/infographs/nodes/kn-demo.png'],
          pathTarget: '/course-runtime/knowledge/infographs/nodes/kn-demo.png',
          evidenceInstrumentation: [],
          privacyScope: 'student-visible',
          contentHash: 'sha256:infograph',
          versionRef: 'knowledge-infograph-manifest.v1',
          generatedBy: 'external-tool',
          humanConfirmed: false,
        },
      ],
    });
    const artifact = buildRuntimeResourceProjectionArtifacts({
      auditRows: audit.rows,
      generatedAt: '2026-06-22T00:00:00.000Z',
    });

    expect(artifact.rows).toHaveLength(5);
    expect(artifact.rows.every((row) => (
      !('lifecycleScope' in row) &&
      !('reviewConcluded' in row) &&
      !('semanticConfirmed' in row)
    ))).toBe(true);
    expect(artifact.limitations.artifactVersion).toBe(RUNTIME_RESOURCE_PROJECTION_ARTIFACT_VERSION);
    expect(artifact.limitations.totals).toMatchObject({
      rows: 5,
      resourceNodeCandidates: 1,
      segmentOnly: 4,
      registryPathEligible: 0,
      planningUnitEligible: 0,
      humanConfirmed: 1,
      agentReviewed: 0,
      semanticReviewed: 0,
      provisional: 4,
    });
    expect(artifact.rows.find((row) => row.id === 'runtime-step:unit-demo:step-1')).toMatchObject({
      artifactVersion: RUNTIME_RESOURCE_PROJECTION_ARTIFACT_VERSION,
      resourceNodeId: 'lesson-step:unit-demo:step-1',
      projectionLevel: 'ResourceNode',
      resourceType: 'lesson_step',
      sourceKind: 'runtime_lesson_step',
      sourceHash: 'sha256:step',
      sourceVersionRef: 'interactive-manifest.v2',
      routeTarget: '/interactive-learning/courses/unit-demo/student/demo?step=step-1',
      renderTarget: '/interactive-learning/courses/unit-demo/student/demo?step=step-1',
      estimatedTimeMinutes: 8,
      graphNodeRefs: {
        knowledge: ['kn-demo'],
        capability: ['controlModeling'],
      },
      evidenceContract: {
        complete: true,
      },
      reviewAudit: {
        status: 'human-confirmed',
        reviewedSourceHash: 'sha256:step',
        reviewedVersionRef: 'interactive-manifest.v2',
      },
      readiness: {
        minimumCompetency: {
          controlModeling: 0.2,
        },
        minimumEvidenceCount: 1,
        unlockMessage: '完成本单元前序学习证据后进入该步骤。',
      },
    });
    expect(artifact.rows.find((row) => row.id === 'runtime-module:unit-demo:step-1:figure')).toMatchObject({
      projectionLevel: 'ResourceSegment',
      resourceNodeId: null,
      pathEligibility: {
        current: false,
        masteryAffecting: false,
      },
      retrievalChunk: {
        pathEligible: false,
        reason: 'resource-node-planning-audit-required',
      },
    });
    expect(artifact.rows.find((row) => row.id === 'runtime-media:unit-demo:figure.png')).toMatchObject({
      projectionLevel: 'ResourceSegment',
      resourceType: 'image',
      routeTarget: null,
      renderTarget: '/course-runtime/lessons/unit-demo/media/figure.png',
    });
    expect(artifact.rows.find((row) => row.id === 'knowledge-card:kn-demo')).toMatchObject({
      projectionLevel: 'ResourceSegment',
      reviewAudit: {
        status: 'generated-provisional',
      },
    });
    expect(artifact.rows.find((row) => row.id === 'infograph:kn-demo')).toMatchObject({
      projectionLevel: 'ResourceSegment',
      resourceType: 'image',
      sourceKind: 'knowledge_graph',
      groundingEligibility: {
        retrievalReady: true,
      },
    });
  });

  it('keeps stale human review visible in projection limitations', () => {
    const audit = buildResourceFieldCompletionAudit({
      registry: buildResourceNodeRegistry({}),
      generatedAt: '2026-06-22T00:00:00.000Z',
      candidates: [{
        id: 'runtime-step:unit-demo:step-stale',
        title: 'Stale runtime step',
        family: 'runtime-lesson-step',
        sourcePathOrUrl: 'course-content/runtime/lessons/unit-demo/interactive-manifest.json',
        sourceRecord: 'unit-demo:step-stale',
        knowledgeNodeIds: ['kn-demo'],
        capabilityTargetIds: ['controlModeling'],
        segmentRefs: ['step-stale'],
        citationTargets: ['course-content/runtime/lessons/unit-demo/interactive-manifest.json'],
        pathTarget: '/interactive-learning/courses/unit-demo/student/demo?step=step-stale',
        estimatedTimeMinutes: 8,
        evidenceInstrumentation: ['lesson_step_view'],
        privacyScope: 'student-visible',
        contentHash: 'sha256:new',
        versionRef: 'interactive-manifest.v2',
        humanConfirmed: true,
        reviewEvidence: {
          reviewerId: 'teacher-reviewer-1',
          reviewerRole: 'curriculum-data-governance',
          reviewedAt: '2026-07-03T00:00:00.000Z',
          reviewBatchId: 'review-batch-1',
          reviewerVisibleRationale: 'Teacher verified graph fit and path eligibility against the runtime source.',
          independentEvidenceRef: 'review-packet:runtime-step-stale',
          reviewedSourceHash: 'sha256:new',
        },
      }],
    });
    const staleRow = {
      ...audit.rows[0],
      reviewAudit: {
        ...audit.rows[0].reviewAudit,
        reviewedSourceHash: 'sha256:old',
      },
    };
    const artifact = buildRuntimeResourceProjectionArtifacts({
      auditRows: [staleRow],
      generatedAt: '2026-06-22T00:00:00.000Z',
    });

    expect(artifact.limitations.totals.stale).toBe(1);
    expect(artifact.rows[0].reviewAudit).toMatchObject({
      status: 'human-confirmed',
      reviewedSourceHash: 'sha256:old',
    });
  });

  it('keeps tracked runtime assets citation-ready and blocks human-confirmed missing local assets', () => {
    const audit = buildResourceFieldCompletionAudit({
      registry: buildResourceNodeRegistry({}),
      generatedAt: '2026-06-22T00:00:00.000Z',
      candidates: [{
        id: 'runtime-media:unit-demo:figure.png',
        title: 'Runtime figure',
        family: 'runtime-lesson-media',
        sourcePathOrUrl: 'course-content/runtime/lessons/unit-demo/media/figure.png',
        sourceRecord: 'unit-demo:figure.png',
        knowledgeNodeIds: ['kn-demo'],
        segmentRefs: ['figure.png'],
        citationTargets: ['course-content/runtime/lessons/unit-demo/media/figure.png'],
        pathTarget: '/course-runtime/lessons/unit-demo/media/figure.png',
        evidenceInstrumentation: [],
        privacyScope: 'student-visible',
        contentHash: 'sha256:figure',
        versionRef: 'runtime-lesson-media.v1',
        generatedBy: 'external-tool',
        humanConfirmed: true,
        reviewEvidence: {
          reviewerId: 'teacher-reviewer-1',
          reviewerRole: 'curriculum-data-governance',
          reviewedAt: '2026-07-03T00:00:00.000Z',
          reviewBatchId: 'review-batch-1',
          reviewerVisibleRationale: 'Teacher verified that the local runtime asset is absent.',
          independentEvidenceRef: 'review-packet:runtime-media-unit-demo-figure',
          reviewedSourceHash: 'sha256:figure',
          promptOrManifestHash: 'sha256:figure',
        },
      }],
    });
    const semanticEvidence = (
      assetStatus: RuntimeResourceProjectionSemanticEvidence['assetStatus'],
      assetAvailability: RuntimeResourceProjectionSemanticEvidence['assetAvailability'],
    ): RuntimeResourceProjectionSemanticEvidence => ({
      schemaVersion: 'runtime-lesson-semantic-evidence.v1',
      sourceFilePath: 'course-content/runtime/lessons/unit-demo/interactive-manifest.json',
      sourceFileKind: 'interactive-manifest',
      sourceFileHash: 'sha256:manifest',
      evidenceFilePath: 'course-content/authoring/lessons/unit-demo.md',
      evidenceFileHash: 'sha256:evidence',
      evidenceSelector: 'figure.png',
      assetStatus,
      assetAvailability,
      externalIdentitySha256: null,
    });
    const baseline = buildRuntimeResourceProjectionArtifacts({ auditRows: audit.rows });
    const tracked = buildRuntimeResourceProjectionArtifacts({
      auditRows: audit.rows,
      runtimeSemanticEvidenceById: new Map([[
        'runtime-media:unit-demo:figure.png',
        semanticEvidence('tracked-local-runtime-asset', 'tracked-in-git-index'),
      ]]),
    });
    const missing = buildRuntimeResourceProjectionArtifacts({
      auditRows: audit.rows,
      runtimeSemanticEvidenceById: new Map([[
        'runtime-media:unit-demo:figure.png',
        semanticEvidence('missing-local-runtime-asset', 'not-tracked-in-git-index'),
      ]]),
    });

    expect(baseline.rows[0].groundingEligibility.citationReady).toBe(true);
    expect(tracked.rows[0].groundingEligibility).toEqual(baseline.rows[0].groundingEligibility);
    expect(missing.rows[0].groundingEligibility).toEqual({
      ...baseline.rows[0].groundingEligibility,
      citationReady: false,
    });
  });

  it('blocks stale missing local assets from citation', () => {
    const audit = buildResourceFieldCompletionAudit({
      registry: buildResourceNodeRegistry({}),
      generatedAt: '2026-06-22T00:00:00.000Z',
      candidates: [{
        id: 'runtime-media:unit-demo:stale.png',
        title: 'Stale runtime figure',
        family: 'runtime-lesson-media',
        sourcePathOrUrl: 'course-content/runtime/lessons/unit-demo/media/stale.png',
        sourceRecord: 'unit-demo:stale.png',
        knowledgeNodeIds: ['kn-demo'],
        segmentRefs: ['stale.png'],
        citationTargets: ['course-content/runtime/lessons/unit-demo/media/stale.png'],
        pathTarget: '/course-runtime/lessons/unit-demo/media/stale.png',
        evidenceInstrumentation: [],
        privacyScope: 'student-visible',
        contentHash: 'sha256:stale',
        versionRef: 'runtime-lesson-media.v1',
        generatedBy: 'external-tool',
        humanConfirmed: false,
      }],
    });
    const baseline = buildRuntimeResourceProjectionArtifacts({ auditRows: audit.rows });
    const missing = buildRuntimeResourceProjectionArtifacts({
      auditRows: audit.rows,
      runtimeSemanticEvidenceById: new Map([['runtime-media:unit-demo:stale.png', {
        schemaVersion: 'runtime-lesson-semantic-evidence.v1',
        sourceFilePath: 'course-content/runtime/lessons/unit-demo/media/stale.png',
        sourceFileKind: 'missing-local-runtime-asset',
        sourceFileHash: null,
        evidenceFilePath: 'course-content/runtime/lessons/unit-demo/media/unit-demo-media.md',
        evidenceFileHash: 'sha256:evidence',
        evidenceSelector: 'stale.png',
        assetStatus: 'missing-local-runtime-asset',
        assetAvailability: 'not-tracked-in-git-index',
        externalIdentitySha256: null,
      }]]),
    });

    expect(missing.rows[0].reviewAudit.status).not.toBe('human-confirmed');
    expect(missing.rows[0].groundingEligibility).toEqual({
      ...baseline.rows[0].groundingEligibility,
      citationReady: false,
    });
  });

  it('does not mark prompt-scoped review hashes stale when they differ from raw source hashes', () => {
    const audit = buildResourceFieldCompletionAudit({
      registry: buildResourceNodeRegistry({}),
      generatedAt: '2026-06-22T00:00:00.000Z',
      candidates: [{
        id: 'runtime-step:unit-demo:step-reviewed-source',
        title: 'Reviewed-source runtime step',
        family: 'runtime-lesson-step',
        sourcePathOrUrl: 'course-content/runtime/lessons/unit-demo/interactive-manifest.json',
        sourceRecord: 'unit-demo:step-reviewed-source',
        knowledgeNodeIds: ['kn-demo'],
        capabilityTargetIds: ['controlModeling'],
        segmentRefs: ['step-reviewed-source'],
        citationTargets: ['course-content/runtime/lessons/unit-demo/interactive-manifest.json'],
        pathTarget: '/interactive-learning/courses/unit-demo/student/demo?step=step-reviewed-source',
        estimatedTimeMinutes: 8,
        evidenceInstrumentation: ['lesson_step_view'],
        privacyScope: 'student-visible',
        contentHash: 'sha256:manifest-source',
        versionRef: 'interactive-manifest.v2',
        humanConfirmed: true,
        currentPathEligible: true,
        reviewEvidence: {
          reviewerId: 'teacher-reviewer-1',
          reviewerRole: 'curriculum-data-governance',
          reviewedAt: '2026-07-03T00:00:00.000Z',
          reviewBatchId: 'review-batch-1',
          reviewerVisibleRationale: 'Teacher verified graph fit and path eligibility against manifest plus graph overlay.',
          independentEvidenceRef: 'review-packet:runtime-reviewed-source',
          reviewedSourceHash: 'sha256:manifest-plus-overlay',
          promptOrManifestHash: 'sha256:manifest-plus-overlay',
        },
      }],
    });
    const artifact = buildRuntimeResourceProjectionArtifacts({
      auditRows: audit.rows,
      generatedAt: '2026-06-22T00:00:00.000Z',
    });

    expect(artifact.limitations.totals.stale).toBe(0);
    expect(artifact.rows[0]).toMatchObject({
      sourceHash: 'sha256:manifest-source',
      reviewAudit: {
        status: 'human-confirmed',
        reviewedSourceHash: 'sha256:manifest-plus-overlay',
        promptOrManifestHash: 'sha256:manifest-plus-overlay',
      },
    });
  });

  it('keeps an agent-reviewed sidecar out of PlanningUnit and mastery eligibility', () => {
    const audit = buildResourceFieldCompletionAudit({
      registry: buildResourceNodeRegistry({}),
      generatedAt: '2026-07-16T21:30:00.000Z',
      candidates: [{
        id: 'knowledge-card:agent-reviewed-only',
        title: 'Agent reviewed support',
        family: 'knowledge-card',
        sourcePathOrUrl: 'course-content/runtime/knowledge/cards/nodes/agent-reviewed-only.md',
        sourceRecord: 'agent-reviewed-only',
        knowledgeNodeIds: ['kn-agent-reviewed'],
        capabilityTargetIds: ['controlModeling'],
        segmentRefs: ['agent-reviewed-only'],
        citationTargets: ['course-content/runtime/knowledge/cards/nodes/agent-reviewed-only.md'],
        pathTarget: '/knowledge?node=kn-agent-reviewed',
        estimatedTimeMinutes: 5,
        evidenceInstrumentation: ['knowledge_card_open'],
        privacyScope: 'student-visible',
        contentHash: 'sha256:agent-reviewed',
        versionRef: 'runtime-knowledge-card.v1',
        reviewProvenance: 'agent-reviewed',
        currentPathEligible: true,
        reviewEvidence: {
          reviewerId: 'codex-implementing-agent',
          reviewerRole: 'implementing-agent',
          reviewedAt: '2026-07-16T21:30:00.000Z',
          reviewBatchId: 'agent-semantic-review',
          reviewerVisibleRationale: 'Agent semantic review confirms citation support only and does not authorize path publication.',
          independentEvidenceRef: 'course-content/runtime/knowledge/cards/nodes/agent-reviewed-only.md',
          reviewedSourceHash: 'sha256:agent-reviewed',
          reviewedVersionRef: 'runtime-knowledge-card.v1',
        },
      }],
    });
    const row = audit.rows[0];
    const projection = buildRuntimeResourceProjectionArtifacts({ auditRows: audit.rows }).rows[0];

    expect(row).toMatchObject({
      reviewStatus: 'agent-reviewed',
      pathEligibility: {
        current: false,
        afterCompletion: false,
        masteryAffecting: false,
        blockedBy: expect.arrayContaining(['missing-human-review']),
      },
    });
    expect(projection).toMatchObject({
      projectionLevel: 'ResourceSegment',
      routeTarget: null,
      pathEligibility: { current: false, masteryAffecting: false },
    });
  });

  it('keeps authoring textbook families teacher-scoped and audit-only', () => {
    const audit = buildResourceFieldCompletionAudit({
      registry: buildResourceNodeRegistry({}),
      candidates: [{
        id: 'authoring-textbook-caption:book:chapter:figure-1',
        title: 'Authoring caption',
        family: 'authoring-textbook-caption',
        sourcePathOrUrl: 'course-content/authoring/resources/textbooks/book/chapter/manifest.json',
        sourceRecord: 'caption:1',
        segmentRefs: ['chapter', 'figure-1'],
        citationTargets: ['course-content/authoring/resources/textbooks/book/chapter/manifest.json'],
        pathTarget: 'course-content/authoring/resources/textbooks/book/chapter/manifest.json',
        privacyScope: 'teacher-scoped',
        contentHash: 'sha256:caption',
        versionRef: 'authoring-textbook-manifest.v1',
      }],
    });
    const projection = buildRuntimeResourceProjectionArtifacts({ auditRows: audit.rows }).rows[0];

    expect(projection).toMatchObject({
      lifecycleScope: 'audit-only',
      reviewConcluded: false,
      semanticConfirmed: false,
      privacyScope: 'teacher-scoped',
      teacherPolicy: 'teacher-only',
      routeTarget: null,
      renderTarget: null,
      citationTargets: [],
      projectionLevel: 'ResourceSegment',
    });
  });

  it('preserves audited registry media types when URLs do not expose file extensions', () => {
    const audit = buildResourceFieldCompletionAudit({
      registry: buildResourceNodeRegistry({
        runtimeLessons: [{
          lessonId: 'unit-demo',
          title: 'Demo lesson',
          knowledgeNodeIds: ['kn-demo'],
          mediaResources: [{
            id: 'external-audio',
            title: 'External audio preview',
            kind: 'audio',
            url: 'https://pan-yz.cldisk.com/preview/v2/objectshowpreview.html?objectid=audio',
          }],
        }],
      }),
      generatedAt: '2026-06-22T00:00:00.000Z',
    });
    const artifact = buildRuntimeResourceProjectionArtifacts({
      auditRows: audit.rows,
      generatedAt: '2026-06-22T00:00:00.000Z',
    });

    expect(artifact.rows.find((row) => row.id === 'runtime-media:unit-demo:external-audio')).toMatchObject({
      family: 'runtime-lesson-media',
      resourceType: 'audio',
      renderTarget: 'https://pan-yz.cldisk.com/preview/v2/objectshowpreview.html?objectid=audio',
    });
  });
});
