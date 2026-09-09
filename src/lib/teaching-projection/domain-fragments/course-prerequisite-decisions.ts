import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';

import { COURSE_UNIT_ORDER } from './adopt-engineering-prerequisites';
import { projectionDigest } from '../hash';
import type { PrerequisiteStrength } from '../contracts';
import type { DomainFragmentRelationAuthoring } from './contracts';

export const COURSE_ORDER_RELATIVE = 'course-content/authoring/knowledge/teaching-projection/course-order';
export const COURSE_ORDER_CONTRACT = 'act-course-prerequisite-decisions/v1';

export interface CourseOrderTopic {
  key: string;
  label: string;
  status: 'mapped' | 'authority-gap';
  canonicalIds: string[];
  units: string[];
  evidenceRefs: string[];
  rationale: string;
  authorityEvidence: Array<{ canonicalId: string; semanticDigest: string }>;
}
export interface CourseOrderUnit { unitId: string; topicKeys: string[]; evidenceRefs: string[] }
export interface CourseOrderDecision {
  decisionId: string;
  sourceTopic: string;
  targetTopic: string;
  strength: PrerequisiteStrength;
  rationale: string;
  evidenceRefs: string[];
}
export interface CourseOrderManifest {
  contract: string;
  authority: { snapshotId: string; snapshotHash: string; releaseId: string; releaseSetId: string };
  coverageScope: 'available-authority';
  fullCourseCoverage: false;
  acceptedAuthorityGapPolicy: string;
  requiredUnits: string[];
  requiredTopics: string[];
  acceptedGapTopics: string[];
  sourceFiles: Array<{ path: string; sha256: string }>;
  retainedSources: Array<{ path: string; kind: 'course-prerequisites' | 'domain-fragment' }>;
}
export interface CourseOrderObject { id: string; type: string; name: string; definition: string }
export interface CourseOrderInputs {
  manifest: CourseOrderManifest;
  topics: CourseOrderTopic[];
  units: CourseOrderUnit[];
  decisions: CourseOrderDecision[];
}

const hash = (bytes: string | Buffer) => createHash('sha256').update(bytes).digest('hex');
function fail(message: string): never { throw new Error(`course-order: ${message}`); }
const nonempty = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const sameSet = (a: readonly string[], b: readonly string[]) => a.length === new Set(a).size
  && b.length === new Set(b).size && a.length === b.length && a.every((value) => b.includes(value));

export function courseOrderSemanticDigest(object: CourseOrderObject): string {
  return hash(JSON.stringify({ id: object.id, type: object.type, name: object.name, definition: object.definition }));
}

export function readCourseOrderInputs(repoRoot: string): CourseOrderInputs {
  const directory = join(repoRoot, COURSE_ORDER_RELATIVE);
  const manifest = JSON.parse(readFileSync(join(directory, 'manifest.json'), 'utf8')) as CourseOrderManifest;
  for (const source of manifest.sourceFiles) {
    const absolute = resolve(repoRoot, source.path);
    if (!absolute.startsWith(`${resolve(repoRoot, 'course-content')}${sep}`)) fail(`source path outside course content: ${source.path}`);
    if (hash(readFileSync(absolute)) !== source.sha256) fail(`source changed: ${source.path}`);
  }
  const rows = <T>(name: string): T[] => readFileSync(join(directory, name), 'utf8')
    .split('\n').filter((line) => line.trim()).map((line) => JSON.parse(line) as T);
  return { manifest, topics: rows('topics.jsonl'), units: rows('units.jsonl'), decisions: rows('dependencies.jsonl') };
}

