import {
  COURSE_ROOT_DISPOSITION,
  NO_RELATION_DISPOSITION,
  PENDING_REVIEW_DISPOSITION,
  PUBLISHED_EDGE_DISPOSITION,
  type ActTeachingCandidate,
  type ActTeachingFamilyDisposition,
  type ActTeachingPublishedEdge,
  type ActTeachingQualificationReceipt,
  type ActTeachingScope,
} from './contracts';
import {
  domainKeysForMember,
  familyRelationType,
  itemAdmissionFailures,
  replaceDisposition,
  wouldIntroduceCycle,
} from './families';
import { projectionDigest } from './hash';
import { assertQualifiedReceipt } from './qualify';

export interface AdmissionBatch {
  readonly edges: ActTeachingPublishedEdge[];
  readonly dispositions: ActTeachingFamilyDisposition[];
  readonly pending: ActTeachingCandidate[];
  readonly admitted: ActTeachingCandidate[];
}

function edgeIdFor(candidate: ActTeachingCandidate): string {
  return `edge-${projectionDigest({
    family: candidate.family,
    sourceCanonicalId: candidate.sourceCanonicalId,
    targetCanonicalId: candidate.targetCanonicalId,
    scopeHash: candidate.scopeHash,
  }).slice(0, 24)}`;
}

export function admitQualifiedCandidates(input: {
  scope: ActTeachingScope;
  candidates: readonly ActTeachingCandidate[];
  dispositions: readonly ActTeachingFamilyDisposition[];
  edges?: readonly ActTeachingPublishedEdge[];
  qualification: ActTeachingQualificationReceipt;
  pipelineVersion: string;
  pipelineConfigDigest: string;
}): AdmissionBatch {
  assertQualifiedReceipt(
    input.qualification,
    input.pipelineVersion,
    input.pipelineConfigDigest,
  );

  let dispositions = [...input.dispositions];
  const edges = [...(input.edges ?? [])];
  const pending: ActTeachingCandidate[] = [];
  const admitted: ActTeachingCandidate[] = [];

  const ordered = [...input.candidates].sort((a, b) => a.candidateId.localeCompare(b.candidateId));
  for (const candidate of ordered) {
    if (
      candidate.pipelineVersion !== input.pipelineVersion
      || candidate.pipelineConfigDigest !== input.pipelineConfigDigest
    ) {
      pending.push({
        ...candidate,
        exceptionReasons: [...candidate.exceptionReasons, 'pipeline-version-drift'],
      });
      continue;
    }
    const failures = itemAdmissionFailures({ scope: input.scope, candidate });
    const target = candidate.targetCanonicalId;
    if (
      target
      && wouldIntroduceCycle(candidate.family, edges, candidate.sourceCanonicalId, target)
    ) {
      failures.push('illegal-cycle');
    }
    if (failures.length > 0) {
      pending.push({
        ...candidate,
        exceptionReasons: [...new Set([...candidate.exceptionReasons, ...failures])],
      });
      continue;
    }

    if (candidate.family === 'containment' && !target) {
      dispositions = replaceDisposition(dispositions, {
        scopeHash: input.scope.scopeHash,
        canonicalId: candidate.sourceCanonicalId,
        family: 'containment',
        kind: COURSE_ROOT_DISPOSITION,
        edgeId: null,
        evidenceRefs: candidate.evidenceRefs,
        rationale: 'explicit COURSE_ROOT from qualified pipeline',
      });
      admitted.push(candidate);
      continue;
    }

    if (!target) {
      dispositions = replaceDisposition(dispositions, {
        scopeHash: input.scope.scopeHash,
        canonicalId: candidate.sourceCanonicalId,
        family: candidate.family,
        kind: NO_RELATION_DISPOSITION,
        edgeId: null,
        evidenceRefs: candidate.evidenceRefs,
        rationale: 'explicit no-relation from qualified pipeline',
      });
      admitted.push(candidate);
      continue;
    }

    const edge: ActTeachingPublishedEdge = {
      edgeId: edgeIdFor(candidate),
      family: candidate.family,
      relationType: familyRelationType(candidate.family),
      sourceCanonicalId: candidate.sourceCanonicalId,
      targetCanonicalId: target,
      direction: candidate.direction,
      domainKeys: [...new Set([
        ...domainKeysForMember(input.scope, candidate.sourceCanonicalId),
        ...domainKeysForMember(input.scope, target),
      ])].sort(),
      layer: 'ACT_TEACHING',
    };
    edges.push(edge);
    dispositions = replaceDisposition(dispositions, {
      scopeHash: input.scope.scopeHash,
      canonicalId: candidate.sourceCanonicalId,
      family: candidate.family,
      kind: PUBLISHED_EDGE_DISPOSITION,
      edgeId: edge.edgeId,
      evidenceRefs: candidate.evidenceRefs,
      rationale: 'admitted by qualified pipeline and item gates',
    });
    admitted.push(candidate);
  }

  for (const candidate of pending) {
    const current = dispositions.find((row) => (
      row.canonicalId === candidate.sourceCanonicalId && row.family === candidate.family
    ));
    if (current && current.kind !== PENDING_REVIEW_DISPOSITION) {
      continue;
    }
    dispositions = replaceDisposition(dispositions, {
      scopeHash: input.scope.scopeHash,
      canonicalId: candidate.sourceCanonicalId,
      family: candidate.family,
      kind: PENDING_REVIEW_DISPOSITION,
      edgeId: null,
      evidenceRefs: candidate.evidenceRefs,
      rationale: candidate.exceptionReasons.join(',') || 'pending review',
    });
  }

  return { edges, dispositions, pending, admitted };
}
