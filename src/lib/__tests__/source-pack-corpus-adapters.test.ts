/**
 * Corpus Adapters — Contract Tests
 *
 * Verifies:
 * - Unsafe href rejection
 * - Privacy filtering (public/student/teacher/admin/restricted)
 * - Textbook citation preservation
 * - Retrieval chunk not path eligible
 * - Stale / provisional limitations
 */

import { describe, expect, it } from 'vitest';

import {
  adaptLearningEvidenceChunk,
  adaptTextbookSearchDocument,
  adaptResourceProjection,
  adaptLearningEvidenceBatch,
} from '../source-pack/corpus-adapters';
import { buildSourcePack } from '../source-pack/builder';

import {
  hydrateCitationFromAddress,
  hydrateCitationFromTarget,
  isSafeHref,
  isSerializableCitationHref,
  isVerifiedCitationHref,
  buildUnsafeHrefLimitation,
} from '../source-pack/citation-hydrator';

import {
  adaptResourceProjectionRow,
  isProvisionalReview,
} from '../source-pack/resource-projection-adapter';
import { retrieveSourcePack } from '../source-pack/hybrid-retriever';

import type {
  LearningEvidenceCorpusChunk,
} from '../data-governance/learning-evidence-rag-corpus';

import type {
  TextbookRuntimeSearchDocument,
} from '../textbook-runtime-resources';

import type {
  RuntimeResourceProjectionArtifactRow,
} from '../runtime-resource-projections';
import type { SourcePackItem } from '../source-pack/types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeChunk(overrides?: Partial<LearningEvidenceCorpusChunk>): LearningEvidenceCorpusChunk {
  return {
    id: 'chunk-001',
    family: 'course-content',
    sourceType: 'course-content',
    sourceRef: {
      id: 'src-001',
      ownerUserId: null,
      classId: null,
      goalId: null,
      resourceId: null,
    },
    spanRef: {
      kind: 'text-range',
      start: 0,
      end: 100,
      locator: null,
    },
    display: {
      title: '闭环极点配置',
      href: '/course/unit-3-4',
      capsule: '根轨迹法配置闭环极点以改善系统动态性能。',
    },
    citationAddress: {
      kind: 'text',
      sourceRefId: 'kaq:unit-3-4:pole-placement',
      href: '/course/unit-3-4#pole-placement',
      locator: '#pole-placement',
      contentHash: 'sha256:abc123',
      mediaStartSeconds: null,
      mediaEndSeconds: null,
      imageRegion: null,
      interactiveStepId: null,
      simulationRunId: null,
      arenaTaskId: null,
      externalUrl: null,
    },
    content: {
      text: '通过根轨迹法配置闭环极点…',
      redactedSummary: '极点配置方法摘要',
      hash: 'sha256:abc123',
    },
    resourceProjection: {
      resourceId: 'res-001',
      segmentRef: 'seg-001',
      citationTargetRef: 'source-pack-citation:ct-001',
      knowledgeNodeRefs: ['kn-001'],
      capabilityTargetRefs: ['cap-001'],
    },
    privacyClass: 'public',
    confidence: 'high',
    freshness: {
      indexedAt: '2026-06-28T00:00:00Z',
      sourceUpdatedAt: '2026-06-27T00:00:00Z',
      expiresAt: null,
      stale: false,
    },
    authority: {
      level: 'verified',
      knowledgeTags: ['control', 'root-locus'],
      pageAnchor: '/course/unit-3-4#pole-placement',
      freshnessBucket: 'current',
      scopeRule: {
        visibility: 'public',
        allowedRoles: ['student', 'teacher', 'admin'],
      },
    },
    retrieval: {
      tags: ['pole-placement', 'root-locus'],
      goals: ['goal-001'],
      useCases: ['diagnosis'],
    },
    ...overrides,
  };
}

function makeScopedChunk(
  privacyClass: LearningEvidenceCorpusChunk['privacyClass'],
  allowedRoles: LearningEvidenceCorpusChunk['authority']['scopeRule']['allowedRoles'],
  overrides?: Partial<LearningEvidenceCorpusChunk>,
): LearningEvidenceCorpusChunk {
  const base = makeChunk(overrides);
  return {
    ...base,
    privacyClass,
    authority: {
      ...base.authority,
      scopeRule: {
        ...base.authority.scopeRule,
        visibility: privacyClass,
        allowedRoles,
      },
    },
  };
}

function makeTextbookDoc(overrides?: Partial<TextbookRuntimeSearchDocument>): TextbookRuntimeSearchDocument {
  return {
    id: 'doc-001',
    kind: 'chunk',
    title: '根轨迹法基础',
    href: '/course-runtime/textbook/ch02/root-locus',
    text: '根轨迹法是分析和设计线性控制系统的重要方法。',
    contentHash: 'sha256:def456',
    resourceProjection: {
      resourceId: 'res-002',
      segmentRef: 'seg-002',
      citationTargetRef: 'ct-002',
      knowledgeNodeRefs: ['kn-002'],
      capabilityTargetRefs: ['cap-002'],
      versionRefs: {
        artifactVersioningVersion: 'kaq-artifact-versioning.v1',
        graphCatalogVersion: 'graph-catalog.v1',
        resourceRegistryVersion: 'resource-registry.v1',
        resourceProjectionVersion: 'resource-projection.v1',
        groundingVersion: 'grounding.v1',
        citationVersion: 'citation.v1',
      },
    },
    citationAddress: {
      kind: 'text',
      sourceRefId: 'textbook:ch02:root-locus',
      href: '/course-runtime/textbook/ch02/root-locus#sec1',
      locator: '#sec1',
      contentHash: 'sha256:def456',
    },
    metadata: {
      bookId: 'dorf-modern-control-systems',
      sectionId: 'ch02-sec01',
      chapterId: 'ch02',
      chapterNumber: 2,
    },
    ...overrides,
  };
}

