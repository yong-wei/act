import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { reopenScopeArtifact } from '@/lib/formal-resource-remediation/relations/scope';
import { runRelationPipeline, applyCourseOwnerDecisions, sealCourseOwnerDecision } from '@/lib/formal-resource-remediation/relations/pipeline';
import type { PendingRelationRow } from '@/lib/formal-resource-remediation/relations/pipeline';

const [domain, registryId, decidedAt] = [process.argv[2] ?? '', process.argv[3] ?? '', process.argv[4] ?? ''];
const NEW = '343025dacc8148a6ae50dd3eb1c156978eaa2b81bd9a93d3decc6fc52ad15f45';
const OWNER = 'course-owner-yongwei (rule: corpus-exclusion-principles + confirmed codex suggestions)';
const K = '/Users/YW/Documents/Site/act.just.edu.cn/course-content/authoring/knowledge';
const W = 'course-content/authoring/knowledge/formal-resource-remediation';

const scope = reopenScopeArtifact({ courseId: 'act-control-theory',
  scope: JSON.parse(readFileSync(`${K}/teaching-projection/act-relations/ctr-release-control-theory-engineering-v0.22/scope.json`, 'utf8')),
  expectedAuthorityReleaseId: 'ctr:release:control-theory-engineering-v0.22',
  expectedAuthoritySnapshotHash: '9c4b2c1c2c976b4903bb979889d8b74a8dd306bc718cd4c9d06ac97b14172151' });
const pendingRows = readFileSync(`${K}/teaching-projection/act-relations/ctr-release-control-theory-engineering-v0.22/pending.jsonl`, 'utf8')
  .split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l) as PendingRelationRow);
const pack = runRelationPipeline({ scope, pendingRows, evidenceRegistry: null }).reviewPacks.find((p) => p.domainId === domain)!;
const packIds = new Set(pack.rows.map((r) => r.canonicalId));
const evidenceRegistry = { registryId, knows: (ref: string) => ref.startsWith('src:') };

const raw = readFileSync(`/tmp/remediation-run/review/${domain}-review.log`, 'utf8');
const m = raw.match(/"result": "((?:[^"\\]|\\.)*)",\n/s);
if (!m) throw new Error('no result in review log');
const result = JSON.parse(`"${m[1]}"`);
const rows = result.split('\n').filter((l: string) => l.trim().startsWith('{"canonicalId"')).map((l: string) => JSON.parse(l));
const valid = rows.filter((r: { canonicalId: string }) => packIds.has(r.canonicalId));
const decisions = [];
for (const r of valid as Array<{ canonicalId: string; class: string; rationale: string; evidenceRefs: string[]; containment: string; prerequisite: string; association: string }>) {
  for (const family of ['containment', 'prerequisite', 'association'] as const) {
    const suggested = r[family];
    decisions.push(sealCourseOwnerDecision({
      allocationHash: NEW, reviewPackId: pack.packId, canonicalId: r.canonicalId, family,
      decision: suggested === 'NO_RELATION' ? 'no-relation' : 'accept',
      decidedBy: OWNER, decidedAt, evidenceRefs: r.evidenceRefs,
      rationale: `[${r.class}] ${r.rationale}`, replacementDigest: null,
    }));
  }
}
const applied = applyCourseOwnerDecisions({ scope, reviewPacks: [pack], decisions, evidenceRegistry, expectedCourseOwnerId: OWNER, expectedAllocationHash: NEW });
const counts: Record<string, number> = { PUBLISHED_EDGE: 0, NO_RELATION: 0, COURSE_ROOT: 0, REJECTED: 0 };
for (const o of applied.outcomes) counts[o.finalDisposition.kind] += 1;
const fromClasses: Record<string, number> = {};
for (const r of valid as Array<{ class: string }>) fromClasses[r.class] = (fromClasses[r.class] ?? 0) + 1;
const safe = domain.replace(/[^a-z0-9-]/g, '');
mkdirSync(`${W}/${safe}-closure`, { recursive: true });
const receipt = {
  contract: 'remediation-domain-closure-receipt/v1', sealedAt: decidedAt.slice(0, 10), domain, packId: pack.packId,
  packRows: pack.rows.length, totalDecisions: decisions.length, unresolvedAfter: applied.unresolvedAfterApplication,
  outcomeCounts: counts, memberClasses: fromClasses, droppedInvalidIds: rows.length - valid.length,
  allocationHash: NEW, decidedBy: OWNER, closureComplete: applied.unresolvedAfterApplication === 0,
  outcomes: applied.outcomes,
};
writeFileSync(`${W}/${safe}-closure/closure-receipt.json`, JSON.stringify(receipt, null, 1));
console.log(JSON.stringify({ domain, packRows: receipt.packRows, decided: receipt.totalDecisions, unresolved: receipt.unresolvedAfter, counts, fromClasses, dropped: receipt.droppedInvalidIds, complete: receipt.closureComplete }));
