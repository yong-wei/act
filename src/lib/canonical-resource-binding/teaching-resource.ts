import { canonicalSha256 } from './inventory';

export interface GeneratedPublicationRevisionIdentity {
  id: string;
  revisionNumber: number;
  manifestHash: string;
  contentHash: string;
}

export function resolveGeneratedPublicationAggregate(
  values: readonly (GeneratedPublicationRevisionIdentity | null | undefined)[],
): {
  published: boolean;
  publicationRevision: GeneratedPublicationRevisionIdentity | null;
  conflictReasonCodes: string[];
} {
  const byDigest = new Map<string, GeneratedPublicationRevisionIdentity>();
  for (const value of values) {
    if (value) byDigest.set(canonicalSha256(value), value);
  }
  const revisions = [...byDigest.values()];
  return {
    published: revisions.length > 0,
    publicationRevision: revisions.length === 1 ? revisions[0]! : null,
    conflictReasonCodes: revisions.length > 1
      ? ['generated-publication-revision-conflict']
      : [],
  };
}