function makeProjectionRow(overrides?: Partial<RuntimeResourceProjectionArtifactRow>): RuntimeResourceProjectionArtifactRow {
  return {
    artifactVersion: 'runtime-resource-projections.v1',
    id: 'proj-001',
    resourceNodeId: 'res-001',
    family: 'runtime-handout',
    resourceType: 'textbook-section',
    sourceKind: 'runtime_handout',
    sourceRef: 'runtime-handout:unit-3-4',
    sourcePathOrUrl: '/course/unit-3-4',
    sourceRecord: 'unit-3-4',
    sourceHash: 'sha256:source',
    sourceVersionRef: 'runtime.v1',
    projectionLevel: 'ResourceNode' as 'ResourceNode',
    routeTarget: '/course/unit-3-4',
    renderTarget: '/course/unit-3-4',
    title: 'Runtime handout',
    privacyScope: 'student-visible',
    evidenceContract: {
      evidenceFamily: 'course-content',
      evidenceCategory: 'handout',
    },
    reviewAudit: {
      status: 'human-confirmed',
      reviewedBy: 'teacher-001',
      reviewedAt: '2026-06-28T00:00:00Z',
      reviewedSourceHash: 'sha256:source',
      reviewedVersionRef: 'runtime.v1',
      findings: [],
    },
    segmentRefs: ['seg-001'],
    citationTargets: ['source-pack-citation:ct-001'],
    retrievalChunk: {
      id: 'rc-001',
      pathEligible: false,
      reason: 'resource-node-planning-audit-required',
    },
    pathEligibility: {
      current: true,
      afterCompletion: true,
      masteryAffecting: true,
      blockedBy: [],
    },
    groundingEligibility: {
      eligible: true,
      limitations: [],
    },
    versionRefs: {
      resourceRegistryVersion: 'v1.0.0',
      resourceProjectionVersion: 'v1.0.0',
    },
    ...overrides,
  } as RuntimeResourceProjectionArtifactRow;
}

// ─── Href Safety ─────────────────────────────────────────────────────────────

describe('isSafeHref', () => {
  it('accepts https', () => {
    expect(isSafeHref('https://example.com/page')).toBe(true);
  });

  it('accepts http', () => {
    expect(isSafeHref('http://example.com/page')).toBe(true);
  });

  it('accepts root-relative path', () => {
    expect(isSafeHref('/course/unit-3-4')).toBe(true);
  });

  it('rejects path-relative', () => {
    expect(isSafeHref('./page')).toBe(false);
    expect(isSafeHref('../parent/page')).toBe(false);
  });

  it('accepts anchor-only', () => {
    expect(isSafeHref('#section-1')).toBe(true);
  });

  it('rejects javascript:', () => {
    expect(isSafeHref('javascript:alert(1)')).toBe(false);
  });

  it('rejects data:', () => {
    expect(isSafeHref('data:text/html,<script>alert(1)</script>')).toBe(false);
  });

  it('rejects file:', () => {
    expect(isSafeHref('file:///etc/passwd')).toBe(false);
  });

  it('rejects protocol-relative (//)', () => {
    expect(isSafeHref('//evil.com/steal')).toBe(false);
  });

  it('rejects vbscript:', () => {
    expect(isSafeHref('vbscript:msgbox(1)')).toBe(false);
  });

  it('rejects null and empty', () => {
    expect(isSafeHref(null)).toBe(false);
    expect(isSafeHref(undefined)).toBe(false);
    expect(isSafeHref('')).toBe(false);
    expect(isSafeHref('   ')).toBe(false);
  });

  it('rejects whitespace or control characters in hrefs', () => {
    expect(isSafeHref('https://example.com\n/next')).toBe(false);
    expect(isSafeHref(' https://example.com')).toBe(false);
    expect(isSafeHref('https://example.com/\u0000')).toBe(false);
  });
});

describe('buildUnsafeHrefLimitation', () => {
  it('produces a blocking limitation', () => {
    const lim = buildUnsafeHrefLimitation('test-source');
    expect(lim.severity).toBe('blocking');
    expect(lim.code).toBe('citation-unsafe-href');
    expect(lim.recoverable).toBe(false);
  });
});

// ─── Citation Hydrator ──────────────────────────────────────────────────────

describe('hydrateCitationFromAddress', () => {
  it('produces a verified citation for safe href', () => {
    const { citation, limitations } = hydrateCitationFromAddress(
      'source-pack-citation:ct-001',
      'source-pack-source:src-001',
      {
        kind: 'text',
        sourceRefId: 'kaq:unit-3-4',
        href: '/course-runtime/unit-3-4',
        contentHash: 'sha256:abc',
      },
      'Test Title',
    );
    expect(citation.citationTargetId).toBe('source-pack-citation:ct-001');
    expect(citation.verified).toBe(true);
    expect(citation.href).toBe('/course-runtime/unit-3-4');
    expect(limitations).toHaveLength(0);
  });

  it('keeps generic http citation href unverified', () => {
    const { citation, limitations } = hydrateCitationFromAddress(
      'source-pack-citation:http',
      'source-pack-source:http',
      {
        kind: 'external',
        sourceRefId: 'external:http',
        href: 'http://example.com/page',
      },
      'HTTP reference',
    );
    expect(citation.href).toBe('http://example.com/page');
    expect(citation.verified).toBe(false);
    expect(limitations).toHaveLength(0);
  });

  it('keeps generic https citation href from CitationAddress unverified', () => {
    const { citation, limitations } = hydrateCitationFromAddress(
      'source-pack-citation:https',
      'source-pack-source:https',
      {
        kind: 'external',
        sourceRefId: 'model-authored-source',
        href: 'https://model.example/raw.md',
      },
      'HTTPS reference',
    );
    expect(citation.href).toBe('https://model.example/raw.md');
    expect(citation.resolver).toBe('server-owned-runtime');
    expect(citation.verified).toBe(false);
    expect(limitations).toHaveLength(0);
  });

  it('does not verify normalized relative hrefs outside governed paths', () => {
    const { citation } = hydrateCitationFromAddress(
      'source-pack-citation:path-traversal',
      'source-pack-source:path-traversal',
      {
        kind: 'text',
        sourceRefId: 'path-traversal',
        href: '/course-runtime/%2e%2e/admin',
      },
      'Path traversal',
    );
    expect(citation.href).toBe('/course-runtime/%2e%2e/admin');
    expect(citation.verified).toBe(false);
    expect(isVerifiedCitationHref('/course-runtime/../../admin', 'course-runtime')).toBe(false);
  });

  it('does not serialize encoded raw authoring hrefs', () => {
    const rawHref = '/resources/course-content%2Fauthoring%2Funit.md%23L42';
    const { citation, limitations } = hydrateCitationFromAddress(
      'source-pack-citation:raw',
      'source-pack-source:raw',
      {
        kind: 'text',
        sourceRefId: 'raw-source',
        href: rawHref,
      },
      'Raw authoring target',
    );
    expect(isVerifiedCitationHref(rawHref, 'course-runtime')).toBe(false);
    expect(isSerializableCitationHref(rawHref)).toBe(false);
    expect(citation.verified).toBe(false);
    expect(citation.href).toBeUndefined();
    expect(limitations.some((limitation) => limitation.code === 'citation-raw-target-href')).toBe(true);

    expect(() => buildSourcePack({
      query: 'raw href',
      items: [{
        id: 'raw-item',
        title: 'Raw item',
        sourceKind: 'textbook',
        modality: 'text',
        excerpt: 'raw item',
        inclusionRationale: 'raw href is not serialized',
        retrievalChunkId: 'source-pack-chunk:raw',
        citationTargetId: 'source-pack-citation:raw',
        scores: { relevance: 1, final: 1 },
        access: { visibility: 'public', aiUseAllowed: true },
        citation,
      }],
      limitations,
      now: new Date('2026-06-28T00:00:00Z'),
    })).not.toThrow();
  });

  it('marks as unverified with limitation for missing href', () => {
    const { citation, limitations } = hydrateCitationFromAddress(
      'ct-002',
      'src-002',
      { sourceRefId: 'ref-002', href: null },
      'Missing Href Title',
    );
    expect(citation.verified).toBe(false);
    expect(limitations.some((l) => l.code === 'citation-missing-href')).toBe(true);
  });

  it('rejects unsafe href with blocking limitation', () => {
    const { citation, limitations } = hydrateCitationFromAddress(
      'ct-003',
      'src-003',
      { sourceRefId: 'ref-003', href: 'javascript:alert(1)' },
      'Evil Title',
    );
    expect(citation.verified).toBe(false);
    expect(limitations.some((l) => l.code === 'citation-unsafe-href')).toBe(true);
  });

  it('produces warning for missing sourceRefId', () => {
    const { citation, limitations } = hydrateCitationFromAddress(
      'ct-004',
      'src-004',
      { href: '/safe/path' },
      'No Ref Title',
    );
    expect(citation.verified).toBe(false);
    expect(limitations.some((l) => l.code === 'citation-missing-source-ref')).toBe(true);
  });
});

