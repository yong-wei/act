#!/usr/bin/env tsx
/**
 * Build the sealed v0.37 bilingual qualification package (#1741).
 *
 * One-shot qualification-time tool: adapt the exact upstream r5 bundle,
 * qualify both locales, and freeze the package under
 * cutover/envelopes/locale-manifests/control-theory-engineering-v0.37.json.
 * Runtime requests only read and verify this sealed package.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { resolveActiveShardIdentity } from '@/lib/authority-domain-shards/identity';
import { readCurrentShardPointer, resolveAuthorityDomainShardPaths } from '@/lib/authority-domain-shards/store';
import { loadActivePresentationInventory } from '@/lib/authority-locale-readiness/active-presentation-inventory';
import { loadCompositeEnvelopeRegistry } from '@/lib/actkg-envelope/composite-envelope-registry';
import {
  adaptV037LocaleManifest,
  V037_BILINGUAL_BUNDLE_RELATIVE,
} from '@/lib/authority-locale-readiness/v037-adapter';
import { qualifyReleaseLocales } from '@/lib/authority-locale-readiness/qualify';
import {
  interfaceCatalogDigest,
  LOCALE_MANIFESTS_DIR_RELATIVE,
  localeQualificationPackagePath,
  LOCALE_QUALIFICATION_PACKAGE_CONTRACT,
} from '@/lib/authority-locale-readiness/qualification-package';

const ROOT = process.cwd();
const COMPOSITE_NAME = 'control-theory-engineering-v0.37';

const active = resolveActiveShardIdentity({ repoRoot: ROOT });
const registry = loadCompositeEnvelopeRegistry(ROOT).find((row) => row.name === COMPOSITE_NAME);
if (!registry || !registry.qualified) {
  throw new Error(`composite envelope ${COMPOSITE_NAME} is not registered as qualified`);
}
const pointer = readCurrentShardPointer(resolveAuthorityDomainShardPaths(ROOT));

const inventory = loadActivePresentationInventory(ROOT, active);
const { manifest, uncovered } = adaptV037LocaleManifest({
  repoRoot: ROOT,
  envelope: {
    compositeReleaseName: COMPOSITE_NAME,
    authorityReleaseId: active.envelope.authority.releaseId,
    authoritySnapshotId: active.envelope.authority.snapshotId,
    authoritySnapshotHash: active.envelope.authority.snapshotHash,
  },
  inventory,
});

const envelope = {
  name: COMPOSITE_NAME,
  authorityReleaseId: active.envelope.authority.releaseId,
  authoritySnapshotId: active.envelope.authority.snapshotId,
  authoritySnapshotHash: active.envelope.authority.snapshotHash,
};
const qualification = qualifyReleaseLocales(manifest, envelope, manifest.denominators);
if (!qualification.chineseReady || !qualification.bilingualReady || !qualification.interfaceCatalogReady) {
  const failures = [...(qualification.zhCN?.failures ?? []), ...(qualification.en?.failures ?? [])];
  throw new Error(`v0.37 bilingual qualification failed: ${JSON.stringify(failures.slice(0, 5))}`);
}

const upstreamManifest = JSON.parse(readFileSync(
  path.join(ROOT, V037_BILINGUAL_BUNDLE_RELATIVE, 'locale-manifest.json'),
  'utf8',
)) as { release: { hash: string }; bundle_id?: string; release_id?: string };

const pkg = {
  contract: LOCALE_QUALIFICATION_PACKAGE_CONTRACT,
  compositeReleaseName: COMPOSITE_NAME,
  authority: {
    releaseId: active.envelope.authority.releaseId,
    snapshotId: active.envelope.authority.snapshotId,
    snapshotHash: active.envelope.authority.snapshotHash,
  },
  catalog: {
    catalogId: active.envelope.catalog.catalogId,
    catalogHash: active.envelope.catalog.catalogHash,
  },
  shardSet: { shardSetId: pointer.shardSetId, shardSetHash: pointer.shardSetHash },
  sourceBundle: {
    relativePath: V037_BILINGUAL_BUNDLE_RELATIVE,
    bundleId: upstreamManifest.bundle_id ?? 'ctb:control-theory-engineering-v0.37:r5',
    releaseHash: upstreamManifest.release.hash,
    sourceTag: 'control-theory-engineering-v0.37-source-r6',
  },
  manifest,
  qualification,
  uncovered,
  interfaceCatalogDigest: interfaceCatalogDigest(),
};

const outPath = path.join(ROOT, localeQualificationPackagePath(COMPOSITE_NAME));
mkdirSync(path.join(ROOT, LOCALE_MANIFESTS_DIR_RELATIVE), { recursive: true });
writeFileSync(outPath, `${JSON.stringify(pkg, null, 2)}\n`);

console.log(JSON.stringify({
  written: localeQualificationPackagePath(COMPOSITE_NAME),
  bytes: JSON.stringify(pkg).length,
  records: manifest.records.length,
  denominators: manifest.denominators.map((row) => `${row.category}:${row.recordIds.length}`),
  uncoveredNames: uncovered.objectNames.length,
  uncoveredExplanations: uncovered.objectExplanations.length,
  bilingualReady: qualification.bilingualReady,
}, null, 2));
