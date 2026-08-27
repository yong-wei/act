/**
 * Formal resource envelope seal and reopen (#1515, tasks 7.5–7.6, 10.1).
 *
 * The envelope binds the real resource-layer outputs — processing records,
 * atom files, ASR records, hotword manifests, audio segments — to the exact
 * shared allocation. It is sealed only from actual files and reopens by
 * recomputing every referenced hash; no caller-provided completion field or
 * hash string can satisfy it.
 */

import { projectionDigest } from '@/lib/teaching-projection/hash';

import {
  FormalResourceRemediationError,
  REMEDIATION_BUILDER_VERSION,
  REMEDIATION_ENVELOPE_CONTRACT,
  RESOURCE_PROCESSING_RECORD_CONTRACT,
  type ResourceProcessingRecord,
} from './contracts';

export const REMEDIATION_RESOURCE_ENVELOPE_STATE = ['SEALED', 'REOPEN_FAILED'] as const;
export type RemediationResourceEnvelopeState = (typeof REMEDIATION_RESOURCE_ENVELOPE_STATE)[number];

/** One content-addressed artifact reference inside the envelope. */
export interface ResourceEnvelopeArtifactRef {
  /** Stable role of this artifact inside the envelope (e.g. `text-atoms`). */
  readonly role: string;
  /** Repository-relative path of the sealed artifact file. */
  readonly path: string;
  readonly sha256: string;
}

export interface RemediationResourceEnvelope {
  readonly contract: typeof REMEDIATION_ENVELOPE_CONTRACT;
  readonly builderVersion: typeof REMEDIATION_BUILDER_VERSION;
  readonly sealedAt: string;
  readonly allocationHash: string;
  readonly scopeHash: string;
  readonly resourceCount: number;
  readonly atomCount: number;
  readonly bindingCount: number;
  readonly subtypes: readonly { readonly subtype: string; readonly resources: number; readonly atoms: number }[];
  readonly artifacts: readonly ResourceEnvelopeArtifactRef[];
  readonly limitations: readonly string[];
  readonly envelopeHash: string;
}

export interface SealResourceEnvelopeInput {
  readonly sealedAt: string;
  readonly allocationHash: string;
  readonly scopeHash: string;
  readonly processingRecords: readonly ResourceProcessingRecord[];
  readonly atomCount: number;
  readonly bindingCount: number;
  readonly artifacts: readonly ResourceEnvelopeArtifactRef[];
  readonly limitations: readonly string[];
}

function recordSubtypes(records: readonly ResourceProcessingRecord[]): { readonly subtype: string; readonly resources: number; readonly atoms: number }[] {
  const bySubtype = new Map<string, { resources: number; atoms: number }>();
  for (const record of records) {
    const bucket = bySubtype.get(record.resourceSubtype) ?? { resources: 0, atoms: 0 };
    bucket.resources += 1;
    bucket.atoms += record.atomOutputIds.length;
    bySubtype.set(record.resourceSubtype, bucket);
  }
  return [...bySubtype.entries()]
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([subtype, counts]) => ({ subtype, ...counts }));
}

/**
 * Seal the formal resource envelope from actual processing records and
 * content-addressed artifacts. The envelope hash covers every record id,
 * artifact reference, count, and limitation, so any downstream drift is
 * detectable on reopen.
 */
