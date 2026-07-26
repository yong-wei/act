import { describe, expect, it } from 'vitest';

import { buildTextbookMediaGroundingArtifacts } from '../textbook-media-grounding';
import { buildKaqArtifactVersionRefs } from '../kaq-artifact-versioning';
import type { RuntimeResourceProjectionArtifactRow } from '../runtime-resource-projections';
import type { TextbookStructureUnitProjection } from '../structured-textbook-runtime';

const versionRefs = buildKaqArtifactVersionRefs({
  resourceProjectionVersion: 'resource-semantic-projection.v1',
});
const targetFileHashForHref = () => 'sha256:runtime-target-file';

function textbookUnit(overrides: Partial<TextbookStructureUnitProjection> = {}): TextbookStructureUnitProjection {
  return {
    id: 'textbook-unit:hu-shousong-exercise-analysis-3rd@第三版/chapter-chapter-04/section-4.1',
    kind: 'section',
    title: '第 4 章 根轨迹法',
    href: '/textbooks/hu-shousong-exercise-analysis-3rd/%E7%AC%AC%E4%B8%89%E7%89%88/chapter-chapter-04/section-4.1',
    text: '根轨迹描述闭环极点随增益变化的轨迹。',
    contentHash: 'sha256:textbook-unit',
    identity: {
      bookId: 'hu-shousong-exercise-analysis-3rd',
      edition: '第三版',
      sourceRevision: 'revision-001',
      unitId: 'textbook-unit:hu-shousong-exercise-analysis-3rd@第三版/chapter-chapter-04/section-4.1',
      fragmentId: null,
    },
    fragments: [],
    resourceProjection: {
      resourceId: 'textbook-unit:hu-shousong-exercise-analysis-3rd@第三版/chapter-chapter-04/section-4.1',
      segmentRef: 'textbook-unit:hu-shousong-exercise-analysis-3rd@第三版/chapter-chapter-04/section-4.1',
      citationTargetRef: 'textbook-unit:hu-shousong-exercise-analysis-3rd@第三版/chapter-chapter-04/section-4.1',
      knowledgeNodeRefs: ['根轨迹_4_1'],
      capabilityTargetRefs: ['parameterDesign'],
      contentHash: 'sha256:textbook-unit',
      versionRefs,
    },
    citationAddress: {
      kind: 'text',
      sourceRefId: 'textbook-unit:hu-shousong-exercise-analysis-3rd@第三版/chapter-chapter-04/section-4.1',
      href: '/textbooks/hu-shousong-exercise-analysis-3rd/%E7%AC%AC%E4%B8%89%E7%89%88/chapter-chapter-04/section-4.1',
      locator: 'textbook-unit:hu-shousong-exercise-analysis-3rd@第三版/chapter-chapter-04/section-4.1',
      contentHash: 'sha256:textbook-unit',
    },
    metadata: {
      bookId: 'hu-shousong-exercise-analysis-3rd',
      edition: '第三版',
      sourceRevision: 'revision-001',
      unitId: 'textbook-unit:hu-shousong-exercise-analysis-3rd@第三版/chapter-chapter-04/section-4.1',
      chapterId: 'chapter-04',
      naturalNumber: '4.1',
      structuralPath: ['chapter-chapter-04', 'section-4.1'],
    },
    ...overrides,
  };
}

function mediaProjection(
  overrides: Partial<RuntimeResourceProjectionArtifactRow> = {},
): RuntimeResourceProjectionArtifactRow {
  return {
    artifactVersion: 'runtime-resource-projections.v1',
    id: 'runtime-media:unit-4-1:lead-correction-video',
    resourceNodeId: null,
    title: '超前校正视频',
    family: 'runtime-lesson-media',
    resourceType: 'video',
    sourceKind: 'media_source_manifest',
    sourceRef: 'unit-4-1:lead-correction-video',
    sourcePathOrUrl: 'course-content/runtime/lessons/unit-4-1/media/lead-correction.mp4',
    sourceRecord: 'unit-4-1:lead-correction-video',
    sourceHash: 'sha256:video-source',
    sourceVersionRef: 'runtime-lesson-media.v1',
    projectionLevel: 'ResourceSegment',
    routeTarget: null,
    renderTarget: '/course-runtime/lessons/unit-4-1/media/lead-correction.mp4',
    graphNodeRefs: {
      knowledge: ['根轨迹_4_1'],
      capability: ['parameterDesign'],
      quality: [],
    },
    estimatedTimeMinutes: null,
    evidenceInstrumentation: [],
    privacyScope: 'student-visible',
    teacherPolicy: 'allowed',
    evidenceContract: {
      eventSource: true,
      eventType: false,
      clientEventIdPolicy: false,
      attemptKey: false,
      sourceLogId: false,
      dedupeKey: true,
      timestamps: false,
      learningFactPolicy: false,
      confidencePolicy: false,
      privacyScope: true,
      complete: false,
      missingFields: ['eventType'],
    },
    reviewAudit: {
      reviewerId: null,
      reviewerRole: null,
      reviewedAt: null,
      reviewBatchId: null,
      reviewedSourceHash: null,
      reviewedVersionRef: 'runtime-lesson-media.v1',
      generationToolOrModel: 'media-manifest-ingestion',
      promptOrManifestHash: 'sha256:manifest',
      confidence: null,
      staleInvalidationRule: 'requires upstream media projection review before path eligibility',
      status: 'generated-provisional',
    },
    reviewConcluded: false,
    semanticConfirmed: false,
    segmentRefs: ['video:00:03:00-00:03:42'],
    citationTargets: [],
    retrievalChunk: {
      id: 'retrieval-chunk:runtime-media:unit-4-1:lead-correction-video:primary',
      pathEligible: false,
      reason: 'resource-node-planning-audit-required',
    },
    pathEligibility: {
      current: false,
      afterCompletion: false,
      masteryAffecting: false,
      blockedBy: ['missing-citation-target', 'missing-human-review'],
    },
    groundingEligibility: {
      retrievalReady: true,
      citationReady: false,
      authoringTriageReady: true,
    },
    versionRefs,
    ...overrides,
  };
}

