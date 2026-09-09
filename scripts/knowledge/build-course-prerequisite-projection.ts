#!/usr/bin/env tsx
import { createPrerequisiteAuthorDecision } from '@/lib/teaching-projection/prerequisites/publication';
import { stagePrerequisitePublication, activatePrerequisitePublication, resolvePrerequisiteStorePaths } from '@/lib/teaching-projection/prerequisites/store';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { buildAuthoritySemanticCache } from '@/lib/latest-authority-oss-cutover/authority-semantic-cache';
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
const snapshotFlag = process.argv.indexOf('--snapshot-id');
const snapshotId = snapshotFlag >= 0 ? process.argv[snapshotFlag + 1] : input.manifest.authority.snapshotId;
if (!/^snap-[a-f0-9]{64}$/.test(snapshotId ?? '')) throw new Error('course-order: invalid snapshot id');
const snapshotDir = `course-content/authoring/knowledge/authority/releases/${snapshotId}`;
const manifest = json<AuthoritySnapshotManifest>(`${snapshotDir}/manifest.json`);
const engineering = json<AuthorityEngineeringBody>(`${snapshotDir}/engineering.json`);
verifyMaterializedSnapshot({ manifest, engineering });
if (manifest.releaseId !== input.manifest.authority.releaseId) throw new Error('course-order: Authority release changed');
if (manifest.snapshotHash !== input.manifest.authority.snapshotHash) {
  const predecessorDir = 'course-content/authoring/knowledge/authority/releases/' + input.manifest.authority.snapshotId;
  const predecessor = json<AuthorityEngineeringBody>(predecessorDir + '/engineering.json');
  verifyMaterializedSnapshot({ manifest: json<AuthoritySnapshotManifest>(predecessorDir + '/manifest.json'), engineering: predecessor });
  const semantic = buildAuthoritySemanticCache({ predecessor, successor: engineering });
  if (semantic.summary.recomputedCount || semantic.summary.retiredCount) {
    throw new Error('course-order: changed Authority semantics require reviewed course decisions');
  }
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
const retainedCoreIds = input.manifest.retainedSources
  .filter((source) => source.kind === 'domain-fragment')
  .flatMap((source) => json<{ coreNodes: Array<{ canonicalId: string }> }>(source.path).coreNodes.map((node) => node.canonicalId));
// Existing resource eligibility is independent of removing unsupported ordering edges.
const coreIds = [...new Set([...retainedCoreIds, ...input.topics.flatMap((topic) => topic.canonicalIds),
  ...[...relations.values()].flatMap((relation) => [relation.sourceNodeId, relation.targetNodeId])])];
const revisionFlag = process.argv.indexOf('--authoring-revision');
const revision = revisionFlag >= 0 ? process.argv[revisionFlag + 1] : execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
if (!/^[a-f0-9]{40}$/.test(revision ?? '')) throw new Error('course-order: a full authoring revision is required');
const authority = createDomainTeachingAuthorityEnvelope({
  binding: { releaseId: manifest.releaseId, releaseSetId: manifest.releaseSetId, snapshotId: manifest.snapshotId, snapshotHash: manifest.snapshotHash },
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
      rationale: topic?.rationale ?? '保留既有有效教学资源资格与关系端点，不据此生成课程先后修。', sourceKind: 'PREREQUISITE_ENDPOINT',
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
const report = { ...validation.report, retainedRelationCount: retained.length, retainedResourceCoreCount: new Set(retainedCoreIds).size,
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
  const publishedEdges = artifacts.relations.filter((edge) => edge.relationType === 'PREREQUISITE').map((edge) => {
    const decision = createPrerequisiteAuthorDecision({
      sourceNodeId: edge.sourceNodeId, targetNodeId: edge.targetNodeId, strength: edge.strength!,
      scopeId: 'act-control-theory', evidenceRefs: edge.evidenceRefs,
      curatorRationale: edge.curatorRationale, curatorId: edge.curatorId ?? 'course-plan-authoring',
      rationale: edge.curatorRationale ?? '保留已审核先修依据。',
      authorityReleaseId: manifest.releaseId, authoringRevision: revision,
    });
    return { decision, edge: { sourceNodeId: edge.sourceNodeId, targetNodeId: edge.targetNodeId,
      strength: edge.strength!, scopeId: 'act-control-theory', evidenceRefs: edge.evidenceRefs,
      curatorRationale: edge.curatorRationale, curatorId: edge.curatorId,
      status: 'PUBLISHED' as const, authorDecisionId: decision.decisionId,
      candidateOrigin: adoption.adoptedEdges.some((adopted) => adopted.sourceNodeId === edge.sourceNodeId
        && adopted.targetNodeId === edge.targetNodeId && adopted.strength === edge.strength)
        ? 'ENGINEERING_RELATION' as const : null } };
  });
  const prerequisitePaths = resolvePrerequisiteStorePaths(join(root, 'course-content/runtime/knowledge/prerequisites'));
  const publication = stagePrerequisitePublication(prerequisitePaths, {
    useCurrentAsPrior: false,
    scopeId: 'act-control-theory', authoringRevision: revision, authorityReleaseId: manifest.releaseId,
    authorityNodes: engineering.objects.map((object) => ({ canonicalId: object.canonicalId, lifecycleStatus: object.lifecycleStatus ?? 'active' })),
    coreNodes: authoring.coreNodes.map((node) => ({ ...node, scopeId: 'act-control-theory' })),
    edges: publishedEdges.map((row) => row.edge), decisions: publishedEdges.map((row) => row.decision),
    receipts: adoption.receipts,
  });
  if (publication.priorPreserved || !publication.artifacts.gate.passed) throw new Error('course-order: prerequisite publication rejected: ' + JSON.stringify(publication.findings));
  activatePrerequisitePublication(prerequisitePaths, publication.publicationId);
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
