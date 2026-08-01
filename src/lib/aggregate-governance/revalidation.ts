import type {
  PriorSemanticDecision,
  RevalidationOutcome,
  RevalidationReceipt,
} from './contracts';
import { sha256Canonical } from './hash';

export interface RevalidationComparable {
  canonicalDigest: string | null;
  resourceSegmentHash: string | null;
  role: string | null;
  promptReviewerVersion: string | null;
  evidenceDigest: string | null;
  structuralGateDigest: string | null;
}

/**
 * Create an auditable revalidation receipt for a new ReleaseSet only when all
 * semantic identity signals remain valid. Never copies the old publication
 * identity into the new receipt id.
 */
export function evaluateSemanticRevalidation(input: {
  prior: PriorSemanticDecision;
  current: RevalidationComparable;
  newReleaseSetId: string;
  newReleaseId: string;
  newDeltaReceiptId: string;
  captureRevision: string;
  kind: RevalidationReceipt['kind'];
}): RevalidationReceipt {
  const comparable: Array<keyof RevalidationComparable> = [
    'canonicalDigest',
    'resourceSegmentHash',
    'role',
    'promptReviewerVersion',
    'evidenceDigest',
    'structuralGateDigest',
  ];
  const unchanged = comparable.every((field) => input.prior[field] === input.current[field]);
  const outcome: RevalidationOutcome = unchanged ? 'REVALIDATED' : 'REQUIRES_REVIEW';
  const identityDigest = sha256Canonical({
    kind: input.kind,
    priorPublicationIdentity: input.prior.publicationIdentity,
    current: input.current,
    newReleaseSetId: input.newReleaseSetId,
    newReleaseId: input.newReleaseId,
    newDeltaReceiptId: input.newDeltaReceiptId,
    outcome,
  });
  return {
    id: `revalidation:${sha256Canonical({
      identityDigest,
      captureRevision: input.captureRevision,
      priorPublicationIdentity: input.prior.publicationIdentity,
      notCopy: true,
    })}`,
    kind: input.kind,
    priorPublicationIdentity: input.prior.publicationIdentity,
    newReleaseSetId: input.newReleaseSetId,
    newReleaseId: input.newReleaseId,
    newDeltaReceiptId: input.newDeltaReceiptId,
    outcome,
    identityDigest,
    captureRevision: input.captureRevision,
    copiesPriorPublication: false,
  };
}

/**
 * Packaging no-op requires an eligible prior semantic publication identity
 * (prior coverage/Crosswalk/binding governance publication). It creates a new
 * receipt that references but never copies that identity.
 */
export function packagingNoopRevalidation(input: {
  priorPublicationIdentity: string;
  newReleaseSetId: string;
  newReleaseId: string;
  newDeltaReceiptId: string;
  captureRevision: string;
}): RevalidationReceipt {
  if (!input.priorPublicationIdentity.trim()) {
    throw new Error(
      'Aggregate governance rejected: packaging no-op requires prior semantic publication identity',
    );
  }
  if (
    input.priorPublicationIdentity === input.newDeltaReceiptId
    || input.priorPublicationIdentity === input.newReleaseId
  ) {
    throw new Error(
      'Aggregate governance rejected: packaging no-op prior identity must be a prior coverage/Crosswalk/binding publication, not the new Delta/Release identity',
    );
  }
  const identityDigest = sha256Canonical({
    kind: 'packaging',
    priorPublicationIdentity: input.priorPublicationIdentity,
    newReleaseSetId: input.newReleaseSetId,
    newReleaseId: input.newReleaseId,
    newDeltaReceiptId: input.newDeltaReceiptId,
    outcome: 'NO_OP_PACKAGING',
  });
  const receiptId = `revalidation:${sha256Canonical({
    identityDigest,
    captureRevision: input.captureRevision,
    priorPublicationIdentity: input.priorPublicationIdentity,
    notCopy: true,
    newDeltaReceiptId: input.newDeltaReceiptId,
  })}`;
  if (receiptId === input.priorPublicationIdentity) {
    throw new Error(
      'Aggregate governance rejected: packaging no-op must not copy prior publication identity',
    );
  }
  return {
    id: receiptId,
    kind: 'packaging',
    priorPublicationIdentity: input.priorPublicationIdentity,
    newReleaseSetId: input.newReleaseSetId,
    newReleaseId: input.newReleaseId,
    newDeltaReceiptId: input.newDeltaReceiptId,
    outcome: 'NO_OP_PACKAGING',
    identityDigest,
    captureRevision: input.captureRevision,
    copiesPriorPublication: false,
  };
}

export function receiptsDoNotCopyPublicationIdentity(
  receipts: readonly RevalidationReceipt[],
): boolean {
  return receipts.every((receipt) => (
    receipt.copiesPriorPublication === false
    && receipt.id !== receipt.priorPublicationIdentity
  ));
}
