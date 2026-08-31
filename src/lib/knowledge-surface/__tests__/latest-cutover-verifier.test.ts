import { describe, expect, it } from 'vitest';

import {
  verifyLatestKnowledgeCutover,
  type LatestCutoverArtifactPointer,
  type LatestCutoverVerifierInput,
} from '../latest-cutover';
import { projectionDigest } from '@/lib/teaching-projection/hash';

type Fixture = {
  input: LatestCutoverVerifierInput;
  values: Map<string, unknown>;
  pointers: Record<string, LatestCutoverArtifactPointer>;
};

const successorRuntime = {
  releaseId: 'runtime-successor',
  manifestSha256: '1'.repeat(64),
  treeSha256: '2'.repeat(64),
  generation: 2,
};
const predecessorRuntime = {
  releaseId: 'runtime-predecessor',
  manifestSha256: '3'.repeat(64),
  treeSha256: '4'.repeat(64),
  generation: 1,
};

function digestCandidate(body: Record<string, unknown>): string {
  return projectionDigest({
    candidateId: body.candidateId,
    sealedAt: body.sealedAt,
    allocationHash: body.allocationHash,
    authorityCaptureHash: body.authorityCaptureHash,
    localeQualificationHash: body.localeQualificationHash,
    teachingProjectionHash: body.teachingProjectionHash,
    teachingClosureReceiptHash: body.teachingClosureReceiptHash,
    composedDomainFragmentManifestHash: body.composedDomainFragmentManifestHash,
    domainFragmentSetHash: body.domainFragmentSetHash,
    formalResourceEnvelopeHash: body.formalResourceEnvelopeHash,
    continuityReceiptHash: body.continuityReceiptHash,
    derivationReceiptHash: body.derivationReceiptHash,
    successorRuntimeManifestHash: body.successorRuntimeManifestHash,
    successorRuntimeMaterializationHash: body.successorRuntimeMaterializationHash,
    domainShardCatalogHash: body.domainShardCatalogHash,
    domainShardSetHash: body.domainShardSetHash,
    prerequisitePublicationHash: body.prerequisitePublicationHash,
    consumerActivationHash: body.consumerActivationHash,
    predecessor: body.predecessor,
    predecessorRuntimeLifecycleGeneration: body.predecessorRuntimeLifecycleGeneration,
    successorSelectorExpectations: body.successorSelectorExpectations,
    transactionImplementationIdentity: body.transactionImplementationIdentity,
    rollbackPlanHash: body.rollbackPlanHash,
    verificationPolicyHash: body.verificationPolicyHash,
  });
}

