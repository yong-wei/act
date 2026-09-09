#!/usr/bin/env tsx
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { verifyMaterializedSnapshot, type AuthorityEngineeringBody, type AuthoritySnapshotManifest } from '@/lib/authoritative-knowledge/authority-snapshot';
import { createDomainTeachingAuthorityEnvelope, authoritySelectionFromEnvelope } from '@/lib/teaching-projection/domain-fragments/validate';
import { buildDomainTeachingFragment } from '@/lib/teaching-projection/domain-fragments/builder';
import { composeDomainTeachingProjection } from '@/lib/teaching-projection/domain-fragments/compose';
import { teachingCacheFamilyFor } from '@/lib/teaching-projection/domain-fragments/activation';
import { adoptEngineeringLearningOrder } from '@/lib/teaching-projection/prerequisites/adopt-engineering-learning-order';
import { writeDomainTeachingRuntime } from '@/lib/authority-domain-shards/stage-domain-teaching-runtime';
import { readCatalogDomainKeys } from '@/lib/teaching-projection/domain-fragments/build-overview-teaching-order';
import { COURSE_ORDER_RELATIVE, readCourseOrderInputs, readRetainedCourseRelations, validateCourseOrderDecisions } from '@/lib/teaching-projection/domain-fragments/course-prerequisite-decisions';
import type { DomainFragmentRelationAuthoring, DomainTeachingFragmentAuthoring } from '@/lib/teaching-projection/domain-fragments/contracts';

