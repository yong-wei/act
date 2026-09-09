/**
 * Sealed v0.37 bilingual qualification package (#1741).
 *
 * Publication time: adapt the exact upstream r5 bundle, qualify both locales
 * against the adapter-produced denominators, and freeze manifest + receipts +
 * uncovered dispositions + interface-catalog digest under one envelope.
 * Request time: verify the package seal against the live identity and project
 * bounded shard records — never traverse the full shard set per request.
 */

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { compositeEnvelopeDirectory, loadCompositeEnvelopeRegistry } from '@/lib/actkg-envelope/composite-envelope-registry';
import { resolveActiveShardIdentity } from '@/lib/authority-domain-shards/identity';
import { readCurrentShardPointer, resolveAuthorityDomainShardPaths } from '@/lib/authority-domain-shards/store';

import type {
  AdmittedEnvelopeIdentity,
  AuthorityLocaleManifest,
  ReleaseLocaleQualification,
} from './contracts';
import { localeDigest } from './digest';
import { GRAPH_INTERFACE_CATALOG } from './graph-interface-catalog';
import { qualifyReleaseLocales } from './qualify';
import type { V037UncoveredReport } from './v037-adapter';

export const LOCALE_QUALIFICATION_PACKAGE_CONTRACT =
  'act-authority-locale-qualification-package/v1' as const;

export const LOCALE_MANIFESTS_DIR_RELATIVE =
  'course-content/authoring/knowledge/cutover/envelopes/locale-manifests' as const;

export interface LocaleQualificationPackage {
  readonly contract: typeof LOCALE_QUALIFICATION_PACKAGE_CONTRACT;
  readonly compositeReleaseName: string;
  readonly authority: {
    readonly releaseId: string;
    readonly snapshotId: string;
    readonly snapshotHash: string;
  };
  readonly catalog: { readonly catalogId: string; readonly catalogHash: string };
  readonly shardSet: { readonly shardSetId: string; readonly shardSetHash: string };
  readonly sourceBundle: {
    readonly relativePath: string;
    readonly bundleId: string;
    readonly releaseHash: string;
    readonly sourceTag: string;
  };
  readonly manifest: AuthorityLocaleManifest;
  readonly qualification: ReleaseLocaleQualification;
  readonly uncovered: V037UncoveredReport;
  readonly interfaceCatalogDigest: string;
}

export function localeQualificationPackagePath(compositeName: string): string {
  return path.join(LOCALE_MANIFESTS_DIR_RELATIVE, `${compositeName}.json`);
}

export function readLocaleQualificationPackage(
  repoRoot: string,
  compositeName: string,
): LocaleQualificationPackage | null {
  const filePath = path.join(compositeEnvelopeDirectory(repoRoot), 'locale-manifests', `${compositeName}.json`);
  if (!existsSync(filePath)) return null;
  const parsed = JSON.parse(readFileSync(filePath, 'utf8')) as LocaleQualificationPackage;
  if (parsed.contract !== LOCALE_QUALIFICATION_PACKAGE_CONTRACT) return null;
  return parsed;
}

export function interfaceCatalogDigest(): string {
  return localeDigest(GRAPH_INTERFACE_CATALOG);
}

/**
 * Request-time package verification (#1741): the sealed package must bind the
 * exact live Authority/catalog/shard-set identity and carry a manifest that
 * still qualifies bilingual under its own denominators. Any drift fails
 * closed to the historical capability.
 */
export function verifyLocaleQualificationPackage(input: {
  repoRoot: string;
  package: LocaleQualificationPackage;
}): { ok: true; envelope: AdmittedEnvelopeIdentity; manifest: AuthorityLocaleManifest } | { ok: false; reason: string } {
  const pkg = input.package;
  const active = resolveActiveShardIdentity({ repoRoot: input.repoRoot });
  if (
    pkg.authority.releaseId !== active.envelope.authority.releaseId
    || pkg.authority.snapshotId !== active.envelope.authority.snapshotId
    || pkg.authority.snapshotHash !== active.envelope.authority.snapshotHash
    || pkg.catalog.catalogId !== active.envelope.catalog.catalogId
    || pkg.catalog.catalogHash !== active.envelope.catalog.catalogHash
  ) {
    return { ok: false, reason: 'package authority/catalog identity drifted from the live pointer' };
  }
  const pointer = readCurrentShardPointer(resolveAuthorityDomainShardPaths(input.repoRoot));
  if (
    pkg.shardSet.shardSetId !== pointer.shardSetId
    || pkg.shardSet.shardSetHash !== pointer.shardSetHash
  ) {
    return { ok: false, reason: 'package shard-set identity drifted from the live pointer' };
  }
  const registry = loadCompositeEnvelopeRegistry(input.repoRoot).find((row) => (
    row.name === pkg.compositeReleaseName
    && row.authorityReleaseId === pkg.authority.releaseId
    && row.authoritySnapshotId === pkg.authority.snapshotId
    && row.authoritySnapshotHash === pkg.authority.snapshotHash
  ));
  if (!registry || !registry.qualified) {
    return { ok: false, reason: 'package composite is not a qualified registry envelope' };
  }
  if (pkg.interfaceCatalogDigest !== interfaceCatalogDigest()) {
    return { ok: false, reason: 'interface catalog digest drifted from the compiled catalog' };
  }
  const envelope: AdmittedEnvelopeIdentity = {
    name: registry.name,
    authorityReleaseId: registry.authorityReleaseId,
    authoritySnapshotId: registry.authoritySnapshotId,
    authoritySnapshotHash: registry.authoritySnapshotHash,
  };
  const qualification = qualifyReleaseLocales(pkg.manifest, envelope, pkg.manifest.denominators);
  if (!qualification.bilingualReady) {
    return { ok: false, reason: 'sealed manifest no longer qualifies bilingual under its denominators' };
  }
  return { ok: true, envelope, manifest: pkg.manifest };
}
