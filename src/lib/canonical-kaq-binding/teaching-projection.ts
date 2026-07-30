/**
 * Typed boundary for future ActKG Teaching Projection knowledge-to-knowledge
 * relations (#1113).
 *
 * Availability requires VerifiedKaqPinnedContext + branded FormalTeachingProjectionProof.
 */

import { createHash } from 'node:crypto';

import {
  assertFormalTeachingProjectionProof,
  assertVerifiedKaqPinnedContext,
  KaqAuthorityInputError,
  type FormalTeachingProjectionProof,
  type VerifiedKaqPinnedContext,
} from './authority-capability';
import {
  ACTKG_TEACHING_PROJECTION_PREDICATES,
  ENGINEERING_PREDICATES_NEVER_TEACHING,
  KAQ_OWNED_RELATION_NAMESPACES,
  KAQ_TEACHING_PROJECTION_BOUNDARY_VERSION,
  PINNED_KAQ_AGGREGATE_RELEASE_ID,
  PINNED_KAQ_AGGREGATE_RELEASE_SET_ID,
  type ActkgTeachingProjectionPredicate,
  type ActkgTeachingProjectionRelation,
  type EngineeringPredicateNeverTeaching,
  type KaqOwnedRelationNamespace,
  type TeachingProjectionAvailability,
  type TeachingProjectionUnavailableReason,
} from './contracts';

const SHA256 = /^[a-f0-9]{64}$/u;

/**
 * Stable whole-set digest for a formal Teaching Projection relation release.
 * Covers sorted id/version/predicate/source/target plus projection identity.
 * Must match FormalTeachingProjectionProof.relationSetDigest / availability.
 */
export function digestFormalTeachingProjectionRelationSet(
  relations: ReadonlyArray<{
    id: string;
    version: string;
    predicate: string;
    sourceCanonicalId: string;
    targetCanonicalId: string;
  }>,
  projection: {
    projectionId: string;
    projectionDigest: string;
  },
): string {
  const rows = relations
    .map((relation) => ({
      id: relation.id,
      version: relation.version,
      predicate: relation.predicate,
      sourceCanonicalId: relation.sourceCanonicalId,
      targetCanonicalId: relation.targetCanonicalId,
    }))
    .sort((a, b) => {
      const byId = a.id.localeCompare(b.id);
      if (byId !== 0) return byId;
      const byVersion = a.version.localeCompare(b.version);
      if (byVersion !== 0) return byVersion;
      const byPredicate = a.predicate.localeCompare(b.predicate);
      if (byPredicate !== 0) return byPredicate;
      const bySource = a.sourceCanonicalId.localeCompare(b.sourceCanonicalId);
      if (bySource !== 0) return bySource;
      return a.targetCanonicalId.localeCompare(b.targetCanonicalId);
    });
  return createHash('sha256')
    .update(JSON.stringify({
      projectionId: projection.projectionId,
      projectionDigest: projection.projectionDigest,
      relations: rows,
    }), 'utf8')
    .digest('hex');
}

export function isActkgTeachingProjectionPredicate(
  value: string,
): value is ActkgTeachingProjectionPredicate {
  return (ACTKG_TEACHING_PROJECTION_PREDICATES as readonly string[]).includes(value);
}

export function isKaqOwnedRelationNamespace(
  value: string,
): value is KaqOwnedRelationNamespace {
  return (KAQ_OWNED_RELATION_NAMESPACES as readonly string[]).includes(value);
}

function unavailable(
  reason: TeachingProjectionUnavailableReason = 'formal-teaching-projection-not-available',
): TeachingProjectionAvailability {
  return {
    available: false,
    blocked: true,
    reason,
    boundaryVersion: KAQ_TEACHING_PROJECTION_BOUNDARY_VERSION,
  };
}

export function unavailableTeachingProjection(): TeachingProjectionAvailability {
  return unavailable('formal-teaching-projection-not-available');
}

export function resolveTeachingProjectionAvailability(input?: {
  pinned?: VerifiedKaqPinnedContext | null | unknown;
  formalProof?: FormalTeachingProjectionProof | null | Record<string, unknown>;
  teachingProjection?: {
    projectionId: string;
    projectionDigest: string;
  } | null;
}): TeachingProjectionAvailability {
  if (!input?.pinned) {
    return unavailable('missing-pinned-context');
  }

  let pinned: VerifiedKaqPinnedContext;
  try {
    pinned = assertVerifiedKaqPinnedContext(input.pinned);
  } catch (error) {
    if (error instanceof KaqAuthorityInputError) {
      return unavailable('pinned-context-fingerprint-invalid');
    }
    // Fingerprint recompute failures surface as KaqPinnedContextError.
    if (error instanceof Error && error.name === 'KaqPinnedContextError') {
      return unavailable('pinned-context-fingerprint-invalid');
    }
    throw error;
  }

  if (
    pinned.releaseSetId !== PINNED_KAQ_AGGREGATE_RELEASE_SET_ID
    || pinned.releaseId !== PINNED_KAQ_AGGREGATE_RELEASE_ID
  ) {
    return unavailable('release-identity-not-pinned');
  }

  if (!input.formalProof) {
    if (input.teachingProjection) {
      return unavailable('missing-formal-teaching-proof');
    }
    return unavailable('formal-teaching-projection-not-available');
  }

  try {
    const proof = assertFormalTeachingProjectionProof(input.formalProof, pinned);
    return {
      available: true,
      blocked: false,
      boundaryVersion: KAQ_TEACHING_PROJECTION_BOUNDARY_VERSION,
      releaseSetId: proof.releaseSetId,
      releaseId: proof.releaseId,
      pinnedContextDigest: proof.pinnedContextDigest,
      projectionId: proof.projectionId,
      projectionDigest: proof.projectionDigest,
      relationSetDigest: proof.relationSetDigest,
    };
  } catch (error) {
    if (error instanceof KaqAuthorityInputError) {
      if (error.code === 'teaching-proof-mismatch') {
        return unavailable('teaching-proof-mismatch');
      }
      return unavailable('missing-formal-teaching-proof');
    }
    throw error;
  }
}

