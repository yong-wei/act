import { describe, expect, it } from 'vitest';

import { projectionDigest } from '@/lib/teaching-projection/hash';

import type { ResourceProcessingRecord } from '@/lib/formal-resource-remediation/contracts';
import {
  rebindProcessingRecordsToAllocation,
  reopenResourceEnvelope,
  sealResourceEnvelope,
  type RemediationResourceEnvelope,
} from '@/lib/formal-resource-remediation/envelope';
import {
  buildDomainFragment,
  buildRemediationTeachingProjection,
  deriveProjectionCompleteness,
  projectionEdges,
  validateRemediationTeachingProjection,
  type ProjectionBindingRow,
} from '@/lib/formal-resource-remediation/projection';

const ALLOCATION = 'a'.repeat(64);
const SCOPE = 'b'.repeat(64);
const OTHER_ALLOCATION = 'c'.repeat(64);
const SHA = (seed: string) => projectionDigest({ seed });

function record(overrides: Partial<ResourceProcessingRecord> = {}): ResourceProcessingRecord {
  return {
    contract: 'resource-processing-record/v1',
    recordId: 'rec-fixed0000000000000000',
    allocationHash: ALLOCATION,
    resourceId: 'handout-1-1',
    resourceSubtype: 'handout',
    origin: 'ACTIVE_BASELINE',
    sourceIdentity: `content:${SHA('source')}`,
    externalInputId: null,
    processorIdentity: 'handout-processor/v1',
    validatorIdentity: 'remediation-validator/v1',
    atomOutputIds: ['atom-1', 'atom-2'],
    mappingOutputIds: ['atom-1'],
    anchorOutputIds: ['p-1', 'p-2'],
    launchOutputIds: ['p-1', 'p-2'],
    disposition: 'INCLUDED',
    failureCodes: [],
    limitations: [],
    outputManifestHash: SHA('manifest'),
    ...overrides,
  } as ResourceProcessingRecord;
}

function envelopeFixture(): RemediationResourceEnvelope {
  return sealResourceEnvelope({
    sealedAt: '2026-08-25T00:00:00.000Z',
    allocationHash: ALLOCATION,
    scopeHash: SCOPE,
    processingRecords: [record()],
    atomCount: 2,
    bindingCount: 1,
    artifacts: [{ role: 'text-atoms', path: 'formal-resource-remediation/resource-layer/text-atoms.json', sha256: SHA('atoms-file') }],
    limitations: ['exercise/simulation/video subtypes pending (tasks 3/6)'],
  });
}

describe('formal resource envelope', () => {
  it('seals from real records and artifacts', () => {
    const envelope = envelopeFixture();
    expect(envelope.resourceCount).toBe(1);
    expect(envelope.subtypes).toEqual([{ subtype: 'handout', resources: 1, atoms: 2 }]);
    expect(envelope.envelopeHash).toHaveLength(64);
  });

  it('fails closed when a record binds a different allocation', () => {
    expect(() => sealResourceEnvelope({
      sealedAt: '2026-08-25T00:00:00.000Z',
      allocationHash: ALLOCATION,
      scopeHash: SCOPE,
      processingRecords: [record({ allocationHash: OTHER_ALLOCATION })],
      atomCount: 2,
      bindingCount: 0,
      artifacts: [],
      limitations: [],
    })).toThrow(/not the envelope allocation/iu);
  });

  it('fails closed on duplicate artifact roles', () => {
    expect(() => sealResourceEnvelope({
      sealedAt: '2026-08-25T00:00:00.000Z',
      allocationHash: ALLOCATION,
      scopeHash: SCOPE,
      processingRecords: [record()],
      atomCount: 2,
      bindingCount: 0,
      artifacts: [
        { role: 'text-atoms', path: 'a.json', sha256: SHA('a') },
        { role: 'text-atoms', path: 'b.json', sha256: SHA('b') },
      ],
      limitations: [],
    })).toThrow(/twice/iu);
  });

  it('reopens SEALED only when every artifact hash recomputes', () => {
    const envelope = envelopeFixture();
    const ok = reopenResourceEnvelope({
      envelope,
      processingRecords: [record()],
      artifactSha256: () => '0'.repeat(64),
    });
    expect(ok.state).toBe('REOPEN_FAILED');
    const passed = ok.checks.filter((one) => one.name.startsWith('artifact:'));
    expect(passed.every((one) => !one.passed)).toBe(true);
  });

  it('reopens SEALED with matching artifact bytes', () => {
    const bytes = 'atoms-file-bytes';
    const sha = projectionDigest({ bytes: Buffer.from(bytes) });
    const sealed = sealResourceEnvelope({
      sealedAt: '2026-08-25T00:00:00.000Z',
      allocationHash: ALLOCATION,
      scopeHash: SCOPE,
      processingRecords: [record()],
      atomCount: 2,
      bindingCount: 1,
      artifacts: [{ role: 'text-atoms', path: 'formal-resource-remediation/resource-layer/text-atoms.json', sha256: sha }],
      limitations: ['exercise/simulation/video subtypes pending (tasks 3/6)'],
    });
    const result = reopenResourceEnvelope({
      envelope: sealed,
      processingRecords: [record()],
      artifactSha256: () => sha,
    });
    expect(result.state).toBe('SEALED');
  });

  it('rebinding records keeps record identity stable and moves only the allocation', () => {
    const rebound = rebindProcessingRecordsToAllocation([record()], OTHER_ALLOCATION);
    expect(rebound[0].allocationHash).toBe(OTHER_ALLOCATION);
    expect(rebound[0].recordId).toBe('rec-fixed0000000000000000');
  });
});

