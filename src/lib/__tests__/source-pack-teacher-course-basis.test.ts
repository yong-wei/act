import { describe, expect, it } from 'vitest';

import {
  retrieveLearningEvidenceCorpus,
  validateLearningEvidenceCorpusChunk,
  type LearningEvidenceRetrievalScope,
} from '../data-governance/learning-evidence-rag-corpus';
import { adaptLearningEvidenceChunk } from '../source-pack/corpus-adapters';
import {
  buildTeacherCourseBasisLessonDesignCandidates,
  buildTeacherCourseBasisLessonDesignCandidatesFromProjections,
  buildTeacherCourseBasisLessonDesignCandidatesFromReader,
  projectConfirmedTeacherCourseBasisSegment,
  teacherCourseBasisCitationTargetId,
  teacherCourseBasisRetrievalChunkId,
  type TeacherCourseBasisSegmentProjection,
  type TeacherCourseBasisProjectionReadModel,
} from '../source-pack/teacher-course-basis';

function segment(
  overrides: Partial<TeacherCourseBasisSegmentProjection> = {},
): TeacherCourseBasisSegmentProjection {
  return {
    ownerUserId: 'teacher-1',
    courseBasisId: 'basis-1',
    documentId: 'document-1',
    versionId: 'version-1',
    versionState: 'active',
    stableAnchor: 'page-4#paragraph-2',
    contentHash: 'sha256:confirmed-segment',
    title: '自动控制原理：根轨迹校正',
    documentSourceType: 'textbook',
    reviewState: 'confirmed',
    text: '根轨迹校正应同时满足动态性能和稳态精度要求。',
    knowledgeTags: ['root-locus', 'control-correction'],
    indexedAt: '2026-07-19T00:00:00.000Z',
    sourceUpdatedAt: '2026-07-18T00:00:00.000Z',
    ...overrides,
  };
}

function retrievalScope(
  input: TeacherCourseBasisSegmentProjection,
  overrides: Partial<NonNullable<LearningEvidenceRetrievalScope['teacherCourseBasis']>> = {},
): NonNullable<LearningEvidenceRetrievalScope['teacherCourseBasis']> {
  return {
    selectedVersionIds: [input.versionId],
    explicitRetiredVersionIds: input.versionState === 'retired' ? [input.versionId] : [],
    verifiedSarRetrievalChunkIds: [teacherCourseBasisRetrievalChunkId(input)],
    ...overrides,
  };
}

function projectionReadModel(): TeacherCourseBasisProjectionReadModel {
  return {
    corpusSourceId: 'teacher-course-basis:basis-1:version-1:projection-anchor',
    projectedAt: new Date('2026-07-19T00:00:00.000Z'),
    segment: {
      stableAnchor: 'projection-anchor',
      contentHash: 'sha256:projection-segment',
      text: '由持久化 CourseBasisProjection 提供的确认段落。',
    },
    version: {
      id: 'version-1',
      reviewState: 'CONFIRMED',
      retiredAt: null,
      createdAt: new Date('2026-07-18T00:00:00.000Z'),
      document: {
        id: 'document-1',
        title: '课程标准',
        kind: 'STANDARD',
        courseBasis: { id: 'basis-1', ownerId: 'teacher-1' },
      },
    },
  };
}

