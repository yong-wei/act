import { verifyAuthorityDomainCatalogRuntime } from '@/lib/authority-domain-catalog/builder';
import { shardDigest } from '@/lib/authority-domain-shards/hash';
import { computeFragmentBodyDigest } from '@/lib/teaching-projection/domain-fragments/builder';
import { recomputeComposedManifestIdentity } from '@/lib/teaching-projection/domain-fragments/compose';
import type {
  DomainTeachingComposedManifest,
  DomainTeachingFragment,
} from '@/lib/teaching-projection/domain-fragments/contracts';
import { projectionDigest, projectionSha256 } from '@/lib/teaching-projection/hash';
import { activationDigest } from '@/lib/versioned-knowledge-activation/hash';

export interface LatestCutoverArtifactPointer {
  id: string;
  sha256: string;
}

export interface LatestCutoverRuntimeIdentity {
  releaseId: string;
  manifestSha256: string;
  treeSha256?: string | null;
  generation: number;
}

export interface LatestCutoverIO {
  read(id: string): unknown | string | Uint8Array | null | undefined;
}

export function parseRuntimeActiveReceipt(value: unknown): LatestCutoverRuntimeIdentity | null {
  if (!isRecord(value)) return null;
  if (value.schemaVersion !== 'runtime-release-active-receipt.v1') return null;
  if (value.healthCheck !== 'readyz') return null;
  if (!isRecord(value.selection) || value.selection.schemaVersion !== 'runtime-release-selection.v1') {
    return null;
  }
  const generation = value.selection.generation;
  if (typeof generation !== 'number' || !Number.isInteger(generation) || generation < 1) return null;
  const releaseId = typeof value.selection.releaseId === 'string' ? value.selection.releaseId : null;
  const manifestSha256 = typeof value.selection.manifestSha256 === 'string'
    ? value.selection.manifestSha256
    : null;
  if (!releaseId || !manifestSha256 || !/^[a-f0-9]{64}$/u.test(manifestSha256)) return null;
  const treeSha256 = typeof value.selection.treeSha256 === 'string' && /^[a-f0-9]{64}$/u.test(value.selection.treeSha256)
    ? value.selection.treeSha256
    : null;
  return { releaseId, manifestSha256, treeSha256, generation };
}

export interface LatestCutoverVerifierInput {
  io: LatestCutoverIO;
  receipt: LatestCutoverArtifactPointer | null;
  candidateReceipt: LatestCutoverArtifactPointer;
  authorityCurrent: LatestCutoverArtifactPointer;
  runtimeIdentity: LatestCutoverRuntimeIdentity;
  extension: LatestCutoverArtifactPointer;
  domainCatalog: LatestCutoverArtifactPointer;
  domainShards: readonly LatestCutoverArtifactPointer[];
  teachingProjection: LatestCutoverArtifactPointer;
  teachingClosure: LatestCutoverArtifactPointer;
  composedDomainFragments: LatestCutoverArtifactPointer;
  domainFragments: readonly LatestCutoverArtifactPointer[];
  prerequisites: LatestCutoverArtifactPointer;
  consumerActivation: LatestCutoverArtifactPointer;
  formalResource?: LatestCutoverArtifactPointer | null;
}

export type LatestCutoverCombination = 'successor' | 'predecessor' | 'unknown' | 'failed';

export interface KnowledgeSurfaceLatestCutover {
  ready: boolean;
  combination: LatestCutoverCombination;
  identities: {
    activeReceiptSha256: string | null;
    authorityCurrentSha256: string | null;
    runtime: LatestCutoverRuntimeIdentity | null;
    extensionSha256: string | null;
    domainCatalogSha256: string | null;
    domainShardSetSha256: string | null;
    teachingProjectionSha256: string | null;
    teachingClosureSha256: string | null;
    composedDomainFragmentManifestSha256: string | null;
    domainFragmentSetSha256: string | null;
    prerequisitePublicationSha256: string | null;
    consumerActivationSha256: string | null;
    formalResourceEnvelopeSha256: string | null;
  };
  reasons: string[];
}

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function reopenedDigest(value: unknown): string {
  if (typeof value === 'string') return projectionSha256(value);
  if (value instanceof Uint8Array) return projectionSha256(Buffer.from(value));
  return projectionDigest(value);
}

