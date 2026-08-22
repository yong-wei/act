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
import { ActTeachingRelationError, teachingEdgeId } from './hash';

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
  edges?: readonly ActTeachingPublishedEdge[];
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
  const edges = input.edges ?? [];
  const containmentEdges = edges.filter((edge) => edge.family === 'containment');
  const members = new Set(input.scope.memberIds);
  for (const edge of containmentEdges) {
    const expectedId = teachingEdgeId({
      family: 'containment',
      sourceCanonicalId: edge.sourceCanonicalId,
      targetCanonicalId: edge.targetCanonicalId,
      scopeHash: input.scope.scopeHash,
    });
    if (edge.edgeId !== expectedId) {
      throw new ActTeachingRelationError(
        'containment-edge-mismatch',
        `containment edge identity drifted from source/target/scope`,
      );
    }
    if (edge.sourceCanonicalId === edge.targetCanonicalId) {
      throw new ActTeachingRelationError('self-loop', `containment edge ${edge.edgeId} is a self-loop`);
    }
    if (edge.relationType !== 'CONTAINMENT' || edge.direction !== 'source_to_target' || edge.layer !== 'ACT_TEACHING') {
      throw new ActTeachingRelationError(
        'containment-edge-mismatch',
        `containment edge ${edge.edgeId} has invalid runtime semantics`,
      );
    }
    const sourceDomains = domainKeysForMember(input.scope, edge.sourceCanonicalId);
    const targetDomains = domainKeysForMember(input.scope, edge.targetCanonicalId);
    const expectedDomains = [...new Set([...sourceDomains, ...targetDomains])].sort();
    if (JSON.stringify([...(edge.domainKeys ?? [])].sort()) !== JSON.stringify(expectedDomains)) {
      throw new ActTeachingRelationError(
        'containment-edge-mismatch',
        `containment edge ${edge.edgeId} domainKeys drifted from scope membership`,
      );
    }
    if (wouldIntroduceCycle('containment', containmentEdges, edge.sourceCanonicalId, edge.targetCanonicalId)) {
      throw new ActTeachingRelationError(
        'illegal-cycle',
        `containment edge ${edge.edgeId} introduces a cycle`,
      );
    }
    if (!members.has(edge.sourceCanonicalId) || !members.has(edge.targetCanonicalId)) {
      throw new ActTeachingRelationError(
        'containment-incomplete',
        `containment edge ${edge.edgeId} has an endpoint outside the scope`,
      );
    }
    const row = byMember.get(edge.sourceCanonicalId);
    if (!row || row.kind !== PUBLISHED_EDGE_DISPOSITION || row.edgeId !== edge.edgeId) {
      throw new ActTeachingRelationError(
        'containment-edge-mismatch',
        `containment edge ${edge.edgeId} is not the unique published parent for ${edge.sourceCanonicalId}`,
      );
    }
  }
  for (const memberId of input.scope.memberIds) {
    const row = byMember.get(memberId)!;
    const sourced = containmentEdges.filter((edge) => edge.sourceCanonicalId === memberId);
    if (row.kind === COURSE_ROOT_DISPOSITION && sourced.length > 0) {
      throw new ActTeachingRelationError(
        'containment-root-parent-conflict',
        `member ${memberId} cannot be COURSE_ROOT and also have parent edges`,
      );
    }
    if (row.kind === PUBLISHED_EDGE_DISPOSITION) {
      if (sourced.length !== 1 || sourced[0]?.edgeId !== row.edgeId) {
        throw new ActTeachingRelationError(
          'containment-edge-mismatch',
          `member ${memberId} must have exactly one matching containment parent edge`,
        );
      }
    }
  }
}

export function domainKeysForMember(
  scope: ActTeachingScope,
  canonicalId: string,
): readonly string[] {
  return scope.members.find((member) => member.canonicalId === canonicalId)?.domainIds ?? [];
}