describe('hydrateCitationFromTarget', () => {
  it('produces a verified citation from a valid target', () => {
    const { citation, limitations } = hydrateCitationFromTarget(
      'source-pack-citation:ct-001',
      'source-pack-source:src-001',
      { id: 'source-pack-citation:ct-001', label: 'Test Target', href: '/course-runtime/safe/path', verified: true },
    );
    expect(citation.verified).toBe(true);
    expect(limitations).toHaveLength(0);
  });

  it('flags stale targets', () => {
    const { citation, limitations } = hydrateCitationFromTarget(
      'ct-002', 'src-002',
      { id: 'ct-002', label: 'Stale', stale: true, href: '/course-runtime/path', verified: true },
    );
    expect(citation.verified).toBe(false);
    expect(limitations.some((l) => l.code === 'citation-stale')).toBe(true);
  });

  it('flags restricted targets', () => {
    const { citation, limitations } = hydrateCitationFromTarget(
      'ct-003', 'src-003',
      { id: 'ct-003', label: 'Restricted', restricted: true, href: '/course-runtime/path', verified: true },
    );
    expect(citation.verified).toBe(false);
    expect(limitations.some((l) => l.code === 'citation-restricted')).toBe(true);
  });

  it('flags provisional targets', () => {
    const { citation, limitations } = hydrateCitationFromTarget(
      'ct-004', 'src-004',
      { id: 'ct-004', label: 'Provisional', provisional: true, href: '/course-runtime/path', verified: true },
    );
    expect(citation.verified).toBe(false);
    expect(limitations.some((l) => l.code === 'citation-provisional')).toBe(true);
  });
});

// ─── Privacy Filtering ──────────────────────────────────────────────────────

