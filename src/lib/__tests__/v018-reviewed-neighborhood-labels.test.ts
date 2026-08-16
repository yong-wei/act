import { describe, expect, it } from 'vitest';

import {
  createAuthorityLabelResolverContext,
  isSafeAuthorityLabel,
  resolveAuthorityLabel,
} from '@/lib/authority-domain-shards/labels';
import {
  V018_REVIEWED_NEIGHBORHOOD_ENTITY_IDS,
  V018_REVIEWED_NEIGHBORHOOD_LABELS,
  V018_REVIEWED_NEIGHBORHOOD_RELEASE_ID,
  V018_REVIEWED_NEIGHBORHOOD_SNAPSHOT_HASH,
  V018_REVIEWED_NEIGHBORHOOD_SNAPSHOT_ID,
  reviewedNeighborhoodLabelsForSnapshot,
  reviewedNeighborhoodOverlaySha256,
} from '@/lib/authority-domain-shards/v018-reviewed-neighborhood-labels';
import type { AuthoritativeV2Evidence } from '@/lib/authoritative-knowledge/contracts';

const V018_PROFILE_ID = 'ctr:profile:control-theory-engineering-v0.18:runtime-v3';
const V018_PROFILE_SHA256 = 'a442adfc5a73d9bacba53ce33016238be148917084e057ab979340279737bfe7';

function evidence(labels: AuthoritativeV2Evidence['multilingualLabels']): AuthoritativeV2Evidence {
  return {
    protocol: 'actkg-public-bundle/2',
    profiles: [
      {
        releaseId: V018_REVIEWED_NEIGHBORHOOD_RELEASE_ID,
        profileKey: 'act',
        manifestProfile: 'runtime',
        profileId: V018_PROFILE_ID,
        profileSha256: V018_PROFILE_SHA256,
        projectionKind: 'act_runtime_graph',
        profileVersion: 'v1',
        mappingContractVersion: 'actkg-map/v2',
        aggregationPolicy: 'preserve-all',
        payload: {},
      },
      {
        releaseId: V018_REVIEWED_NEIGHBORHOOD_RELEASE_ID,
        profileKey: 'domain',
        manifestProfile: 'domain',
        profileId: 'domain-profile',
        profileSha256: 'd'.repeat(64),
        projectionKind: 'domain_graph',
        profileVersion: 'v1',
        mappingContractVersion: 'actkg-map/v2',
        aggregationPolicy: 'preserve-all',
        payload: {},
      },
      {
        releaseId: V018_REVIEWED_NEIGHBORHOOD_RELEASE_ID,
        profileKey: 'review',
        manifestProfile: 'review',
        profileId: 'review-profile',
        profileSha256: 'e'.repeat(64),
        projectionKind: 'review_graph',
        profileVersion: 'v1',
        mappingContractVersion: 'actkg-map/v2',
        aggregationPolicy: 'preserve-all',
        payload: {},
      },
    ],
    multilingualLabels: labels,
    admissionBinding: {
      releaseId: V018_REVIEWED_NEIGHBORHOOD_RELEASE_ID,
      bundleReceiptId: 'bundle-receipt:test',
      protocol: 'actkg-public-bundle/2',
      provenance: 'registry',
      verificationScope: 'admission-time',
      verifiedDuringLoad: false,
      registryIdentity: {},
      upstreamRepository: {},
      publicationRevision: {},
      sourceRevision: {},
      bundleIdentity: {},
      bindingDigest: 'f'.repeat(64),
    },
  };
}

