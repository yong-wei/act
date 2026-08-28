import { compareCanonicalStrings, sha256Canonical } from './canonical';
import type { ResourceIdentity, ResourceIndexSourceKind } from './types';

export interface ResourceIdentityInput {
  sourceKind: ResourceIndexSourceKind;
  sourceRef: string;
  sourceVersion: string;
  contentHash: string;
  scope: string;
}

export function buildResourceIdentity(input: ResourceIdentityInput): ResourceIdentity {
  return {
    key: sha256Canonical({
      sourceKind: input.sourceKind,
      sourceRef: input.sourceRef,
      sourceVersion: input.sourceVersion,
      contentHash: input.contentHash,
      scope: input.scope,
    }),
    sourceKind: input.sourceKind,
    sourceRef: input.sourceRef,
    sourceVersion: input.sourceVersion,
    contentHash: input.contentHash,
    scope: input.scope,
  };
}

export function compareResourceIdentities(left: ResourceIdentity, right: ResourceIdentity): number {
  return [
    compareCanonicalStrings(left.sourceKind, right.sourceKind),
    compareCanonicalStrings(left.sourceRef, right.sourceRef),
    compareCanonicalStrings(left.sourceVersion, right.sourceVersion),
    compareCanonicalStrings(left.contentHash, right.contentHash),
    compareCanonicalStrings(left.scope, right.scope),
  ].find((value) => value !== 0) ?? 0;
}