describe('privacy filtering', () => {
  it('allows public chunk for student role', () => {
    const chunk = makeChunk({ privacyClass: 'public' });
    const { item, limitations } = adaptLearningEvidenceChunk(chunk, { role: 'student' });
    expect(item).not.toBeNull();
    expect(limitations.filter((l) => l.code === 'privacy-excluded')).toHaveLength(0);
  });

  it('allows student-visible chunk for matching student owner', () => {
    const chunk = makeScopedChunk('student-visible', ['student'], {
      sourceRef: {
        ...makeChunk().sourceRef,
        ownerUserId: 'student-1',
      },
    });
    const { item } = adaptLearningEvidenceChunk(chunk, { role: 'student', userId: 'student-1' });
    expect(item).not.toBeNull();
  });

  it('excludes teacher-visible chunk for student with limitation', () => {
    const chunk = makeScopedChunk('teacher-visible', ['teacher'], {
      sourceRef: {
        ...makeChunk().sourceRef,
        classId: 'class-1',
      },
    });
    const { item, limitations } = adaptLearningEvidenceChunk(chunk, { role: 'student', classIds: ['class-1'] });
    expect(item).toBeNull();
    expect(limitations.some((l) => l.code === 'scope-excluded')).toBe(true);
  });

  it('allows teacher-visible chunk for matching teacher class', () => {
    const chunk = makeScopedChunk('teacher-visible', ['teacher'], {
      sourceRef: {
        ...makeChunk().sourceRef,
        classId: 'class-1',
      },
    });
    const { item } = adaptLearningEvidenceChunk(chunk, { role: 'teacher', classIds: ['class-1'] });
    expect(item).not.toBeNull();
  });

  it('allows admin-only chunk for admin', () => {
    const chunk = makeScopedChunk('admin-only', ['admin']);
    const { item } = adaptLearningEvidenceChunk(chunk, { role: 'admin' });
    expect(item).not.toBeNull();
  });

  it('excludes admin-only chunk for teacher', () => {
    const chunk = makeScopedChunk('admin-only', ['admin']);
    const { item } = adaptLearningEvidenceChunk(chunk, { role: 'teacher' });
    expect(item).toBeNull();
  });

  it('excludes service-only chunk for student', () => {
    const chunk = makeScopedChunk('service-only', ['service']);
    const { item } = adaptLearningEvidenceChunk(chunk, { role: 'student' });
    expect(item).toBeNull();
  });

  it('excludes teacher-visible chunk when class scope does not match', () => {
    const chunk = makeScopedChunk('teacher-visible', ['teacher'], {
      sourceRef: {
        ...makeChunk().sourceRef,
        classId: 'class-1',
      },
    });
    const { item, limitations } = adaptLearningEvidenceChunk(chunk, { role: 'teacher', classIds: ['class-2'] });
    expect(item).toBeNull();
    expect(limitations.some((l) => l.code === 'scope-excluded')).toBe(true);
  });

  it('excludes chunks when allowedRoles omits caller role', () => {
    const chunk = makeScopedChunk('public', ['teacher']);
    const { item } = adaptLearningEvidenceChunk(chunk, { role: 'student' });
    expect(item).toBeNull();
  });

  it('excludes chunks blocked for the requested resource projection scene', () => {
    const chunk = makeChunk({
      resourceProjection: {
        ...makeChunk().resourceProjection!,
        pathEligibility: undefined,
        sceneAvailability: {
          konling: {
            allowed: false,
            limitation: 'konling blocked',
          },
        },
      },
      retrieval: {
        ...makeChunk().retrieval,
        useCases: ['konling'],
      },
    });
    const { item, limitations } = adaptLearningEvidenceChunk(chunk, { role: 'teacher', useCase: 'konling' });
    expect(item).toBeNull();
    expect(limitations.some((limitation) => limitation.code === 'scope-excluded')).toBe(true);
  });

  it('excludes chunks with source type incompatible with requested use case', () => {
    const chunk = makeChunk({
      sourceType: 'teacher-report',
      family: 'report',
      retrieval: {
        ...makeChunk().retrieval,
        useCases: ['grading'],
      },
      authority: {
        ...makeChunk().authority,
        level: 'teacher-authored',
      },
    });
    const { item, limitations } = adaptLearningEvidenceChunk(chunk, { role: 'teacher', useCase: 'grading' });
    expect(item).toBeNull();
    expect(limitations.some((limitation) => limitation.code === 'scope-excluded')).toBe(true);
  });

  it('does not use raw URL refs as learning evidence citation target ids', () => {
    const chunk = makeChunk({
      resourceProjection: {
        ...makeChunk().resourceProjection!,
        citationTargetRef: 'external:https://example.com/citation',
      },
      citationAddress: {
        ...makeChunk().citationAddress!,
        sourceRefId: 'https://example.com/source',
      },
    });
    const { item, limitations } = adaptLearningEvidenceChunk(chunk, { role: 'teacher' });
    expect(item?.citationTargetId).toBe('learning-evidence-citation:external-https-example.com-citation');
    expect(item?.citation?.citationTargetId).toBe(item?.citationTargetId);
    expect(item?.citationTargetId).not.toContain('https://');
    expect(limitations.some((limitation) => limitation.code === 'citation-target-raw-ref')).toBe(true);
  });

  it('keeps learning evidence https citation addresses unverified', () => {
    const chunk = makeChunk({
      citationAddress: {
        ...makeChunk().citationAddress!,
        sourceRefId: 'kaq:unit-3-4:model-authored',
        href: 'https://model.example/raw.md',
        externalUrl: 'https://model.example/raw.md',
      },
    });
    const { item } = adaptLearningEvidenceChunk(chunk, { role: 'teacher' });
    expect(item?.citation?.href).toBe('https://model.example/raw.md');
    expect(item?.citation?.resolver).toBe('server-owned-runtime');
    expect(item?.citation?.verified).toBe(false);
  });

  it('feeds learning evidence resource, goal, and quality metadata into hybrid coverage', () => {
    const chunk = makeChunk({
      sourceRef: {
        ...makeChunk().sourceRef,
        goalId: 'goal-from-source',
        resourceId: 'resource-from-source',
      },
      resourceProjection: {
        ...makeChunk().resourceProjection!,
        resourceId: 'res-001',
        graphNodeRefs: {
          knowledge: ['kn-001'],
          capability: ['cap-001'],
          quality: ['quality-001'],
        },
      },
      retrieval: {
        ...makeChunk().retrieval,
        goals: ['goal-001'],
      },
    });
    const { item } = adaptLearningEvidenceChunk(chunk, { role: 'teacher' });
    expect(item).not.toBeNull();
    if (!item) return;

    expect(item.metadata?.resourceId).toBe('res-001');
    expect(item.metadata?.resourceIds).toEqual(['res-001', 'resource-from-source']);
    expect(item.metadata?.learningGoalIds).toEqual(['goal-001', 'goal-from-source']);
    expect(item.metadata?.qualityTargetRefs).toEqual(['quality-001']);

    const result = retrieveSourcePack({
      query: '闭环极点配置',
      profile: 'lesson-design',
      role: 'teacher',
      topK: 1,
      resourceIds: ['res-001'],
      learningGoalIds: ['goal-001'],
      qualityTargetRefs: ['quality-001'],
      candidates: [item],
      now: new Date('2026-06-28T00:00:00Z'),
    });
    const codes = result.pack.limitations.map((limitation) => limitation.code);
    expect(result.pack.items.map((packItem) => packItem.id)).toEqual(['chunk-001']);
    expect(codes).not.toContain('coverage-missing-resource');
    expect(codes).not.toContain('coverage-missing-learning-goal');
    expect(codes).not.toContain('coverage-missing-quality-target');
  });

  it('does not use authoring paths or line targets as learning evidence citation target ids', () => {
    const chunk = makeChunk({
      resourceProjection: {
        ...makeChunk().resourceProjection!,
        citationTargetRef: 'course-content/authoring/unit-3-4.md',
      },
      citationAddress: {
        ...makeChunk().citationAddress!,
        sourceRefId: 'kaq:unit-3-4#L42',
      },
    });
    const { item, limitations } = adaptLearningEvidenceChunk(chunk, { role: 'teacher' });
    expect(item?.citationTargetId).toBe('learning-evidence-citation:course-content-authoring-unit-3-4.md');
    expect(item?.citationTargetId).not.toContain('course-content/authoring');
    expect(item?.citationTargetId).not.toContain('#L42');
    expect(limitations.some((limitation) => limitation.code === 'citation-target-raw-ref')).toBe(true);
  });

  it('decodes encoded raw refs before accepting learning evidence citation target ids', () => {
    const chunk = makeChunk({
      resourceProjection: {
        ...makeChunk().resourceProjection!,
        citationTargetRef: 'raw:https%2525253A%2525252F%2525252Fexample.com%2525252Funit-3-4.md',
      },
      citationAddress: {
        ...makeChunk().citationAddress!,
        sourceRefId: 'raw:course-content%2Fauthoring%2Funit-3-4.md%23L42',
      },
    });
    const { item, limitations } = adaptLearningEvidenceChunk(chunk, { role: 'teacher' });
    expect(item?.citationTargetId).toBe('learning-evidence-citation:raw-https-2525253A-2525252F-2525252Fexample.com-2525252Funit-3-4.md');
    expect(item?.citationTargetId).not.toContain('course-content/authoring');
    expect(item?.citationTargetId).not.toContain('https://');
    expect(limitations.some((limitation) => limitation.code === 'citation-target-raw-ref')).toBe(true);
  });
});

// ─── Unsafe Href Rejection ──────────────────────────────────────────────────

describe('unsafe href rejection', () => {
  it('rejects javascript: href in chunk display', () => {
    const chunk = makeChunk({
      display: { title: 'Test', href: 'javascript:doBad()', capsule: 'bad' },
    });
    const { limitations } = adaptLearningEvidenceChunk(chunk, { role: 'teacher' });
    expect(limitations.some((l) => l.code === 'citation-unsafe-href')).toBe(true);
  });

  it('rejects javascript: href in chunk citationAddress', () => {
    const chunk = makeChunk({
      citationAddress: {
        ...makeChunk().citationAddress!,
        href: 'javascript:void(0)',
      },
    });
    const { limitations } = adaptLearningEvidenceChunk(chunk, { role: 'teacher' });
    expect(limitations.some((l) => l.code === 'citation-unsafe-href')).toBe(true);
  });

  it('rejects data: href in textbook doc', () => {
    const doc = makeTextbookDoc({ href: 'data:text/html,<h1>hi</h1>' });
    const { limitations } = adaptTextbookSearchDocument(doc);
    expect(limitations.some((l) => l.code === 'citation-unsafe-href')).toBe(true);
  });
});

