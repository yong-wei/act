import type { CompositeEnvelopeRecord } from '@/lib/actkg-envelope/composite-envelope-registry';
import type { AuthorityShardSetManifest, AuthorityShardCurrentPointer, AuthorityDomainDefaultShard } from '@/lib/authority-domain-shards/contracts';
import type { LocaleQualificationPackage } from '@/lib/authority-locale-readiness/qualification-package';
import { interfaceCatalogDigest } from '@/lib/authority-locale-readiness/qualification-package';
import { qualifyReleaseLocales } from '@/lib/authority-locale-readiness/qualify';
import { shardDigest, shardSha256 } from '@/lib/authority-domain-shards/hash';

/** Read only frozen revisions, never the publisher's dirty workspace. */
export function assertKnowledgePublicationConsistency(
  read: (relative: string) => string,
  readBaseline: (relative: string) => string = read,
): void {
  const root = 'course-content/runtime/knowledge';
  const json = <T>(relative: string): T => JSON.parse(read(root + '/' + relative)) as T;
  const check = (condition: unknown, reason: string): void => {
    if (!condition) throw new Error('Knowledge publication mismatch: ' + reason);
  };
  const course = json<{ projectionId: string; projectionHash: string }>('projection/current.json');
  const courseManifest = json<{ authoringRevision: string; authorityReleaseId: string; authoritySnapshotId: string; authoritySnapshotHash: string; projectionHash: string; gatePassed: boolean }>(
    'projection/releases/' + course.projectionId + '/projection-manifest.json');
  check(courseManifest.gatePassed && courseManifest.projectionHash === course.projectionHash, 'course projection gate');
  const overlay = json<{ projectionId: string; projectionHash: string }>('teaching-projection/domain-fragments/current.json');
  const overlayRoot = 'teaching-projection/domain-fragments/releases/' + overlay.projectionId;
  const composed = json<{ projectionHash: string; authoringRevision: string; authorityBinding: { snapshotHash: string } }>(overlayRoot + '/composed-manifest.json');
  check(composed.projectionHash === overlay.projectionHash
    && composed.authorityBinding.snapshotHash === courseManifest.authoritySnapshotHash, 'domain teaching projection');
  const sidecar = json<{ envelopeProjectionId: string; envelopeProjectionHash: string; courseProjectionId: string; courseProjectionHash: string }>(overlayRoot + '/inspector-sidecar.json');
  check(sidecar.envelopeProjectionId === overlay.projectionId && sidecar.envelopeProjectionHash === overlay.projectionHash
    && sidecar.courseProjectionId === course.projectionId && sidecar.courseProjectionHash === course.projectionHash, 'inspector resource sidecar');
  const shard = json<AuthorityShardCurrentPointer>('authority-domain-shards/current.json');
  const shardRoot = 'authority-domain-shards/sets/' + shard.shardSetId;
  const shards = json<AuthorityShardSetManifest>(shardRoot + '/manifest.json');
  check(shard.snapshotHash === courseManifest.authoritySnapshotHash
    && shards.shardSetHash === shard.shardSetHash
    && shardDigest({ envelope: shards.envelope, files: shards.files }) === shard.shardSetHash
    && shards.envelope.teaching.projectionHash === overlay.projectionHash, 'sealed domain shard teaching identity');
  const prereq = json<{ publicationId: string; publicationHash: string }>('prerequisites/current.json');
  const rows = (bytes: string): Array<Record<string, unknown>> => bytes.split('\n').filter((line) => line.trim()).map((line) => JSON.parse(line));
  const tuple = (row: Record<string, unknown>, fields: readonly string[]) => JSON.stringify(fields.map((field) => row[field] ?? null));
  const baseline = JSON.parse(readBaseline(root + '/projection/current.json')) as { projectionId: string };
  const baselineBindings = rows(readBaseline(root + '/projection/releases/' + baseline.projectionId + '/bindings.jsonl'));
  const candidateBindings = rows(read(root + '/projection/releases/' + course.projectionId + '/bindings.jsonl'));
  const candidateResourceIds = new Set(rows(read(root + '/projection/releases/' + course.projectionId + '/resources.jsonl')).map((row) => row.resourceId));
  const retiredUnboundInfographic = (row: Record<string, unknown>): boolean => {
    if (row.resourceType !== 'infographic' || row.projectionStatus !== 'EXPLICIT_NONE' || row.bindingCount !== 0
      || candidateResourceIds.has(row.resourceId)
      || [...baselineBindings, ...candidateBindings].some((binding) => binding.resourceId === row.resourceId)) return false;
    try {
      // This ruling is part of the frozen application input, not a publisher-provided exemption.
      const ruling = JSON.parse(readBaseline('course-content/authoring/knowledge/cutover/candidates/control-theory-engineering-v0.37-r6/domain-catalog/retirement-ruling.json')) as {
        contract: string; snapshotId: string; retiredMembers: string[];
      };
      const baselineManifest = JSON.parse(readBaseline(root + '/projection/releases/' + baseline.projectionId + '/projection-manifest.json')) as {
        authoritySnapshotId: string; authorityReleaseId: string;
      };
      return ruling.contract === 'act-authority-domain-catalog-retirement-ruling/v1'
        && ruling.snapshotId === baselineManifest.authoritySnapshotId
        && baselineManifest.authorityReleaseId === courseManifest.authorityReleaseId
        && ruling.retiredMembers.some((id) => row.resourceId === 'act:infographic:' + id.replaceAll(':', '_'));
    } catch {
      return false;
    }
  };
  for (const [file, fields] of [
    ['resources.jsonl', ['resourceId', 'resourceType', 'sourcePath']],
    ['bindings.jsonl', ['resourceId', 'canonicalId', 'role', 'scopeId', 'primary', 'sourcePath']],
  ] as const) {
    const before = rows(readBaseline(root + '/projection/releases/' + baseline.projectionId + '/' + file));
    const after = new Set(rows(read(root + '/projection/releases/' + course.projectionId + '/' + file)).map((row) => tuple(row, fields)));
    check(before.every((row) => after.has(tuple(row, fields))
      || file === 'resources.jsonl' && retiredUnboundInfographic(row)), 'retained resource continuity: ' + file);
  }
  const prereqFields = ['sourceCanonicalId', 'targetCanonicalId', 'strength', 'scopeId'];
  const publishedPrerequisites = json<Array<Record<string, unknown>>>('prerequisites/releases/' + prereq.publicationId + '/projection-prerequisites.json');
  const coursePrerequisites = rows(read(root + '/projection/releases/' + course.projectionId + '/prerequisites.jsonl'));
  const publishedPairs = new Set(publishedPrerequisites.map((row) => tuple(row, prereqFields)));
  const coursePairs = new Set(coursePrerequisites.map((row) => tuple(row, prereqFields)));
  check(publishedPairs.size === coursePairs.size && [...publishedPairs].every((key) => coursePairs.has(key)), 'course and path prerequisite publication');
  const registry = json<{ envelopes: CompositeEnvelopeRecord[] }>('composite-envelopes/actkg-composite-envelope-registry.json');
  const matches = registry.envelopes.filter((row) => row.qualified
    && row.authoritySnapshotHash === courseManifest.authoritySnapshotHash
    && row.projectionId === course.projectionId && row.projectionHash === course.projectionHash
    && row.publicationId === prereq.publicationId && row.publicationHash === prereq.publicationHash
    && row.shardSetId === shard.shardSetId && row.shardSetHash === shard.shardSetHash);
  check(matches.length === 1, 'qualified composite registry');
  const selected = matches[0]!;
  const pkg = json<LocaleQualificationPackage>('composite-envelopes/locale-manifests/' + selected.name + '.json');
  check(pkg.shardSet.shardSetHash === shard.shardSetHash
    && pkg.authority.snapshotHash === courseManifest.authoritySnapshotHash
    && pkg.interfaceCatalogDigest === interfaceCatalogDigest(), 'locale package final shard or interface binding');
  check(qualifyReleaseLocales(pkg.manifest, { name: selected.name, authorityReleaseId: selected.authorityReleaseId,
    authoritySnapshotId: selected.authoritySnapshotId, authoritySnapshotHash: selected.authoritySnapshotHash },
  pkg.manifest.denominators).bilingualReady, 'bilingual qualification');
  for (const [relative, hash] of Object.entries(shards.files)) {
    if (!relative.startsWith('domains/') || relative.split('/').length !== 3 || !relative.endsWith('/default.json')) continue;
    const bytes = read(root + '/' + shardRoot + '/' + relative);
    check(shardSha256(bytes) === hash, 'domain payload digest');
    const domain = JSON.parse(bytes) as AuthorityDomainDefaultShard;
    check(domain.teachingCoverage.relationCount === domain.teachingRelations.length, 'delivered teaching coverage count');
    const endpointIds = new Set([...domain.objects, ...(domain.teachingBoundaryObjects ?? [])].map((row) => row.id));
    check(domain.teachingRelations.every((edge) => endpointIds.has(edge.sourceId) && endpointIds.has(edge.targetId)), 'teaching endpoint closure');
    const familyPath = relative.replace(/default.json$/, 'families/prerequisite-order.json');
    check(Boolean(shards.files[familyPath]), 'published engineering prerequisite family');
  }
  const coverage = json<{ projectionHash: string; fullCourseCoverage: boolean }>('course-order/coverage.json');
  check(coverage.projectionHash === overlay.projectionHash, 'course coverage proof');
}
