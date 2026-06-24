import { describe, expect, it } from 'vitest';

import { buildTextbookMediaGroundingArtifacts } from '../textbook-media-grounding';
import { buildKaqArtifactVersionRefs } from '../kaq-artifact-versioning';
import type { RuntimeResourceProjectionArtifactRow } from '../runtime-resource-projections';
import type { TextbookRuntimeSearchDocument } from '../textbook-runtime-resources';

const versionRefs = buildKaqArtifactVersionRefs({
  resourceProjectionVersion: 'resource-semantic-projection.v1',
});

function textbookDocument(overrides: Partial<TextbookRuntimeSearchDocument> = {}): TextbookRuntimeSearchDocument {
  return {
    id: 'ch04-sec01__chunk-001',
    kind: 'chunk',
    title: '第 4 章 根轨迹法',
    href: '/course-runtime/lessons/unit-4-1/textbook/ch04-sec01.md#chunk-001',
    text: '根轨迹描述闭环极点随增益变化的轨迹。',
    contentHash: 'sha256:textbook-section',
    resourceProjection: {
      resourceId: 'textbook-section:hu-shousong-exercise-analysis-3rd:ch04-sec01',
      segmentRef: 'ch04-sec01',
      citationTargetRef: 'ch04-sec01__chunk-001',
      knowledgeNodeRefs: ['根轨迹_4_1'],
      capabilityTargetRefs: ['parameterDesign'],
      contentHash: 'sha256:textbook-section',
      versionRefs,
    },
    citationAddress: {
      kind: 'text',
      sourceRefId: 'ch04-sec01__chunk-001',
      href: '/course-runtime/lessons/unit-4-1/textbook/ch04-sec01.md#chunk-001',
      locator: 'p.42#chunk-001',
      contentHash: 'sha256:textbook-section',
    },
    metadata: {
      bookId: 'hu-shousong-exercise-analysis-3rd',
      sectionId: 'ch04-sec01',
      chapterId: 'chapter-04',
      chapterNumber: 4,
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
      textbookDocuments: [
        textbookDocument(),
        textbookDocument({
          id: 'ch04-sec01__fig-001',
          kind: 'figure',
          title: '图 4-1 根轨迹示例',
          resourceProjection: {
            ...textbookDocument().resourceProjection,
            citationTargetRef: 'fig-04-01',
          },
          citationAddress: {
            kind: 'image',
            sourceRefId: 'fig-04-01',
            href: '/course-runtime/lessons/unit-4-1/textbook/ch04-sec01.md#fig-04-01',
            locator: 'p.43#fig-04-01',
            contentHash: 'sha256:textbook-section',
          },
        }),
      ],
      mediaProjections: [mediaProjection()],
    });

    expect(artifacts.candidates).toEqual(expect.arrayContaining([
      expect.objectContaining({
        sourcePackageId: 'hu-shousong-exercise-analysis-3rd',
        candidateId: 'textbook-section:hu-shousong-exercise-analysis-3rd:ch04-sec01:ch04-sec01__chunk-001',
        sectionId: 'ch04-sec01',
        pageAnchor: 'p.42#chunk-001',
        sourceHash: 'sha256:textbook-section',
        reviewState: 'human-confirmed',
        reviewBatchId: 'textbook-grounding-2026-06-24',
        limitationReason: null,
        pathEligible: false,
      }),
    ]));
    expect(artifacts.citationTargets).toEqual(expect.arrayContaining([
      expect.objectContaining({
        citationTargetId: 'citation-target:ch04-sec01__chunk-001',
        retrievalChunkId: 'retrieval-chunk:ch04-sec01__chunk-001',
        address: expect.objectContaining({
          kind: 'text',
          href: '/course-runtime/lessons/unit-4-1/textbook/ch04-sec01.md#chunk-001',
          locator: 'p.42#chunk-001',
        }),
        pathEligibility: {
          eligible: false,
          reason: 'resource-node-planning-audit-required',
        },
      }),
    ]));
    expect(artifacts.limitations.denominator).toMatchObject({
      textbookDocuments: 2,
      mediaProjectionRows: 1,
      reviewedTextbookCandidates: 2,
      reviewedMediaProjections: 0,
    });
  });

  it('does not expose citation targets for non-deployable textbook runtime-resource paths', () => {
    const artifacts = buildTextbookMediaGroundingArtifacts({
      sourcePackageId: 'hu-shousong-exercise-analysis-3rd',
      generatedAt: '2026-06-24T00:00:00.000Z',
      reviewBatchId: 'textbook-grounding-2026-06-24',
      textbookDocuments: [
        textbookDocument({
          id: 'ch04-sec01__ignored-runtime-resource',
          href: '/course-runtime/resources/textbooks/hu-shousong-exercise-analysis-3rd/sections/ch04-sec01.md#chunk-001',
          citationAddress: {
            kind: 'text',
            sourceRefId: 'ch04-sec01__ignored-runtime-resource',
            href: '/course-runtime/resources/textbooks/hu-shousong-exercise-analysis-3rd/sections/ch04-sec01.md#chunk-001',
            locator: 'p.42#chunk-001',
            contentHash: 'sha256:textbook-section',
          },
        }),
      ],
      mediaProjections: [],
    });

    expect(artifacts.citationTargets).toEqual([]);
    expect(artifacts.candidates).toEqual([
      expect.objectContaining({
        documentId: 'ch04-sec01__ignored-runtime-resource',
        reviewState: 'generated-provisional',
        limitationReason: 'unsafe-citation-address',
      }),
    ]);
  });

  it('does not create citation targets for provisional textbook candidates', () => {
    const artifacts = buildTextbookMediaGroundingArtifacts({
      sourcePackageId: 'hu-shousong-exercise-analysis-3rd',
      generatedAt: '2026-06-24T00:00:00.000Z',
      reviewBatchId: 'textbook-grounding-2026-06-24',
      textbookDocuments: [
        textbookDocument({
          id: 'ch04-sec01__missing-source-hash',
          contentHash: null,
          resourceProjection: {
            ...textbookDocument().resourceProjection,
            contentHash: null,
          },
          citationAddress: {
            kind: 'text',
            sourceRefId: 'ch04-sec01__missing-source-hash',
            href: '/course-runtime/lessons/unit-4-1/textbook/ch04-sec01.md#chunk-001',
            locator: 'p.42#chunk-001',
            contentHash: null,
          },
        }),
      ],
      mediaProjections: [],
    });

    expect(artifacts.citationTargets).toEqual([]);
    expect(artifacts.candidates).toEqual([
      expect.objectContaining({
        documentId: 'ch04-sec01__missing-source-hash',
        reviewState: 'generated-provisional',
        limitationReason: 'missing-source-hash',
      }),
    ]);
  });

  it('records media projection limitations without creating private raw-media ingestion results', () => {
    const artifacts = buildTextbookMediaGroundingArtifacts({
      sourcePackageId: 'hu-shousong-exercise-analysis-3rd',
      generatedAt: '2026-06-24T00:00:00.000Z',
      reviewBatchId: 'textbook-grounding-2026-06-24',
      textbookDocuments: [
        textbookDocument({
          id: 'unsafe-doc',
          href: 'file:///tmp/raw.md',
          citationAddress: {
            kind: 'text',
            sourceRefId: 'unsafe-doc',
            href: 'file:///tmp/raw.md',
            locator: 'raw',
            contentHash: 'sha256:textbook-section',
          },
        }),
      ],
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
            blockedBy: ['resource-node-planning-audit-required'],
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
        id: 'unsafe-doc',
        sourceKind: 'textbook-section',
        reason: 'unsafe-citation-address',
      }),
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
});
