/**
 * Adopt minted engineering learning-order edges into ACT_TEACHING.
 *
 * Candidates stay non-publishable. Adoption is an explicit pass: both
 * endpoints must already be current Authority objects and core nodes.
 * Teaching evidence wins on conflict. Receipts bind snapshot + edge id.
 */

import {
  candidatesFromEngineeringRelations,
  isEngineeringLearningOrderPredicate,
} from './candidates';
import {
  type EngineeringLearningOrderDisposition,
  type EngineeringLearningOrderReceipt,
  type PrerequisiteAuthorDecision,
  type PrerequisiteCandidateRecord,
  type PrerequisiteEdgeAuthoring,
  type PrerequisiteEdgePublished,
} from './contracts';
import { detectRequiredCycles, edgeIdentityKey } from './edges';
import { createPrerequisiteAuthorDecision } from './publication';

export const ENGINEERING_LEARNING_ORDER_CURATOR =
  'engineering-learning-order-adoption' as const;

export interface EngineeringLearningOrderRelation {
  id: string;
  sourceId: string;
  targetId: string;
  predicate: string;
}

export interface AdoptEngineeringLearningOrderInput {
  relations: readonly EngineeringLearningOrderRelation[];
  teachingEdges: readonly Pick<
    PrerequisiteEdgeAuthoring,
    'sourceNodeId' | 'targetNodeId' | 'strength' | 'edgeId'
  >[];
  coreNodeIds: ReadonlySet<string>;
  authorityIds: ReadonlySet<string>;
  scopeId: string;
  authorityReleaseId: string;
  projectionCaptureId: string | null;
  authoringRevision: string;
  snapshotHash: string;
}

export interface AdoptEngineeringLearningOrderResult {
  adoptedEdges: PrerequisiteEdgeAuthoring[];
  decisions: PrerequisiteAuthorDecision[];
  receipts: EngineeringLearningOrderReceipt[];
  candidates: PrerequisiteCandidateRecord[];
}

function pairKey(sourceId: string, targetId: string): string {
  return `${sourceId}\u001f${targetId}`;
}

function receiptCandidateNote(
  relation: EngineeringLearningOrderRelation,
  disposition: EngineeringLearningOrderDisposition,
  snapshotHash: string,
): string {
  return `engineering learning-order ${relation.predicate} ${relation.id} is eligible for ACT teaching adoption; disposition=${disposition} snapshot=${snapshotHash}`;
}