// ─── Textbook Citation Preservation ──────────────────────────────────────────

describe('textbook citation preservation', () => {
  it('preserves textbook doc metadata in output', () => {
    const doc = makeTextbookDoc();
    const { item } = adaptTextbookSearchDocument(doc);
    expect(item.sourceKind).toBe('textbook');
    expect(item.resourceNodeId).toBeUndefined();
    expect(item.citation).toBeDefined();
    expect(item.citation?.citationTargetId).toBe('textbook:ch02:root-locus');
    expect(item.metadata?.resourceId).toBe('res-002');
    expect(item.metadata?.bookId).toBe('dorf-modern-control-systems');
    expect(item.metadata?.sectionId).toBe('ch02-sec01');
    expect(item.metadata?.chapterId).toBe('ch02');
    expect(item.metadata?.chapterNumber).toBe(2);
    expect(item.metadata?.segmentRef).toBe('seg-002');
    expect(item.metadata?.citationLocator).toBe('#sec1');
    expect(item.metadata?.sourceVersion).toBe('resource-projection.v1');
    expect(item.metadata?.artifactVersioningVersion).toBe('kaq-artifact-versioning.v1');
    expect(item.metadata?.graphCatalogVersion).toBe('graph-catalog.v1');
    expect(item.metadata?.resourceRegistryVersion).toBe('resource-registry.v1');
    expect(item.metadata?.resourceProjectionVersion).toBe('resource-projection.v1');
    expect(item.metadata?.groundingVersion).toBe('grounding.v1');
    expect(item.metadata?.citationVersion).toBe('citation.v1');
    expect(item.metadata?.knowledgeNodeRefs).toEqual(['kn-002']);
    expect(item.metadata?.capabilityTargetRefs).toEqual(['cap-002']);
    expect(item.metadata?.reviewStatus).toBe('canonical');
    expect(item.metadata?.authorityLevel).toBe('canonical');
  });

  it('derives textbook citation locator from href when locator is missing', () => {
    const doc = makeTextbookDoc({
      citationAddress: {
        ...makeTextbookDoc().citationAddress!,
        locator: undefined,
      },
    });
    const { item } = adaptTextbookSearchDocument(doc);
    expect(item.metadata?.citationLocator).toBe('sec1');
  });

  it('derives textbook citation locator from doc href when citation address href has no hash', () => {
    const doc = makeTextbookDoc({
      href: '/course-runtime/textbook/ch02/root-locus#doc-sec1',
      citationAddress: {
        ...makeTextbookDoc().citationAddress!,
        locator: undefined,
        href: '/course-runtime/textbook/ch02/root-locus',
      },
    });
    const { item } = adaptTextbookSearchDocument(doc);
    expect(item.metadata?.citationLocator).toBe('doc-sec1');
  });

  it('does not use raw URL refs as textbook citation target ids', () => {
    const doc = makeTextbookDoc({
      resourceProjection: {
        ...makeTextbookDoc().resourceProjection,
        citationTargetRef: 'external:https://example.com/textbook-citation',
      },
      citationAddress: {
        ...makeTextbookDoc().citationAddress!,
        sourceRefId: 'https://example.com/textbook-source',
      },
    });
    const { item, limitations } = adaptTextbookSearchDocument(doc);
    expect(item.citationTargetId).toBe('textbook-citation:external-https-example.com-textbook-citation');
    expect(item.citation?.citationTargetId).toBe(item.citationTargetId);
    expect(item.citationTargetId).not.toContain('https://');
    expect(limitations.some((limitation) => limitation.code === 'citation-target-raw-ref')).toBe(true);
  });

  it('keeps textbook https citation addresses unverified', () => {
    const doc = makeTextbookDoc({
      citationAddress: {
        ...makeTextbookDoc().citationAddress!,
        sourceRefId: 'textbook:ch02:model-authored',
        href: 'https://model.example/textbook.md',
      },
    });
    const { item } = adaptTextbookSearchDocument(doc);
    expect(item.citation?.href).toBe('https://model.example/textbook.md');
    expect(item.citation?.resolver).toBe('server-owned-runtime');
    expect(item.citation?.verified).toBe(false);
  });

  it('does not use authoring paths or line targets as textbook citation target ids', () => {
    const doc = makeTextbookDoc({
      resourceProjection: {
        ...makeTextbookDoc().resourceProjection,
        citationTargetRef: 'course-content/authoring/textbook/ch02.md',
      },
      citationAddress: {
        ...makeTextbookDoc().citationAddress!,
        sourceRefId: 'textbook:ch02#L100',
      },
    });
    const { item, limitations } = adaptTextbookSearchDocument(doc);
    expect(item.citationTargetId).toBe('textbook-citation:course-content-authoring-textbook-ch02.md');
    expect(item.citationTargetId).not.toContain('course-content/authoring');
    expect(item.citationTargetId).not.toContain('#L100');
    expect(limitations.some((limitation) => limitation.code === 'citation-target-raw-ref')).toBe(true);
  });

  it('preserves citation address in textbook output', () => {
    const doc = makeTextbookDoc();
    const { item } = adaptTextbookSearchDocument(doc);
    expect(item.citation).toBeDefined();
    expect(item.citation?.verified).toBe(true);
    expect(item.citation?.href).toBe('/course-runtime/textbook/ch02/root-locus#sec1');
  });

  it('warns for missing href in textbook doc', () => {
    const doc = makeTextbookDoc({
      href: null,
      citationAddress: {
        ...makeTextbookDoc().citationAddress!,
        href: null,
      },
    });
    const { limitations } = adaptTextbookSearchDocument(doc);
    expect(limitations.some((l) => l.code === 'textbook-missing-href')).toBe(true);
  });
});

// ─── Retrieval Chunk Not Path Eligible ───────────────────────────────────────

