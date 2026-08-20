import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  V022_ADMISSION_RECEIPT_REVISION,
  V022_AUTHORITY_RELEASE_ID,
  V022_CANDIDATE_RECEIPT_RELATIVE,
  V022_CAPTURE_REVISION,
  V022_MULTILINGUAL_LABEL_COUNT,
  V022_REVIEWED_DOMAIN_PRESENTATION,
  V022_SNAPSHOT_ID,
  assertSameV022Envelope,
  buildV022DomainCatalogAuthoring,
  domainIdFromModuleVersion,
  loadPinnedV022Envelope,
} from '@/lib/actkg-v022-display-projections';
import {
  REGISTERED_PEER_DOMAIN_IDS,
  buildAuthorityDomainCatalog,
} from '@/lib/authority-domain-catalog';

describe('actkg v0.22 display projections', () => {
  it('pins one composite envelope and refuses latest mixing', () => {
    const envelope = loadPinnedV022Envelope(process.cwd());
    expect(envelope.releaseId).toBe(V022_AUTHORITY_RELEASE_ID);
    expect(envelope.snapshotId).toBe(V022_SNAPSHOT_ID);
    expect(envelope.captureRevision).toBe(V022_CAPTURE_REVISION);
    expect(envelope.multilingualLabelCount).toBe(V022_MULTILINGUAL_LABEL_COUNT);
    expect(envelope.integrationVersion).toBe('control-theory-integration-v0.20');
    expect(envelope.terminologyVersion).toBe('control-theory-zh-cn-terminology-v0.5');
    expect(envelope.multilingualLabelCount).not.toBe(1909);
    assertSameV022Envelope(envelope, envelope);
    expect(() => assertSameV022Envelope(envelope, {
      ...envelope,
      releaseId: 'ctr:release:control-theory-engineering-v0.18' as typeof envelope.releaseId,
    })).toThrow(/share one pinned v0.22 envelope/);
  });

  it('derives domain ids from module versions without a hard-coded count', () => {
    expect(domainIdFromModuleVersion('system-modeling-engineering-v0.1')).toBe('system-modeling');
    expect(domainIdFromModuleVersion(
      'optimal-control-foundations-and-linear-quadratic-design-engineering-v0.1',
    )).toBe('optimal-control-foundations-and-linear-quadratic-design');
    const components = JSON.parse(readFileSync(path.join(
      'course-content/authoring/knowledge/releases/control-theory-engineering-v0.22-r5',
      'component-releases.json',
    ), 'utf8')) as { components: Array<{ component_role: string; release_version: string }> };
    const moduleDomainIds = components.components
      .filter((row) => row.component_role === 'module')
      .map((row) => domainIdFromModuleVersion(row.release_version));
    expect(V022_REVIEWED_DOMAIN_PRESENTATION.map((row) => row.domainId)).toEqual(moduleDomainIds);
    expect(moduleDomainIds).not.toEqual([...REGISTERED_PEER_DOMAIN_IDS]);
  });

  it('rebuilds many-to-many membership covering every published v0.22 concept', () => {
    const envelope = loadPinnedV022Envelope(process.cwd());
    const built = buildV022DomainCatalogAuthoring({ repoRoot: process.cwd(), envelope });
    expect(built.runtime.domains.map((row) => row.domainId)).toEqual(
      V022_REVIEWED_DOMAIN_PRESENTATION.map((row) => row.domainId),
    );
    expect(built.runtime.aggregate.domainCount).toBe(built.runtime.domains.length);
    expect(built.runtime.aggregate.domainCount).not.toBe(REGISTERED_PEER_DOMAIN_IDS.length);
    expect(built.orphanCount).toBe(0);
    expect(built.publishedConceptCount).toBe(built.runtime.memberships.length);
    expect(built.runtime.authorityBinding.releaseId).toBe(V022_AUTHORITY_RELEASE_ID);
    expect(built.runtime.authorityBinding.snapshotId).toBe(V022_SNAPSHOT_ID);
    for (const domain of built.runtime.domains) {
      expect(domain.memberCount).toBeGreaterThan(0);
      expect(domain.displayName).not.toMatch(/ctr:|snap-|adc-/);
    }
    const rebuilt = buildAuthorityDomainCatalog(
      built.authoring,
      built.runtime.memberships.map((row) => ({ canonicalId: row.canonicalId })),
    );
    expect(rebuilt.catalogHash).toBe(built.runtime.catalogHash);
  });

  it('keeps the served v0.9 production catalog bytes untouched as a prior catalog', () => {
    const production = JSON.parse(readFileSync(
      'course-content/authoring/knowledge/authority-domain-catalog/catalog.json',
      'utf8',
    )) as { authorityBinding: { releaseId: string }; domains: unknown[] };
    expect(production.authorityBinding.releaseId).toBe('ctr:release:control-theory-engineering-v0.9');
    expect(production.domains).toHaveLength(8);
  });

  it('keeps the sealed v0.18 label count from leaking into v0.22', () => {
    expect(V022_MULTILINGUAL_LABEL_COUNT).toBe(2148);
    expect(V022_MULTILINGUAL_LABEL_COUNT).not.toBe(1909);
  });

  it('loads one admitted receipt for snapshot, capture, and mirror files', () => {
    const envelope = loadPinnedV022Envelope(process.cwd());
    const gitReceipt = JSON.parse(execFileSync(
      'git',
      ['show', `${V022_ADMISSION_RECEIPT_REVISION}:${V022_CANDIDATE_RECEIPT_RELATIVE}`],
      { cwd: process.cwd(), encoding: 'utf8' },
    )) as {
      captureRevision: string;
      mirror: { files: Array<{ path: string; rawSha256: string; gitObject: string }> };
      replays: Array<{ snapshotId: string }>;
      validated: { bundleDigest: string };
    };
    expect(envelope.captureRevision).toBe(V022_CAPTURE_REVISION);
    expect(gitReceipt.captureRevision).toBe(V022_CAPTURE_REVISION);
    expect(gitReceipt.captureRevision).not.toBe(V022_ADMISSION_RECEIPT_REVISION);
    expect(gitReceipt.replays[0]?.snapshotId).toBe(V022_SNAPSHOT_ID);
    expect(gitReceipt.validated.bundleDigest).toBe(envelope.bundleDigest);
    expect(gitReceipt.mirror.files.length).toBeGreaterThan(0);
  });
});