export function adoptEngineeringLearningOrder(
  input: AdoptEngineeringLearningOrderInput,
): AdoptEngineeringLearningOrderResult {
  const teachingByPair = new Map<string, (typeof input.teachingEdges)[number]>();
  for (const edge of input.teachingEdges) {
    teachingByPair.set(pairKey(edge.sourceNodeId, edge.targetNodeId), edge);
  }

  const adoptedEdges: PrerequisiteEdgeAuthoring[] = [];
  const decisions: PrerequisiteAuthorDecision[] = [];
  const receipts: EngineeringLearningOrderReceipt[] = [];
  const remainingForCandidates: Array<
    EngineeringLearningOrderRelation & { scopeId: string; note?: string }
  > = [];

  const requiredPairs = input.teachingEdges
    .filter((edge) => edge.strength === 'REQUIRED')
    .map((edge) => ({
      sourceNodeId: edge.sourceNodeId,
      targetNodeId: edge.targetNodeId,
      strength: 'REQUIRED' as const,
    }));

  for (const relation of input.relations) {
    const baseReceipt = {
      relationId: relation.id,
      sourceId: relation.sourceId,
      targetId: relation.targetId,
      snapshotHash: input.snapshotHash,
      authorityReleaseId: input.authorityReleaseId,
    };

    if (!isEngineeringLearningOrderPredicate(relation.predicate)) {
      remainingForCandidates.push({ ...relation, scopeId: input.scopeId });
      continue;
    }

    const inAuthority =
      input.authorityIds.has(relation.sourceId)
      && input.authorityIds.has(relation.targetId);
    if (!inAuthority) {
      receipts.push({ ...baseReceipt, disposition: 'rejected-not-authority', teachingPair: null });
      remainingForCandidates.push({
        ...relation,
        scopeId: input.scopeId,
        note: receiptCandidateNote(relation, 'rejected-not-authority', input.snapshotHash),
      });
      continue;
    }

    const inCore =
      input.coreNodeIds.has(relation.sourceId)
      && input.coreNodeIds.has(relation.targetId);
    if (!inCore) {
      receipts.push({ ...baseReceipt, disposition: 'rejected-not-core', teachingPair: null });
      remainingForCandidates.push({
        ...relation,
        scopeId: input.scopeId,
        note: receiptCandidateNote(relation, 'rejected-not-core', input.snapshotHash),
      });
      continue;
    }

    const same = teachingByPair.get(pairKey(relation.sourceId, relation.targetId));
    const opposite = teachingByPair.get(pairKey(relation.targetId, relation.sourceId));
    if (same) {
      if (same.strength === 'REQUIRED') {
        receipts.push({
          ...baseReceipt,
          disposition: 'already-teaching',
          teachingPair: { sourceNodeId: same.sourceNodeId, targetNodeId: same.targetNodeId },
        });
        continue;
      }
      receipts.push({
        ...baseReceipt,
        disposition: 'exception-teaching-conflict',
        teachingPair: { sourceNodeId: same.sourceNodeId, targetNodeId: same.targetNodeId },
      });
      remainingForCandidates.push({
        ...relation,
        scopeId: input.scopeId,
        note: receiptCandidateNote(relation, 'exception-teaching-conflict', input.snapshotHash),
      });
      continue;
    }
    if (opposite) {
      receipts.push({
        ...baseReceipt,
        disposition: 'exception-teaching-conflict',
        teachingPair: { sourceNodeId: opposite.sourceNodeId, targetNodeId: opposite.targetNodeId },
      });
      remainingForCandidates.push({
        ...relation,
        scopeId: input.scopeId,
        note: receiptCandidateNote(relation, 'exception-teaching-conflict', input.snapshotHash),
      });
      continue;
    }

    const cycleProbe = [
      ...requiredPairs,
      {
        sourceNodeId: relation.sourceId,
        targetNodeId: relation.targetId,
        strength: 'REQUIRED' as const,
      },
    ];
    if (detectRequiredCycles(cycleProbe).length > 0) {
      receipts.push({ ...baseReceipt, disposition: 'rejected-cycle', teachingPair: null });
      remainingForCandidates.push({
        ...relation,
        scopeId: input.scopeId,
        note: receiptCandidateNote(relation, 'rejected-cycle', input.snapshotHash),
      });
      continue;
    }

    const evidenceRefs = [
      `${ENGINEERING_RELATION_EVIDENCE_PREFIX}${relation.id}`,
      `${ENGINEERING_SNAPSHOT_EVIDENCE_PREFIX}${input.snapshotHash}`,
    ];
    const decision = createPrerequisiteAuthorDecision({
      sourceNodeId: relation.sourceId,
      targetNodeId: relation.targetId,
      strength: 'REQUIRED',
      scopeId: input.scopeId,
      evidenceRefs,
      curatorRationale: `Adopted engineering learning-order ${relation.id}`,
      curatorId: ENGINEERING_LEARNING_ORDER_CURATOR,
      rationale: `Adopted engineering learning-order ${relation.id} on snapshot ${input.snapshotHash}`,
      authorityReleaseId: input.authorityReleaseId,
      projectionCaptureId: input.projectionCaptureId,
      authoringRevision: input.authoringRevision,
    });
    adoptedEdges.push({
      sourceNodeId: relation.sourceId,
      targetNodeId: relation.targetId,
      strength: 'REQUIRED',
      scopeId: input.scopeId,
      evidenceRefs,
      curatorId: ENGINEERING_LEARNING_ORDER_CURATOR,
      curatorRationale: `Adopted engineering learning-order ${relation.id}`,
      status: 'PUBLISHED',
      authorDecisionId: decision.decisionId,
      candidateOrigin: 'ENGINEERING_RELATION',
    });
    decisions.push(decision);
    requiredPairs.push({
      sourceNodeId: relation.sourceId,
      targetNodeId: relation.targetId,
      strength: 'REQUIRED',
    });
    receipts.push({ ...baseReceipt, disposition: 'adopted', teachingPair: null });
  }

  return {
    adoptedEdges,
    decisions,
    receipts,
    candidates: candidatesFromEngineeringRelations(remainingForCandidates),
  };
}

export const ENGINEERING_RELATION_EVIDENCE_PREFIX = 'engineering-relation:';
export const ENGINEERING_SNAPSHOT_EVIDENCE_PREFIX = 'engineering-snapshot:';

export class EngineeringLearningOrderReceiptError extends Error {
  readonly code = 'hash-invalid';

  constructor(message: string) {
    super(message);
    this.name = 'EngineeringLearningOrderReceiptError';
  }
}