describe('retrieval chunk not path eligible', () => {
  it('assigns retrievalChunkId but not resourceNodeId when pathEligible is false', () => {
    const row = makeProjectionRow({
      pathEligibility: {
        current: false,
        afterCompletion: false,
        masteryAffecting: false,
        blockedBy: [],
      },
    });
    const { item, limitations } = adaptResourceProjectionRow(row);
    expect(item.retrievalChunkId).toBe('resource-projection-chunk:rc-001');
    expect(item.resourceNodeId).toBeUndefined();
    expect(item.planningUnitId).toBeUndefined();
    expect(limitations.some((l) => l.code === 'retrieval-only-not-path-eligible')).toBe(true);
  });

  it('assigns resourceNodeId when pathEligible is true and projectionLevel is ResourceNode', () => {
    const row = makeProjectionRow({
      pathEligibility: {
        current: true,
        afterCompletion: true,
        masteryAffecting: true,
        blockedBy: [],
      },
      projectionLevel: 'ResourceNode' as 'ResourceNode',
    });
    const { item } = adaptResourceProjectionRow(row);
    expect(item.resourceNodeId).toBe('res-001');
    expect(item.retrievalChunkId).toBe('resource-projection-chunk:rc-001');
    expect(item.sourceKind).toBe('runtime-lesson');
  });

  it('feeds resource projection graph metadata into hybrid coverage', () => {
    const row = makeProjectionRow({
      graphNodeRefs: {
        knowledge: ['kn-001'],
        capability: ['cap-001'],
        quality: ['quality-001'],
      },
      pathEligibility: {
        current: true,
        afterCompletion: true,
        masteryAffecting: true,
        blockedBy: [],
      },
      projectionLevel: 'ResourceNode' as 'ResourceNode',
    });
    const { item } = adaptResourceProjectionRow(row);

    expect(item.metadata?.resourceId).toBe('res-001');
    expect(item.metadata?.resourceIds).toEqual(['res-001', 'proj-001']);
    expect(item.metadata?.knowledgeNodeRefs).toEqual(['kn-001']);
    expect(item.metadata?.capabilityTargetRefs).toEqual(['cap-001']);
    expect(item.metadata?.qualityTargetRefs).toEqual(['quality-001']);

    const result = retrieveSourcePack({
      query: 'Runtime handout',
      profile: 'lesson-design',
      role: 'teacher',
      topK: 1,
      resourceIds: ['res-001'],
      qualityTargetRefs: ['quality-001'],
      candidates: [item],
      now: new Date('2026-06-28T00:00:00Z'),
    });
    const codes = result.pack.limitations.map((limitation) => limitation.code);
    expect(result.pack.items.map((packItem) => packItem.id)).toEqual(['proj-001']);
    expect(codes).not.toContain('coverage-missing-resource');
    expect(codes).not.toContain('coverage-missing-quality-target');
  });

  it('keeps knowledge-card resource projections as knowledge-card source kind', () => {
    const row = makeProjectionRow({
      family: 'knowledge-card',
      sourceKind: 'knowledge_card',
      projectionLevel: 'ResourceNode' as 'ResourceNode',
    });
    const { item } = adaptResourceProjectionRow(row);
    expect(item.sourceKind).toBe('knowledge-card');
  });

  it('preserves runtime media projection modality', () => {
    const row = makeProjectionRow({
      family: 'runtime-lesson-media',
      sourceKind: 'runtime_lesson_media',
      resourceType: 'video',
      projectionLevel: 'ResourceNode' as 'ResourceNode',
    });
    const { item } = adaptResourceProjectionRow(row);
    expect(item.sourceKind).toBe('runtime-lesson');
    expect(item.modality).toBe('video');
  });

  it('maps runtime media slides to interactive modality', () => {
    const row = makeProjectionRow({
      family: 'runtime-lesson-media',
      sourceKind: 'runtime_lesson_media',
      resourceType: 'slides' as 'image',
      projectionLevel: 'ResourceNode' as 'ResourceNode',
    });
    const { item } = adaptResourceProjectionRow(row);
    expect(item.modality).toBe('interactive');
  });

  it('assigns planningUnitId for path-eligible PlanningUnit projection', () => {
    const row = makeProjectionRow({
      projectionLevel: 'PlanningUnit' as 'PlanningUnit',
      pathEligibility: {
        current: true,
        afterCompletion: true,
        masteryAffecting: true,
        blockedBy: [],
      },
    });
    const { item } = adaptResourceProjectionRow(row);
    expect(item.resourceNodeId).toBe('res-001');
    expect(item.planningUnitId).toBe('planning-unit:res-001');
  });

  it('retrieval chunk is carried even when not path eligible', () => {
    // Key contract: retrievalChunkId is ALWAYS populated when chunk exists,
    // regardless of path eligibility. This proves RetrievalChunk/CitationTarget
    // can support citations without becoming PathNode candidates.
    const row = makeProjectionRow({
      pathEligibility: {
        current: false,
        afterCompletion: false,
        masteryAffecting: false,
        blockedBy: ['missing-path-target'],
      },
    });
    const { item } = adaptResourceProjectionRow(row);
    expect(item.retrievalChunkId).toBe('resource-projection-chunk:rc-001');
  });

  it('learning evidence chunk does not become a path node without eligibility', () => {
    const chunk = makeChunk({
      resourceProjection: {
        ...makeChunk().resourceProjection!,
        pathEligibility: { eligible: false, reason: 'resource-node-planning-audit-required' },
      },
      citationAddress: {
        ...makeChunk().citationAddress!,
        imageRegion: { x: 10, y: 20, width: 120, height: 80 },
      },
    });
    const { item, limitations } = adaptLearningEvidenceChunk(chunk, { role: 'teacher' });
    expect(item?.retrievalChunkId).toBe('learning-evidence:chunk-001');
    expect(item?.resourceNodeId).toBeUndefined();
    expect(limitations.some((limitation) => limitation.code === 'retrieval-only-not-path-eligible')).toBe(true);
  });
});

// ─── Stale / Provisional Limitations ─────────────────────────────────────────

