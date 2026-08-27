import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { buildGeneratedQuestion } from '@/features/assessment/adaptive-question-bank';
import {
  assessmentItemSemanticReviewSourceHash,
  type AssessmentItemSemanticReviewDecision,
} from './adaptive-assessment-semantic-review';
import {
  currentPublishedReceipts,
  isCurrentPublicationReceipt,
  restoreGeneratedCandidateStore,
  serializeGeneratedCandidateStore,
  type GeneratedCandidateStore,
  type GeneratedPublicationReceipt,
} from './generated-candidate-governance';
import type { GeneratedQuestionCatalogRow } from './adaptive-assessment-item-catalog';

export const GENERATED_CATALOG_RELEASE_DIR = 'data/generated-assessment-catalog';
export const GENERATED_CANDIDATE_STORE_PATH = `${GENERATED_CATALOG_RELEASE_DIR}/generated-assessment-candidate-store.json`;
export const GENERATED_CATALOG_ITEMS_PATH = `${GENERATED_CATALOG_RELEASE_DIR}/generated-assessment-catalog-items.jsonl`;
export const GENERATED_CATALOG_REVIEWS_PATH = `${GENERATED_CATALOG_RELEASE_DIR}/generated-assessment-review-snapshots.jsonl`;
export const GENERATED_CATALOG_RELEASE_PATH = `${GENERATED_CATALOG_RELEASE_DIR}/generated-assessment-catalog-release.json`;

export function generatedQuestionsFromStore(store: GeneratedCandidateStore): GeneratedQuestionCatalogRow[] {
  return currentPublishedReceipts(store).flatMap((receipt) => {
    if (!isCurrentPublicationReceipt(store, receipt)) return [];
    const revision = store.revisions.find((item) => item.revisionId === receipt.revisionId);
    if (!revision) return [];
    const question = buildGeneratedQuestion(
      revision.revisionId,
      revision.content.stem,
      revision.content.difficulty,
      ['time'],
      revision.content.knowledgeTags,
      {
        learningGoalIds: revision.content.learningGoalIds,
        graphNodeIds: revision.content.graphNodeIds,
        intendedStage: revision.content.intendedStage,
      },
    );
    question.options = revision.content.options;
    question.generatedMetadata = {
      ...question.generatedMetadata!,
      generationKind: receipt.generationKind,
    };
    return [{
      question,
      generationKind: receipt.generationKind,
    }];
  });
}

export function generatedReviewDecisionsFromStore(store: GeneratedCandidateStore): AssessmentItemSemanticReviewDecision[] {
  return currentPublishedReceipts(store).flatMap((receipt) => {
    if (!isCurrentPublicationReceipt(store, receipt)) return [];
    const revision = store.revisions.find((item) => item.revisionId === receipt.revisionId);
    const review = store.reviews.find((item) => item.reviewId === receipt.reviewId);
    if (!revision || !review) return [];
    const decision: AssessmentItemSemanticReviewDecision = {
      catalogItemId: receipt.catalogItemId,
      decisionKind: 'human-review',
      outcome: 'approved',
      reviewerId: review.reviewerUserId,
      reviewerRole: review.reviewerRole,
      reviewedAt: review.createdAt,
      reviewBatchId: 'generated-candidate-publication',
      sourceContentHash: receipt.contentHash,
      selectedLearningGoalIds: [...revision.content.learningGoalIds],
      selectedKaqObjectiveIds: [],
      selectedGraphNodeIds: [...revision.content.graphNodeIds],
      selectedStagePurpose: revision.content.intendedStage === 'low-stakes-practice'
        ? 'practice'
        : revision.content.intendedStage,
      difficulty: revision.content.difficulty,
      cognitiveLevel: 'apply',
      misconceptionRefs: [],
      remediationRefs: [],
      metadataVersionRefs: {
        generatedPublicationReceiptHash: receipt.receiptHash,
        generatedCandidateRevisionId: receipt.revisionId,
      },
      notes: review.rationale,
    };
    return [{
      ...decision,
      reviewSourceHash: assessmentItemSemanticReviewSourceHash(decision),
    }];
  });
}

export function writeGeneratedCatalogRelease(
  store: GeneratedCandidateStore,
  rootDir = process.cwd(),
  catalogItems: unknown[] = [],
): GeneratedPublicationReceipt[] {
  const receipts = currentPublishedReceipts(store).filter((receipt) => isCurrentPublicationReceipt(store, receipt));
  const dir = path.join(rootDir, GENERATED_CATALOG_RELEASE_DIR);
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(rootDir, GENERATED_CANDIDATE_STORE_PATH), serializeGeneratedCandidateStore(store));
  writeFileSync(
    path.join(rootDir, GENERATED_CATALOG_ITEMS_PATH),
    catalogItems.map((item) => JSON.stringify(item)).join('\n') + (catalogItems.length ? '\n' : ''),
  );
  writeFileSync(
    path.join(rootDir, GENERATED_CATALOG_REVIEWS_PATH),
    generatedReviewDecisionsFromStore(store).map((decision) => JSON.stringify(decision)).join('\n')
      + (receipts.length ? '\n' : ''),
  );
  writeFileSync(path.join(rootDir, GENERATED_CATALOG_RELEASE_PATH), `${JSON.stringify({
    artifactVersion: 'generated-assessment-catalog-release.v1',
    receiptHashes: receipts.map((receipt) => receipt.receiptHash).sort(),
    catalogItemIds: receipts.map((receipt) => receipt.catalogItemId).sort(),
  }, null, 2)}\n`);
  return receipts;
}

export function readGeneratedCandidateStore(rootDir = process.cwd()): GeneratedCandidateStore | null {
  const filePath = path.join(rootDir, GENERATED_CANDIDATE_STORE_PATH);
  if (!existsSync(filePath)) return null;
  return restoreGeneratedCandidateStore(readFileSync(filePath, 'utf8'));
}
