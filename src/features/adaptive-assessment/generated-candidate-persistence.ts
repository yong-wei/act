import type { Prisma, PrismaClient } from '@prisma/client';

import {
  type GeneratedCandidateStore,
  createGeneratedCandidateStore,
} from './generated-candidate-governance';

export async function persistGeneratedCandidateStore(
  db: PrismaClient,
  store: GeneratedCandidateStore,
): Promise<void> {
  await db.$transaction(async (tx) => {
    for (const record of store.candidates) {
      await tx.adaptiveAssessmentGeneratedCandidate.upsert({
        where: { id: record.candidateId },
        update: {
          generationKind: record.generationKind,
          createdByUserId: record.createdByUserId,
        },
        create: {
          id: record.candidateId,
          generationKind: record.generationKind,
          status: record.status,
          currentRevisionId: record.currentRevisionId,
          createdByUserId: record.createdByUserId,
          createdAt: new Date(record.createdAt),
          updatedAt: new Date(record.updatedAt),
        },
      });
    }
    for (const revision of store.revisions) {
      const existing = await tx.adaptiveAssessmentGeneratedCandidateRevision.findUnique({
        where: { id: revision.revisionId },
      });
      if (existing) {
        if (existing.contentHash !== revision.envelope.contentHash) {
          throw new Error(`immutable-revision-drift:${revision.revisionId}`);
        }
        continue;
      }
      await tx.adaptiveAssessmentGeneratedCandidateRevision.create({
        data: {
          id: revision.revisionId,
          candidateId: revision.candidateId,
          parentRevisionId: revision.envelope.parentRevisionId,
          contentHash: revision.envelope.contentHash,
          envelopePublicJson: toJson(revision.envelope),
          envelopePrivateJson: toJson(revision.privatePayload ?? {}),
          contentJson: toJson(revision.content),
          promptHash: revision.envelope.promptHash,
          modelResponseHash: revision.envelope.modelResponseHash,
          createdAt: new Date(revision.createdAt),
        },
      });
    }
    for (const event of store.events) {
      await tx.adaptiveAssessmentGeneratedCandidateEvent.upsert({
        where: { id: event.eventId },
        update: {},
        create: {
          id: event.eventId,
          candidateId: event.candidateId,
          revisionId: event.revisionId,
          status: event.status,
          actorUserId: event.actorUserId,
          reason: event.reason,
          createdAt: new Date(event.createdAt),
        },
      });
    }
    for (const review of store.reviews) {
      const existingReview = await tx.adaptiveAssessmentGeneratedCandidateReview.findUnique({
        where: { id: review.reviewId },
      });
      if (existingReview) {
        await tx.adaptiveAssessmentGeneratedCandidateReview.update({
          where: { id: review.reviewId },
          data: { stale: review.stale },
        });
        continue;
      }
      await tx.adaptiveAssessmentGeneratedCandidateReview.create({
        data: {
          id: review.reviewId,
          candidateId: review.candidateId,
          revisionId: review.revisionId,
          reviewerUserId: review.reviewerUserId,
          reviewerRole: review.reviewerRole,
          outcome: review.outcome,
          rationale: review.rationale,
          itemDecisions: toJson(review.itemDecisions),
          contentHash: review.contentHash,
          reviewSourceHash: review.reviewSourceHash,
          stale: review.stale,
          createdAt: new Date(review.createdAt),
        },
      });
    }
    for (const receipt of store.receipts) {
      await tx.adaptiveAssessmentGeneratedPublicationReceipt.upsert({
        where: { id: receipt.receiptId },
        update: {
          status: receipt.status,
          retiredAt: receipt.retiredAt ? new Date(receipt.retiredAt) : null,
        },
        create: {
          id: receipt.receiptId,
          candidateId: receipt.candidateId,
          revisionId: receipt.revisionId,
          reviewId: receipt.reviewId,
          catalogItemId: receipt.catalogItemId,
          contentHash: receipt.contentHash,
          catalogReleaseId: receipt.catalogReleaseId,
          receiptHash: receipt.receiptHash,
          generationKind: receipt.generationKind,
          status: receipt.status,
          createdAt: new Date(receipt.createdAt),
          retiredAt: receipt.retiredAt ? new Date(receipt.retiredAt) : null,
        },
      });
    }
    for (const record of store.candidates) {
      await tx.adaptiveAssessmentGeneratedCandidate.update({
        where: { id: record.candidateId },
        data: {
          status: record.status,
          currentRevisionId: record.currentRevisionId,
          updatedAt: new Date(record.updatedAt),
        },
      });
    }
  });
}