export function assertEngineeringAdoptedReceipts(input: {
  edges: readonly Pick<
    PrerequisiteEdgePublished,
    'status' | 'candidateOrigin' | 'sourceNodeId' | 'targetNodeId' | 'evidenceRefs'
  >[];
  receipts: readonly EngineeringLearningOrderReceipt[] | undefined;
}): void {
  const adoptedEdges = input.edges.filter((edge) => (
    edge.status === 'PUBLISHED' && edge.candidateOrigin === 'ENGINEERING_RELATION'
  ));

  const byRelation = new Map<string, EngineeringLearningOrderReceipt>();
  for (const receipt of input.receipts ?? []) {
    if (byRelation.has(receipt.relationId)) {
      throw new EngineeringLearningOrderReceiptError(
        `duplicate engineering-learning-order receipt ${receipt.relationId}`,
      );
    }
    byRelation.set(receipt.relationId, receipt);
  }

  for (const edge of adoptedEdges) {
    const relationRef = edge.evidenceRefs.find((ref) => (
      ref.startsWith(ENGINEERING_RELATION_EVIDENCE_PREFIX)
    ));
    const snapshotRef = edge.evidenceRefs.find((ref) => (
      ref.startsWith(ENGINEERING_SNAPSHOT_EVIDENCE_PREFIX)
    ));
    if (!relationRef || !snapshotRef) {
      throw new EngineeringLearningOrderReceiptError(
        'published engineering-order edge missing relation or snapshot evidence',
      );
    }
    const relationId = relationRef.slice(ENGINEERING_RELATION_EVIDENCE_PREFIX.length);
    const snapshotHash = snapshotRef.slice(ENGINEERING_SNAPSHOT_EVIDENCE_PREFIX.length);
    const receipt = byRelation.get(relationId);
    if (!receipt) {
      throw new EngineeringLearningOrderReceiptError(
        `published engineering-order edge missing receipt ${relationId}`,
      );
    }
    if (receipt.disposition !== 'adopted' && receipt.disposition !== 'already-teaching') {
      throw new EngineeringLearningOrderReceiptError(
        `engineering-order receipt ${relationId} is not an adoption receipt`,
      );
    }
    if (receipt.sourceId !== edge.sourceNodeId || receipt.targetId !== edge.targetNodeId) {
      throw new EngineeringLearningOrderReceiptError(
        `engineering-order receipt ${relationId} endpoint mismatch`,
      );
    }
    if (receipt.snapshotHash !== snapshotHash) {
      throw new EngineeringLearningOrderReceiptError(
        `engineering-order receipt ${relationId} snapshot mismatch`,
      );
    }
  }

  for (const receipt of input.receipts ?? []) {
    if (receipt.disposition !== 'adopted') continue;
    const matched = adoptedEdges.some((edge) => {
      const relationRef = edge.evidenceRefs.find((ref) => (
        ref.startsWith(ENGINEERING_RELATION_EVIDENCE_PREFIX)
      ));
      return relationRef?.slice(ENGINEERING_RELATION_EVIDENCE_PREFIX.length) === receipt.relationId
        && receipt.sourceId === edge.sourceNodeId
        && receipt.targetId === edge.targetNodeId;
    });
    if (!matched) {
      throw new EngineeringLearningOrderReceiptError(
        `adopted receipt ${receipt.relationId} has no published engineering-order edge`,
      );
    }
  }
}

export function applyEngineeringLearningOrderToBuildInput(input: {
  scopeId: string;
  authorityReleaseId: string;
  projectionCaptureId: string | null;
  authoringRevision: string;
  snapshotHash: string;
  coreNodeIds: readonly string[];
  authorityIds: readonly string[];
  teachingEdges: readonly PrerequisiteEdgeAuthoring[];
  teachingDecisions: readonly PrerequisiteAuthorDecision[];
  relations: readonly EngineeringLearningOrderRelation[];
}): {
  edges: PrerequisiteEdgeAuthoring[];
  decisions: PrerequisiteAuthorDecision[];
  candidates: PrerequisiteCandidateRecord[];
  receipts: EngineeringLearningOrderReceipt[];
} {
  const adopted = adoptEngineeringLearningOrder({
    relations: input.relations,
    teachingEdges: input.teachingEdges,
    coreNodeIds: new Set(input.coreNodeIds),
    authorityIds: new Set(input.authorityIds),
    scopeId: input.scopeId,
    authorityReleaseId: input.authorityReleaseId,
    projectionCaptureId: input.projectionCaptureId,
    authoringRevision: input.authoringRevision,
    snapshotHash: input.snapshotHash,
  });

  return {
    edges: [...input.teachingEdges, ...adopted.adoptedEdges],
    decisions: [...input.teachingDecisions, ...adopted.decisions],
    candidates: adopted.candidates,
    receipts: adopted.receipts,
  };
}

export function decisionFromPublishedEdge(input: {
  sourceNodeId: string;
  targetNodeId: string;
  strength: 'REQUIRED' | 'RECOMMENDED';
  scopeId: string;
  evidenceRefs: readonly string[];
  curatorRationale: string | null;
  authorDecisionId: string;
  authorityReleaseId: string;
  projectionCaptureId: string | null;
  authoringRevision: string;
}): PrerequisiteAuthorDecision {
  return createPrerequisiteAuthorDecision({
    sourceNodeId: input.sourceNodeId,
    targetNodeId: input.targetNodeId,
    strength: input.strength,
    scopeId: input.scopeId,
    evidenceRefs: input.evidenceRefs,
    curatorRationale: input.curatorRationale,
    curatorId: 'course-owner',
    rationale: `Retained published teaching edge ${edgeIdentityKey({
      sourceNodeId: input.sourceNodeId,
      targetNodeId: input.targetNodeId,
      strength: input.strength,
      scopeId: input.scopeId,
    })}`,
    authorityReleaseId: input.authorityReleaseId,
    projectionCaptureId: input.projectionCaptureId,
    authoringRevision: input.authoringRevision,
    decisionId: input.authorDecisionId,
  });
}
