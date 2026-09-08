import { describe, expect, it } from 'vitest';

import {
  COMPOSITE_ENVELOPE_REGISTRY_RELATIVE,
  envelopeByName,
  loadCompositeEnvelopeRegistry,
  matchCompositeEnvelope,
  multilingualLabelCountForRelease,
} from '@/lib/actkg-envelope/composite-envelope-registry';
import {
  V018_REVIEWED_NEIGHBORHOOD_RELEASE_ID,
  V018_REVIEWED_NEIGHBORHOOD_SNAPSHOT_ID,
} from '@/lib/authority-domain-shards/v018-reviewed-neighborhood-labels';

describe('v0.22 composite envelope registry', () => {
  it('loads named envelopes from the sealed configuration artifact', () => {
    const loaded = loadCompositeEnvelopeRegistry();
    expect(COMPOSITE_ENVELOPE_REGISTRY_RELATIVE).toContain('actkg-composite-envelope-registry.json');
    expect(loaded.map((row) => row.name)).toEqual([
      'control-theory-engineering-v0.9',
      'control-theory-engineering-v0.18',
      'control-theory-engineering-v0.22',
      // v0.37 envelope 自 #1741 双语权威图谱切换起登记（#2061 更新为 r6 快照身份）。
      'control-theory-engineering-v0.37',
    ]);
  });

  it('resolves named envelopes and refuses latest', () => {
    expect(envelopeByName('control-theory-engineering-v0.9').authorityReleaseId)
      .toBe('ctr:release:control-theory-engineering-v0.9');
    const v18 = envelopeByName('control-theory-engineering-v0.18');
    expect(v18.multilingualLabelCount).toBe(1909);
    expect(v18.profileId).toBe('ctr:profile:control-theory-engineering-v0.18:runtime-v3');
    expect(v18.shardSetId).toBe('ads-30cd92a6be1035c981428d1cb144e2d1dc37578020b6e99b1b02d41f7c2752af');
    expect(envelopeByName('control-theory-engineering-v0.22').multilingualLabelCount).toBe(2148);
    expect(() => envelopeByName('latest')).toThrow(/must not resolve latest/);
  });

  it('matches a complete selector set and fails closed on mix', () => {
    const v09 = envelopeByName('control-theory-engineering-v0.9');
    const v22 = envelopeByName('control-theory-engineering-v0.22');
    expect(matchCompositeEnvelope({
      authorityReleaseId: v09.authorityReleaseId,
      authoritySnapshotId: v09.authoritySnapshotId,
      authoritySnapshotHash: v09.authoritySnapshotHash,
      projectionId: v09.projectionId,
      projectionHash: v09.projectionHash,
      publicationId: v09.publicationId,
      publicationHash: v09.publicationHash,
      shardSetId: v09.shardSetId,
      shardSetHash: v09.shardSetHash,
      catalogId: v09.catalogId,
      catalogHash: v09.catalogHash,
      activationId: v09.activationId,
      activationHash: v09.activationHash,
    }).name).toBe('control-theory-engineering-v0.9');
    expect(() => matchCompositeEnvelope({
      authorityReleaseId: v22.authorityReleaseId,
      authoritySnapshotId: v22.authoritySnapshotId,
      authoritySnapshotHash: v22.authoritySnapshotHash,
      projectionId: v09.projectionId,
      projectionHash: v09.projectionHash,
      publicationId: v09.publicationId,
      publicationHash: v09.publicationHash,
      shardSetId: v09.shardSetId,
      shardSetHash: v09.shardSetHash,
      catalogId: v09.catalogId,
      catalogHash: v09.catalogHash,
      activationId: v09.activationId,
      activationHash: v09.activationHash,
    })).toThrow(/do not resolve one qualified composite envelope/);
    expect(() => matchCompositeEnvelope({
      authorityReleaseId: v09.authorityReleaseId,
      authoritySnapshotId: v09.authoritySnapshotId,
      authoritySnapshotHash: '0'.repeat(64),
      projectionId: v09.projectionId,
      projectionHash: v09.projectionHash,
      publicationId: v09.publicationId,
      publicationHash: v09.publicationHash,
      shardSetId: v09.shardSetId,
      shardSetHash: v09.shardSetHash,
      catalogId: v09.catalogId,
      catalogHash: v09.catalogHash,
      activationId: v09.activationId,
      activationHash: v09.activationHash,
    })).toThrow(/do not resolve one qualified composite envelope/);
  });

  it('looks up multilingual label counts by release instead of a compiled v0.18-only pin', () => {
    expect(multilingualLabelCountForRelease('ctr:release:control-theory-engineering-v0.18')).toBe(1909);
    expect(multilingualLabelCountForRelease('ctr:release:control-theory-engineering-v0.22')).toBe(2148);
    expect(multilingualLabelCountForRelease('ctr:release:control-theory-engineering-v0.9')).toBeNull();
  });

  it('binds the v0.18 neighborhood overlay to the named envelope', () => {
    const v18 = envelopeByName('control-theory-engineering-v0.18');
    expect(V018_REVIEWED_NEIGHBORHOOD_RELEASE_ID).toBe(v18.authorityReleaseId);
    expect(V018_REVIEWED_NEIGHBORHOOD_SNAPSHOT_ID).toBe(v18.authoritySnapshotId);
  });
});