export async function loadGeneratedCandidateStore(
  db: Pick<PrismaClient,
    'adaptiveAssessmentGeneratedCandidate' |
    'adaptiveAssessmentGeneratedCandidateRevision' |
    'adaptiveAssessmentGeneratedCandidateEvent' |
    'adaptiveAssessmentGeneratedCandidateReview' |
    'adaptiveAssessmentGeneratedPublicationReceipt'
  >,
): Promise<GeneratedCandidateStore> {
  const store = createGeneratedCandidateStore();
  const [candidates, revisions, events, reviews, receipts] = await Promise.all([
    db.adaptiveAssessmentGeneratedCandidate.findMany(),
    db.adaptiveAssessmentGeneratedCandidateRevision.findMany(),
    db.adaptiveAssessmentGeneratedCandidateEvent.findMany(),
    db.adaptiveAssessmentGeneratedCandidateReview.findMany(),
    db.adaptiveAssessmentGeneratedPublicationReceipt.findMany(),
  ]);
  store.candidates = candidates.map((record) => ({
    candidateId: record.id,
    generationKind: record.generationKind as GeneratedCandidateStore['candidates'][number]['generationKind'],
    status: record.status as GeneratedCandidateStore['candidates'][number]['status'],
    currentRevisionId: record.currentRevisionId,
    createdByUserId: record.createdByUserId,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  }));
  store.revisions = revisions.map((revision) => ({
    revisionId: revision.id,
    candidateId: revision.candidateId,
    envelope: revision.envelopePublicJson as unknown as GeneratedCandidateStore['revisions'][number]['envelope'],
    content: revision.contentJson as unknown as GeneratedCandidateStore['revisions'][number]['content'],
    createdAt: revision.createdAt.toISOString(),
    privatePayload: revision.envelopePrivateJson as unknown as GeneratedCandidateStore['revisions'][number]['privatePayload'],
  }));
  store.events = events.map((event) => ({
    eventId: event.id,
    candidateId: event.candidateId,
    revisionId: event.revisionId,
    status: event.status as GeneratedCandidateStore['events'][number]['status'],
    actorUserId: event.actorUserId,
    reason: event.reason,
    createdAt: event.createdAt.toISOString(),
  }));
  store.reviews = reviews.map((review) => ({
    reviewId: review.id,
    candidateId: review.candidateId,
    revisionId: review.revisionId,
    reviewerUserId: review.reviewerUserId,
    reviewerRole: review.reviewerRole as GeneratedCandidateStore['reviews'][number]['reviewerRole'],
    outcome: review.outcome as GeneratedCandidateStore['reviews'][number]['outcome'],
    rationale: review.rationale,
    itemDecisions: review.itemDecisions as unknown as GeneratedCandidateStore['reviews'][number]['itemDecisions'],
    contentHash: review.contentHash,
    reviewSourceHash: review.reviewSourceHash,
    stale: review.stale,
    createdAt: review.createdAt.toISOString(),
  }));
  store.receipts = receipts.map((receipt) => ({
    receiptId: receipt.id,
    candidateId: receipt.candidateId,
    revisionId: receipt.revisionId,
    reviewId: receipt.reviewId,
    catalogItemId: receipt.catalogItemId,
    contentHash: receipt.contentHash,
    catalogReleaseId: receipt.catalogReleaseId,
    receiptHash: receipt.receiptHash,
    generationKind: receipt.generationKind as GeneratedCandidateStore['receipts'][number]['generationKind'],
    status: receipt.status as GeneratedCandidateStore['receipts'][number]['status'],
    createdAt: receipt.createdAt.toISOString(),
    retiredAt: receipt.retiredAt?.toISOString() ?? null,
  }));
  return store;
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
