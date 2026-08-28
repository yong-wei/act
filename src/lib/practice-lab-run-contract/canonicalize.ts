import { createHash } from 'node:crypto';

import { CONTRACT_SCHEMA, type ArtifactRunIdentity } from './types';

export function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, canonicalize(nested)]),
    );
  }
  return value;
}

export function canonicalIdentityHash(identity: Omit<ArtifactRunIdentity, 'canonicalIdentityHash'>): string {
  const payload = canonicalize({
    schemaVersion: CONTRACT_SCHEMA,
    sourceKind: identity.sourceKind,
    sourceId: identity.sourceId,
    ownerRef: identity.ownerRef,
    authority: identity.authority,
    taskId: identity.taskId,
    specHash: identity.specHash,
    artifactHash: identity.artifactHash,
    controllerSnapshotRef: identity.controllerSnapshotRef,
    protocolVersion: identity.protocolVersion,
    runtimeVersion: identity.runtimeVersion,
    modelVersion: identity.modelVersion,
    controllerSchemaVersion: identity.controllerSchemaVersion,
    executor: identity.executor,
    authoritySource: identity.authoritySource,
    modelRelation: identity.modelRelation,
    teachingSemantics: identity.teachingSemantics,
    prohibitsMixedClaims: identity.prohibitsMixedClaims,
    parameterVisibility: identity.parameterVisibility,
    resultVisibility: identity.resultVisibility,
    evaluationVisibility: identity.evaluationVisibility,
    officialEligible: identity.officialEligible,
    seed: identity.seed,
    checksum: identity.checksum,
    toleranceProfile: identity.toleranceProfile,
  });
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

export function sealIdentity(identity: Omit<ArtifactRunIdentity, 'canonicalIdentityHash'>): ArtifactRunIdentity {
  return {
    ...identity,
    canonicalIdentityHash: canonicalIdentityHash(identity),
  };
}