describe('textbook and media grounding artifacts', () => {
  it('builds reviewed textbook candidates and server-owned citation targets without path promotion', () => {
    const artifacts = buildTextbookMediaGroundingArtifacts({
      sourcePackageId: 'hu-shousong-exercise-analysis-3rd',
      generatedAt: '2026-06-24T00:00:00.000Z',
      reviewBatchId: 'textbook-grounding-2026-06-24',
      targetFileHashForHref,
      textbookUnits: [textbookUnit()],
      mediaProjections: [mediaProjection()],
    });

    expect(artifacts.candidates).toEqual(expect.arrayContaining([
      expect.objectContaining({
        sourcePackageId: 'hu-shousong-exercise-analysis-3rd',
        candidateId: `textbook-unit:hu-shousong-exercise-analysis-3rd:${textbookUnit().id}:${textbookUnit().id}`,
        unitId: textbookUnit().id,
        pageAnchor: textbookUnit().id,
        sourceHash: 'sha256:textbook-unit',
        reviewState: 'human-confirmed',
        reviewBatchId: 'textbook-grounding-2026-06-24',
        limitationReason: null,
        pathEligible: false,
      }),
    ]));
    expect(artifacts.citationTargets).toEqual(expect.arrayContaining([
      expect.objectContaining({
        citationTargetId: `citation-target:${textbookUnit().id}`,
        retrievalChunkId: `retrieval-chunk:${textbookUnit().id}`,
        address: expect.objectContaining({
          kind: 'text',
          href: textbookUnit().href,
          locator: textbookUnit().id,
        }),
        targetFileHash: 'sha256:runtime-target-file',
        pathEligibility: {
          eligible: false,
          reason: 'resource-node-planning-audit-required',
        },
      }),
    ]));
    expect(artifacts.limitations.denominator).toMatchObject({
      textbookUnits: 1,
      mediaProjectionRows: 1,
      reviewedTextbookCandidates: 1,
      reviewedMediaProjections: 0,
    });
  });

  it('records media projection limitations without creating private raw-media ingestion results', () => {
    const artifacts = buildTextbookMediaGroundingArtifacts({
      sourcePackageId: 'hu-shousong-exercise-analysis-3rd',
      generatedAt: '2026-06-24T00:00:00.000Z',
      reviewBatchId: 'textbook-grounding-2026-06-24',
      targetFileHashForHref,
      textbookUnits: [],
      mediaProjections: [
        mediaProjection({
          citationTargets: ['https://signed.example.com/raw-video.mp4?token=secret'],
          renderTarget: 'https://signed.example.com/raw-video.mp4?token=secret',
          reviewAudit: {
            ...mediaProjection().reviewAudit,
            status: 'external-tool-provisional',
          },
        }),
        mediaProjection({
          id: 'runtime-media:unit-4-1:not-reviewed-image',
          citationTargets: ['course-content/runtime/lessons/unit-4-1/media/raw.png'],
          reviewAudit: {
            ...mediaProjection().reviewAudit,
            generationToolOrModel: 'local-vision-model',
            status: 'not-reviewed',
          },
        }),
        mediaProjection({
          id: 'runtime-media:unit-4-1:model-assisted-image',
          citationTargets: ['/course-runtime/lessons/unit-4-1/media/reviewed-image.png'],
          reviewAudit: {
            ...mediaProjection().reviewAudit,
            generationToolOrModel: 'local-vision-model',
            status: 'model-assisted-provisional',
          },
        }),
        mediaProjection({
          id: 'runtime-media:unit-4-1:blocked-local-path',
          citationTargets: ['/Users/YW/raw.png'],
          reviewAudit: {
            ...mediaProjection().reviewAudit,
            status: 'blocked',
          },
        }),
        mediaProjection({
          id: 'runtime-media:unit-4-1:stale-source-path',
          citationTargets: ['/course-content/runtime/lessons/unit-4-1/media/raw.png'],
          reviewAudit: {
            ...mediaProjection().reviewAudit,
            status: 'stale',
          },
        }),
        mediaProjection({
          id: 'runtime-media:unit-4-1:reviewed-slide',
          citationTargets: ['citation:unit-4-1:reviewed-slide:p12'],
          reviewAudit: {
            ...mediaProjection().reviewAudit,
            reviewBatchId: 'media-ingestion-2026-06-24',
            reviewerId: 'reviewer-1',
            reviewerRole: 'teacher',
            reviewedAt: '2026-06-24T00:00:00.000Z',
            reviewedSourceHash: 'sha256:video-source',
            status: 'human-confirmed',
          },
          pathEligibility: {
            current: false,
            afterCompletion: false,
            masteryAffecting: false,
            blockedBy: ['missing-human-review'],
          },
          groundingEligibility: {
            retrievalReady: true,
            citationReady: true,
            authoringTriageReady: true,
          },
        }),
      ],
    });

    expect(artifacts.limitations.reviewStatus).toMatchObject({
      textbookHumanConfirmed: 0,
      mediaHumanConfirmed: 1,
      mediaProvisional: 5,
      mediaBlocked: 1,
      mediaStale: 1,
    });
    expect(artifacts.limitations.mediaReviewStatusCounts).toMatchObject({
      'external-tool-provisional': 1,
      'not-reviewed': 1,
      'model-assisted-provisional': 1,
      blocked: 1,
      stale: 1,
      'human-confirmed': 1,
    });
    expect(artifacts.limitations.limitations).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'runtime-media:unit-4-1:lead-correction-video',
        sourceKind: 'media-projection',
        reason: 'unsafe-citation-address',
        generatedByPrivateParser: false,
      }),
      expect.objectContaining({
        id: 'runtime-media:unit-4-1:not-reviewed-image',
        sourceKind: 'media-projection',
        reason: 'unsafe-citation-address',
        generatedByPrivateParser: false,
      }),
      expect.objectContaining({
        id: 'runtime-media:unit-4-1:model-assisted-image',
        sourceKind: 'media-projection',
        reason: 'missing-upstream-media-projection-review',
        generatedByPrivateParser: false,
      }),
      expect.objectContaining({
        id: 'runtime-media:unit-4-1:blocked-local-path',
        sourceKind: 'media-projection',
        reason: 'unsafe-citation-address',
        generatedByPrivateParser: false,
      }),
      expect.objectContaining({
        id: 'runtime-media:unit-4-1:stale-source-path',
        sourceKind: 'media-projection',
        reason: 'unsafe-citation-address',
        generatedByPrivateParser: false,
      }),
    ]));
    expect(artifacts.limitations.limitations).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ generatedByPrivateParser: true }),
    ]));
  });

  it('treats stale human media reviews as limitations', () => {
    const artifacts = buildTextbookMediaGroundingArtifacts({
      sourcePackageId: 'hu-shousong-exercise-analysis-3rd',
      generatedAt: '2026-06-24T00:00:00.000Z',
      reviewBatchId: 'textbook-grounding-2026-06-24',
      targetFileHashForHref,
      textbookUnits: [],
      mediaProjections: [
        mediaProjection({
          id: 'runtime-media:unit-4-1:stale-human-review',
          citationTargets: ['/course-runtime/lessons/unit-4-1/media/reviewed-image.png'],
          reviewAudit: {
            ...mediaProjection().reviewAudit,
            reviewBatchId: 'media-ingestion-2026-06-24',
            reviewerId: 'reviewer-1',
            reviewerRole: 'teacher',
            reviewedAt: '2026-06-24T00:00:00.000Z',
            reviewedSourceHash: 'sha256:old-video-source',
            reviewedVersionRef: 'runtime-lesson-media.v1',
            status: 'human-confirmed',
          },
          pathEligibility: {
            current: false,
            afterCompletion: false,
            masteryAffecting: false,
            blockedBy: [],
          },
        }),
      ],
    });

    expect(artifacts.limitations.denominator.reviewedMediaProjections).toBe(0);
    expect(artifacts.limitations.reviewStatus.mediaHumanConfirmed).toBe(0);
    expect(artifacts.limitations.limitations).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'runtime-media:unit-4-1:stale-human-review',
        sourceKind: 'media-projection',
        reason: 'missing-upstream-media-projection-review',
      }),
      expect.objectContaining({
        id: 'runtime-media:unit-4-1:stale-human-review',
        sourceKind: 'media-projection',
        reason: 'provisional-review-state',
      }),
    ]));
  });
});
