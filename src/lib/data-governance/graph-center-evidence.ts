import type { TextbookStructureUnitProjection } from '@/lib/course-bundle';
import {
  createLearningEvidenceCorpusChunk,
  type LearningEvidenceCorpusChunk,
} from './learning-evidence-rag-corpus';

export function textbookStructureUnitsToLearningEvidenceCorpus(
  units: TextbookStructureUnitProjection[],
): LearningEvidenceCorpusChunk[] {
  return units.map((unit) => createLearningEvidenceCorpusChunk({
    id: unit.id,
    family: 'course-content',
    sourceType: 'course-content',
    sourceRef: {
      id: unit.id,
      ownerUserId: null,
      classId: null,
      goalId: unit.metadata.chapterId ?? unit.metadata.bookId,
      resourceId: unit.resourceProjection.resourceId,
    },
    spanRef: {
      kind: 'text-range',
      locator: unit.citationAddress.locator ?? unit.resourceProjection.citationTargetRef,
    },
    display: {
      title: unit.title,
      href: unit.href,
      capsule: unit.title,
    },
    citationAddress: unit.citationAddress,
    content: {
      text: null,
      redactedSummary: unit.title,
      hash: unit.contentHash,
    },
    resourceProjection: {
      ...unit.resourceProjection,
    },
    privacyClass: 'public',
    confidence: 'high',
    freshness: {
      indexedAt: new Date(0).toISOString(),
      sourceUpdatedAt: null,
      expiresAt: null,
      stale: false,
    },
    authority: {
      level: 'canonical',
      knowledgeTags: unit.resourceProjection.knowledgeNodeRefs,
      pageAnchor: unit.citationAddress.locator,
      freshnessBucket: 'current',
      scopeRule: {
        visibility: 'public',
        allowedRoles: ['student', 'teacher', 'admin', 'service'],
      },
      conflictGroup: null,
      conflictSignal: null,
    },
    retrieval: {
      tags: [
        'textbook-unit',
        unit.kind,
        ...unit.resourceProjection.knowledgeNodeRefs,
        ...unit.resourceProjection.capabilityTargetRefs,
      ],
      goals: [
        unit.metadata.bookId,
        unit.metadata.unitId,
        ...(unit.metadata.chapterId ? [unit.metadata.chapterId] : []),
      ],
      useCases: ['konling', 'recommendation', 'prep-pack'],
    },
  }));
}