const MEMBER_A = 'ctkg:m3-v2b:canonical-object:aaa';
const MEMBER_B = 'ctkg:m3-v2f:source-object:bbb';
const MEMBER_EX = 'ctkg:m3-v2m:canonical-object:excluded';

function membersFixture() {
  return [
    { canonicalId: MEMBER_A, domain: 'system-modeling', excluded: false },
    { canonicalId: MEMBER_B, domain: 'system-modeling', excluded: false },
    { canonicalId: MEMBER_EX, domain: 'lyapunov-stability', excluded: true },
  ];
}

function ledgerFixture() {
  return [{
    domain: 'system-modeling',
    rows: [
      { canonicalId: MEMBER_A, family: 'containment' as const, disposition: 'PUBLISHED_EDGE' as const, target: MEMBER_B, edgeId: 'e1' },
      { canonicalId: MEMBER_B, family: 'prerequisite' as const, disposition: 'NO_RELATION' as const, target: null, edgeId: null },
    ],
  }, {
    domain: 'lyapunov-stability',
    rows: [
      { canonicalId: MEMBER_EX, family: 'association' as const, disposition: 'NO_RELATION' as const, target: null, edgeId: null },
    ],
  }];
}

function bindingsFixture(): ProjectionBindingRow[] {
  return [{ modality: 'card', resourceId: 'card-1', anchorId: 'atom-1', canonicalId: MEMBER_A, evidence: 'course-to-authority-map exact-name' }];
}

function projectionFixture() {
  return buildRemediationTeachingProjection({
    sealedAt: '2026-08-25T00:00:00.000Z',
    allocationHash: ALLOCATION,
    scopeHash: SCOPE,
    members: membersFixture(),
    finalLedgerRows: ledgerFixture(),
    bindings: bindingsFixture(),
    envelope: envelopeFixture(),
    totalClosureReceiptSha256: SHA('total-receipt'),
    totalConservationCheckSha256: SHA('conservation'),
    limitations: ['test limitation'],
  });
}

