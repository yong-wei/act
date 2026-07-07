import { describe, expect, it } from 'vitest';

import {
  buildRuntimeResourceProjectionArtifacts,
  RUNTIME_RESOURCE_PROJECTION_ARTIFACT_VERSION,
} from '../runtime-resource-projections';
import { buildResourceFieldCompletionAudit } from '../resource-field-completion-audit';
import { buildResourceNodeRegistry } from '../resource-node-registry';

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
    expect(artifact.limitations.artifactVersion).toBe(RUNTIME_RESOURCE_PROJECTION_ARTIFACT_VERSION);
    expect(artifact.limitations.totals).toMatchObject({
      rows: 5,
      resourceNodeCandidates: 1,
      segmentOnly: 4,
      registryPathEligible: 0,
      planningUnitEligible: 0,
      humanConfirmed: 1,
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
