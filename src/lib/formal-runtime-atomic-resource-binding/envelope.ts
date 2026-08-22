import {
  FORMAL_RESOURCE_BUILDER_VERSION,
  FORMAL_RESOURCE_ENVELOPE_CONTRACT,
  type FormalBinding,
  type FormalQualificationReceipt,
  type FormalResourceCandidate,
  type FormalResourceEnvelope,
} from './contracts';
import { FormalResourceError, projectionDigest } from './hash';
import { setHash } from './inventory';

export function buildFormalResourceEnvelope(input: {
  releaseId: string;
  sourceRevision: string;
  treeSha256: string;
  authority: FormalResourceEnvelope['authority'];
  courseScopeId: string;
  candidates: readonly FormalResourceCandidate[];
  bindings: readonly FormalBinding[];
  qualifications: readonly FormalQualificationReceipt[];
}): FormalResourceEnvelope {
  const included = input.candidates.filter((row) => row.disposition === 'INCLUDED');
  const excluded = input.candidates.filter((row) => row.disposition === 'EXCLUDED');
  if (included.length + excluded.length !== input.candidates.length) {
    throw new FormalResourceError('inventory-incomplete', 'every candidate must be INCLUDED or EXCLUDED');
  }
  const body = {
    contract: FORMAL_RESOURCE_ENVELOPE_CONTRACT,
    builderVersion: FORMAL_RESOURCE_BUILDER_VERSION,
    releaseId: input.releaseId,
    sourceRevision: input.sourceRevision,
    treeSha256: input.treeSha256,
    authority: input.authority,
    courseScopeId: input.courseScopeId,
    candidateCount: input.candidates.length,
    includedCount: included.length,
    excludedCount: excluded.length,
    bindingCount: input.bindings.length,
    candidateHash: setHash(input.candidates.map((row) => row.resourceId)),
    includedHash: setHash(included.map((row) => row.resourceId)),
    excludedHash: setHash(excluded.map((row) => row.resourceId)),
    bindingHash: setHash(input.bindings.map((row) => row.bindingId)),
    qualificationReceiptIds: [...input.qualifications.map((row) => row.receiptId)].sort(),
  };
  return {
    ...body,
    envelopeHash: projectionDigest(body),
  };
}

export function assertEnvelopeMatch(
  expected: FormalResourceEnvelope,
  actual: Pick<FormalResourceEnvelope, 'envelopeHash' | 'bindingHash' | 'candidateHash' | 'authority' | 'courseScopeId' | 'releaseId'>,
): void {
  if (
    expected.envelopeHash !== actual.envelopeHash
    || expected.bindingHash !== actual.bindingHash
    || expected.candidateHash !== actual.candidateHash
    || expected.releaseId !== actual.releaseId
    || expected.courseScopeId !== actual.courseScopeId
    || expected.authority.releaseId !== actual.authority.releaseId
    || expected.authority.snapshotHash !== actual.authority.snapshotHash
  ) {
    throw new FormalResourceError(
      'envelope-drift',
      'formal-resource envelope drifted from the sealed Runtime Release v2 receipt',
    );
  }
}

export function historicalV2SatisfiesFormalGate(hasFormalContract: boolean): boolean {
  return hasFormalContract;
}

export function assertReceiptSealsEnvelope(
  receiptEnvelopeHash: string | undefined,
  envelope: FormalResourceEnvelope,
): void {
  if (!receiptEnvelopeHash || receiptEnvelopeHash !== envelope.envelopeHash) {
    throw new FormalResourceError(
      'envelope-drift',
      'Runtime Release v2 receipt does not seal the formal-resource envelope',
    );
  }
}

export function assertFormalPreflight(input: {
  envelope: FormalResourceEnvelope;
  candidates: readonly FormalResourceCandidate[];
  bindings: readonly FormalBinding[];
  qualifications: readonly FormalQualificationReceipt[];
}): void {
  const rebuilt = buildFormalResourceEnvelope({
    releaseId: input.envelope.releaseId,
    sourceRevision: input.envelope.sourceRevision,
    treeSha256: input.envelope.treeSha256,
    authority: input.envelope.authority,
    courseScopeId: input.envelope.courseScopeId,
    candidates: input.candidates,
    bindings: input.bindings,
    qualifications: input.qualifications,
  });
  if (rebuilt.envelopeHash !== input.envelope.envelopeHash) {
    throw new FormalResourceError('envelope-drift', 'preflight rebuilt envelope drifted');
  }
}