describe('stale and provisional limitations', () => {
  it('flags stale learning evidence chunks', () => {
    const chunk = makeChunk({
      freshness: {
        indexedAt: '2025-01-01T00:00:00Z',
        sourceUpdatedAt: '2024-12-01T00:00:00Z',
        expiresAt: '2025-06-01T00:00:00Z',
        stale: true,
      },
    });
    const { limitations } = adaptLearningEvidenceChunk(chunk, { role: 'teacher' });
    expect(limitations.some((l) => l.code === 'evidence-stale')).toBe(true);
  });

  it('isProvisionalReview returns true for generated-provisional', () => {
    expect(isProvisionalReview('generated-provisional')).toBe(true);
  });

  it('isProvisionalReview returns true for model-assisted-provisional', () => {
    expect(isProvisionalReview('model-assisted-provisional')).toBe(true);
  });

  it('isProvisionalReview returns true for not-reviewed', () => {
    expect(isProvisionalReview('not-reviewed')).toBe(true);
  });

  it('isProvisionalReview returns false for human-confirmed', () => {
    expect(isProvisionalReview('human-confirmed')).toBe(false);
  });

  it('flags provisional projection rows', () => {
    const row = makeProjectionRow({
      reviewAudit: {
        ...makeProjectionRow().reviewAudit,
        status: 'generated-provisional',
      },
    } as Partial<RuntimeResourceProjectionArtifactRow> as RuntimeResourceProjectionArtifactRow);
    const { limitations } = adaptResourceProjectionRow(row);
    expect(limitations.some((l) => l.code === 'projection-provisional')).toBe(true);
  });

  it('flags stale human-confirmed projection rows when reviewed source changed', () => {
    const row = makeProjectionRow({
      reviewAudit: {
        ...makeProjectionRow().reviewAudit,
        status: 'human-confirmed',
        reviewedSourceHash: 'sha256:old-source',
        reviewedVersionRef: 'runtime.old',
      },
    });
    const { item, limitations } = adaptResourceProjectionRow(row);
    expect(limitations.some((limitation) => limitation.code === 'projection-stale')).toBe(true);
    expect(item.scores.freshness).toBe(0.3);
  });

  it('does not flag projection reviews when prompt hash differs from reviewed source hash', () => {
    const row = makeProjectionRow({
      sourceHash: 'sha256:manifest-source',
      reviewAudit: {
        ...makeProjectionRow().reviewAudit,
        status: 'human-confirmed',
        reviewedSourceHash: 'sha256:manifest-source',
        promptOrManifestHash: 'sha256:manifest-plus-overlay',
        reviewedVersionRef: 'runtime.v1',
      },
    });
    const { item, limitations } = adaptResourceProjectionRow(row);
    expect(limitations.some((limitation) => limitation.code === 'projection-stale')).toBe(false);
    expect(item.scores.freshness).toBeGreaterThan(0.3);
  });

  it('flags knowledge projections when reviewed source hash only matches the packet hash', () => {
    const row = makeProjectionRow({
      family: 'knowledge-card',
      resourceType: 'knowledge_card',
      sourceKind: 'knowledge_graph',
      sourceHash: 'sha256:current-knowledge-source',
      reviewAudit: {
        ...makeProjectionRow().reviewAudit,
        status: 'human-confirmed',
        reviewedSourceHash: 'sha256:knowledge-review-packet',
        promptOrManifestHash: 'sha256:knowledge-review-packet',
        reviewedVersionRef: 'runtime.v1',
      },
    });
    const { item, limitations } = adaptResourceProjectionRow(row);
    expect(limitations.some((limitation) => limitation.code === 'projection-stale')).toBe(true);
    expect(item.scores.freshness).toBe(0.3);
  });

  it('flags projection rows with explicit stale review status', () => {
    const row = makeProjectionRow({
      reviewAudit: {
        ...makeProjectionRow().reviewAudit,
        status: 'stale',
      },
    });
    const { item, limitations } = adaptResourceProjectionRow(row);
    expect(limitations.some((limitation) => limitation.code === 'projection-stale')).toBe(true);
    expect(item.scores.freshness).toBe(0.3);
  });
});

// ─── SourcePackItem Structure ────────────────────────────────────────────────

describe('adapted SourcePackItem structure', () => {
  it('learning evidence chunk produces valid SourcePackItem fields', () => {
    const chunk = makeChunk({
      citationAddress: {
        ...makeChunk().citationAddress!,
        imageRegion: {
          x: 10,
          y: 20,
          width: 120,
          height: 80,
        },
      },
      resourceProjection: {
        ...makeChunk().resourceProjection!,
        versionRefs: {
          artifactVersioningVersion: 'kaq-artifact-versioning.v1',
          graphCatalogVersion: 'graph-catalog.v1',
          resourceRegistryVersion: 'resource-registry.v1',
          resourceProjectionVersion: 'resource-projection.v1',
          groundingVersion: 'grounding.v1',
          citationVersion: 'citation.v1',
        },
      },
    });
    const { item } = adaptLearningEvidenceChunk(chunk, { role: 'teacher' });
    expect(item).not.toBeNull();
    if (!item) return;

    expect(item.id).toBe('chunk-001');
    expect(item.title).toBe('闭环极点配置');
    expect(item.sourceKind).toBe('textbook');
    expect(item.modality).toBe('text');
    expect(typeof item.excerpt).toBe('string');
    expect(item.excerpt.length).toBeGreaterThan(0);
    expect(item.scores).toBeDefined();
    expect(item.scores.relevance).toBeGreaterThanOrEqual(0);
    expect(item.scores.relevance).toBeLessThanOrEqual(1);
    expect(item.scores.final).toBeGreaterThanOrEqual(0);
    expect(item.scores.final).toBeLessThanOrEqual(1);
    expect(item.access.aiUseAllowed).toBe(true);
    expect(item.resourceNodeId).toBeUndefined();
    expect(item.retrievalChunkId).toBe('learning-evidence:chunk-001');
    expect(item.citationTargetId).toBe('source-pack-citation:ct-001');
    expect(item.metadata?.spanKind).toBe('text-range');
    expect(item.metadata?.spanStart).toBe(0);
    expect(item.metadata?.spanEnd).toBe(100);
    expect(item.metadata?.citationAddressKind).toBe('text');
    expect(item.metadata?.citationLocator).toBe('#pole-placement');
    expect(item.metadata?.citationImageRegionX).toBe(10);
    expect(item.metadata?.citationImageRegionY).toBe(20);
    expect(item.metadata?.citationImageRegionWidth).toBe(120);
    expect(item.metadata?.citationImageRegionHeight).toBe(80);
    expect(item.metadata?.knowledgeNodeRefs).toEqual(['kn-001']);
    expect(item.metadata?.capabilityTargetRefs).toEqual(['cap-001']);
    expect(item.metadata?.artifactVersioningVersion).toBe('kaq-artifact-versioning.v1');
    expect(item.metadata?.resourceProjectionVersion).toBe('resource-projection.v1');
  });

  it('textbook doc produces valid SourcePackItem', () => {
    const doc = makeTextbookDoc();
    const { item } = adaptTextbookSearchDocument(doc);
    expect(item.id).toBe('doc-001');
    expect(item.sourceKind).toBe('textbook');
    expect(item.citation).toBeDefined();
    expect(item.metadata?.bookId).toBeDefined();
  });

  it('resource projection row produces valid SourcePackItem', () => {
    const row = makeProjectionRow();
    const { item } = adaptResourceProjectionRow(row);
    expect(item.id).toBe('proj-001');
    expect(item.retrievalChunkId).toBe('resource-projection-chunk:rc-001');
    expect(item.citationTargetId).toBe('source-pack-citation:ct-001');
  });
});

// ─── Batch Adaptation ────────────────────────────────────────────────────────