describe('teacher Course Basis governed projection', () => {
  it('maps confirmed segments to governed course-content chunks and Source Pack citation metadata', () => {
    const input = segment();
    const chunk = projectConfirmedTeacherCourseBasisSegment(input);

    expect(chunk).not.toBeNull();
    expect(validateLearningEvidenceCorpusChunk(chunk!)).toEqual([]);
    expect(chunk).toMatchObject({
      id: teacherCourseBasisRetrievalChunkId(input),
      family: 'course-content',
      sourceType: 'teacher-course-basis',
      sourceRef: {
        ownerUserId: 'teacher-1',
        courseBasisId: 'basis-1',
        documentId: 'document-1',
        versionId: 'version-1',
        documentSourceType: 'textbook',
        reviewState: 'confirmed',
        versionState: 'active',
      },
      spanRef: { locator: 'page-4#paragraph-2' },
      content: { hash: 'sha256:confirmed-segment' },
      privacyClass: 'teacher-visible',
    });

    const result = adaptLearningEvidenceChunk(chunk!, {
      role: 'teacher',
      userId: 'teacher-1',
      useCase: 'prep-pack',
      teacherCourseBasis: retrievalScope(input),
    });

    expect(result.item).toMatchObject({
      sourceKind: 'textbook',
      retrievalChunkId: teacherCourseBasisRetrievalChunkId(input),
      citationTargetId: teacherCourseBasisCitationTargetId(input),
      access: { visibility: 'teacher' },
      citation: {
        citationTargetId: teacherCourseBasisCitationTargetId(input),
        sourceId: teacherCourseBasisRetrievalChunkId(input),
        verified: true,
      },
      metadata: {
        sourceType: 'teacher-course-basis',
        ownerUserId: 'teacher-1',
        courseBasisId: 'basis-1',
        documentId: 'document-1',
        versionId: 'version-1',
        documentSourceType: 'textbook',
        reviewState: 'confirmed',
        versionState: 'active',
        contentHash: 'sha256:confirmed-segment',
        stableAnchor: 'page-4#paragraph-2',
        spanLocator: 'page-4#paragraph-2',
      },
    });
  });

  it('does not project unconfirmed segments', () => {
    expect(projectConfirmedTeacherCourseBasisSegment(segment({ reviewState: 'unconfirmed' }))).toBeNull();
  });

  it('does not classify non-textbook Course Basis documents as textbooks', () => {
    const input = segment({ documentSourceType: 'uploaded-document' });
    const chunk = projectConfirmedTeacherCourseBasisSegment(input)!;
    const result = adaptLearningEvidenceChunk(chunk, {
      role: 'teacher',
      userId: input.ownerUserId,
      useCase: 'prep-pack',
      teacherCourseBasis: retrievalScope(input),
    });

    expect(result.item?.sourceKind).toBe('other');
  });

  it('rejects ordinary prep-pack retrieval and incomplete Course Basis scopes', () => {
    const input = segment();
    const chunk = projectConfirmedTeacherCourseBasisSegment(input)!;
    const ordinaryScope = {
      role: 'teacher' as const,
      userId: input.ownerUserId,
      useCase: 'prep-pack' as const,
    };

    expect(retrieveLearningEvidenceCorpus([chunk], ordinaryScope)).toHaveLength(0);
    expect(adaptLearningEvidenceChunk(chunk, ordinaryScope).item).toBeNull();
    expect(retrieveLearningEvidenceCorpus([chunk], {
      ...ordinaryScope,
      teacherCourseBasis: retrievalScope(input, { selectedVersionIds: [] }),
    })).toHaveLength(0);
    expect(retrieveLearningEvidenceCorpus([chunk], {
      ...ordinaryScope,
      teacherCourseBasis: retrievalScope(input, { verifiedSarRetrievalChunkIds: [] }),
    })).toHaveLength(0);

    const unconfirmed = {
      ...chunk,
      sourceRef: { ...chunk.sourceRef, reviewState: 'unconfirmed' },
    };
    const retired = {
      ...chunk,
      sourceRef: { ...chunk.sourceRef, versionState: 'retired' },
    };
    const forgedClassScope = {
      ...chunk,
      sourceRef: { ...chunk.sourceRef, classId: 'class-1' },
    };
    expect(retrieveLearningEvidenceCorpus([unconfirmed], {
      ...ordinaryScope,
      teacherCourseBasis: retrievalScope(input),
    })).toHaveLength(0);
    expect(retrieveLearningEvidenceCorpus([retired], {
      ...ordinaryScope,
      teacherCourseBasis: retrievalScope(input, { explicitRetiredVersionIds: [] }),
    })).toHaveLength(0);
    expect(retrieveLearningEvidenceCorpus([forgedClassScope], {
      ...ordinaryScope,
      userId: 'teacher-2',
      classIds: ['class-1'],
      teacherCourseBasis: retrievalScope(input),
    })).toHaveLength(0);
  });

  it('makes owner-private teacher chunks visible only to the owner, admin, and service', () => {
    const input = segment();
    const chunk = projectConfirmedTeacherCourseBasisSegment(input)!;
    const teacherCourseBasis = retrievalScope(input);

    expect(retrieveLearningEvidenceCorpus([chunk], {
      role: 'teacher',
      userId: 'teacher-1',
      useCase: 'prep-pack',
      teacherCourseBasis,
    })).toHaveLength(1);
    expect(retrieveLearningEvidenceCorpus([chunk], {
      role: 'teacher',
      userId: 'teacher-2',
      useCase: 'prep-pack',
      teacherCourseBasis,
    })).toHaveLength(0);
    expect(retrieveLearningEvidenceCorpus([chunk], {
      role: 'student',
      userId: 'student-1',
      useCase: 'prep-pack',
      teacherCourseBasis,
    })).toHaveLength(0);
    expect(retrieveLearningEvidenceCorpus([chunk], {
      role: 'admin',
      targetUserId: 'teacher-2',
      useCase: 'prep-pack',
      teacherCourseBasis,
    })).toHaveLength(1);
    expect(retrieveLearningEvidenceCorpus([chunk], {
      role: 'service',
      targetUserId: 'teacher-2',
      useCase: 'prep-pack',
      teacherCourseBasis,
    })).toHaveLength(1);

    expect(adaptLearningEvidenceChunk(chunk, {
      role: 'teacher',
      userId: 'teacher-2',
      useCase: 'prep-pack',
      teacherCourseBasis,
    }).item).toBeNull();
    expect(adaptLearningEvidenceChunk(chunk, {
      role: 'admin',
      targetUserId: 'teacher-2',
      useCase: 'prep-pack',
      teacherCourseBasis,
    }).item).not.toBeNull();
  });

  it('preserves class-scoped teacher-visible behavior', () => {
    const input = segment();
    const ownerPrivate = projectConfirmedTeacherCourseBasisSegment(input)!;
    const classScoped = {
      ...ownerPrivate,
      family: 'report' as const,
      sourceType: 'teacher-report' as const,
      sourceRef: { ...ownerPrivate.sourceRef, ownerUserId: null, classId: 'class-1' },
      authority: {
        ...ownerPrivate.authority,
        knowledgeTags: [],
        scopeRule: {
          ...ownerPrivate.authority.scopeRule,
          ownerRequired: false,
          classRequired: true,
        },
      },
    };

    expect(retrieveLearningEvidenceCorpus([classScoped], {
      role: 'teacher',
      userId: 'teacher-2',
      classIds: ['class-1'],
      useCase: 'prep-pack',
    })).toHaveLength(1);
    expect(retrieveLearningEvidenceCorpus([classScoped], {
      role: 'teacher',
      userId: 'teacher-1',
      classIds: ['class-2'],
      useCase: 'prep-pack',
    })).toHaveLength(0);
  });
});