describe('remediation teaching projection', () => {
  it('builds membership, relations, bindings, and zero-resource accounting', () => {
    const projection = projectionFixture();
    expect(projection.membership).toMatchObject({ memberCount: 3, coveredMemberCount: 2, excludedMemberCount: 1 });
    expect(projection.relations.edgeCount).toBe(1);
    expect(projection.bindings.byModality).toEqual({ card: 1, audio: 0 });
    expect(projection.zeroResourceNodes.count).toBe(1);
  });

  it('fails closed when an edge endpoint leaves the reopened membership', () => {
    expect(() => buildRemediationTeachingProjection({
      sealedAt: '2026-08-25T00:00:00.000Z',
      allocationHash: ALLOCATION,
      scopeHash: SCOPE,
      members: membersFixture(),
      finalLedgerRows: [{
        domain: 'system-modeling',
        rows: [{ canonicalId: MEMBER_A, family: 'containment', disposition: 'PUBLISHED_EDGE', target: 'ctkg:unknown', edgeId: 'e2' }],
      }],
      bindings: [],
      envelope: envelopeFixture(),
      totalClosureReceiptSha256: SHA('t'),
      totalConservationCheckSha256: SHA('c'),
      limitations: [],
    })).toThrow(/outside the reopened membership/iu);
  });

  it('fails closed when a binding targets an unknown member', () => {
    expect(() => buildRemediationTeachingProjection({
      sealedAt: '2026-08-25T00:00:00.000Z',
      allocationHash: ALLOCATION,
      scopeHash: SCOPE,
      members: membersFixture(),
      finalLedgerRows: ledgerFixture(),
      bindings: [{ modality: 'audio', resourceId: 'audio-1', anchorId: 'seg-1', canonicalId: 'ctkg:unknown', evidence: 'term-overlap' }],
      envelope: envelopeFixture(),
      totalClosureReceiptSha256: SHA('t'),
      totalConservationCheckSha256: SHA('c'),
      limitations: [],
    })).toThrow(/outside the reopened membership/iu);
  });

  it('derives COMPLETE only from reopened reconciling artifacts', () => {
    const projection = projectionFixture();
    const result = deriveProjectionCompleteness({
      reopenedScope: { scopeHash: SCOPE, memberCount: 3 },
      reopenedEnvelope: { state: 'SEALED', envelope: envelopeFixture() },
      closure: { allocationHash: ALLOCATION, memberCount: 3, rowCount: 9, unresolved: 0, closureComplete: true, domainReceiptCount: 15 },
      conservation: { ledgerRowCount: 9, duplicates: 0, missingRowCount: 0 },
      allocationHash: ALLOCATION,
      projection,
    });
    expect(result.state).toBe('COMPLETE');
    expect(result.checks.every((one) => one.passed)).toBe(true);
  });

  it('stays INCOMPLETE when the allocation identity drifts anywhere', () => {
    const projection = projectionFixture();
    const result = deriveProjectionCompleteness({
      reopenedScope: { scopeHash: SCOPE, memberCount: 3 },
      reopenedEnvelope: { state: 'SEALED', envelope: envelopeFixture() },
      closure: { allocationHash: OTHER_ALLOCATION, memberCount: 3, rowCount: 9, unresolved: 0, closureComplete: true, domainReceiptCount: 15 },
      conservation: { ledgerRowCount: 9, duplicates: 0, missingRowCount: 0 },
      allocationHash: ALLOCATION,
      projection,
    });
    expect(result.state).toBe('INCOMPLETE');
    expect(result.checks.find((one) => one.name === 'allocation-identity')?.passed).toBe(false);
  });

  it('stays INCOMPLETE when the envelope fails to reopen', () => {
    const projection = projectionFixture();
    const result = deriveProjectionCompleteness({
      reopenedScope: { scopeHash: SCOPE, memberCount: 3 },
      reopenedEnvelope: { state: 'REOPEN_FAILED', envelope: envelopeFixture() },
      closure: { allocationHash: ALLOCATION, memberCount: 3, rowCount: 9, unresolved: 0, closureComplete: true, domainReceiptCount: 15 },
      conservation: { ledgerRowCount: 9, duplicates: 0, missingRowCount: 0 },
      allocationHash: ALLOCATION,
      projection,
    });
    expect(result.state).toBe('INCOMPLETE');
    expect(result.checks.find((one) => one.name === 'envelope-reopened')?.passed).toBe(false);
  });

  it('stays INCOMPLETE when conservation reports duplicates', () => {
    const projection = projectionFixture();
    const result = deriveProjectionCompleteness({
      reopenedScope: { scopeHash: SCOPE, memberCount: 3 },
      reopenedEnvelope: { state: 'SEALED', envelope: envelopeFixture() },
      closure: { allocationHash: ALLOCATION, memberCount: 3, rowCount: 9, unresolved: 0, closureComplete: true, domainReceiptCount: 15 },
      conservation: { ledgerRowCount: 9, duplicates: 1, missingRowCount: 0 },
      allocationHash: ALLOCATION,
      projection,
    });
    expect(result.state).toBe('INCOMPLETE');
  });

  it('validates cleanly against reconciling inputs and flags drift', () => {
    const projection = projectionFixture();
    const edges = projectionEdges(membersFixture(), ledgerFixture());
    const clean = validateRemediationTeachingProjection({
      projection,
      members: membersFixture(),
      edges,
      bindings: bindingsFixture(),
      envelope: envelopeFixture(),
      closure: { memberCount: 3, rowCount: 9, publishedEdges: 1 },
    });
    expect(clean).toEqual([]);
    const drift = validateRemediationTeachingProjection({
      projection: { ...projection, relations: { ...projection.relations, edgeCount: 5 } },
      members: membersFixture(),
      edges,
      bindings: bindingsFixture(),
      envelope: envelopeFixture(),
      closure: { memberCount: 3, rowCount: 9, publishedEdges: 1 },
    });
    expect(drift.some((finding) => finding.code === 'relation-count')).toBe(true);
  });

  it('materializes a domain fragment bound to the projection hash', () => {
    const projection = projectionFixture();
    const fragment = buildDomainFragment({
      domain: 'system-modeling',
      projection,
      members: membersFixture(),
      edges: projectionEdges(membersFixture(), ledgerFixture()),
      bindings: bindingsFixture(),
    });
    expect(fragment).toMatchObject({ domain: 'system-modeling', memberCount: 2, edgeCount: 1, bindingCount: 1 });
    expect(fragment.projectionHash).toBe(projection.projectionHash);
  });
});
