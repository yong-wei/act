import type { SarAssociationExpansionResult } from '../data-governance/sar-association-expansion';
import {
  createLearningEvidenceCorpusChunk,
  type LearningEvidenceCorpusChunk,
} from '../data-governance/learning-evidence-rag-corpus';
import { adaptLearningEvidenceChunk } from './corpus-adapters';
import type { SourcePackItem } from './types';

export type TeacherCourseBasisDocumentSourceType = 'textbook' | 'reference' | 'uploaded-document';
export type TeacherCourseBasisReviewState = 'confirmed' | 'unconfirmed';
export type TeacherCourseBasisVersionState = 'active' | 'retired';

export interface TeacherCourseBasisSegmentProjection {
  ownerUserId: string;
  courseBasisId: string;
  documentId: string;
  versionId: string;
  versionState: TeacherCourseBasisVersionState;
  stableAnchor: string;
  contentHash: string;
  title: string;
  documentSourceType: TeacherCourseBasisDocumentSourceType;
  reviewState: TeacherCourseBasisReviewState;
  text: string;
  knowledgeTags?: string[];
  indexedAt: string;
  sourceUpdatedAt?: string | null;
  retrievalChunkId?: string;
}

export interface TeacherCourseBasisProjectionReadModel {
  corpusSourceId: string;
  projectedAt: Date | string;
  segment: {
    stableAnchor: string;
    contentHash: string;
    text: string;
  };
  version: {
    id: string;
    reviewState: 'PENDING' | 'CONFIRMED' | 'REJECTED';
    retiredAt: Date | string | null;
    createdAt: Date | string;
    document: {
      id: string;
      title: string;
      kind: 'STANDARD' | 'TEXTBOOK' | 'OTHER';
      courseBasis: {
        id: string;
        ownerId: string;
      };
    };
  };
}

export interface TeacherCourseBasisProjectionReadRequest {
  ownerUserId: string;
  selectedVersionIds: readonly string[];
}

export interface TeacherCourseBasisProjectionReader {
  readCourseBasisProjections(
    request: TeacherCourseBasisProjectionReadRequest,
  ): Promise<readonly TeacherCourseBasisProjectionReadModel[]>;
}

export interface BuildTeacherCourseBasisLessonDesignCandidatesInput {
  segments: readonly TeacherCourseBasisSegmentProjection[];
  ownerUserId: string;
  selectedVersionIds: readonly string[];
  explicitRetiredVersionIds?: readonly string[];
  sar: Pick<SarAssociationExpansionResult, 'candidateRefs'>;
}

export interface TeacherCourseBasisLessonDesignCandidates {
  chunks: LearningEvidenceCorpusChunk[];
  items: SourcePackItem[];
}

export function teacherCourseBasisRetrievalChunkId(
  segment: Pick<TeacherCourseBasisSegmentProjection, 'courseBasisId' | 'versionId' | 'stableAnchor' | 'retrievalChunkId'>,
): string {
  if (segment.retrievalChunkId && isGovernedId(segment.retrievalChunkId)) return segment.retrievalChunkId;
  return governedSegmentId('teacher-course-basis', segment);
}

export function teacherCourseBasisCitationTargetId(
  segment: Pick<TeacherCourseBasisSegmentProjection, 'courseBasisId' | 'versionId' | 'stableAnchor'>,
): string {
  return governedSegmentId('teacher-course-basis-citation', segment);
}

export function projectConfirmedTeacherCourseBasisSegment(
  segment: TeacherCourseBasisSegmentProjection,
): LearningEvidenceCorpusChunk | null {
  if (segment.reviewState !== 'confirmed') return null;

  const retrievalChunkId = teacherCourseBasisRetrievalChunkId(segment);
  const citationTargetId = teacherCourseBasisCitationTargetId(segment);
  const knowledgeTags = segment.knowledgeTags?.length
    ? segment.knowledgeTags
    : [`course-basis:${segment.courseBasisId}`];

  return createLearningEvidenceCorpusChunk({
    id: retrievalChunkId,
    family: 'course-content',
    sourceType: 'teacher-course-basis',
    sourceRef: {
      id: `teacher-course-basis-document:${encodeIdPart(segment.documentId)}:${encodeIdPart(segment.versionId)}`,
      ownerUserId: segment.ownerUserId,
      classId: null,
      resourceId: `teacher-course-basis:${encodeIdPart(segment.courseBasisId)}`,
      courseBasisId: segment.courseBasisId,
      documentId: segment.documentId,
      versionId: segment.versionId,
      documentSourceType: segment.documentSourceType,
      reviewState: segment.reviewState,
      versionState: segment.versionState,
    },
    spanRef: {
      kind: 'text-range',
      locator: segment.stableAnchor,
    },
    display: {
      title: segment.title,
      href: `#${encodeIdPart(segment.stableAnchor)}`,
      capsule: segment.text,
    },
    citationAddress: {
      kind: 'text',
      sourceRefId: citationTargetId,
      href: `#${encodeIdPart(segment.stableAnchor)}`,
      locator: segment.stableAnchor,
      contentHash: segment.contentHash,
    },
    content: {
      text: segment.text,
      redactedSummary: segment.text,
      hash: segment.contentHash,
    },
    resourceProjection: {
      resourceId: `teacher-course-basis:${encodeIdPart(segment.courseBasisId)}`,
      segmentRef: segment.stableAnchor,
      citationTargetRef: citationTargetId,
      knowledgeNodeRefs: knowledgeTags,
      capabilityTargetRefs: [],
      contentHash: segment.contentHash,
      authorityLevel: 'teacher-authored',
      privacyScope: 'teacher-visible',
    },
    privacyClass: 'teacher-visible',
    confidence: 'high',
    freshness: {
      indexedAt: segment.indexedAt,
      sourceUpdatedAt: segment.sourceUpdatedAt ?? null,
      expiresAt: null,
      stale: false,
    },
    authority: {
      level: 'teacher-authored',
      knowledgeTags,
      pageAnchor: segment.stableAnchor,
      freshnessBucket: 'current',
      scopeRule: {
        visibility: 'teacher-visible',
        allowedRoles: ['teacher', 'admin', 'service'],
        ownerRequired: true,
      },
    },
    retrieval: {
      tags: knowledgeTags,
      goals: [],
      useCases: ['prep-pack'],
    },
  });
}

