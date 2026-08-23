import { projectionDigest, projectionSha256 } from '@/lib/teaching-projection/hash';

export { projectionDigest, projectionSha256 };

export class ActTeachingRelationError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'ActTeachingRelationError';
    this.code = code;
  }
}

export function sortedUnique(values: readonly string[]): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

export function teachingEdgeId(input: {
  family: string;
  sourceCanonicalId: string;
  targetCanonicalId: string | null;
  scopeHash: string;
}): string {
  return `edge-${projectionDigest(input).slice(0, 24)}`;
}

export const FROZEN_EVIDENCE_CLAIM_KINDS = ['COURSE_ROOT', 'CONTAINMENT_PARENT'] as const;
export type FrozenEvidenceClaimKind = (typeof FROZEN_EVIDENCE_CLAIM_KINDS)[number];

export interface FrozenEvidenceClaim {
  readonly kind: FrozenEvidenceClaimKind;
  readonly relationType: 'CONTAINMENT';
  readonly sourceCanonicalId: string;
  readonly targetCanonicalId: string | null;
}

export interface FrozenEvidenceRecord {
  readonly ref: string;
  readonly body: string;
  readonly claim: FrozenEvidenceClaim;
}

export function freezeEvidenceRef(ref: string, body: string): { ref: string; body: string } {
  if (!ref || !body || ref.startsWith('course-root:') || ref.startsWith('scope:') || ref.startsWith('pending:')) {
    throw new ActTeachingRelationError('invalid-evidence-ref', `evidence ref is not independently verifiable: ${ref}`);
  }
  return { ref, body };
}

export function freezeEvidenceRecord(
  ref: string,
  body: string,
  claim: FrozenEvidenceClaim,
): FrozenEvidenceRecord {
  freezeEvidenceRef(ref, body);
  if (!claim.sourceCanonicalId) {
    throw new ActTeachingRelationError('invalid-evidence-ref', `evidence ${ref} is missing a source identity`);
  }
  if (claim.relationType !== 'CONTAINMENT') {
    throw new ActTeachingRelationError('invalid-evidence-ref', `evidence ${ref} must attest CONTAINMENT`);
  }
  if (claim.kind === 'COURSE_ROOT' && claim.targetCanonicalId !== null) {
    throw new ActTeachingRelationError('invalid-evidence-ref', `COURSE_ROOT evidence ${ref} cannot name a parent`);
  }
  if (claim.kind === 'CONTAINMENT_PARENT') {
    if (!claim.targetCanonicalId) {
      throw new ActTeachingRelationError('invalid-evidence-ref', `parent evidence ${ref} requires a target`);
    }
    if (claim.sourceCanonicalId === claim.targetCanonicalId) {
      throw new ActTeachingRelationError('invalid-evidence-ref', `parent evidence ${ref} is a self-loop`);
    }
  }
  return Object.freeze({
    ref,
    body,
    claim: Object.freeze({ ...claim }),
  });
}

export function evidenceAttestsClaim(
  record: FrozenEvidenceRecord,
  claim: FrozenEvidenceClaim,
): boolean {
  return record.claim.kind === claim.kind
    && record.claim.relationType === claim.relationType
    && record.claim.sourceCanonicalId === claim.sourceCanonicalId
    && record.claim.targetCanonicalId === claim.targetCanonicalId;
}

export function requireNonEmpty(value: string, code: string, field: string): string {
  if (!value || value.trim().length === 0) {
    throw new ActTeachingRelationError(code, `${field} is required`);
  }
  return value;
}
