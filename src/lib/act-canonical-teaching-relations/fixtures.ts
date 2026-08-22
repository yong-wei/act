import type { AuthorityDomainCatalogRuntime } from '@/lib/authority-domain-catalog/contracts';
import { AUTHORITY_DOMAIN_CATALOG_RUNTIME_CONTRACT } from '@/lib/authority-domain-catalog/contracts';
import { AUTHORITY_DOMAIN_CATALOG_BUILDER_VERSION } from '@/lib/authority-domain-catalog/contracts';

import type { ActTeachingAuthorityIdentity } from './contracts';
import type { GoldRelationItem, QualificationDataset } from './qualify';

export const FIXTURE_AUTHORITY: ActTeachingAuthorityIdentity = {
  releaseId: 'ctr:release:control-theory-engineering-v0.22',
  snapshotId: 'snap-9c4b2c1c2c976b4903bb979889d8b74a8dd306bc718cd4c9d06ac97b14172151',
  snapshotHash: '9c4b2c1c2c976b4903bb979889d8b74a8dd306bc718cd4c9d06ac97b14172151',
  releaseSetId: 'actkg-authority-candidate-v018-98f2d5b183f9c0e632e3e020fe45111140f00b935450189edf0869375ef45854',
};

export function fixtureCatalog(input: {
  catalogId?: string;
  catalogHash?: string;
  members: Array<{ canonicalId: string; domainId: string }>;
  extraDomains?: Array<{ domainId: string; displayName: string }>;
  authority?: ActTeachingAuthorityIdentity;
}): AuthorityDomainCatalogRuntime {
  const authority = input.authority ?? FIXTURE_AUTHORITY;
  const domainIds = [...new Set(input.members.map((row) => row.domainId))];
  return {
    contract: AUTHORITY_DOMAIN_CATALOG_RUNTIME_CONTRACT,
    catalogId: input.catalogId ?? 'adc-fixture',
    catalogHash: input.catalogHash ?? 'a'.repeat(64),
    catalogVersion: 'fixture',
    builderVersion: AUTHORITY_DOMAIN_CATALOG_BUILDER_VERSION,
    authorityBinding: {
      snapshotId: authority.snapshotId,
      snapshotHash: authority.snapshotHash,
      releaseId: authority.releaseId,
      releaseSetId: authority.releaseSetId,
    },
    domains: [
      ...domainIds.map((domainId, order) => ({
        domainId,
        order,
        displayName: domainId,
        summary: domainId,
        presentationRole: 'domain' as const,
        visualRole: 'modeling' as const,
        memberCount: input.members.filter((row) => row.domainId === domainId).length,
      })),
      ...(input.extraDomains ?? []).map((domain, index) => ({
        domainId: domain.domainId,
        order: domainIds.length + index,
        displayName: domain.displayName,
        summary: domain.displayName,
        presentationRole: 'domain' as const,
        visualRole: 'modeling' as const,
        memberCount: 0,
      })),
    ],
    aggregate: {
      entryId: 'control-theory-integration',
      order: 0,
      displayName: '综合',
      summary: '导航入口',
      presentationRole: 'aggregate',
      visualRole: 'aggregate',
      domainCount: domainIds.length,
    },
    memberships: input.members.map((row) => ({
      canonicalId: row.canonicalId,
      domainIds: [row.domainId],
      preferredDomainId: row.domainId,
    })),
  };
}

export const FIXTURE_CONTAINMENT_EVIDENCE = {
  courseRootIds: ['ctc:a'],
  parents: [
    {
      childCanonicalId: 'ctc:b',
      parentCanonicalId: 'ctc:a',
      evidenceRefs: ['evidence:handout-a-contains-b'],
    },
    {
      childCanonicalId: 'ctc:c',
      parentCanonicalId: 'ctc:a',
      evidenceRefs: ['evidence:handout-a-contains-c'],
    },
  ],
} as const;

export function representativeGold(): QualificationDataset {
  const items: GoldRelationItem[] = [
    {
      id: 'gold-root-a',
      family: 'containment',
      relationType: 'CONTAINMENT',
      sourceCanonicalId: 'ctc:a',
      targetCanonicalId: null,
      expected: 'admit',
    },
    {
      id: 'gold-parent-b',
      family: 'containment',
      relationType: 'CONTAINMENT',
      sourceCanonicalId: 'ctc:b',
      targetCanonicalId: 'ctc:a',
      expected: 'admit',
    },
    {
      id: 'gold-cycle',
      family: 'prerequisite',
      relationType: 'PREREQUISITE',
      sourceCanonicalId: 'ctc:a',
      targetCanonicalId: 'ctc:a',
      expected: 'exclude',
    },
    {
      id: 'gold-low-conf',
      family: 'association',
      relationType: 'PEDAGOGICAL_ASSOCIATION',
      sourceCanonicalId: 'ctc:a',
      targetCanonicalId: 'ctc:b',
      expected: 'exclude',
    },
  ];
  return { name: 'gold', items };
}

export function representativeHoldout(): QualificationDataset {
  return {
    name: 'holdout',
    items: [
      {
        id: 'holdout-parent-c',
        family: 'containment',
        relationType: 'CONTAINMENT',
        sourceCanonicalId: 'ctc:c',
        targetCanonicalId: 'ctc:a',
        expected: 'admit',
      },
      {
        id: 'holdout-weak',
        family: 'prerequisite',
        relationType: 'PREREQUISITE',
        sourceCanonicalId: 'ctc:c',
        targetCanonicalId: 'ctc:a',
        expected: 'exclude',
      },
    ],
  };
}