describe('adaptLearningEvidenceBatch', () => {
  it('processes multiple chunks with privacy filtering', () => {
    const chunks = [
      makeChunk({ id: 'chunk-public', privacyClass: 'public' }),
      makeScopedChunk('teacher-visible', ['teacher'], {
        id: 'chunk-teacher',
        sourceRef: {
          ...makeChunk().sourceRef,
          classId: 'class-1',
        },
      }),
      makeScopedChunk('admin-only', ['admin'], { id: 'chunk-admin' }),
      makeScopedChunk('service-only', ['service'], { id: 'chunk-service' }),
    ];
    const result = adaptLearningEvidenceBatch(chunks, { role: 'teacher', classIds: ['class-1'] });
    expect(result.summary.totalInputChunks).toBe(4);
    // Teacher should see public + teacher-visible = 2
    expect(result.items).toHaveLength(2);
    expect(result.summary.privacyExcluded).toBeGreaterThanOrEqual(1);
  });

  it('does not count non-privacy scope exclusions as privacyExcluded', () => {
    const result = adaptLearningEvidenceBatch([
      makeChunk({
        id: 'chunk-usecase-excluded',
        retrieval: {
          ...makeChunk().retrieval,
          useCases: ['diagnosis'],
        },
      }),
    ], { role: 'teacher', useCase: 'konling' });
    expect(result.items).toHaveLength(0);
    expect(result.limitations.some((limitation) => limitation.code === 'scope-excluded')).toBe(true);
    expect(result.summary.privacyExcluded).toBe(0);
    expect(result.summary.sourceTypeExcluded).toBe(0);
  });

  it('counts cross-owner student-visible exclusions as privacyExcluded', () => {
    const result = adaptLearningEvidenceBatch([
      makeScopedChunk('student-visible', ['student'], {
        id: 'chunk-other-student',
        sourceRef: {
          ...makeChunk().sourceRef,
          ownerUserId: 'student-2',
        },
      }),
    ], { role: 'student', userId: 'student-1' });
    expect(result.items).toHaveLength(0);
    expect(result.limitations.some((limitation) => limitation.code === 'scope-excluded')).toBe(true);
    expect(result.summary.privacyExcluded).toBe(1);
  });
});

// ─── Path Eligibility Separation (spec requirement) ──────────────────────────

describe('path eligibility separation', () => {
  it('retrieval chunk does not become path-plannable node without ResourceNode audit', () => {
    // A row that only has a RetrievalChunk (projectionLevel = RetrievalChunk)
    // and pathEligibility.current = false should NOT get resourceNodeId
    const row = makeProjectionRow({
      projectionLevel: 'RetrievalChunk' as 'RetrievalChunk',
      pathEligibility: {
        current: false,
        afterCompletion: false,
        masteryAffecting: false,
        blockedBy: ['missing-path-target'],
      },
    });
    const { item, limitations } = adaptResourceProjectionRow(row);
    expect(item.retrievalChunkId).toBe('resource-projection-chunk:rc-001');
    expect(item.resourceNodeId).toBeUndefined();
    expect(item.planningUnitId).toBeUndefined();
    expect(limitations.some((l) => l.code === 'retrieval-only-not-path-eligible')).toBe(true);
  });

  it('CitationTarget row does not become path-plannable without ResourceNode audit', () => {
    const row = makeProjectionRow({
      projectionLevel: 'CitationTarget' as 'CitationTarget',
      pathEligibility: {
        current: false,
        afterCompletion: false,
        masteryAffecting: false,
        blockedBy: [],
      },
    });
    const { item } = adaptResourceProjectionRow(row);
    expect(item.citationTargetId).toBe('source-pack-citation:ct-001');
    expect(item.resourceNodeId).toBeUndefined();
    expect(item.planningUnitId).toBeUndefined();
  });

  it('does not write path-like citation target refs into citationTargetId', () => {
    const row = makeProjectionRow({
      citationTargets: ['/course-runtime/lessons/3-4#root-locus'],
    });
    const { item, limitations } = adaptResourceProjectionRow(row);
    expect(item.citationTargetId).toBeUndefined();
    expect(item.metadata?.citationTargetRefs).toEqual(['/course-runtime/lessons/3-4#root-locus']);
    expect(limitations.some((limitation) => limitation.code === 'citation-target-not-governed-id')).toBe(true);
  });

  it('decodes projection citation refs before accepting governed ids', () => {
    const row = makeProjectionRow({
      citationTargets: [
        'external:https%3A%2F%2Fexample.com%2Funit-3-4.md',
        'raw:course-content%252Fauthoring%252Funit-3-4.md%2523L42',
      ],
    });
    const { item, limitations } = adaptResourceProjectionRow(row);
    expect(item.citationTargetId).toBeUndefined();
    expect(item.metadata?.citationTargetRefs).toEqual([
      'external:https%3A%2F%2Fexample.com%2Funit-3-4.md',
      'raw:course-content%252Fauthoring%252Funit-3-4.md%2523L42',
    ]);
    expect(limitations.some((limitation) => limitation.code === 'citation-target-raw-ref')).toBe(true);
    expect(() => buildSourcePack({
      query: 'root locus',
      profile: 'lesson-authoring',
      items: [item],
      limitations,
      now: new Date('2026-06-28T00:00:00Z'),
    })).not.toThrow();
  });

  it('keeps governed projection citation ids when raw refs are also present', () => {
    const row = makeProjectionRow({
      citationTargets: [
        'source-pack-citation:ct-001',
        'external:https%3A%2F%2Fexample.com%2Funit-3-4.md',
      ],
    });
    const { item, limitations } = adaptResourceProjectionRow(row);
    expect(item.citationTargetId).toBe('source-pack-citation:ct-001');
    expect(limitations.some((limitation) => limitation.code === 'citation-target-raw-ref')).toBe(true);
    expect(limitations.some((limitation) => limitation.code === 'citation-target-not-governed-id')).toBe(false);
  });
});

describe('adapter output validates through buildSourcePack', () => {
  it('builds a Source Pack from governed learning evidence, textbook, and projection candidates', () => {
    const chunkResult = adaptLearningEvidenceChunk(makeChunk(), { role: 'teacher' });
    const textbookResult = adaptTextbookSearchDocument(makeTextbookDoc());
    const projectionResult = adaptResourceProjectionRow(makeProjectionRow());
    const items = [
      chunkResult.item,
      textbookResult.item,
      projectionResult.item,
    ].filter((item): item is SourcePackItem => Boolean(item));

    const pack = buildSourcePack({
      query: 'root locus',
      profile: 'lesson-authoring',
      items,
      limitations: [
        ...chunkResult.limitations,
        ...textbookResult.limitations,
        ...projectionResult.limitations,
      ],
      now: new Date('2026-06-28T00:00:00Z'),
    });

    expect(pack.items).toHaveLength(3);
    expect(pack.audit.retrievalChunkIds).toContain('learning-evidence:chunk-001');
    expect(pack.audit.retrievalChunkIds).toContain('textbook-search:seg-002');
    expect(pack.audit.retrievalChunkIds).toContain('resource-projection-chunk:rc-001');
  });
});