function fixture(): Fixture {
  const values = new Map<string, unknown>();
  const pointers: Record<string, LatestCutoverArtifactPointer> = {};
  const add = (id: string, value: unknown): LatestCutoverArtifactPointer => {
    values.set(id, value);
    const pointer = { id, sha256: projectionDigest(value) };
    pointers[id] = pointer;
    return pointer;
  };

  const authority = add('authority-current', {
    contract: 'actkg-engineering-authority-current/v1',
    snapshotId: 'snap-successor',
    snapshotHash: '5'.repeat(64),
    releaseId: 'release-successor',
    releaseSetId: 'set-successor',
  });
  const catalog = add('domain-catalog', {
    contract: 'act-authority-domain-catalog/v1',
    authorityBinding: {
      snapshotId: 'snap-successor',
      snapshotHash: '5'.repeat(64),
      releaseId: 'release-successor',
      releaseSetId: 'set-successor',
    },
    domains: [{ domainId: 'largest', nodeCount: 50, relationCount: 20 }],
  });
  const shard = add('domain-shard', {
    contract: 'act-authority-domain-shard/v1',
    envelope: {
      authority: {
        snapshotId: 'snap-successor',
        snapshotHash: '5'.repeat(64),
        releaseId: 'release-successor',
        releaseSetId: 'set-successor',
      },
      teaching: { status: 'available', projectionHash: '6'.repeat(64) },
    },
    nodes: [{ id: 'n1' }],
  });
  const teachingProjection = add('teaching-projection', {
    contract: 'act-teaching-projection/v1',
    authorityBinding: {
      snapshotId: 'snap-successor',
      snapshotHash: '5'.repeat(64),
      releaseId: 'release-successor',
      releaseSetId: 'set-successor',
    },
    projectionHash: '6'.repeat(64),
    relations: [{ id: 't1', layer: 'ACT_TEACHING' }],
  });
  const teachingClosure = add('teaching-closure', {
    contract: 'coordinated-teaching-closure-receipt/v1',
    status: 'COMPLETE',
    zeroUnresolved: true,
    familyCounts: [{ admittedRelationCount: 1, unresolvedCount: 0 }],
  });
  const fragment = add('fragment-1', {
    contract: 'act-domain-teaching-fragment/v1',
    authorityBinding: {
      snapshotId: 'snap-successor',
      snapshotHash: '5'.repeat(64),
      releaseId: 'release-successor',
      releaseSetId: 'set-successor',
    },
    relations: [{ id: 't1', layer: 'ACT_TEACHING' }],
  });
  const composed = add('composed-fragments', {
    contract: 'act-domain-teaching-composed-manifest/v1',
    authorityBinding: {
      snapshotId: 'snap-successor',
      snapshotHash: '5'.repeat(64),
      releaseId: 'release-successor',
      releaseSetId: 'set-successor',
    },
    fragments: [{ fragmentId: fragment.id, fragmentDigest: fragment.sha256 }],
    relationCount: 1,
    gateStatus: 'PUBLISHED',
    gatePassed: true,
  });
  const prerequisites = add('prerequisites', {
    contract: 'prerequisite-publication/v1',
    authorityBinding: { releaseId: 'release-successor' },
    status: 'PUBLISHED',
  });
  const activation = add('consumer-activation', {
    contract: 'consumer-activation/v1',
    authorityBinding: { releaseId: 'release-successor' },
    status: 'ACTIVE',
  });
  const resource = add('formal-resource', {
    contract: 'formal-resource-envelope/v1',
    authorityBinding: { releaseId: 'release-successor' },
    status: 'READY',
  });
  const extension = add('extension', {
    contract: 'coordinated-runtime-manifest-extension/v1',
    teachingProjectionHash: teachingProjection.sha256,
    teachingClosureReceiptHash: teachingClosure.sha256,
    composedDomainFragmentManifestHash: composed.sha256,
    domainFragmentSetHash: projectionDigest([fragment.sha256]),
    formalResourceEnvelopeHash: resource.sha256,
    domainShardSetHash: projectionDigest([shard.sha256]),
    prerequisitePublicationHash: prerequisites.sha256,
    consumerActivationHash: activation.sha256,
    predecessorRuntimeReleaseId: predecessorRuntime.releaseId,
    predecessorRuntimeManifestSha256: predecessorRuntime.manifestSha256,
    predecessorLifecycleGeneration: predecessorRuntime.generation,
  });
  const predecessorAuthorityIdentity = '7'.repeat(64);
  const candidateBody = {
    contract: 'coordinated-candidate-receipt/v1',
    builderVersion: 'latest-authority-oss-cutover-builder/v1',
    candidateId: 'cand-test',
    sealedAt: '2026-08-30T00:00:00.000Z',
    selectable: false,
    allocationHash: 'a'.repeat(64),
    authorityCaptureHash: 'b'.repeat(64),
    localeQualificationHash: 'c'.repeat(64),
    teachingProjectionHash: teachingProjection.sha256,
    teachingClosureReceiptHash: teachingClosure.sha256,
    composedDomainFragmentManifestHash: composed.sha256,
    domainFragmentSetHash: projectionDigest([fragment.sha256]),
    formalResourceEnvelopeHash: resource.sha256,
    continuityReceiptHash: 'd'.repeat(64),
    derivationReceiptHash: 'e'.repeat(64),
    successorRuntimeManifestHash: 'f'.repeat(64),
    successorRuntimeMaterializationHash: '1'.repeat(64),
    domainShardCatalogHash: catalog.sha256,
    domainShardSetHash: projectionDigest([shard.sha256]),
    prerequisitePublicationHash: prerequisites.sha256,
    consumerActivationHash: activation.sha256,
    predecessor: [{ selectorId: 'authority:current', identity: predecessorAuthorityIdentity }],
    predecessorRuntimeLifecycleGeneration: 1,
    successorSelectorExpectations: [{
      selectorId: 'authority:current',
      expectedSuccessorIdentity: authority.sha256,
    }],
    transactionImplementationIdentity: '8'.repeat(64),
    rollbackPlanHash: '9'.repeat(64),
    verificationPolicyHash: '0'.repeat(64),
  };
  const candidateHash = digestCandidate(candidateBody);
  const candidateValue = { ...candidateBody, receiptHash: candidateHash };
  values.set('candidate-receipt', candidateValue);
  const candidate = { id: 'candidate-receipt', sha256: candidateHash };
  pointers['candidate-receipt'] = candidate;
  const receiptBody = {
    contract: 'coordinated-active-receipt/v1',
    committedSelectors: [{ selectorId: 'authority:current', identity: authority.sha256 }],
    candidateReceiptHash: candidateHash,
    runtimeActiveIdentity: successorRuntime,
    domainShardCatalogHash: catalog.sha256,
    runtimeManifestExtensionHash: extension.sha256,
  };
  const receipt = add('active-receipt', {
    ...receiptBody,
    receiptHash: projectionDigest(receiptBody),
  });

  return {
    values,
    pointers,
    input: {
      io: { read: (id) => values.get(id) ?? null },
      receipt,
      candidateReceipt: candidate,
      authorityCurrent: authority,
      runtimeIdentity: successorRuntime,
      extension,
      domainCatalog: catalog,
      domainShards: [shard],
      teachingProjection,
      teachingClosure,
      composedDomainFragments: composed,
      domainFragments: [fragment],
      prerequisites,
      consumerActivation: activation,
      formalResource: resource,
    },
  };
}