function parsedValue(value: unknown): unknown {
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as unknown;
    } catch {
      return null;
    }
  }
  if (value instanceof Uint8Array) {
    try {
      return JSON.parse(Buffer.from(value).toString('utf8')) as unknown;
    } catch {
      return null;
    }
  }
  return value;
}

function stringAt(value: unknown, ...path: string[]): string | null {
  let current = value;
  for (const segment of path) {
    if (!isRecord(current)) return null;
    current = current[segment];
  }
  return typeof current === 'string' && current.length > 0 ? current : null;
}

function numberAt(value: unknown, ...path: string[]): number | null {
  let current = value;
  for (const segment of path) {
    if (!isRecord(current)) return null;
    current = current[segment];
  }
  return typeof current === 'number' && Number.isFinite(current) ? current : null;
}

interface RuntimeReleaseIdentity {
  releaseId: string;
  manifestSha256: string;
  treeSha256?: string | null;
}

function sameReleaseManifest(
  left: LatestCutoverRuntimeIdentity,
  right: RuntimeReleaseIdentity | null,
): boolean {
  return Boolean(
    right
    && left.releaseId === right.releaseId
    && left.manifestSha256 === right.manifestSha256
    && (!right.treeSha256 || left.treeSha256 === right.treeSha256),
  );
}

function generationAt(value: unknown, ...path: string[]): number | null {
  const generation = numberAt(value, ...path);
  if (generation == null || !Number.isInteger(generation) || generation < 1) return null;
  return generation;
}

function runtimeFrom(value: unknown): RuntimeReleaseIdentity | null {
  const releaseId = stringAt(value, 'releaseId');
  const manifestSha256 = stringAt(value, 'manifestSha256');
  if (!releaseId || !manifestSha256) return null;
  return {
    releaseId,
    manifestSha256,
    treeSha256: stringAt(value, 'treeSha256'),
  };
}

function predecessorRuntimeMatches(
  live: LatestCutoverRuntimeIdentity,
  extension: unknown,
  candidateReceipt: unknown,
): boolean {
  const extensionGeneration = generationAt(extension, 'predecessorLifecycleGeneration');
  const candidateGeneration = generationAt(candidateReceipt, 'predecessorRuntimeLifecycleGeneration');
  const releaseId = stringAt(extension, 'predecessorRuntimeReleaseId');
  const manifestSha256 = stringAt(extension, 'predecessorRuntimeManifestSha256');
  if (
    !releaseId
    || !manifestSha256
    || extensionGeneration == null
    || candidateGeneration == null
    || extensionGeneration !== candidateGeneration
    || live.generation !== extensionGeneration
  ) {
    return false;
  }
  return sameReleaseManifest(live, { releaseId, manifestSha256 });
}

function authorityIdentity(value: unknown): Record<string, string> {
  const candidates = [
    value,
    isRecord(value) ? value.authorityBinding : null,
    isRecord(value) && isRecord(value.envelope) ? value.envelope.authority : null,
    isRecord(value) && isRecord(value.authoritySelection)
      ? value.authoritySelection.authorityBinding
      : null,
  ];
  for (const candidate of candidates) {
    if (!isRecord(candidate)) continue;
    const identity = Object.fromEntries(
      ['snapshotId', 'snapshotHash', 'releaseId', 'releaseSetId']
        .map((key) => [key, candidate[key]])
        .filter((entry): entry is [string, string] => (
          typeof entry[1] === 'string' && entry[1].length > 0
        )),
    );
    if (Object.keys(identity).length > 0) return identity;
  }
  return {};
}

function setDigest(pointers: readonly LatestCutoverArtifactPointer[]): string {
  return projectionDigest(pointers.map((pointer) => pointer.sha256));
}