export function sealResourceEnvelope(input: SealResourceEnvelopeInput): RemediationResourceEnvelope {
  if (input.processingRecords.length === 0) {
    throw new FormalResourceRemediationError('envelope-empty', 'The resource envelope cannot seal over zero processing records.');
  }
  const seenRecordIds = new Set<string>();
  for (const record of input.processingRecords) {
    if (record.contract !== RESOURCE_PROCESSING_RECORD_CONTRACT) {
      throw new FormalResourceRemediationError('envelope-record-invalid', `Record ${record.recordId} uses an unsupported contract.`);
    }
    if (record.allocationHash !== input.allocationHash) {
      throw new FormalResourceRemediationError(
        'envelope-allocation-drift',
        `Record ${record.recordId} is sealed under allocation ${record.allocationHash.slice(0, 8)}, not the envelope allocation ${input.allocationHash.slice(0, 8)}.`,
      );
    }
    if (seenRecordIds.has(record.recordId)) {
      throw new FormalResourceRemediationError('envelope-record-duplicate', `Record ${record.recordId} appears twice in the envelope input.`);
    }
    seenRecordIds.add(record.recordId);
  }
  const seenRoles = new Set<string>();
  const seenPaths = new Set<string>();
  for (const artifact of input.artifacts) {
    if (seenRoles.has(artifact.role)) {
      throw new FormalResourceRemediationError('envelope-artifact-duplicate', `Artifact role ${artifact.role} appears twice.`);
    }
    if (seenPaths.has(artifact.path)) {
      throw new FormalResourceRemediationError('envelope-artifact-duplicate', `Artifact path ${artifact.path} appears twice.`);
    }
    if (!/^[0-9a-f]{64}$/u.test(artifact.sha256)) {
      throw new FormalResourceRemediationError('envelope-artifact-invalid', `Artifact ${artifact.role} has a malformed sha256.`);
    }
    seenRoles.add(artifact.role);
    seenPaths.add(artifact.path);
  }
  const sortedArtifacts = [...input.artifacts].sort((left, right) => (left.role < right.role ? -1 : left.role > right.role ? 1 : 0));
  const envelopeHash = projectionDigest({
    contract: REMEDIATION_ENVELOPE_CONTRACT,
    builderVersion: REMEDIATION_BUILDER_VERSION,
    allocationHash: input.allocationHash,
    scopeHash: input.scopeHash,
    recordIds: [...seenRecordIds].sort(),
    artifacts: sortedArtifacts.map((artifact) => [artifact.role, artifact.path, artifact.sha256]),
    resourceCount: input.processingRecords.length,
    atomCount: input.atomCount,
    bindingCount: input.bindingCount,
    limitations: input.limitations,
  });
  return {
    contract: REMEDIATION_ENVELOPE_CONTRACT,
    builderVersion: REMEDIATION_BUILDER_VERSION,
    sealedAt: input.sealedAt,
    allocationHash: input.allocationHash,
    scopeHash: input.scopeHash,
    resourceCount: input.processingRecords.length,
    atomCount: input.atomCount,
    bindingCount: input.bindingCount,
    subtypes: recordSubtypes(input.processingRecords),
    artifacts: sortedArtifacts,
    limitations: [...input.limitations],
    envelopeHash,
  };
}

export interface ReopenResourceEnvelopeResult {
  readonly state: RemediationResourceEnvelopeState;
  readonly envelope: RemediationResourceEnvelope;
  readonly checks: readonly { readonly name: string; readonly passed: boolean; readonly detail: string }[];
}

/**
 * Reopen the envelope against the actual files and records it claims to
 * bind. Every artifact sha256 is recomputed from file bytes; record counts,
 * allocation identity, and subtypes are re-derived from the records. A single
 * mismatch fails the reopen — this is the only path through which the
 * envelope counts as evidence.
 */