function bindPredecessor(subject: Fixture, authorityValue: unknown) {
  const authoritySha = projectionDigest(authorityValue);
  subject.values.set('authority-current', authorityValue);
  subject.input.authorityCurrent = { id: 'authority-current', sha256: authoritySha };
  const candidate = subject.values.get('candidate-receipt') as Record<string, unknown>;
  const nextHash = digestCandidate({
    ...candidate,
    predecessor: [{ selectorId: 'authority:current', identity: authoritySha }],
  });
  subject.values.set('candidate-receipt', {
    ...candidate,
    predecessor: [{ selectorId: 'authority:current', identity: authoritySha }],
    receiptHash: nextHash,
  });
  subject.input.candidateReceipt = { id: 'candidate-receipt', sha256: nextHash };
  const receipt = subject.values.get('active-receipt') as Record<string, unknown>;
  const nextReceipt = {
    ...receipt,
    candidateReceiptHash: nextHash,
  };
  delete nextReceipt.predecessor;
  subject.values.set('active-receipt', nextReceipt);
  subject.input.receipt = { id: 'active-receipt', sha256: projectionDigest(nextReceipt) };
  subject.input.runtimeIdentity = predecessorRuntime;
}

describe('latest knowledge cutover verifier', () => {
  it('keeps a matching predecessor truthful but not latest-ready', () => {
    const subject = fixture();
    bindPredecessor(subject, { predecessor: true });

    expect(verifyLatestKnowledgeCutover(subject.input)).toMatchObject({
      ready: false,
      combination: 'predecessor',
    });
  });

  it('qualifies a complete matching successor', () => {
    const result = verifyLatestKnowledgeCutover(fixture().input);
    expect(result.ready).toBe(true);
    expect(result.combination).toBe('successor');
    expect(result.reasons).toEqual([]);
  });

  it('fails closed when a composed domain fragment is missing', () => {
    const subject = fixture();
    subject.values.delete('fragment-1');
    expect(verifyLatestKnowledgeCutover(subject.input)).toMatchObject({
      ready: false,
      combination: 'failed',
      reasons: expect.arrayContaining(['missing-fragment']),
    });
  });

  it('rejects partial Teaching Projection closure', () => {
    const subject = fixture();
    const partial = { status: 'PARTIAL', zeroUnresolved: false, familyCounts: [] };
    subject.values.set('teaching-closure', partial);
    subject.input.teachingClosure = { id: 'teaching-closure', sha256: projectionDigest(partial) };
    expect(verifyLatestKnowledgeCutover(subject.input).reasons).toContain('teaching-partial');
  });

  it('rejects mixed Authority identities', () => {
    const subject = fixture();
    const mixed = subject.values.get('domain-shard') as Record<string, unknown>;
    subject.values.set('domain-shard', {
      ...mixed,
      envelope: { authority: { releaseId: 'release-foreign' }, teaching: { status: 'available' } },
    });
    subject.input.domainShards = [{
      id: 'domain-shard',
      sha256: projectionDigest(subject.values.get('domain-shard')),
    }];
    expect(verifyLatestKnowledgeCutover(subject.input).reasons).toContain('mixed-identity');
  });

  it('recognizes an identity-matched rollback as predecessor', () => {
    const subject = fixture();
    bindPredecessor(subject, { rollback: 'predecessor' });
    const result = verifyLatestKnowledgeCutover(subject.input);
    expect(result.combination).toBe('predecessor');
    expect(result.ready).toBe(false);
  });

  it('rejects a successor whose candidate receipt does not seal the reopened members', () => {
    const subject = fixture();
    const candidate = subject.values.get('candidate-receipt') as Record<string, unknown>;
    const nextHash = digestCandidate({
      ...candidate,
      teachingProjectionHash: 'e'.repeat(64),
    });
    subject.values.set('candidate-receipt', {
      ...candidate,
      teachingProjectionHash: 'e'.repeat(64),
      receiptHash: nextHash,
    });
    subject.input.candidateReceipt = { id: 'candidate-receipt', sha256: nextHash };
    const receipt = subject.values.get('active-receipt') as Record<string, unknown>;
    const nextReceipt = {
      ...receipt,
      candidateReceiptHash: nextHash,
    };
    subject.values.set('active-receipt', nextReceipt);
    subject.input.receipt = { id: 'active-receipt', sha256: projectionDigest(nextReceipt) };
    expect(verifyLatestKnowledgeCutover(subject.input)).toMatchObject({
      ready: false,
      combination: 'failed',
      reasons: expect.arrayContaining(['mixed-identity']),
    });
  });

  it('rejects a successor whose candidate receipt hash does not reopen', () => {
    const subject = fixture();
    const receipt = subject.values.get('active-receipt') as Record<string, unknown>;
    subject.values.set('active-receipt', {
      ...receipt,
      candidateReceiptHash: '2'.repeat(64),
    });
    subject.input.receipt = {
      id: 'active-receipt',
      sha256: projectionDigest(subject.values.get('active-receipt')),
    };
    expect(verifyLatestKnowledgeCutover(subject.input)).toMatchObject({
      ready: false,
      combination: 'failed',
      reasons: expect.arrayContaining(['mixed-identity']),
    });
  });

  it('detects a tampered reopened member', () => {
    const subject = fixture();
    subject.values.set('prerequisites', { tampered: true });
    expect(verifyLatestKnowledgeCutover(subject.input).reasons).toContain('hash-mismatch');
  });

  it('rejects a predecessor that reuses release identity under a drifted lifecycle generation', () => {
    const subject = fixture();
    bindPredecessor(subject, { predecessor: true });
    subject.input.runtimeIdentity = {
      ...predecessorRuntime,
      generation: 99,
    };
    expect(verifyLatestKnowledgeCutover(subject.input)).toMatchObject({
      ready: false,
      combination: 'unknown',
      reasons: expect.arrayContaining(['unknown-state']),
    });
  });

  it('fails closed for a state matching neither predecessor nor successor', () => {
    const subject = fixture();
    subject.input.runtimeIdentity = {
      releaseId: 'runtime-unknown',
      manifestSha256: '8'.repeat(64),
      treeSha256: '9'.repeat(64),
      generation: 1,
    };
    expect(verifyLatestKnowledgeCutover(subject.input)).toMatchObject({
      ready: false,
      combination: 'unknown',
      reasons: expect.arrayContaining(['unknown-state']),
    });
  });

  it('publishes only sanitized identities and stable reasons', () => {
    const subject = fixture();
    const receipt = subject.values.get('active-receipt');
    subject.values.delete('active-receipt');
    subject.values.set('/Users/private/cutover?X-Amz-Signature=secret', receipt);
    subject.input.receipt = {
      id: '/Users/private/cutover?X-Amz-Signature=secret',
      sha256: projectionDigest(receipt),
    };
    const serialized = JSON.stringify(verifyLatestKnowledgeCutover(subject.input));
    expect(serialized).not.toMatch(/\/Users|X-Amz|secret/u);
  });

  it('rejects a member that keeps its declared identity hash after content tamper', () => {
    const envelopeHash = projectionDigest({
      contract: 'coordinated-formal-resource-envelope-incremental-reuse/v1',
      allocationHash: 'a'.repeat(64),
      status: 'READY',
    });
    const tampered = {
      contract: 'coordinated-formal-resource-envelope-incremental-reuse/v1',
      allocationHash: 'a'.repeat(64),
      status: 'READY',
      extra: 'mutated',
      envelopeHash,
    };
    const subject = fixture();
    subject.values.set('formal-resource', Buffer.from(`${JSON.stringify(tampered)}\n`));
    subject.input.formalResource = { id: 'formal-resource', sha256: envelopeHash };
    expect(verifyLatestKnowledgeCutover(subject.input).reasons).toContain('hash-mismatch');
  });

  it('rejects a coordinated receipt whose receiptHash is not recomputed from the sealed body', () => {
    const subject = fixture();
    const receipt = subject.values.get('active-receipt') as Record<string, unknown>;
    const forged = { ...receipt, receiptHash: 'd'.repeat(64) };
    subject.values.set('active-receipt', Buffer.from(`${JSON.stringify(forged)}\n`));
    subject.input.receipt = { id: 'active-receipt', sha256: 'd'.repeat(64) };
    expect(verifyLatestKnowledgeCutover(subject.input).reasons).toContain('hash-mismatch');
  });
});
