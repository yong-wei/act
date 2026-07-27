import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { adoptCourseBasisVersion } from '@/lib/course-basis/service';
import {
  canonicalSourceFields,
  normalizeSourceMatchingMeaning,
  projectCurrentCumulativeClassPortrait,
  shouldMarkClassContextStale,
  sourceGapDecisionComplete,
} from '@/lib/smart-lesson-plan/domain';
import {
  deriveSmartLessonSourceState,
  sourceBindingEvidenceKey,
} from '@/lib/smart-lesson-plan/service';
import {
  buildSmartPreparationTextbookCatalog,
  rangeMatchesCandidate,
  textbookCandidateBinding,
} from '@/lib/smart-lesson-plan/textbook-resource-pack';
import { getSourcePackRetrievalProfile } from '@/lib/source-pack/retrieval-profiles';

describe('smart preparation grounding contracts', () => {
  it('uses the bounded smart-preparation retrieval profile', () => {
    const profile = getSourcePackRetrievalProfile('smart-preparation');
    expect(profile.defaultRole).toBe('teacher');
    expect(profile.budgets).toEqual({
      maxItems: 8,
      maxExcerptChars: 340,
      maxPerSourceKind: 3,
      maxPerModality: 4,
      maxPerResource: 2,
      maxPerCitationTarget: 2,
    });
  });

  it('keeps textbook retrieval candidates inside confirmed book, chapter, or section bounds', () => {
    const candidate = {
      displayNumber: 1,
      title: '根轨迹',
      text: '根轨迹用于分析闭环极点。',
      identity: {
        kind: 'unit' as const,
        unitId: 'section-1',
        fragmentId: null,
        bookId: 'book-1',
        edition: '8',
        sourceRevision: 'revision-1',
        structuralPath: ['chapter-1', 'section-1'],
      },
      href: '/textbooks/book-1/section-1',
      priority: 1,
      limitation: null,
    };
    expect(rangeMatchesCandidate({
      bookId: 'book-1', level: 'CHAPTER', unitId: 'chapter-1', structuralPath: ['chapter-1'],
    }, candidate)).toBe(true);
    expect(rangeMatchesCandidate({
      bookId: 'book-1', level: 'SECTION', unitId: 'section-2', structuralPath: ['chapter-1', 'section-2'],
    }, candidate)).toBe(false);
    expect(textbookCandidateBinding(candidate)).toMatchObject({
      sourceKind: 'textbook',
      sourceVersionId: 'textbook-v2:book-1:8:revision-1',
      anchor: 'section-1',
      title: '根轨迹',
      structuralPath: ['chapter-1', 'section-1'],
      href: '/textbooks/book-1/section-1',
    });
  });

  it('projects only book, chapter, and section catalog metadata without textbook bodies', () => {
    const catalog = buildSmartPreparationTextbookCatalog([{
      manifest: { bookId: 'book-1', edition: '8' },
      units: [
        { id: 'chapter-1', bookId: 'book-1', kind: 'chapter', title: '第一章', naturalNumber: '1', structuralPath: ['chapter-1'], markdown: 'private body' },
        { id: 'example-1', bookId: 'book-1', kind: 'example', title: '例题', naturalNumber: '1.1', structuralPath: ['chapter-1', 'example-1'], markdown: 'private example' },
      ],
    } as never]);
    expect(catalog[0]?.ranges).toEqual([expect.objectContaining({ unitId: 'chapter-1', level: 'CHAPTER' })]);
    expect(JSON.stringify(catalog)).not.toContain('private body');
  });

  it('automatically verifies only one reliable match and preserves ambiguity', () => {
    const binding = {
      citationId: 'citation-1', sourceVersionId: 'version-1', anchor: 'anchor-1', contentHash: 'a'.repeat(64),
    };
    const key = sourceBindingEvidenceKey(binding);
    expect(deriveSmartLessonSourceState(
      'TEACHER_CREATED', 'TEACHER_CREATED_SOURCE_PENDING', [binding], new Set([key]),
    )).toBe('VERIFIED');
    expect(deriveSmartLessonSourceState(
      'TEACHER_CREATED', 'TEACHER_CREATED_SOURCE_PENDING', [binding], new Set([key, 'another']),
    )).toBe('TEACHER_CREATED_SOURCE_PENDING');
    expect(deriveSmartLessonSourceState(
      'TEACHER_CREATED', 'TEACHER_CREATED_SOURCE_PENDING', [binding], new Set([key, 'another']),
      undefined, undefined, true,
    )).toBe('VERIFIED');
    expect(deriveSmartLessonSourceState(
      'TEACHER_CREATED', 'NO_RELIABLE_SOURCE', [], new Set(),
    )).toBe('NO_RELIABLE_SOURCE');
    expect(() => deriveSmartLessonSourceState(
      'TEACHER_CREATED', 'NO_RELIABLE_SOURCE', [binding], new Set([key]),
    )).toThrowError(expect.objectContaining({ code: 'no-reliable-source-bindings-conflict' }));
  });

  it('freezes an editable upload only when the verified binding is first adopted', async () => {
    let reviewState = 'PENDING';
    let existingLink: Record<string, unknown> | null = null;
    const tx = {
      courseBasisDocumentVersion: {
        findFirst: vi.fn(async () => ({
          id: 'version-1', contentHash: 'version-hash', reviewState, extractionState: 'EXTRACTED',
          normalizedText: 'content', retiredAt: null,
          document: { courseBasis: { id: 'basis-1', ownerId: 'teacher-1' } },
          segments: [{ id: 'segment-1', stableAnchor: 'anchor-1', contentHash: 'segment-hash' }],
        })),
        updateMany: vi.fn(async () => { reviewState = 'CONFIRMED'; return { count: 1 }; }),
        findUniqueOrThrow: vi.fn(async () => ({
          id: 'version-1', documentId: 'document-1', versionNumber: 1, sourceType: 'PLAIN_TEXT',
          sourceName: 'source.txt', mimeType: 'text/plain', byteSize: 7, contentHash: 'version-hash',
          extractionState: 'EXTRACTED', extractionVersion: 'v1', failureReason: null, reviewState,
          reviewedById: 'teacher-1', reviewedAt: new Date(), retiredById: null, retiredAt: null,
          createdAt: new Date(), _count: { segments: 1, projections: 1 },
        })),
      },
      courseBasisReferenceLink: {
        findUnique: vi.fn(async () => existingLink),
        create: vi.fn(async ({ data }) => {
          existingLink = { id: 'link-1', ...data };
          return existingLink;
        }),
        update: vi.fn(),
      },
      courseBasisProjection: {
        createMany: vi.fn(async () => ({ count: 1 })),
        count: vi.fn(async () => 1),
      },
    };
    const input = {
      actor: { id: 'teacher-1', role: 'TEACHER' as const },
      versionId: 'version-1',
      adopter: { referenceType: 'SMART_LESSON_KNOWLEDGE_POINT' as const, referenceId: 'kp-1' },
      anchors: [{ stableAnchor: 'anchor-1', contentHash: 'segment-hash' }],
    };
    expect((await adoptCourseBasisVersion(tx as never, input)).frozenNow).toBe(true);
    expect((await adoptCourseBasisVersion(tx as never, input)).frozenNow).toBe(false);
    expect(tx.courseBasisDocumentVersion.updateMany).toHaveBeenCalledTimes(1);
  });

  it('projects only aggregate current cumulative portrait fields with a stable context reference', () => {
    const portrait = {
      stateKind: 'SNAPSHOT',
      evidenceAsOf: '2026-07-26T10:00:00.000Z',
      generatedAt: '2026-07-26T10:05:00.000Z',
      activeStudentCount: 3,
      totalStudentCount: 4,
      aggregate: {
        overall: { mean: 0.65, meanConfidence: 0.7, includedCount: 3, missingCount: 1 },
        dimensions: {
          stability: { mean: 0.6, meanConfidence: 0.8, includedCount: 3, missingCount: 1 },
        },
      },
      diagnosis: {
        improvementClusters: ['stability'],
        riskList: [{ studentId: 'private-student' }],
        limitations: ['private free text'],
      },
    };
    const first = projectCurrentCumulativeClassPortrait({ classId: 'class-1', portrait });
    const second = projectCurrentCumulativeClassPortrait({ classId: 'class-1', portrait });
    expect(first.contextRef).toBe(second.contextRef);
    expect(first.cohortBucket).toBe('suppressed-small');
    expect(first).toMatchObject({ suppressionReason: 'cohort-below-five' });
    expect(first).not.toHaveProperty('overall');
    expect(first).not.toHaveProperty('competencies');
    expect(first).not.toHaveProperty('gaps');
    expect(JSON.stringify(first)).not.toContain('private-student');
    expect(JSON.stringify(first)).not.toContain('private free text');
  });

  it('suppresses 1, 2, and 4 learners while exposing aggregate fields at 5', () => {
    const portrait = (count: number) => ({
      stateKind: 'SNAPSHOT',
      evidenceAsOf: '2026-07-26T10:00:00.000Z',
      generatedAt: '2026-07-26T10:05:00.000Z',
      activeStudentCount: count,
      totalStudentCount: count,
      aggregate: {
        overall: { mean: 0.65, meanConfidence: 0.7, includedCount: count, missingCount: 0 },
        dimensions: {
          stability: { mean: 0.6, meanConfidence: 0.8, includedCount: count, missingCount: 0 },
        },
      },
      diagnosis: { improvementClusters: ['stability'] },
    });
    for (const count of [1, 2, 4]) {
      const projected = projectCurrentCumulativeClassPortrait({ classId: 'class-1', portrait: portrait(count) });
      expect(projected).toMatchObject({
        cohortBucket: 'suppressed-small',
        suppressionReason: 'cohort-below-five',
      });
      expect(projected).not.toHaveProperty('overall');
      expect(projected).not.toHaveProperty('competencies');
      expect(projected).not.toHaveProperty('gaps');
    }
    const five = projectCurrentCumulativeClassPortrait({ classId: 'class-1', portrait: portrait(5) });
    expect(five).toMatchObject({
      cohortBucket: '5-9',
      overall: { attainment: 0.65, coverage: 1, confidence: 0.7 },
      competencies: [{ identity: 'stability', attainment: 0.6, coverage: 1, confidence: 0.8 }],
      gaps: [{ identity: 'stability', reason: 'improvement-cluster' }],
    });
  });

  it('suppresses aggregate metrics when the class has 10 learners but overall includes only 4', () => {
    const projected = projectCurrentCumulativeClassPortrait({
      classId: 'class-1',
      portrait: {
        stateKind: 'SNAPSHOT',
        evidenceAsOf: '2026-07-26T10:00:00.000Z',
        generatedAt: '2026-07-26T10:05:00.000Z',
        activeStudentCount: 10,
        totalStudentCount: 10,
        aggregate: {
          overall: { mean: 0.4, meanConfidence: 0.5, includedCount: 4, missingCount: 6 },
          dimensions: {
            stability: { mean: 0.3, meanConfidence: 0.6, includedCount: 4, missingCount: 6 },
          },
        },
        diagnosis: { improvementClusters: ['stability'] },
      },
    });

    expect(projected).toMatchObject({
      cohortBucket: 'suppressed-small',
      suppressionReason: 'cohort-below-five',
    });
    expect(projected).not.toHaveProperty('overall');
    expect(projected).not.toHaveProperty('competencies');
    expect(projected).not.toHaveProperty('gaps');
  });

  it('filters low-support competency metrics and their gap identities', () => {
    const projected = projectCurrentCumulativeClassPortrait({
      classId: 'class-1',
      portrait: {
        stateKind: 'SNAPSHOT',
        evidenceAsOf: '2026-07-26T10:00:00.000Z',
        generatedAt: '2026-07-26T10:05:00.000Z',
        activeStudentCount: 10,
        totalStudentCount: 10,
        aggregate: {
          overall: { mean: 0.65, meanConfidence: 0.7, includedCount: 10, missingCount: 0 },
          dimensions: {
            lowSupport: { mean: 0.1, meanConfidence: 0.2, includedCount: 1, missingCount: 9 },
            stability: { mean: 0.6, meanConfidence: 0.8, includedCount: 5, missingCount: 5 },
          },
        },
        diagnosis: { improvementClusters: ['lowSupport', 'stability'] },
      },
    });

    expect(projected).toMatchObject({
      cohortBucket: '10-19',
      competencies: [{ identity: 'stability', attainment: 0.6, coverage: 0.5, confidence: 0.8 }],
      gaps: [{ identity: 'stability', reason: 'improvement-cluster' }],
    });
    expect(JSON.stringify(projected)).not.toContain('lowSupport');
  });

  it('keeps source decisions for formatting changes and invalidates semantic changes', () => {
    expect(normalizeSourceMatchingMeaning('稳定性 判据！')).toBe(normalizeSourceMatchingMeaning('稳定性判据'));
    const base = canonicalSourceFields({
      itemId: 'kp-1',
      itemLineageId: 'lineage-1',
      taskLineageId: 'task-lineage',
      content: '稳定性 判据！',
      sourceState: 'TEACHER_CREATED_SOURCE_PENDING',
      sourceBindings: [],
    });
    const formattingOnly = canonicalSourceFields({
      itemId: 'kp-1',
      itemLineageId: 'lineage-1',
      taskLineageId: 'task-lineage',
      content: '稳定性判据',
      sourceState: 'TEACHER_CREATED_SOURCE_PENDING',
      sourceBindings: [],
    });
    const semanticEdit = canonicalSourceFields({
      itemId: 'kp-1',
      itemLineageId: 'lineage-1',
      taskLineageId: 'task-lineage',
      content: '稳态误差判据',
      sourceState: 'TEACHER_CREATED_SOURCE_PENDING',
      sourceBindings: [],
    });
    expect(formattingOnly.contentHash).toBe(base.contentHash);
    expect(formattingOnly.gapIdentity).toBe(base.gapIdentity);
    expect(semanticEdit.gapIdentity).not.toBe(base.gapIdentity);
  });

  it('preserves mathematical operators, signs, and decimal points in source matching hashes', () => {
    const semanticPairs = [
      ['s+1', 's-1'],
      ['Kp>1', 'Kp<1'],
      ['ζ=0.7', 'ζ=-0.7'],
    ] as const;

    for (const [left, right] of semanticPairs) {
      expect(normalizeSourceMatchingMeaning(left)).not.toBe(normalizeSourceMatchingMeaning(right));
      const fields = (content: string) => canonicalSourceFields({
        itemId: 'kp-1',
        itemLineageId: 'lineage-1',
        taskLineageId: 'task-lineage',
        content,
        sourceState: 'TEACHER_CREATED_SOURCE_PENDING',
        sourceBindings: [],
      });
      expect(fields(left).contentHash).not.toBe(fields(right).contentHash);
    }
  });

  it('requires a short reason for no-source decisions', () => {
    expect(sourceGapDecisionComplete({ sourceState: 'VERIFIED', gapReason: null })).toBe(true);
    expect(sourceGapDecisionComplete({
      sourceState: 'TEACHER_CREATED_SOURCE_PENDING',
      gapReason: '当前资源包没有覆盖该案例',
    })).toBe(false);
    expect(sourceGapDecisionComplete({
      sourceState: 'AI_GENERATED_SOURCE_PENDING',
      gapReason: null,
    })).toBe(false);
    expect(sourceGapDecisionComplete({
      sourceState: 'NO_RELIABLE_SOURCE',
      sourceBindings: [{ citationId: 'candidate' }],
      gapReason: '当前资源包没有覆盖该案例',
    })).toBe(false);
    expect(sourceGapDecisionComplete({
      sourceState: 'NO_RELIABLE_SOURCE',
      sourceBindings: [],
      gapReason: '当前资源包没有覆盖该案例',
    })).toBe(true);
  });

  it('marks only generated class changes sticky stale', () => {
    expect(shouldMarkClassContextStale({
      previousClassId: 'class-1',
      nextClassId: 'class-2',
      hasGeneratedContent: true,
      staleAt: null,
    })).toBe(true);
    expect(shouldMarkClassContextStale({
      previousClassId: 'class-1',
      nextClassId: 'class-1',
      hasGeneratedContent: true,
      staleAt: null,
    })).toBe(false);
    expect(shouldMarkClassContextStale({
      previousClassId: 'class-1',
      nextClassId: null,
      hasGeneratedContent: true,
      staleAt: new Date('2026-07-26T10:00:00.000Z'),
    })).toBe(false);
    expect(shouldMarkClassContextStale({
      previousClassId: null,
      nextClassId: 'class-2',
      hasGeneratedContent: true,
      staleAt: null,
    })).toBe(true);
  });
});