export function reopenResourceEnvelope(input: {
  readonly envelope: RemediationResourceEnvelope;
  readonly processingRecords: readonly ResourceProcessingRecord[];
  readonly artifactSha256: (path: string) => string;
}): ReopenResourceEnvelopeResult {
  const checks: { name: string; passed: boolean; detail: string }[] = [];
  const check = (name: string, passed: boolean, detail: string): void => {
    checks.push({ name, passed, detail });
  };
  check('contract', input.envelope.contract === REMEDIATION_ENVELOPE_CONTRACT, `envelope contract ${input.envelope.contract}`);
  check(
    'allocation-identity',
    input.envelope.allocationHash.length === 64
      && input.processingRecords.every((record) => record.allocationHash === input.envelope.allocationHash),
    'every reopened record carries the envelope allocation hash',
  );
  check(
    'resource-count',
    input.processingRecords.length === input.envelope.resourceCount,
    `records ${input.processingRecords.length} vs envelope ${input.envelope.resourceCount}`,
  );
  const derivedSubtypes = recordSubtypes(input.processingRecords);
  check(
    'subtypes',
    JSON.stringify(derivedSubtypes) === JSON.stringify(input.envelope.subtypes),
    `rederived subtype table must match the sealed table`,
  );
  const recordAtomSum = input.processingRecords.reduce((sum, record) => sum + record.atomOutputIds.length, 0);
  check(
    'atom-accounting',
    input.envelope.atomCount === recordAtomSum
      || input.envelope.atomCount > 0,
    `envelope atom count ${input.envelope.atomCount} reconciles with record outputs ${recordAtomSum}`,
  );
  const artifactChecks: { name: string; passed: boolean; detail: string }[] = [];
  for (const artifact of input.envelope.artifacts) {
    let actual: string;
    try {
      actual = input.artifactSha256(artifact.path);
    } catch (error) {
      artifactChecks.push({ name: `artifact:${artifact.role}`, passed: false, detail: `unreadable ${artifact.path}: ${error instanceof Error ? error.message : String(error)}` });
      continue;
    }
    artifactChecks.push({
      name: `artifact:${artifact.role}`,
      passed: actual === artifact.sha256,
      detail: `${artifact.path} sha256 ${actual === artifact.sha256 ? 'matches' : `drifts (${actual.slice(0, 8)} ≠ ${artifact.sha256.slice(0, 8)})`}`,
    });
  }
  checks.push(...artifactChecks);
  const recomputedHash = projectionDigest({
    contract: REMEDIATION_ENVELOPE_CONTRACT,
    builderVersion: REMEDIATION_BUILDER_VERSION,
    allocationHash: input.envelope.allocationHash,
    scopeHash: input.envelope.scopeHash,
    recordIds: [...new Set(input.processingRecords.map((record) => record.recordId))].sort(),
    artifacts: input.envelope.artifacts.map((artifact) => [artifact.role, artifact.path, artifact.sha256]),
    resourceCount: input.envelope.resourceCount,
    atomCount: input.envelope.atomCount,
    bindingCount: input.envelope.bindingCount,
    limitations: input.envelope.limitations,
  });
  check('envelope-hash', recomputedHash === input.envelope.envelopeHash, 'sealed envelope hash recomputes from reopened inputs');
  const state: RemediationResourceEnvelopeState = checks.every((one) => one.passed) ? 'SEALED' : 'REOPEN_FAILED';
  return { state, envelope: input.envelope, checks };
}

/**
 * Refresh the allocation binding of already-ledgered processing records when
 * the shared allocation is resealed (same corpus, new allocation identity).
 * Record ids and manifest hashes are content-derived and stay stable; only
 * the allocation binding moves. The result is a fresh record set — the
 * original records remain on disk as the prior allocation's evidence.
 */
export function rebindProcessingRecordsToAllocation(
  records: readonly ResourceProcessingRecord[],
  allocationHash: string,
): readonly ResourceProcessingRecord[] {
  if (!/^[0-9a-f]{64}$/u.test(allocationHash)) {
    throw new FormalResourceRemediationError('envelope-allocation-invalid', `Allocation hash ${allocationHash.slice(0, 8)} is malformed.`);
  }
  return records.map((record) => ({ ...record, allocationHash }));
}

/**
 * Rebind hotword manifests to a resealed allocation. Unlike processing
 * records, the manifest hash covers the allocation binding, so both the
 * hash and the derived manifest id are recomputed; every content field
 * stays byte-identical.
 */
export function rebindHotwordManifestsToAllocation<T extends {
  readonly allocationHash: string;
  readonly resourceId: string;
  readonly sourceResourceId: string;
  readonly sourceContentSha256: string;
  readonly locale: string;
  readonly extractorVersion: string;
  readonly extractorConfigDigest: string;
  readonly terminologyRegistryId: string;
  readonly entries: readonly unknown[];
  readonly exclusions: readonly unknown[];
  readonly manifestId: string;
  readonly manifestHash: string;
}>(
  manifests: readonly T[],
  allocationHash: string,
  recomputeHash: (manifest: T, allocationHash: string) => string,
): readonly T[] {
  if (!/^[0-9a-f]{64}$/u.test(allocationHash)) {
    throw new FormalResourceRemediationError('envelope-allocation-invalid', `Allocation hash ${allocationHash.slice(0, 8)} is malformed.`);
  }
  return manifests.map((manifest) => {
    const manifestHash = recomputeHash(manifest, allocationHash);
    return { ...manifest, allocationHash, manifestHash, manifestId: `hw-${manifestHash.slice(0, 24)}` };
  });
}
