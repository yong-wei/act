import { describe, expect, it } from 'vitest';

import { projectionDigest } from '@/lib/teaching-projection/hash';

import { reopenRemediationHandoff } from '../formal-resource-remediation/handoff';
import type { RemediationHandoffManifest } from '../formal-resource-remediation/contracts';

const HASH = 'a'.repeat(64);
const OTHER = 'b'.repeat(64);

function sealHandoff(overrides: Partial<Record<string, unknown>> = {}): RemediationHandoffManifest {
  const body = {
    contract: 'remediation-handoff-manifest/v1',
    builderVersion: 'formal-resource-remediation-builder/v1',
    handoffId: 'pending',
    sealedAt: '2026-08-24T20:30:00.000Z',
    selectable: false,
    allocationHash: HASH,
    authorityCaptureHash: HASH,
    denominatorHash: HASH,
    resourceEnvelopeHash: HASH,
    closureReceiptHash: HASH,
    teachingProjectionHash: HASH,
    prerequisitePublicationHash: HASH,
    domainFragmentsHash: HASH,
    domainShardsHash: HASH,
    consumerProjectionsHash: HASH,
    processorRegistryHash: HASH,
    reportsHash: HASH,
    notes: ['note one'],
    ...overrides,
  };
  const { handoffId, ...rest } = body as { handoffId: string } & Record<string, unknown>;
  void handoffId;
  const handoffHash = projectionDigest({ ...rest, handoffId: 'pending' });
  return {
    ...(rest as unknown as RemediationHandoffManifest),
    handoffId: `handoff-${handoffHash.slice(0, 24)}`,
    handoffHash,
  } as RemediationHandoffManifest;
}

describe('reopenRemediationHandoff', () => {
  it('reopens a sealed handoff unchanged', () => {
    const handoff = sealHandoff();
    expect(reopenRemediationHandoff(handoff)).toBe(handoff);
  });

  it('keeps extra body fields (notes) inside the sealed digest', () => {
    const handoff = sealHandoff({ notes: ['note one', 'note two'] });
    expect(() => reopenRemediationHandoff(handoff)).not.toThrow();
  });

  it('fails closed on an edited body field', () => {
    const handoff = sealHandoff();
    const tampered = { ...handoff, teachingProjectionHash: OTHER };
    expect(() => reopenRemediationHandoff(tampered)).toThrow(/own sealed hash/u);
  });

  it('fails closed on an edited notes entry', () => {
    const handoff = sealHandoff();
    const tampered = { ...handoff, notes: ['edited note'] };
    expect(() => reopenRemediationHandoff(tampered)).toThrow(/own sealed hash/u);
  });

  it('fails closed on a selectable handoff', () => {
    const handoff = sealHandoff({ selectable: true });
    expect(() => reopenRemediationHandoff(handoff)).toThrow(/non-selectable/u);
  });

  it('fails closed on a foreign contract', () => {
    const handoff = sealHandoff({ contract: 'other-manifest/v9' });
    expect(() => reopenRemediationHandoff(handoff)).toThrow(/contract/u);
  });

  it('fails closed when the handoff id is not derived from the digest', () => {
    const handoff = sealHandoff();
    const tampered = { ...handoff, handoffId: 'handoff-notderived' };
    expect(() => reopenRemediationHandoff(tampered)).toThrow(/derived from the sealed hash/u);
  });
});
