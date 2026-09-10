import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { COMPOSITE_ENVELOPE_REGISTRY_RELATIVE, type CompositeEnvelopeRecord } from '@/lib/actkg-envelope/composite-envelope-registry';
import { resolveActiveShardIdentity } from '@/lib/authority-domain-shards/identity';
import { readCurrentShardPointer, resolveAuthorityDomainShardPaths } from '@/lib/authority-domain-shards/store';
import { interfaceCatalogDigest, localeQualificationPackagePath, type LocaleQualificationPackage } from '@/lib/authority-locale-readiness/qualification-package';
import { qualifyReleaseLocales } from '@/lib/authority-locale-readiness/qualify';
import { resolveActiveConsumerActivation, resolveConsumerActivationStorePaths } from '@/lib/versioned-knowledge-activation/store';
import { assertKnowledgePublicationConsistency } from './assert-knowledge-publication-consistency';

const root = process.cwd();
const json = <T>(relative: string): T => JSON.parse(readFileSync(join(root, relative), 'utf8')) as T;
const registry = json<{ contract: string; envelopes: CompositeEnvelopeRecord[] }>(COMPOSITE_ENVELOPE_REGISTRY_RELATIVE);
const active = resolveActiveShardIdentity({ repoRoot: root });
const shard = readCurrentShardPointer(resolveAuthorityDomainShardPaths(root));
const course = json<{ projectionId: string; projectionHash: string }>('course-content/runtime/knowledge/projection/current.json');
const courseManifest = json<{ authoringRevision: string }>('course-content/runtime/knowledge/projection/releases/' + course.projectionId + '/projection-manifest.json');
const prerequisite = json<{ publicationId: string; publicationHash: string }>('course-content/runtime/knowledge/prerequisites/current.json');
const consumers = resolveActiveConsumerActivation(resolveConsumerActivationStorePaths(join(root, 'course-content/runtime/knowledge/consumer-activation')));
if (consumers.status !== 'available' || !consumers.manifest || consumers.manifest.impact.readyConsumerIds.length !== 6) throw new Error('six-consumer activation is not qualified');
for (const consumer of consumers.manifest.consumers) {
  if (consumer.combination?.authoritySnapshotHash !== active.envelope.authority.snapshotHash
    || (consumer.combination.projectionId && consumer.combination.projectionId !== course.projectionId)) throw new Error('consumer combination differs from candidate');
}
const selected = registry.envelopes.find((row) => row.authorityReleaseId === active.envelope.authority.releaseId);
if (!selected) throw new Error('candidate release is not registered');
const pkg = json<LocaleQualificationPackage>(localeQualificationPackagePath(selected.name));
if (pkg.authority.snapshotHash !== active.envelope.authority.snapshotHash
  || pkg.catalog.catalogHash !== active.envelope.catalog.catalogHash
  || pkg.shardSet.shardSetHash !== shard.shardSetHash
  || pkg.interfaceCatalogDigest !== interfaceCatalogDigest()) throw new Error('locale package does not bind final candidate');
const qualification = qualifyReleaseLocales(pkg.manifest, { name: selected.name,
  authorityReleaseId: active.envelope.authority.releaseId, authoritySnapshotId: active.envelope.authority.snapshotId,
  authoritySnapshotHash: active.envelope.authority.snapshotHash }, pkg.manifest.denominators);
if (!qualification.bilingualReady) throw new Error('candidate is not bilingual');
Object.assign(selected, {
  authoritySnapshotId: active.envelope.authority.snapshotId, authoritySnapshotHash: active.envelope.authority.snapshotHash,
  projectionId: course.projectionId, projectionHash: course.projectionHash,
  publicationId: prerequisite.publicationId, publicationHash: prerequisite.publicationHash,
  catalogId: active.envelope.catalog.catalogId, catalogHash: active.envelope.catalog.catalogHash,
  shardSetId: shard.shardSetId, shardSetHash: shard.shardSetHash,
  activationId: consumers.manifest.activationId, activationHash: consumers.manifest.activationHash,
});
const out = join(root, 'course-content/runtime/knowledge/composite-envelopes');
mkdirSync(join(out, 'locale-manifests'), { recursive: true });
writeFileSync(join(out, 'actkg-composite-envelope-registry.json'), JSON.stringify(registry, null, 2) + '\n');
writeFileSync(join(out, 'locale-manifests', selected.name + '.json'), JSON.stringify(pkg, null, 2) + '\n');
assertKnowledgePublicationConsistency(
  (relative) => readFileSync(join(root, relative), 'utf8'),
  (relative) => execFileSync('git', ['show', courseManifest.authoringRevision + ':' + relative], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }),
);
console.log(JSON.stringify({ composite: selected.name, authoringRevision: courseManifest.authoringRevision,
  snapshotId: selected.authoritySnapshotId, projectionId: selected.projectionId, publicationId: selected.publicationId,
  shardSetId: selected.shardSetId, activationId: selected.activationId, bilingualReady: true, resourceContinuity: 'passed' }));