function setMatches(sealed: string | null, pointers: readonly LatestCutoverArtifactPointer[]): boolean {
  if (!sealed) return false;
  if (pointers.length === 1 && pointers[0]?.sha256 === sealed) return true;
  return setDigest(pointers) === sealed;
}

function identityConflicts(expected: Record<string, string>, actual: Record<string, string>): boolean {
  return Object.entries(actual).some(([key, value]) => expected[key] != null && expected[key] !== value);
}

function omitKeys(value: JsonRecord, keys: readonly string[]): JsonRecord {
  const omitted = { ...value };
  for (const key of keys) delete omitted[key];
  return omitted;
}

function recomputeIdentity(value: unknown): string | null {
  if (!isRecord(value)) return null;
  const contract = stringAt(value, 'contract');
  try {
    if (contract === 'act-domain-teaching-fragment/v1') {
      const fragment = value as unknown as DomainTeachingFragment;
      return computeFragmentBodyDigest({
        fragmentKey: fragment.fragmentKey,
        fragmentVersion: fragment.fragmentVersion,
        domainKeys: fragment.domainKeys,
        authorityBinding: fragment.authorityBinding,
        authoritySelection: fragment.authoritySelection,
        authoringRevision: fragment.authoringRevision,
        sourceInventoryDigest: fragment.sourceInventoryDigest,
        authorityDigest: fragment.authorityDigest,
        evidenceRefs: fragment.evidenceRefs,
        coreNodes: fragment.coreNodes,
        relations: fragment.relations,
      });
    }
    if (contract === 'act-domain-teaching-composed-manifest/v1') {
      return recomputeComposedManifestIdentity(value as unknown as DomainTeachingComposedManifest).projectionHash;
    }
    if (contract === 'coordinated-teaching-closure-receipt/v1') {
      const familyCounts = Array.isArray(value.familyCounts) ? value.familyCounts : [];
      const countsHash = projectionDigest(familyCounts);
      return projectionDigest({
        contract: 'coordinated-teaching-closure-receipt/v1',
        scopeHash: value.scopeHash,
        authorityCaptureHash: value.authorityCaptureHash,
        zeroUnresolved: value.zeroUnresolved === true,
        allClosed: familyCounts.every((family) => (
          isRecord(family)
          && typeof family.closedCount === 'number'
          && typeof family.memberCount === 'number'
          && family.closedCount === family.memberCount
        )),
        countsHash,
      });
    }
    if (contract === 'coordinated-active-receipt/v1') {
      return projectionDigest({
        transactionId: value.transactionId ?? null,
        journalHash: value.journalHash ?? null,
        candidateReceiptHash: value.candidateReceiptHash ?? null,
        committedSelectors: value.committedSelectors ?? null,
        mutationReceiptHashes: value.mutationReceiptHashes ?? null,
        runtimeActiveReceiptHash: value.runtimeActiveReceiptHash ?? null,
        runtimeActiveIdentity: value.runtimeActiveIdentity ?? null,
      });
    }
    if (contract === 'coordinated-formal-resource-envelope-incremental-reuse/v1') {
      return projectionDigest(omitKeys(value, ['envelopeHash']));
    }
    if (contract === 'act-teaching-projection-manifest/v1') {
      return projectionDigest(omitKeys(value, ['projectionId', 'projectionHash']));
    }
    if (contract === 'act-teaching-prerequisite-publication/v1') {
      return projectionDigest(omitKeys(value, ['publicationId', 'publicationHash']));
    }
    if (contract === 'act-versioned-knowledge-consumer-activation/v1') {
      return activationDigest(omitKeys(value, ['activationHash']));
    }
    if (contract === 'act-authority-domain-display-catalog-runtime/v1') {
      verifyAuthorityDomainCatalogRuntime(value as never);
      return typeof value.catalogHash === 'string' ? value.catalogHash : null;
    }
    if (contract === 'act-authority-domain-shard-set/v1') {
      if (!isRecord(value.envelope) || !isRecord(value.files)) return null;
      return shardDigest({ envelope: value.envelope, files: value.files });
    }
    if (contract === 'coordinated-candidate-receipt/v1') {
      const candidateId = stringAt(value, 'candidateId');
      if (!candidateId) return null;
      return projectionDigest({
        candidateId,
        sealedAt: value.sealedAt,
        allocationHash: value.allocationHash,
        authorityCaptureHash: value.authorityCaptureHash,
        localeQualificationHash: value.localeQualificationHash,
        teachingProjectionHash: value.teachingProjectionHash,
        teachingClosureReceiptHash: value.teachingClosureReceiptHash,
        composedDomainFragmentManifestHash: value.composedDomainFragmentManifestHash,
        domainFragmentSetHash: value.domainFragmentSetHash,
        formalResourceEnvelopeHash: value.formalResourceEnvelopeHash,
        continuityReceiptHash: value.continuityReceiptHash,
        derivationReceiptHash: value.derivationReceiptHash,
        successorRuntimeManifestHash: value.successorRuntimeManifestHash,
        successorRuntimeMaterializationHash: value.successorRuntimeMaterializationHash,
        domainShardCatalogHash: value.domainShardCatalogHash,
        domainShardSetHash: value.domainShardSetHash,
        prerequisitePublicationHash: value.prerequisitePublicationHash,
        consumerActivationHash: value.consumerActivationHash,
        predecessor: value.predecessor,
        predecessorRuntimeLifecycleGeneration: value.predecessorRuntimeLifecycleGeneration,
        successorSelectorExpectations: value.successorSelectorExpectations,
        transactionImplementationIdentity: value.transactionImplementationIdentity,
        rollbackPlanHash: value.rollbackPlanHash,
        verificationPolicyHash: value.verificationPolicyHash,
      });
    }
  } catch {
    return null;
  }
  return null;
}

