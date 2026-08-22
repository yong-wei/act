import {
  ACT_TEACHING_FAMILIES,
  COURSE_ROOT_DISPOSITION,
  FAMILY_TO_RELATION_TYPE,
  NO_RELATION_DISPOSITION,
  PENDING_REVIEW_DISPOSITION,
  PUBLISHED_EDGE_DISPOSITION,
  type ActTeachingCandidate,
  type ActTeachingFamily,
  type ActTeachingFamilyDisposition,
  type ActTeachingPublishedEdge,
  type ActTeachingScope,
} from './contracts';
import { ActTeachingRelationError } from './hash';

export const MIN_AUTO_ADMIT_CONFIDENCE = 0.85;

const CONTAINMENT_CYCLE_FAMILIES = new Set<ActTeachingFamily>([
  'containment',
  'prerequisite',
]);

export function familyRelationType(family: ActTeachingFamily) {
  return FAMILY_TO_RELATION_TYPE[family];
}

export function itemAdmissionFailures(input: {
  scope: ActTeachingScope;
  candidate: ActTeachingCandidate;
}): string[] {
  const { scope, candidate } = input;
  const reasons: string[] = [];
  const members = new Set(scope.memberIds);
  if (candidate.scopeHash !== scope.scopeHash) {
    reasons.push('scope-mismatch');
  }
  if (
    candidate.authority.releaseId !== scope.authority.releaseId
    || candidate.authority.snapshotHash !== scope.authority.snapshotHash
  ) {
    reasons.push('authority-mismatch');
  }
  if (!members.has(candidate.sourceCanonicalId)) {
    reasons.push('source-outside-scope');
  }
  if (candidate.targetCanonicalId && !members.has(candidate.targetCanonicalId)) {
    reasons.push('target-outside-scope');
  }
  if (candidate.confidence < MIN_AUTO_ADMIT_CONFIDENCE) {
    reasons.push('low-confidence');
  }
  if (candidate.evidenceRefs.length === 0) {
    reasons.push('weak-evidence');
  }
  if (
    candidate.targetCanonicalId
    && candidate.sourceCanonicalId === candidate.targetCanonicalId
    && CONTAINMENT_CYCLE_FAMILIES.has(candidate.family)
  ) {
    reasons.push('self-loop');
  }
  if (candidate.family === 'containment' && candidate.direction !== 'source_to_target') {
    reasons.push('direction-conflict');
  }
  if (candidate.family === 'prerequisite' && candidate.direction !== 'source_to_target') {
    reasons.push('direction-conflict');
  }
  if (candidate.family === 'association' && candidate.direction !== 'symmetric') {
    reasons.push('direction-conflict');
  }
  if (candidate.exceptionReasons.length > 0) {
    reasons.push(...candidate.exceptionReasons);
  }
  return [...new Set(reasons)];
}

export function wouldIntroduceCycle(
  family: ActTeachingFamily,
  edges: readonly ActTeachingPublishedEdge[],
  sourceCanonicalId: string,
  targetCanonicalId: string,
): boolean {
  if (!CONTAINMENT_CYCLE_FAMILIES.has(family)) return false;
  const adjacency = new Map<string, string[]>();
  for (const edge of edges) {
    if (edge.family !== family) continue;
    const list = adjacency.get(edge.sourceCanonicalId) ?? [];
    list.push(edge.targetCanonicalId);
    adjacency.set(edge.sourceCanonicalId, list);
  }
  const stack = [...(adjacency.get(targetCanonicalId) ?? [])];
  const seen = new Set<string>();
  while (stack.length > 0) {
    const node = stack.pop()!;
    if (node === sourceCanonicalId) return true;
    if (seen.has(node)) continue;
    seen.add(node);
    stack.push(...(adjacency.get(node) ?? []));
  }
  return false;
}

export function containmentClosed(disposition: ActTeachingFamilyDisposition): boolean {
  return disposition.family === 'containment'
    && (
      disposition.kind === COURSE_ROOT_DISPOSITION
      || (disposition.kind === PUBLISHED_EDGE_DISPOSITION && Boolean(disposition.edgeId))
    );
}

export function familyClosed(disposition: ActTeachingFamilyDisposition): boolean {
  if (disposition.family === 'containment') return containmentClosed(disposition);
  return disposition.kind === PUBLISHED_EDGE_DISPOSITION
    || disposition.kind === NO_RELATION_DISPOSITION;
}

export function emptyDispositions(scope: ActTeachingScope): ActTeachingFamilyDisposition[] {
  return scope.memberIds.flatMap((canonicalId) => ACT_TEACHING_FAMILIES.map((family) => ({
    scopeHash: scope.scopeHash,
    canonicalId,
    family,
    kind: PENDING_REVIEW_DISPOSITION,
    edgeId: null,
    evidenceRefs: [] as const,
    rationale: 'awaiting qualified admission or repository decision',
  })));
}

export function replaceDisposition(
  rows: readonly ActTeachingFamilyDisposition[],
  next: ActTeachingFamilyDisposition,
): ActTeachingFamilyDisposition[] {
  const key = `${next.canonicalId}:${next.family}`;
  const kept = rows.filter((row) => `${row.canonicalId}:${row.family}` !== key);
  return [...kept, next].sort((a, b) => {
    const byId = a.canonicalId.localeCompare(b.canonicalId);
    if (byId !== 0) return byId;
    return a.family.localeCompare(b.family);
  });
}

export function assertContainmentSkeleton(input: {
  scope: ActTeachingScope;
  dispositions: readonly ActTeachingFamilyDisposition[];
}): void {
  if (input.scope.memberIds.length === 0) return;
  const byMember = new Map<string, ActTeachingFamilyDisposition>();
  for (const row of input.dispositions) {
    if (row.family !== 'containment') continue;
    if (row.scopeHash !== input.scope.scopeHash) {
      throw new ActTeachingRelationError(
        'scope-drift',
        `containment disposition for ${row.canonicalId} belongs to another scope`,
      );
    }
    if (byMember.has(row.canonicalId)) {
      throw new ActTeachingRelationError(
        'duplicate-disposition',
        `member ${row.canonicalId} has more than one containment disposition`,
      );
    }
    byMember.set(row.canonicalId, row);
  }
  for (const memberId of input.scope.memberIds) {
    const row = byMember.get(memberId);
    if (!row || !containmentClosed(row)) {
      throw new ActTeachingRelationError(
        'containment-incomplete',
        `member ${memberId} lacks an admitted containment parent or COURSE_ROOT`,
      );
    }
    if (row.kind === PUBLISHED_EDGE_DISPOSITION && !row.edgeId) {
      throw new ActTeachingRelationError(
        'containment-incomplete',
        `member ${memberId} published containment is missing its edge`,
      );
    }
  }
}

export function domainKeysForMember(
  scope: ActTeachingScope,
  canonicalId: string,
): readonly string[] {
  return scope.members.find((member) => member.canonicalId === canonicalId)?.domainIds ?? [];
}
