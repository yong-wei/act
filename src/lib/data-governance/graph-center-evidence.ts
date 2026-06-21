import type { TextbookRuntimeSearchDocument } from '@/lib/textbook-runtime-resources';
import {
  createLearningEvidenceCorpusChunk,
  type LearningEvidenceCorpusChunk,
} from './learning-evidence-rag-corpus';

export function textbookSearchDocumentsToLearningEvidenceCorpus(
  documents: TextbookRuntimeSearchDocument[],
): LearningEvidenceCorpusChunk[] {
  return documents.map((document) => createLearningEvidenceCorpusChunk({
    id: document.id,
    family: 'course-content',
    sourceType: 'course-content',
    sourceRef: {
      id: document.id,
      ownerUserId: null,
      classId: null,
      goalId: document.metadata.chapterId ?? document.metadata.bookId,
      resourceId: document.resourceProjection.resourceId,
    },
    spanRef: {
      kind: document.kind === 'figure' ? 'node' : 'text-range',
      locator: document.citationAddress?.locator ?? document.resourceProjection.citationTargetRef ?? document.id,
    },
    display: {
      title: document.title,
      href: document.href,
      capsule: document.title,
    },
    citationAddress: document.citationAddress,
    content: {
      text: null,
      redactedSummary: document.title,
      hash: document.contentHash ?? document.resourceProjection.contentHash ?? document.id,
    },
    resourceProjection: document.resourceProjection,
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
      knowledgeTags: document.resourceProjection.knowledgeNodeRefs,
      pageAnchor: document.citationAddress?.locator ?? null,
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
        'textbook-section',
        document.kind,
        ...document.resourceProjection.knowledgeNodeRefs,
        ...document.resourceProjection.capabilityTargetRefs,
      ],
      goals: [
        document.metadata.bookId,
        document.metadata.sectionId,
        ...(document.metadata.chapterId ? [document.metadata.chapterId] : []),
      ],
      useCases: ['konling', 'recommendation', 'prep-pack'],
    },
  }));
}