export function validateCourseOrderDecisions(input: CourseOrderInputs, objects: readonly CourseOrderObject[]) {
  const { manifest, topics, units, decisions } = input;
  if (manifest.contract !== COURSE_ORDER_CONTRACT || manifest.coverageScope !== 'available-authority'
    || manifest.fullCourseCoverage !== false) fail('unsupported or dishonest coverage declaration');
  if (!sameSet(manifest.requiredUnits, COURSE_UNIT_ORDER) || !sameSet(units.map((unit) => unit.unitId), manifest.requiredUnits)) {
    fail('complete module 1–5 unit coverage is required');
  }
  if (!sameSet(topics.map((topic) => topic.key), manifest.requiredTopics)) fail('topic denominator changed');
  const byId = new Map(objects.map((object) => [object.id, object]));
  const byKey = new Map(topics.map((topic) => [topic.key, topic]));
  const sourcePaths = new Set(manifest.sourceFiles.map((source) => source.path));
  const evidence = (refs: readonly string[], subject: string) => {
    if (!Array.isArray(refs) || refs.length === 0 || refs.some((ref) => !sourcePaths.has(ref))) fail(`unsealed evidence: ${subject}`);
  };
  for (const unit of units) {
    evidence(unit.evidenceRefs, unit.unitId);
    if (!unit.topicKeys.length || new Set(unit.topicKeys).size !== unit.topicKeys.length) fail(`empty or duplicate unit topics: ${unit.unitId}`);
    for (const key of unit.topicKeys) if (!byKey.has(key)) fail(`unknown topic ${key} in ${unit.unitId}`);
  }
  for (const topic of topics) {
    if (!nonempty(topic.label) || !nonempty(topic.rationale)) fail(`missing semantic decision: ${topic.key}`);
    evidence(topic.evidenceRefs, topic.key);
    if (!sameSet(topic.units, units.filter((unit) => unit.topicKeys.includes(topic.key)).map((unit) => unit.unitId))
      || topic.units.length === 0) fail(`unit evidence mismatch: ${topic.key}`);
    if (topic.status === 'authority-gap') {
      if (topic.canonicalIds.length || topic.authorityEvidence.length || !manifest.acceptedGapTopics.includes(topic.key)
        || !nonempty(manifest.acceptedAuthorityGapPolicy)) fail(`unaccepted or fabricated gap: ${topic.key}`);
      continue;
    }
    if (topic.status !== 'mapped' || !topic.canonicalIds.length
      || !sameSet(topic.canonicalIds, topic.authorityEvidence.map((row) => row.canonicalId))) fail(`mapping incomplete: ${topic.key}`);
    for (const row of topic.authorityEvidence) {
      const object = byId.get(row.canonicalId);
      if (!object || object.type !== 'DomainConcept' || courseOrderSemanticDigest(object) !== row.semanticDigest) {
        fail(`Authority semantic mismatch: ${topic.key}/${row.canonicalId}`);
      }
    }
  }

  const edges: Array<{ sourceId: string; targetId: string; decision: CourseOrderDecision }> = [];
  const deferred: string[] = [];
  const seenDecisions = new Set<string>();
  for (const decision of decisions) {
    if (!nonempty(decision.decisionId) || seenDecisions.has(decision.decisionId)) fail('duplicate decision identity');
    seenDecisions.add(decision.decisionId);
    const source = byKey.get(decision.sourceTopic);
    const target = byKey.get(decision.targetTopic);
    if (!source || !target || source.key === target.key) fail(`invalid decision endpoints: ${decision.decisionId}`);
    if (!nonempty(decision.rationale) || !['REQUIRED', 'RECOMMENDED'].includes(decision.strength)) fail(`missing teaching judgment: ${decision.decisionId}`);
    evidence(decision.evidenceRefs, decision.decisionId);
    if (source.status === 'authority-gap' || target.status === 'authority-gap') {
      deferred.push(decision.decisionId);
      continue;
    }
    for (const sourceId of source.canonicalIds) for (const targetId of target.canonicalIds) {
      if (sourceId === targetId) fail(`self prerequisite: ${decision.decisionId}`);
      edges.push({ sourceId, targetId, decision });
    }
  }

  const ids = [...new Set(topics.flatMap((topic) => topic.canonicalIds))];
  const adjacent = new Map(ids.map((id) => [id, new Set<string>()]));
  const required = new Map(ids.map((id) => [id, new Set<string>()]));
  for (const edge of edges) {
    adjacent.get(edge.sourceId)!.add(edge.targetId);
    adjacent.get(edge.targetId)!.add(edge.sourceId);
    if (edge.decision.strength === 'REQUIRED') required.get(edge.sourceId)!.add(edge.targetId);
  }
  const isolated = ids.filter((id) => !adjacent.get(id)!.size);
  if (isolated.length) fail(`isolated mapped concepts: ${isolated.join(',')}`);
  const reached = new Set<string>();
  const queue = ids.slice(0, 1);
  while (queue.length) {
    const id = queue.pop()!;
    if (reached.has(id)) continue;
    reached.add(id);
    for (const next of adjacent.get(id) ?? []) if (!reached.has(next)) queue.push(next);
  }
  if (reached.size !== ids.length) fail('mapped course graph is disconnected');
  const active = new Set<string>();
  const complete = new Set<string>();
  const visit = (id: string) => {
    if (active.has(id)) fail(`REQUIRED cycle at ${id}`);
    if (complete.has(id)) return;
    active.add(id);
    for (const target of required.get(id) ?? []) visit(target);
    active.delete(id);
    complete.add(id);
  };
  ids.forEach(visit);

  return {
    edges,
    report: {
      contract: 'act-course-prerequisite-coverage/v1',
      sourceDigest: projectionDigest(manifest.sourceFiles),
      decisionDigest: projectionDigest({ topics, units, decisions }),
      coverageScope: manifest.coverageScope,
      fullCourseCoverage: false,
      unitCount: units.length,
      topicCount: topics.length,
      mappedTopicCount: topics.filter((topic) => topic.status === 'mapped').length,
      mappedCanonicalCount: ids.length,
      authorityGaps: topics.filter((topic) => topic.status === 'authority-gap').map(({ key, label, units, rationale }) => ({ key, label, units, rationale })),
      deferredDecisions: deferred,
      isolatedCanonicalIds: isolated,
      requiredCycles: [] as string[],
    },
  };
}

