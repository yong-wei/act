import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { ActTeachingFamilyDisposition } from '@/lib/act-canonical-teaching-relations/contracts';
import { authorityDigest, verifyMaterializedSnapshot, type AuthorityEngineeringBody, type AuthoritySnapshotManifest } from '@/lib/authoritative-knowledge/authority-snapshot';
import { buildAuthoritySemanticCache, type AuthoritySemanticCache } from '@/lib/latest-authority-oss-cutover/authority-semantic-cache';
import { evaluateTeachingClosure } from '@/lib/latest-authority-oss-cutover/teaching-closure';
import { loadReferencedDomainFragments, writeDomainFragmentsToCandidate } from '@/lib/latest-authority-oss-cutover/domain-fragment-files';
import { projectionDigest } from '@/lib/teaching-projection/hash';
import type { DomainTeachingComposedManifest } from '@/lib/teaching-projection/domain-fragments/contracts';

interface HistoricalEdge { edgeId: string; source: string; target: string; family: string }
interface CourseEdge { edgeId: string; sourceNodeId: string; targetNodeId: string; evidenceRefs: readonly string[]; curatorRationale?: string | null }
interface ReclosureInput {
  sourceScopeHash: string;
  scopeHash: string;
  authorityCaptureHash: string;
  members: readonly string[];
  retiredMembers: readonly string[];
  sourceDispositions: readonly ActTeachingFamilyDisposition[];
  semanticCache: AuthoritySemanticCache;
  historicalEdges: readonly HistoricalEdge[];
  courseEdges: readonly CourseEdge[];
}

export function recloseCourseGovernance(input: ReclosureInput) {
  const fail = (message: string): never => { throw new Error('course governance: ' + message); };
  const members = new Set(input.members);
  if (members.size !== input.members.length) fail('duplicate scope member');
  const currentObjects = input.semanticCache.entries.filter((row) => row.kind === 'object' && row.successorRevision !== null);
  if (currentObjects.length !== members.size || currentObjects.some((row) => !members.has(row.recordId))) fail('scope omits a successor object');
  const retired = input.semanticCache.entries.filter((row) => row.kind === 'object' && row.disposition === 'RETIRED').map((row) => row.recordId).sort();
  if (JSON.stringify(retired) !== JSON.stringify([...input.retiredMembers].sort())) fail('retirement ruling differs from semantic delta');
  const reusable = new Set(input.semanticCache.entries.filter((row) => row.kind === 'object' && row.disposition === 'REUSED').map((row) => row.recordId));
  if (input.members.some((id) => !reusable.has(id))) fail('changed or new object needs a new teaching decision');
  const historical = new Map<string, HistoricalEdge>();
  for (const edge of input.historicalEdges) {
    const prior = historical.get(edge.edgeId);
    if (prior && (prior.source !== edge.source || prior.target !== edge.target || prior.family !== edge.family)) fail('conflicting historical edge identity');
    historical.set(edge.edgeId, edge);
  }
  const incidence = new Map<string, CourseEdge>();
  for (const edge of [...input.courseEdges].sort((a, b) => a.edgeId.localeCompare(b.edgeId))) {
    if (!members.has(edge.sourceNodeId) || !members.has(edge.targetNodeId) || !edge.evidenceRefs.length) fail('unqualified course edge');
    for (const id of [edge.sourceNodeId, edge.targetNodeId]) if (!incidence.has(id)) incidence.set(id, edge);
  }
  const seen = new Set<string>();
  let reusedCount = 0;
  let recomputedCount = 0;
  const dispositions: ActTeachingFamilyDisposition[] = [];
  for (const row of input.sourceDispositions) {
    const key = row.canonicalId + '\0' + row.family;
    if (row.scopeHash !== input.sourceScopeHash || seen.has(key)) fail('source disposition identity drift');
    seen.add(key);
    if (!members.has(row.canonicalId)) {
      if (!retired.includes(row.canonicalId) || row.kind !== 'NO_RELATION') fail('cannot retire an admitted teaching member');
      continue;
    }
    if (row.family !== 'prerequisite' && row.kind === 'PUBLISHED_EDGE') {
      const edge = row.edgeId ? historical.get(row.edgeId) : undefined;
      if (!edge || edge.source !== row.canonicalId || edge.family !== row.family || !members.has(edge.target)) fail('historical admitted edge is absent or retired');
    }
    const edge = row.family === 'prerequisite' ? incidence.get(row.canonicalId) : undefined;
    if (row.family === 'prerequisite' && row.kind === 'PUBLISHED_EDGE' && !edge) fail('previously taught prerequisite member was lost');
    const next: ActTeachingFamilyDisposition = edge ? {
      scopeHash: input.scopeHash, canonicalId: row.canonicalId, family: 'prerequisite', kind: 'PUBLISHED_EDGE',
      edgeId: edge.edgeId, evidenceRefs: [...edge.evidenceRefs],
      rationale: edge.curatorRationale ?? '已审定课程先修关系的端点。',
    } : { ...row, scopeHash: input.scopeHash };
    const { scopeHash: _beforeScope, ...beforeSemantic } = row;
    const { scopeHash: _afterScope, ...afterSemantic } = next;
    if (projectionDigest(beforeSemantic) === projectionDigest(afterSemantic)) reusedCount += 1;
    else recomputedCount += 1;
    dispositions.push(next);
  }
  for (const id of [...members, ...retired]) for (const family of ['containment', 'prerequisite', 'association']) {
    if (!seen.has(id + '\0' + family)) fail('source three-family ledger is incomplete');
  }
  if (dispositions.length !== members.size * 3) fail('successor three-family ledger is incomplete');
  const closure = evaluateTeachingClosure({ scopeHash: input.scopeHash, authorityCaptureHash: input.authorityCaptureHash,
    members: input.members.map((canonicalId) => ({ canonicalId })), dispositions, candidates: [], decisions: [] });
  if (closure.status !== 'COMPLETE' || !closure.zeroUnresolved) fail('successor closure is incomplete');
  return { dispositions, closure, reusedCount, recomputedCount, retiredDispositionCount: input.sourceDispositions.length - dispositions.length };
}