function selectorIdentity(receipt: unknown, key: 'committedSelectors' | 'predecessor'): string | null {
  if (!isRecord(receipt) || !Array.isArray(receipt[key])) return null;
  const row = receipt[key].find((item) => (
    isRecord(item) && item.selectorId === 'authority:current'
  ));
  return isRecord(row) && typeof row.identity === 'string' ? row.identity : null;
}

function emptyResult(reason: string): KnowledgeSurfaceLatestCutover {
  return {
    ready: false,
    combination: 'failed',
    identities: {
      activeReceiptSha256: null,
      authorityCurrentSha256: null,
      runtime: null,
      extensionSha256: null,
      domainCatalogSha256: null,
      domainShardSetSha256: null,
      teachingProjectionSha256: null,
      teachingClosureSha256: null,
      composedDomainFragmentManifestSha256: null,
      domainFragmentSetSha256: null,
      prerequisitePublicationSha256: null,
      consumerActivationSha256: null,
      formalResourceEnvelopeSha256: null,
    },
    reasons: [reason],
  };
}

export function unavailableLatestKnowledgeCutover(): KnowledgeSurfaceLatestCutover {
  return {
    ...emptyResult('unknown-state'),
    combination: 'unknown',
  };
}

export function verifyLatestKnowledgeCutover(
  input: LatestCutoverVerifierInput,
): KnowledgeSurfaceLatestCutover {
  if (!input.receipt) return emptyResult('absent-active-receipt');

  const reasons = new Set<string>();
  const read = (
    pointer: LatestCutoverArtifactPointer | null | undefined,
    missingReason = 'missing-member',
  ): unknown | null => {
    if (!pointer) {
      reasons.add(missingReason);
      return null;
    }
    const value = input.io.read(pointer.id);
    if (value == null) {
      reasons.add(missingReason);
      return null;
    }
    if (reopenedDigest(value) !== pointer.sha256) {
      const parsedCandidate = parsedValue(value);
      if (recomputeIdentity(parsedCandidate) !== pointer.sha256) {
        reasons.add('hash-mismatch');
        return null;
      }
      return parsedCandidate;
    }
    const parsed = parsedValue(value);
    if (parsed == null) {
      reasons.add('unknown-state');
      return null;
    }
    return parsed;
  };

  const receipt = read(input.receipt, 'absent-active-receipt');
  const candidateReceipt = read(input.candidateReceipt);
  const authority = read(input.authorityCurrent);
  const extension = read(input.extension);
  const catalog = read(input.domainCatalog);
  const shards = input.domainShards.map((pointer) => read(pointer));
  const teachingProjection = read(input.teachingProjection, 'teaching-unavailable');
  const teachingClosure = read(input.teachingClosure, 'teaching-unavailable');
  const composed = read(input.composedDomainFragments, 'missing-fragment');
  const fragments = input.domainFragments.map((pointer) => read(pointer, 'missing-fragment'));
  const prerequisites = read(input.prerequisites);
  const consumerActivation = read(input.consumerActivation);
  const formalResource = input.formalResource ? read(input.formalResource) : null;

  if (input.domainShards.length === 0) reasons.add('missing-fragment');
  if (input.domainFragments.length === 0) reasons.add('missing-fragment');

  const expectedAuthority = authorityIdentity(authority);
  for (const member of [
    catalog,
    ...shards,
    teachingProjection,
    composed,
    ...fragments,
    prerequisites,
    consumerActivation,
    formalResource,
  ]) {
    if (member && identityConflicts(expectedAuthority, authorityIdentity(member))) {
      reasons.add('mixed-identity');
    }
  }

  if (
    stringAt(extension, 'teachingProjectionHash') !== input.teachingProjection.sha256
    || stringAt(extension, 'teachingClosureReceiptHash') !== input.teachingClosure.sha256
    || stringAt(extension, 'composedDomainFragmentManifestHash') !== input.composedDomainFragments.sha256
    || stringAt(extension, 'prerequisitePublicationHash') !== input.prerequisites.sha256
    || stringAt(extension, 'consumerActivationHash') !== input.consumerActivation.sha256
    || !setMatches(stringAt(extension, 'domainShardSetHash'), input.domainShards)
  ) {
    reasons.add('mixed-identity');
  }
  const sealedFragmentSet = stringAt(extension, 'domainFragmentSetHash');
  if (
    !setMatches(sealedFragmentSet, input.domainFragments)
    && stringAt(composed, 'sourceHashes', 'fragments') !== sealedFragmentSet
  ) {
    reasons.add('mixed-identity');
  }
  if (input.formalResource) {
    if (stringAt(extension, 'formalResourceEnvelopeHash') !== input.formalResource.sha256) {
      reasons.add('mixed-identity');
    }
  } else if (stringAt(extension, 'formalResourceEnvelopeHash')) {
    reasons.add('missing-member');
  }

  const receiptCatalogHash = stringAt(receipt, 'domainShardCatalogHash');
  if (receiptCatalogHash && receiptCatalogHash !== input.domainCatalog.sha256) {
    reasons.add('mixed-identity');
  }
  const receiptExtensionHash = stringAt(receipt, 'runtimeManifestExtensionHash');
  if (receiptExtensionHash && receiptExtensionHash !== input.extension.sha256) {
    reasons.add('mixed-identity');
  }
  const candidateReceiptHash = stringAt(receipt, 'candidateReceiptHash');
  if (!candidateReceiptHash || candidateReceiptHash !== input.candidateReceipt.sha256 || !candidateReceipt) {
    reasons.add('mixed-identity');
  }
  if (
    stringAt(receipt, 'contract') !== 'coordinated-active-receipt/v1'
    || stringAt(extension, 'contract') !== 'coordinated-runtime-manifest-extension/v1'
  ) {
    reasons.add('unknown-state');
  }
  const prerequisiteStatus = stringAt(prerequisites, 'status');
  const activationStatus = stringAt(consumerActivation, 'status');
  if (prerequisiteStatus && !['PUBLISHED', 'READY', 'COMPLETE'].includes(prerequisiteStatus)) {
    reasons.add('unknown-state');
  }
  if (activationStatus && !['ACTIVE', 'READY', 'COMPLETE'].includes(activationStatus)) {
    reasons.add('unknown-state');
  }

  const closureComplete = stringAt(teachingClosure, 'status') === 'COMPLETE'
    && isRecord(teachingClosure)
    && teachingClosure.zeroUnresolved === true;
  if (!closureComplete) reasons.add('teaching-partial');

  const fragmentDescriptors = isRecord(composed) && Array.isArray(composed.fragments)
    ? composed.fragments
    : [];
  const relationCount = numberAt(composed, 'relationCount')
    ?? (isRecord(teachingProjection) && Array.isArray(teachingProjection.relations)
      ? teachingProjection.relations.length
      : 0);
  if (
    !isRecord(composed)
    || composed.gatePassed !== true
    || fragmentDescriptors.length === 0
    || relationCount <= 0
  ) {
    reasons.add('teaching-unavailable');
  }
  const reopenedFragments = new Map(input.domainFragments.map((pointer, index) => [
    pointer.id,
    { pointer, value: fragments[index] },
  ]));
  for (const descriptor of fragmentDescriptors) {
    if (!isRecord(descriptor)) {
      reasons.add('missing-fragment');
      continue;
    }
    const fragmentId = typeof descriptor.fragmentId === 'string' ? descriptor.fragmentId : null;
    const expectedHash = typeof descriptor.fragmentDigest === 'string' ? descriptor.fragmentDigest : null;
    const reopened = fragmentId ? reopenedFragments.get(fragmentId) : null;
    if (!reopened?.value) reasons.add('missing-fragment');
    else if (expectedHash && expectedHash !== reopened.pointer.sha256) reasons.add('hash-mismatch');
  }

  const successorAuthority = selectorIdentity(receipt, 'committedSelectors');
  const predecessorAuthority = selectorIdentity(candidateReceipt, 'predecessor');
  const successorRuntimeIdentity = runtimeFrom(
    isRecord(receipt) ? receipt.runtimeActiveIdentity : null,
  );
  const authorityHash = input.authorityCurrent.sha256;
  const candidateBound = Boolean(
    candidateReceipt
    && candidateReceiptHash
    && candidateReceiptHash === input.candidateReceipt.sha256,
  );
  const successor = successorAuthority === authorityHash
    && sameReleaseManifest(input.runtimeIdentity, successorRuntimeIdentity);
  const predecessor = candidateBound
    && predecessorRuntimeMatches(input.runtimeIdentity, extension, candidateReceipt)
    && predecessorAuthority === authorityHash;

  const identities = {
    activeReceiptSha256: input.receipt.sha256,
    authorityCurrentSha256: input.authorityCurrent.sha256,
    runtime: { ...input.runtimeIdentity },
    extensionSha256: input.extension.sha256,
    domainCatalogSha256: input.domainCatalog.sha256,
    domainShardSetSha256: projectionDigest(input.domainShards.map((pointer) => pointer.sha256)),
    teachingProjectionSha256: input.teachingProjection.sha256,
    teachingClosureSha256: input.teachingClosure.sha256,
    composedDomainFragmentManifestSha256: input.composedDomainFragments.sha256,
    domainFragmentSetSha256: projectionDigest(input.domainFragments.map((pointer) => pointer.sha256)),
    prerequisitePublicationSha256: input.prerequisites.sha256,
    consumerActivationSha256: input.consumerActivation.sha256,
    formalResourceEnvelopeSha256: input.formalResource?.sha256 ?? null,
  };

  if (predecessor && !successor) {
    return {
      ready: false,
      combination: 'predecessor',
      identities,
      reasons: [],
    };
  }

  let combination: LatestCutoverCombination;
  if (successor) combination = reasons.size === 0 ? 'successor' : 'failed';
  else {
    combination = 'unknown';
    reasons.add('unknown-state');
  }

  return {
    ready: combination === 'successor' && reasons.size === 0,
    combination,
    identities,
    reasons: [...reasons].sort(),
  };
}