const root = process.cwd();
const json = <T>(relative: string): T => JSON.parse(readFileSync(join(root, relative), 'utf8')) as T;
const input = readCourseOrderInputs(root);
const snapshotDir = `course-content/authoring/knowledge/authority/releases/${input.manifest.authority.snapshotId}`;
const manifest = json<AuthoritySnapshotManifest>(`${snapshotDir}/manifest.json`);
const engineering = json<AuthorityEngineeringBody>(`${snapshotDir}/engineering.json`);
verifyMaterializedSnapshot({ manifest, engineering });
if (manifest.snapshotHash !== input.manifest.authority.snapshotHash || manifest.releaseId !== input.manifest.authority.releaseId) {
  throw new Error('course-order: Authority capture changed');
}
const locale = json<{ manifest: { records: Array<{ locale: string; category: string; recordId: string; value: string }> } }>(
  'course-content/authoring/knowledge/cutover/envelopes/locale-manifests/control-theory-engineering-v0.37.json',
);
const names = new Map(locale.manifest.records.filter((row) => row.locale === 'zh-CN' && row.category === 'object-names').map((row) => [row.recordId, row.value]));
const definitions = new Map(locale.manifest.records.filter((row) => row.locale === 'zh-CN' && row.category === 'object-explanations').map((row) => [row.recordId, row.value]));
const objects = engineering.objects.map((object) => {
  const payload = object.payload as { displayName?: string; payload?: { description?: string } };
  return { id: object.canonicalId, type: object.canonicalType,
    name: names.get(object.canonicalId) ?? payload.displayName ?? object.semanticName ?? '',
    definition: definitions.get(object.canonicalId) ?? payload.payload?.description ?? '' };
});
const validation = validateCourseOrderDecisions(input, objects);
const memberships = readCatalogDomainKeys(root);
const domainsFor = (id: string) => {
  const domains = memberships.get(id);
  if (!domains?.length) throw new Error(`course-order: no registered domain for ${id}`);
  return domains;
};
const retained = readRetainedCourseRelations(root, input.manifest);
const relations = new Map<string, DomainFragmentRelationAuthoring>();
const add = (relation: DomainFragmentRelationAuthoring) => {
  const key = `${relation.sourceNodeId}:${relation.targetNodeId}:${relation.relationType}:${relation.strength}`;
  const previous = relations.get(key);
  const domainKeys = [...new Set([...domainsFor(relation.sourceNodeId), ...domainsFor(relation.targetNodeId)])];
  relations.set(key, previous ? {
    ...previous,
    evidenceRefs: [...new Set([...previous.evidenceRefs, ...relation.evidenceRefs])],
    domainKeys,
  } : { ...relation, domainKeys });
};
retained.forEach(add);
for (const edge of validation.edges) add({
  sourceNodeId: edge.sourceId, targetNodeId: edge.targetId,
  relationType: 'PREREQUISITE', strength: edge.decision.strength, domainKeys: [],
  evidenceRefs: [...edge.decision.evidenceRefs, `${COURSE_ORDER_RELATIVE}/dependencies.jsonl`],
  curatorId: 'course-plan-authoring', curatorRationale: edge.decision.rationale,
  authorDecisionId: edge.decision.decisionId,
});
const coreIds = [...new Set([...relations.values()].flatMap((relation) => [relation.sourceNodeId, relation.targetNodeId]))];
const revisionFlag = process.argv.indexOf('--authoring-revision');
const revision = revisionFlag >= 0 ? process.argv[revisionFlag + 1] : execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
if (!/^[a-f0-9]{40}$/.test(revision ?? '')) throw new Error('course-order: a full authoring revision is required');
const authority = createDomainTeachingAuthorityEnvelope({
  binding: input.manifest.authority,
  sourceDatasetHash: manifest.sourceDatasetHash,
  captureRevision: manifest.captureRevision,
  authoringRevision: revision,
  nodes: engineering.objects.map((object) => ({ canonicalId: object.canonicalId, lifecycleStatus: object.lifecycleStatus ?? 'active' })),
});
const authoring: DomainTeachingFragmentAuthoring = {
  contract: 'act-domain-teaching-fragment/v1', fragmentKey: 'course-plan-teaching-order-v1', fragmentVersion: '1',
  domainKeys: [...new Set(coreIds.flatMap(domainsFor))], authorityBinding: authority.binding,
  authoritySelection: authoritySelectionFromEnvelope(authority), authoringRevision: revision,
  evidenceRefs: [`${COURSE_ORDER_RELATIVE}/manifest.json`, `${COURSE_ORDER_RELATIVE}/dependencies.jsonl`],
  coreNodes: coreIds.map((canonicalId) => {
    const topic = input.topics.find((topic) => topic.canonicalIds.includes(canonicalId));
    return { canonicalId, domainKeys: domainsFor(canonicalId), pathEligible: true, cardPolicy: 'OPTIONAL',
      moduleId: topic ? `module-${topic.units[0][0]}` : null,
      rationale: topic?.rationale ?? '保留已发布课程先后修的端点。', sourceKind: 'PREREQUISITE_ENDPOINT',
      sourceEvidence: topic?.evidenceRefs ?? input.manifest.retainedSources.map((source) => source.path) };
  }),
  relations: [...relations.values()],
};
let fragment = buildDomainTeachingFragment(authoring, authority);
const adoption = adoptEngineeringLearningOrder({
  relations: engineering.relations.filter((relation) => relation.relationType === 'prerequisite' && relation.direct === true)
    .map((relation) => ({ id: relation.relationId, predicate: relation.relationType, sourceId: relation.sourceId, targetId: relation.targetId })),
  teachingEdges: fragment.relations,
  coreNodeIds: new Set(coreIds), authorityIds: new Set(objects.map((object) => object.id)),
  scopeId: 'course-plan', authorityReleaseId: manifest.releaseId, projectionCaptureId: null,
  authoringRevision: revision, snapshotHash: manifest.snapshotHash,
});
if (adoption.adoptedEdges.length) {
  fragment = buildDomainTeachingFragment({ ...authoring, relations: [
    ...authoring.relations,
    ...adoption.adoptedEdges.map((edge) => ({
      sourceNodeId: edge.sourceNodeId, targetNodeId: edge.targetNodeId,
      relationType: 'PREREQUISITE' as const, strength: edge.strength,
      domainKeys: [...new Set([...domainsFor(edge.sourceNodeId), ...domainsFor(edge.targetNodeId)])],
      evidenceRefs: edge.evidenceRefs, curatorId: edge.curatorId,
      curatorRationale: edge.curatorRationale, authorDecisionId: edge.authorDecisionId,
    })),
  ] }, authority);
}
const artifacts = composeDomainTeachingProjection({ fragments: [fragment], authority, authoringRevision: revision });
const report = { ...validation.report, retainedRelationCount: retained.length,
  engineeringDispositions: adoption.receipts.reduce<Record<string, number>>((counts, row) => {
    counts[row.disposition] = (counts[row.disposition] ?? 0) + 1;
    return counts;
  }, {}),
  publishedCanonicalCount: artifacts.coreNodes.length,
  publishedRelationCount: artifacts.relations.length, projectionId: artifacts.manifest.projectionId,
  projectionHash: artifacts.manifest.projectionHash, authoringRevision: revision };
if (process.argv.includes('--write')) {
  if (revisionFlag < 0) throw new Error('course-order: --write requires the frozen --authoring-revision');
  const status = execFileSync('git', ['status', '--porcelain', '--', COURSE_ORDER_RELATIVE], { encoding: 'utf8' }).trim();
  if (status) throw new Error('course-order: commit the reviewed course decisions before materialization');
  writeDomainTeachingRuntime({ repoRoot: root, artifacts, pointer: {
    contract: 'act-domain-teaching-projection-current/v1', projectionId: artifacts.manifest.projectionId,
    projectionHash: artifacts.manifest.projectionHash, authorityReleaseId: manifest.releaseId,
    authorityDigest: artifacts.manifest.authorityDigest, teachingCacheFamily: teachingCacheFamilyFor(artifacts.manifest),
    activatedAt: new Date().toISOString(),
  } });
  const reportDir = join(root, 'course-content/runtime/knowledge/course-order');
  mkdirSync(reportDir, { recursive: true });
  writeFileSync(join(reportDir, 'coverage.json'), `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(join(reportDir, 'engineering-adoption.jsonl'), `${adoption.receipts.map((row) => JSON.stringify(row)).join('\n')}\n`);
}
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