/** Preserve explicit published facts; never re-import the old automatic gap-fill edges. */
export function readRetainedCourseRelations(repoRoot: string, manifest: CourseOrderManifest): DomainFragmentRelationAuthoring[] {
  const sealedPaths = new Set(manifest.sourceFiles.map((source) => source.path));
  const relations: DomainFragmentRelationAuthoring[] = [];
  for (const source of manifest.retainedSources) {
    if (!sealedPaths.has(source.path)) fail(`unsealed retained source: ${source.path}`);
    const content = JSON.parse(readFileSync(join(repoRoot, source.path), 'utf8'));
    const rows = source.kind === 'course-prerequisites' ? content : content.relations;
    if (!Array.isArray(rows)) fail(`invalid retained relations: ${source.path}`);
    for (const row of rows) {
      if (row.relationType !== 'PREREQUISITE') continue;
      if (source.kind === 'domain-fragment' && (!row.evidenceRefs?.length
        || String(row.curatorRationale).startsWith('Unscheduled'))) continue;
      relations.push({
        sourceNodeId: row.sourceNodeId, targetNodeId: row.targetNodeId,
        relationType: 'PREREQUISITE', strength: row.strength,
        domainKeys: row.domainKeys ?? [],
        evidenceRefs: [...new Set([...(row.evidenceRefs ?? []), source.path])],
        curatorId: row.curatorId ?? 'published-course-prerequisites',
        curatorRationale: row.curatorRationale ?? '保留已发布课程先后修及其原始强度。',
        authorDecisionId: row.authorDecisionId ?? row.edgeId ?? row.id,
      });
    }
  }
  return relations;
}