describe('v0.18 reviewed neighborhood overlay', () => {
  it('admits exactly 25 classifier-safe zh-CN preferred labels', () => {
    expect(V018_REVIEWED_NEIGHBORHOOD_ENTITY_IDS).toHaveLength(25);
    expect(new Set(V018_REVIEWED_NEIGHBORHOOD_ENTITY_IDS).size).toBe(25);
    expect(V018_REVIEWED_NEIGHBORHOOD_LABELS).toHaveLength(25);
    for (const row of V018_REVIEWED_NEIGHBORHOOD_LABELS) {
      expect(row.language).toBe('zh-CN');
      expect(row.labelType).toBe('canonical_preferred');
      expect(isSafeAuthorityLabel(row.label)).toBe(true);
      expect(row.label).not.toMatch(/[\\/]|A\/D|D\/A/u);
    }
  });

  it('binds only the admitted v0.18 snapshot', () => {
    expect(reviewedNeighborhoodLabelsForSnapshot({
      releaseId: V018_REVIEWED_NEIGHBORHOOD_RELEASE_ID,
      snapshotId: V018_REVIEWED_NEIGHBORHOOD_SNAPSHOT_ID,
      snapshotHash: V018_REVIEWED_NEIGHBORHOOD_SNAPSHOT_HASH,
    })).toHaveLength(25);
    expect(reviewedNeighborhoodLabelsForSnapshot({
      releaseId: 'ctr:release:control-theory-engineering-v0.9',
      snapshotId: V018_REVIEWED_NEIGHBORHOOD_SNAPSHOT_ID,
      snapshotHash: V018_REVIEWED_NEIGHBORHOOD_SNAPSHOT_HASH,
    })).toEqual([]);
  });

  it('resolves overlay labels through the shipped resolver', () => {
    const objects = V018_REVIEWED_NEIGHBORHOOD_LABELS.map((row) => ({
      canonicalId: row.entityId,
      canonicalType: 'DomainConcept',
      semanticName: row.entityId,
      payload: { displayName: 'G(s)=1/s^2' },
    }));
    const context = createAuthorityLabelResolverContext({
      snapshot: {
        releaseId: V018_REVIEWED_NEIGHBORHOOD_RELEASE_ID,
        snapshotId: V018_REVIEWED_NEIGHBORHOOD_SNAPSHOT_ID,
        snapshotHash: V018_REVIEWED_NEIGHBORHOOD_SNAPSHOT_HASH,
      },
      objects,
      v2Evidence: evidence([]),
    });
    for (const row of V018_REVIEWED_NEIGHBORHOOD_LABELS) {
      expect(resolveAuthorityLabel(context, row.entityId)).toEqual({
        status: 'available',
        label: row.label,
        aliases: [],
      });
    }
  });

  it('does not mutate the sealed 1909-row admission count contract', () => {
    expect(V018_REVIEWED_NEIGHBORHOOD_LABELS).toHaveLength(25);
    expect(V018_REVIEWED_NEIGHBORHOOD_LABELS.every((row) => row.ordinal >= 10_000)).toBe(true);
  });

  it('seals a stable overlay artifact hash', () => {
    const digest = reviewedNeighborhoodOverlaySha256();
    expect(digest).toMatch(/^[a-f0-9]{64}$/u);
    expect(reviewedNeighborhoodOverlaySha256()).toBe(digest);
  });

  it('replaces an unsafe admitted preferred and omits an unsafe alternative', () => {
    const target = V018_REVIEWED_NEIGHBORHOOD_LABELS[0]!;
    const objects = [{
      canonicalId: target.entityId,
      canonicalType: 'DomainConcept',
      semanticName: target.entityId,
      payload: { displayName: 'G(s)=1/s^2' },
    }];
    const context = createAuthorityLabelResolverContext({
      snapshot: {
        releaseId: V018_REVIEWED_NEIGHBORHOOD_RELEASE_ID,
        snapshotId: V018_REVIEWED_NEIGHBORHOOD_SNAPSHOT_ID,
        snapshotHash: V018_REVIEWED_NEIGHBORHOOD_SNAPSHOT_HASH,
      },
      objects,
      v2Evidence: evidence([
        {
          releaseId: V018_REVIEWED_NEIGHBORHOOD_RELEASE_ID,
          ordinal: 1,
          entityId: target.entityId,
          language: 'zh-CN',
          label: 'A/D转换器',
          labelType: 'canonical_preferred',
          terminologyAssertionId: 'ctt:admitted-unsafe-preferred',
          payload: {},
        },
        {
          releaseId: V018_REVIEWED_NEIGHBORHOOD_RELEASE_ID,
          ordinal: 2,
          entityId: target.entityId,
          language: 'zh-CN',
          label: 'G（s）=1/s²',
          labelType: 'alternative',
          terminologyAssertionId: 'ctt:admitted-unsafe-alternative',
          payload: {},
        },
      ]),
    });
    expect(resolveAuthorityLabel(context, target.entityId)).toEqual({
      status: 'available',
      label: target.label,
      aliases: [],
    });
  });

  it('keeps a safe admitted alternative after overlaying a missing preferred', () => {
    const target = V018_REVIEWED_NEIGHBORHOOD_LABELS.find((row) => (
      row.entityId === 'ctkg:v3e-object-9581ae46c5b411c0d37c0d18'
    ))!;
    const objects = [{
      canonicalId: target.entityId,
      canonicalType: 'DomainConcept',
      semanticName: target.entityId,
      payload: { displayName: 'unsafe/display' },
    }];
    const context = createAuthorityLabelResolverContext({
      snapshot: {
        releaseId: V018_REVIEWED_NEIGHBORHOOD_RELEASE_ID,
        snapshotId: V018_REVIEWED_NEIGHBORHOOD_SNAPSHOT_ID,
        snapshotHash: V018_REVIEWED_NEIGHBORHOOD_SNAPSHOT_HASH,
      },
      objects,
      v2Evidence: evidence([
        {
          releaseId: V018_REVIEWED_NEIGHBORHOOD_RELEASE_ID,
          ordinal: 1,
          entityId: target.entityId,
          language: 'zh-CN',
          label: '含饱和环节、二阶环节与积分器的振荡控制系统',
          labelType: 'alternative',
          terminologyAssertionId: 'ctt:admitted-safe-alternative',
          payload: {},
        },
      ]),
    });
    expect(resolveAuthorityLabel(context, target.entityId)).toEqual({
      status: 'available',
      label: target.label,
      aliases: ['含饱和环节、二阶环节与积分器的振荡控制系统'],
    });
  });
});