function main() {
  const root = process.cwd();
  const option = (name: string) => {
    const index = process.argv.indexOf(name);
    const value = index < 0 ? undefined : process.argv[index + 1];
    if (!value || value.startsWith('--')) throw new Error('missing ' + name);
    return value;
  };
  const candidate = option('--candidate-root');
  if (!candidate.startsWith('course-content/authoring/knowledge/cutover/candidates/') || candidate.split('/').includes('..')) throw new Error('candidate root must be inside the repository cutover store');
  const appRevision = option('--app-revision');
  if (!/^[a-f0-9]{40}$/.test(appRevision)) throw new Error('full application revision required');
  const git = (...args: string[]) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const compilerRevision = process.argv.includes('--compiler-revision') ? option('--compiler-revision') : git('rev-parse', 'HEAD').trim();
  if (!/^[a-f0-9]{40}$/.test(compilerRevision)) throw new Error('full compiler revision required');
  const script = 'scripts/knowledge/reclose-current-course-governance.ts';
  if (git('show', compilerRevision + ':' + script) !== readFileSync(join(root, script), 'utf8')) throw new Error('commit the compiler before generating evidence');
  const read = <T,>(path: string): T => JSON.parse(readFileSync(join(root, path), 'utf8')) as T;
  const frozen = <T,>(path: string): T => JSON.parse(git('show', appRevision + ':' + path)) as T;
  const oldRoot = 'course-content/authoring/knowledge/cutover/candidates/control-theory-engineering-v0.37-r4-c6-presentation-evidence';
  const source = frozen<{ scopeHash: string; dispositionHash: string; dispositions: ActTeachingFamilyDisposition[] }>(oldRoot + '/teaching-dispositions.json');
  if (source.dispositionHash !== projectionDigest(source.dispositions)) throw new Error('frozen source ledger hash mismatch');
  const sourceScope = frozen<{ authority: { snapshotId: string } }>(oldRoot + '/domain-catalog/scope.json');
  const scope = read<{ scopeHash: string; authority: { snapshotId: string; snapshotHash: string }; members: { canonicalId: string }[] }>(candidate + '/domain-catalog/scope.json');
  const loadSnapshot = (id: string, previous: boolean) => {
    const prefix = 'course-content/authoring/knowledge/authority/releases/' + id;
    const manifest = previous ? frozen<AuthoritySnapshotManifest>(prefix + '/manifest.json') : read<AuthoritySnapshotManifest>(prefix + '/manifest.json');
    const engineering = previous ? frozen<AuthorityEngineeringBody>(prefix + '/engineering.json') : read<AuthorityEngineeringBody>(prefix + '/engineering.json');
    // The predecessor is an observed legacy input; its exact body is preserved, not re-qualified.
    if (authorityDigest(engineering) !== manifest.engineeringDigest) throw new Error('Authority body digest mismatch');
    if (!previous) {
      verifyMaterializedSnapshot({ manifest, engineering });
      if (manifest.captureRevision !== appRevision) throw new Error('successor is not the frozen application capture');
    }
    return engineering;
  };
  const semanticCache = buildAuthoritySemanticCache({ predecessor: loadSnapshot(sourceScope.authority.snapshotId, true), successor: loadSnapshot(scope.authority.snapshotId, false) });
  const ruling = frozen<{ snapshotId: string; retiredMembers: string[] }>('course-content/authoring/knowledge/cutover/candidates/control-theory-engineering-v0.37-r6/domain-catalog/retirement-ruling.json');
  const baselineCourse = frozen<{ projectionId: string }>('course-content/runtime/knowledge/projection/current.json');
  const baselineManifest = frozen<{ authoritySnapshotId: string }>('course-content/runtime/knowledge/projection/releases/' + baselineCourse.projectionId + '/projection-manifest.json');
  if (ruling.snapshotId !== baselineManifest.authoritySnapshotId) throw new Error('retirement ruling is not the frozen input scope');
  const current = read<{ projectionId: string }>('course-content/runtime/knowledge/teaching-projection/domain-fragments/current.json');
  const projectionRoot = 'course-content/runtime/knowledge/teaching-projection/domain-fragments/releases/' + current.projectionId;
  const composed = read<DomainTeachingComposedManifest>(projectionRoot + '/composed-manifest.json');
  if (composed.authoringRevision !== appRevision || composed.authorityBinding.snapshotHash !== scope.authority.snapshotHash) throw new Error('course projection capture mismatch');
  const fragments = loadReferencedDomainFragments(composed, join(root, projectionRoot, 'fragments'));
  const historicalRoot = 'course-content/authoring/knowledge/formal-resource-remediation/teaching-projection/fragments';
  const historicalPaths = git('ls-tree', '--name-only', appRevision + ':' + historicalRoot).trim().split('\n').filter((name) => name.endsWith('.json'));
  const historicalEdges = historicalPaths.flatMap((name) => frozen<{ edges: (HistoricalEdge & { kind: string })[] }>(historicalRoot + '/' + name).edges
    .filter((edge) => edge.kind === 'PUBLISHED_EDGE'));
  const capture = frozen<{ captureHash: string }>('course-content/authoring/knowledge/cutover/candidates/control-theory-engineering-v0.37-r6/authority-capture.json');
  const result = recloseCourseGovernance({ sourceScopeHash: source.scopeHash, scopeHash: scope.scopeHash, authorityCaptureHash: capture.captureHash,
    members: scope.members.map((row) => row.canonicalId), retiredMembers: ruling.retiredMembers, sourceDispositions: source.dispositions,
    semanticCache, historicalEdges, courseEdges: fragments.flatMap((fragment) => fragment.relations.filter((edge) => edge.relationType === 'PREREQUISITE')) });
  const dispositionHash = projectionDigest(result.dispositions);
  const receiptBody = { contract: 'r4-c6-teaching-governance-reclosure/v1', status: 'COMPLETE', appRevision, compilerRevision,
    sourceScopeHash: source.scopeHash, successorScopeHash: scope.scopeHash, successorSnapshotHash: scope.authority.snapshotHash,
    sourceDispositionHash: source.dispositionHash, dispositionHash, semanticCacheHash: semanticCache.cacheHash,
    courseProjectionHash: composed.projectionHash, changedFields: ['scopeHash', 'retiredMembers', 'prerequisiteDispositions'],
    retiredMembers: [...ruling.retiredMembers].sort(), retiredDispositionCount: result.retiredDispositionCount,
    reusedCount: result.reusedCount, recomputedCount: result.recomputedCount, teachingClosureReceiptHash: result.closure.receiptHash };
  const write = (name: string, value: unknown) => {
    const target = join(root, candidate, name), bytes = JSON.stringify(value, null, 2) + '\n';
    try { if (readFileSync(target, 'utf8') === bytes) return; throw new Error('immutable artifact differs: ' + name); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, bytes, { flag: 'wx' });
  };
  write('production-authority-semantic-cache.json', semanticCache);
  write('teaching-dispositions.json', { contract: 'coordinated-teaching-disposition-scope-reclosure/v1', authorityCaptureHash: capture.captureHash,
    scopeHash: scope.scopeHash, semanticCacheHash: semanticCache.cacheHash, dispositionHash, dispositions: result.dispositions,
    source: { path: oldRoot + '/teaching-dispositions.json', sourceRevision: appRevision, dispositionHash: source.dispositionHash } });
  write('teaching-closure-receipt.json', result.closure);
  write('teaching-reclosure-receipt.json', { ...receiptBody, receiptHash: projectionDigest(receiptBody) });
  write('composed-domain-fragment-manifest.json', composed);
  writeDomainFragmentsToCandidate(join(root, candidate), fragments);
  write('authority-capture/authority-capture.json', capture);
  console.log(JSON.stringify({ status: result.closure.status, scopeMembers: scope.members.length,
    reused: result.reusedCount, recomputed: result.recomputedCount, retired: result.retiredDispositionCount, families: result.closure.familyCounts }));
}

if (process.argv[1]?.endsWith('reclose-current-course-governance.ts')) main();