describe('teacher Course Basis lesson-design candidate construction', () => {
  it('constructs production candidates from CourseBasisProjection read models', () => {
    const projection = projectionReadModel();
    const corpusSourceId = projection.corpusSourceId;
    const result = buildTeacherCourseBasisLessonDesignCandidatesFromProjections({
      projections: [projection],
      ownerUserId: 'teacher-1',
      selectedVersionIds: ['version-1'],
      sar: {
        candidateRefs: {
          eventIds: [],
          entityIds: [],
          citationTargetIds: [],
          retrievalChunkIds: [corpusSourceId],
          resourceNodeIds: [],
          planningUnitIds: [],
        },
      },
    });

    expect(result.chunks).toHaveLength(1);
    expect(result.chunks[0]).toMatchObject({
      id: corpusSourceId,
      sourceRef: {
        ownerUserId: 'teacher-1',
        versionId: 'version-1',
        reviewState: 'confirmed',
        versionState: 'active',
      },
    });
    expect(result.items[0]).toMatchObject({
      retrievalChunkId: corpusSourceId,
      sourceKind: 'reference',
      metadata: {
        documentSourceType: 'reference',
        versionState: 'active',
      },
    });
  });

  it('loads projection read models through a Prisma-independent production reader', async () => {
    const projection = projectionReadModel();
    const requests: unknown[] = [];
    const result = await buildTeacherCourseBasisLessonDesignCandidatesFromReader({
      reader: {
        async readCourseBasisProjections(request) {
          requests.push(request);
          return [projection];
        },
      },
      ownerUserId: 'teacher-1',
      selectedVersionIds: ['version-1'],
      sar: {
        candidateRefs: {
          eventIds: [],
          entityIds: [],
          citationTargetIds: [],
          retrievalChunkIds: [projection.corpusSourceId],
          resourceNodeIds: [],
          planningUnitIds: [],
        },
      },
    });

    expect(requests).toEqual([{
      ownerUserId: 'teacher-1',
      selectedVersionIds: ['version-1'],
    }]);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].sourceKind).toBe('reference');
  });

  it('intersects owner-selected confirmed versions with verified SAR retrieval chunk ids', () => {
    const included = segment();
    const unconfirmed = segment({
      stableAnchor: 'unconfirmed',
      reviewState: 'unconfirmed',
    });
    const foreignOwner = segment({
      ownerUserId: 'teacher-2',
      stableAnchor: 'foreign-owner',
    });
    const unselected = segment({
      versionId: 'version-2',
      stableAnchor: 'unselected-version',
    });
    const retired = segment({
      versionId: 'version-retired',
      versionState: 'retired',
      stableAnchor: 'retired-version',
    });
    const sarOnlySeed = segment({
      versionId: 'version-seed-only',
      stableAnchor: 'source-pack-seed-only',
    });
    const expandedSar = {
      candidateRefs: {
        eventIds: [],
        entityIds: [],
        citationTargetIds: [],
        retrievalChunkIds: [
          teacherCourseBasisRetrievalChunkId(included),
          teacherCourseBasisRetrievalChunkId(unconfirmed),
          teacherCourseBasisRetrievalChunkId(foreignOwner),
          teacherCourseBasisRetrievalChunkId(unselected),
          teacherCourseBasisRetrievalChunkId(retired),
        ],
        resourceNodeIds: [],
        planningUnitIds: [],
      },
      sourcePackSeedRefs: [teacherCourseBasisRetrievalChunkId(sarOnlySeed)],
      resourceIds: [teacherCourseBasisRetrievalChunkId(sarOnlySeed)],
    };
    const result = buildTeacherCourseBasisLessonDesignCandidates({
      segments: [included, unconfirmed, foreignOwner, unselected, retired, sarOnlySeed],
      ownerUserId: 'teacher-1',
      selectedVersionIds: ['version-1', 'version-retired', 'version-seed-only'],
      sar: expandedSar,
    });

    expect(result.chunks.map((chunk) => chunk.id)).toEqual([
      teacherCourseBasisRetrievalChunkId(included),
    ]);
    expect(result.items.map((item) => item.retrievalChunkId)).toEqual([
      teacherCourseBasisRetrievalChunkId(included),
    ]);
  });

  it('includes a retired selected version only when explicitly requested', () => {
    const retired = segment({
      versionId: 'version-retired',
      versionState: 'retired',
      stableAnchor: 'retired-version',
    });
    const sar = {
      candidateRefs: {
        eventIds: [],
        entityIds: [],
        citationTargetIds: [],
        retrievalChunkIds: [teacherCourseBasisRetrievalChunkId(retired)],
        resourceNodeIds: [],
        planningUnitIds: [],
      },
    };

    expect(buildTeacherCourseBasisLessonDesignCandidates({
      segments: [retired],
      ownerUserId: 'teacher-1',
      selectedVersionIds: ['version-retired'],
      sar,
    }).items).toHaveLength(0);

    expect(buildTeacherCourseBasisLessonDesignCandidates({
      segments: [retired],
      ownerUserId: 'teacher-1',
      selectedVersionIds: ['version-retired'],
      explicitRetiredVersionIds: ['version-retired'],
      sar,
    }).items).toHaveLength(1);
  });
});