export function inferTeachingRelationFromEngineeringPredicate(
  _predicate: string | EngineeringPredicateNeverTeaching,
): null {
  return null;
}

export function courseCoverageCreatesTeachingProjectionEdge(
  _role: string,
): false {
  return false;
}

export function actkgRelationMatchesAvailability(
  relation: ActkgTeachingProjectionRelation,
  availability: Extract<TeachingProjectionAvailability, { available: true }>,
): boolean {
  return (
    relation.releaseSetId === availability.releaseSetId
    && relation.releaseId === availability.releaseId
    && relation.pinnedContextDigest === availability.pinnedContextDigest
    && relation.projectionId === availability.projectionId
    && relation.projectionDigest === availability.projectionDigest
    && relation.namespace === 'actkg-teaching-projection'
    && relation.authority === 'ACTKG'
  );
}

export function buildActkgTeachingProjectionRelation(input: {
  availability: TeachingProjectionAvailability;
  pinned: VerifiedKaqPinnedContext;
  id: string;
  predicate: string;
  sourceCanonicalId: string;
  targetCanonicalId: string;
  version: string;
}): ActkgTeachingProjectionRelation {
  if (!input.availability.available) {
    throw new Error(
      'Teaching Projection relation rejected: formal Teaching Projection is not available',
    );
  }
  if (!isActkgTeachingProjectionPredicate(input.predicate)) {
    throw new Error(
      `Teaching Projection relation rejected: unsupported predicate ${input.predicate}`,
    );
  }
  if (!input.sourceCanonicalId.trim() || !input.targetCanonicalId.trim()) {
    throw new Error('Teaching Projection relation rejected: endpoints required');
  }
  if (!SHA256.test(input.availability.projectionDigest)) {
    throw new Error(
      'Teaching Projection relation rejected: projectionDigest must be 64-char lowercase sha256 hex',
    );
  }

  const pinned = assertVerifiedKaqPinnedContext(input.pinned);

  if (pinned.contextDigest !== input.availability.pinnedContextDigest) {
    throw new Error(
      'Teaching Projection relation rejected: pinnedContextDigest mismatch',
    );
  }
  if (
    pinned.releaseSetId !== input.availability.releaseSetId
    || pinned.releaseId !== input.availability.releaseId
  ) {
    throw new Error(
      'Teaching Projection relation rejected: Release identity mismatch with pinned context',
    );
  }
  if (
    input.availability.releaseSetId !== PINNED_KAQ_AGGREGATE_RELEASE_SET_ID
    || input.availability.releaseId !== PINNED_KAQ_AGGREGATE_RELEASE_ID
  ) {
    throw new Error(
      'Teaching Projection relation rejected: availability is not bound to pinned aggregate',
    );
  }
  if (!pinned.admittedCanonicalIds.includes(input.sourceCanonicalId)) {
    throw new Error(
      `Teaching Projection relation rejected: source ${input.sourceCanonicalId} outside CourseCoverage`,
    );
  }
  if (!pinned.admittedCanonicalIds.includes(input.targetCanonicalId)) {
    throw new Error(
      `Teaching Projection relation rejected: target ${input.targetCanonicalId} outside CourseCoverage`,
    );
  }

  const relation: ActkgTeachingProjectionRelation = {
    id: input.id,
    namespace: 'actkg-teaching-projection',
    authority: 'ACTKG',
    predicate: input.predicate,
    sourceCanonicalId: input.sourceCanonicalId,
    targetCanonicalId: input.targetCanonicalId,
    releaseSetId: input.availability.releaseSetId,
    releaseId: input.availability.releaseId,
    pinnedContextDigest: input.availability.pinnedContextDigest,
    projectionId: input.availability.projectionId,
    projectionDigest: input.availability.projectionDigest,
    version: input.version,
  };

  if (!actkgRelationMatchesAvailability(relation, input.availability)) {
    throw new Error(
      'Teaching Projection relation rejected: constructed relation does not match availability',
    );
  }
  return relation;
}

export type TypedRelationAuthority =
  | {
      namespace: KaqOwnedRelationNamespace;
      authority: 'KAQ';
      version: string;
    }
  | {
      namespace: 'actkg-teaching-projection';
      authority: 'ACTKG';
      version: string;
      projectionId: string;
      projectionDigest: string;
    };

export function describeKaqOwnedRelationAuthority(
  namespace: KaqOwnedRelationNamespace,
  version: string,
): TypedRelationAuthority {
  return {
    namespace,
    authority: 'KAQ',
    version,
  };
}

export function describeActkgTeachingRelationAuthority(
  relation: ActkgTeachingProjectionRelation,
): TypedRelationAuthority {
  return {
    namespace: 'actkg-teaching-projection',
    authority: 'ACTKG',
    version: relation.version,
    projectionId: relation.projectionId,
    projectionDigest: relation.projectionDigest,
  };
}

export function engineeringPredicateTeachingInferenceTable(): Record<
  EngineeringPredicateNeverTeaching,
  null
> {
  const table = {} as Record<EngineeringPredicateNeverTeaching, null>;
  for (const predicate of ENGINEERING_PREDICATES_NEVER_TEACHING) {
    table[predicate] = inferTeachingRelationFromEngineeringPredicate(predicate);
  }
  return table;
}