export function buildTeacherCourseBasisLessonDesignCandidates(
  input: BuildTeacherCourseBasisLessonDesignCandidatesInput,
): TeacherCourseBasisLessonDesignCandidates {
  const selectedVersionIds = new Set(input.selectedVersionIds);
  const explicitRetiredVersionIds = new Set(input.explicitRetiredVersionIds ?? []);
  const sarRetrievalChunkIds = new Set(input.sar.candidateRefs.retrievalChunkIds);
  const chunks: LearningEvidenceCorpusChunk[] = [];
  const items: SourcePackItem[] = [];

  for (const segment of input.segments) {
    if (segment.ownerUserId !== input.ownerUserId) continue;
    if (segment.reviewState !== 'confirmed') continue;
    if (!selectedVersionIds.has(segment.versionId)) continue;
    if (segment.versionState === 'retired' && !explicitRetiredVersionIds.has(segment.versionId)) continue;

    const chunk = projectConfirmedTeacherCourseBasisSegment(segment);
    if (!chunk || !sarRetrievalChunkIds.has(chunk.id)) continue;

    const adapted = adaptLearningEvidenceChunk(chunk, {
      role: 'teacher',
      userId: input.ownerUserId,
      allowedSourceTypes: ['teacher-course-basis'],
      useCase: 'prep-pack',
      teacherCourseBasis: {
        selectedVersionIds: [...selectedVersionIds],
        explicitRetiredVersionIds: [...explicitRetiredVersionIds],
        verifiedSarRetrievalChunkIds: [...sarRetrievalChunkIds],
      },
    });
    if (!adapted.item) continue;

    chunks.push(chunk);
    items.push(adapted.item);
  }

  return { chunks, items };
}

export function teacherCourseBasisSegmentsFromProjections(
  projections: readonly TeacherCourseBasisProjectionReadModel[],
): TeacherCourseBasisSegmentProjection[] {
  return projections.map((projection) => ({
    ownerUserId: projection.version.document.courseBasis.ownerId,
    courseBasisId: projection.version.document.courseBasis.id,
    documentId: projection.version.document.id,
    versionId: projection.version.id,
    versionState: projection.version.retiredAt ? 'retired' : 'active',
    stableAnchor: projection.segment.stableAnchor,
    contentHash: projection.segment.contentHash,
    title: projection.version.document.title,
    documentSourceType: documentSourceType(projection.version.document.kind),
    reviewState: projection.version.reviewState === 'CONFIRMED' ? 'confirmed' : 'unconfirmed',
    text: projection.segment.text,
    indexedAt: isoTimestamp(projection.projectedAt),
    sourceUpdatedAt: isoTimestamp(projection.version.createdAt),
    retrievalChunkId: projection.corpusSourceId,
  }));
}

export function buildTeacherCourseBasisLessonDesignCandidatesFromProjections(
  input: Omit<BuildTeacherCourseBasisLessonDesignCandidatesInput, 'segments'> & {
    projections: readonly TeacherCourseBasisProjectionReadModel[];
  },
): TeacherCourseBasisLessonDesignCandidates {
  const { projections, ...buildInput } = input;
  return buildTeacherCourseBasisLessonDesignCandidates({
    ...buildInput,
    segments: teacherCourseBasisSegmentsFromProjections(projections),
  });
}

export async function buildTeacherCourseBasisLessonDesignCandidatesFromReader(
  input: Omit<BuildTeacherCourseBasisLessonDesignCandidatesInput, 'segments'> & {
    reader: TeacherCourseBasisProjectionReader;
  },
): Promise<TeacherCourseBasisLessonDesignCandidates> {
  const { reader, ...buildInput } = input;
  const projections = await reader.readCourseBasisProjections({
    ownerUserId: input.ownerUserId,
    selectedVersionIds: input.selectedVersionIds,
  });
  return buildTeacherCourseBasisLessonDesignCandidatesFromProjections({
    ...buildInput,
    projections,
  });
}

function governedSegmentId(
  prefix: string,
  segment: Pick<TeacherCourseBasisSegmentProjection, 'courseBasisId' | 'versionId' | 'stableAnchor'>,
): string {
  return `${prefix}:${encodeIdPart(segment.courseBasisId)}:${encodeIdPart(segment.versionId)}:${encodeIdPart(segment.stableAnchor)}`;
}

function encodeIdPart(value: string): string {
  return encodeURIComponent(value);
}

function isGovernedId(value: string): boolean {
  return /^[\p{L}\p{N}][\p{L}\p{N}_.-]*:[^\s]+$/u.test(value);
}

function documentSourceType(
  kind: TeacherCourseBasisProjectionReadModel['version']['document']['kind'],
): TeacherCourseBasisDocumentSourceType {
  if (kind === 'TEXTBOOK') return 'textbook';
  if (kind === 'STANDARD') return 'reference';
  return 'uploaded-document';
}

function isoTimestamp(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}
