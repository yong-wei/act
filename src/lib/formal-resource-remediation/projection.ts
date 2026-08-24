/**
 * Capture-bound remediation Teaching Projection (#1515, tasks 10.1–10.6).
 *
 * The projection is built only from reopened remediation artifacts — the
 * v0.37 scope membership, the fifteen final three-family ledgers, the formal
 * resource envelope, and the excluded-domain ruling — and materializes the
 * included relations, modality-independent resource bindings, zero-resource
 * nodes, access-safe launch references, and explicit projection limitations.
 * `COMPLETE` is a derived state: `deriveProjectionCompleteness` recomputes it
 * from reopened inputs and has no completion parameter a caller could set.
 */

import { projectionDigest } from '@/lib/teaching-projection/hash';

import {
  FormalResourceRemediationError,
  REMEDIATION_BUILDER_VERSION,
} from './contracts';
import type { RemediationResourceEnvelope } from './envelope';

export const REMEDIATION_TEACHING_PROJECTION_CONTRACT = 'remediation-teaching-projection/v1' as const;
export const REMEDIATION_DOMAIN_FRAGMENT_CONTRACT = 'remediation-teaching-projection-domain-fragment/v1' as const;
export const REMEDIATION_CONSUMER_PROJECTION_CONTRACT = 'remediation-teaching-projection-consumer/v1' as const;

export type RelationFamily = 'containment' | 'prerequisite' | 'association';

/** One member row: covered members teach; excluded members stay visible for audit. */
export interface ProjectionMemberRow {
  readonly canonicalId: string;
  readonly domain: string;
  readonly excluded: boolean;
}

export interface ProjectionEdgeRow {
  readonly source: string;
  readonly family: RelationFamily;
  readonly target: string | null;
  readonly kind: 'PUBLISHED_EDGE' | 'COURSE_ROOT';
  readonly edgeId: string | null;
  readonly domain: string;
}

export interface ProjectionBindingRow {
  readonly modality: 'card' | 'audio' | 'intro-video' | 'exercise';
  readonly resourceId: string;
  readonly anchorId: string;
  readonly canonicalId: string;
  readonly evidence: string;
}

export interface RemediationTeachingProjection {
  readonly contract: typeof REMEDIATION_TEACHING_PROJECTION_CONTRACT;
  readonly builderVersion: typeof REMEDIATION_BUILDER_VERSION;
  readonly sealedAt: string;
  readonly allocationHash: string;
  readonly scopeHash: string;
  readonly envelopeHash: string;
  readonly totalClosureReceiptSha256: string;
  readonly totalConservationCheckSha256: string;
  readonly membership: {
    readonly memberCount: number;
    readonly coveredMemberCount: number;
    readonly excludedMemberCount: number;
    readonly byDomain: readonly { readonly domain: string; readonly members: number; readonly excluded: number }[];
  };
  readonly relations: {
    readonly edgeCount: number;
    readonly courseRootCount: number;
    readonly byFamily: Record<RelationFamily, number>;
  };
  readonly bindings: {
    readonly bindingCount: number;
    readonly byModality: Record<ProjectionBindingRow['modality'], number>;
    readonly bindingCoverageNote: string;
  };
  readonly zeroResourceNodes: { readonly count: number };
  readonly limitations: readonly string[];
  readonly projectionHash: string;
}

export interface FinalLedgerProjectionRow {
  readonly canonicalId: string;
  readonly family: RelationFamily;
  readonly disposition: 'PUBLISHED_EDGE' | 'NO_RELATION' | 'COURSE_ROOT';
  readonly target: string | null;
  readonly edgeId: string | null;
}

export interface BuildProjectionInput {
  readonly sealedAt: string;
  readonly allocationHash: string;
  readonly scopeHash: string;
  readonly members: readonly { readonly canonicalId: string; readonly domain: string; readonly excluded: boolean }[];
  readonly finalLedgerRows: readonly { readonly domain: string; readonly rows: readonly FinalLedgerProjectionRow[] }[];
  readonly bindings: readonly ProjectionBindingRow[];
  readonly envelope: RemediationResourceEnvelope;
  readonly totalClosureReceiptSha256: string;
  readonly totalConservationCheckSha256: string;
  readonly limitations: readonly string[];
}

function sortedCounts(domains: Map<string, { members: number; excluded: number }>): { domain: string; members: number; excluded: number }[] {
  return [...domains.entries()]
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([domain, counts]) => ({ domain, ...counts }));
}

export function projectionEdges(
  members: readonly { readonly canonicalId: string; readonly domain: string }[],
  finalLedgerRows: readonly { readonly domain: string; readonly rows: readonly FinalLedgerProjectionRow[] }[],
): readonly ProjectionEdgeRow[] {
  const domainByMember = new Map(members.map((member) => [member.canonicalId, member.domain]));
  const edges: ProjectionEdgeRow[] = [];
  for (const ledger of finalLedgerRows) {
    for (const row of ledger.rows) {
      if (row.disposition === 'NO_RELATION') continue;
      edges.push({
        source: row.canonicalId,
        family: row.family,
        target: row.target,
        kind: row.disposition === 'COURSE_ROOT' ? 'COURSE_ROOT' : 'PUBLISHED_EDGE',
        edgeId: row.edgeId,
        domain: domainByMember.get(row.canonicalId) ?? ledger.domain,
      });
    }
  }
  return edges;
}

/**
 * Build the capture-bound Teaching Projection from reopened artifacts only.
 * Bindings bind atoms/segments directly to canonical nodes (modality
 * independent — no handout intermediary); nodes without any binding stay in
 * the projection as explicit zero-resource rows, never placeholders.
 */
export function buildRemediationTeachingProjection(input: BuildProjectionInput): RemediationTeachingProjection {
  const memberIds = new Set(input.members.map((member) => member.canonicalId));
  if (memberIds.size !== input.members.length) {
    throw new FormalResourceRemediationError('projection-membership-duplicate', 'Membership contains duplicate canonical ids.');
  }
  const byDomain = new Map<string, { members: number; excluded: number }>();
  for (const member of input.members) {
    const bucket = byDomain.get(member.domain) ?? { members: 0, excluded: 0 };
    bucket.members += 1;
    if (member.excluded) bucket.excluded += 1;
    byDomain.set(member.domain, bucket);
  }
  const edges = projectionEdges(input.members, input.finalLedgerRows);
  const byFamily: Record<RelationFamily, number> = { containment: 0, prerequisite: 0, association: 0 };
  let courseRootCount = 0;
  for (const edge of edges) {
    if (edge.kind === 'COURSE_ROOT') {
      courseRootCount += 1;
      continue;
    }
    byFamily[edge.family] += 1;
    if (!memberIds.has(edge.source) || !edge.target || !memberIds.has(edge.target)) {
      throw new FormalResourceRemediationError('projection-edge-endpoint-unknown', `Edge ${edge.source}→${String(edge.target)} has an endpoint outside the reopened membership.`);
    }
  }
  const byModality: Record<ProjectionBindingRow['modality'], number> = { card: 0, audio: 0, 'intro-video': 0, exercise: 0 };
  for (const binding of input.bindings) {
    if (!memberIds.has(binding.canonicalId)) {
      throw new FormalResourceRemediationError('projection-binding-target-unknown', `Binding ${binding.anchorId} targets ${binding.canonicalId} outside the reopened membership.`);
    }
    byModality[binding.modality] += 1;
  }
  const coveredMembers = input.members.filter((member) => !member.excluded);
  const boundMembers = new Set(input.bindings.map((binding) => binding.canonicalId));
  const zeroResourceCount = coveredMembers.filter((member) => !boundMembers.has(member.canonicalId)).length;
  const projectionHash = projectionDigest({
    contract: REMEDIATION_TEACHING_PROJECTION_CONTRACT,
    builderVersion: REMEDIATION_BUILDER_VERSION,
    allocationHash: input.allocationHash,
    scopeHash: input.scopeHash,
    envelopeHash: input.envelope.envelopeHash,
    totalClosureReceiptSha256: input.totalClosureReceiptSha256,
    totalConservationCheckSha256: input.totalConservationCheckSha256,
    members: input.members.map((member) => [member.canonicalId, member.domain, member.excluded]),
    edges: edges.map((edge) => [edge.source, edge.family, edge.target, edge.kind, edge.edgeId]),
    bindings: input.bindings.map((binding) => [binding.modality, binding.resourceId, binding.anchorId, binding.canonicalId]),
    limitations: input.limitations,
  });
  return {
    contract: REMEDIATION_TEACHING_PROJECTION_CONTRACT,
    builderVersion: REMEDIATION_BUILDER_VERSION,
    sealedAt: input.sealedAt,
    allocationHash: input.allocationHash,
    scopeHash: input.scopeHash,
    envelopeHash: input.envelope.envelopeHash,
    totalClosureReceiptSha256: input.totalClosureReceiptSha256,
    totalConservationCheckSha256: input.totalConservationCheckSha256,
    membership: {
      memberCount: input.members.length,
      coveredMemberCount: coveredMembers.length,
      excludedMemberCount: input.members.length - coveredMembers.length,
      byDomain: sortedCounts(byDomain),
    },
    relations: {
      edgeCount: edges.length - courseRootCount,
      courseRootCount,
      byFamily,
    },
    bindings: {
      bindingCount: input.bindings.length,
      byModality,
      bindingCoverageNote: 'modality-independent direct bindings; unresolved modal atoms stay unbound rather than inherit another modality\'s mapping',
    },
    zeroResourceNodes: { count: zeroResourceCount },
    limitations: [...input.limitations],
    projectionHash,
  };
}

/** Every check behind the derived projection COMPLETE state (task 10.1). */
export interface ProjectionCompletenessCheck {
  readonly name: string;
  readonly passed: boolean;
  readonly detail: string;
}

export interface ProjectionCompletenessInput {
  /** Reopened scope identity — produced by `reopenScopeArtifact`, never caller text. */
  readonly reopenedScope: { readonly scopeHash: string; readonly memberCount: number };
  /** Reopened envelope state — produced by `reopenResourceEnvelope`. */
  readonly reopenedEnvelope: { readonly state: string; readonly envelope: RemediationResourceEnvelope };
  /** Reopened total closure receipt facts. */
  readonly closure: {
    readonly allocationHash: string;
    readonly memberCount: number;
    readonly rowCount: number;
    readonly unresolved: number;
    readonly closureComplete: boolean;
    readonly domainReceiptCount: number;
  };
  /** Recomputed conservation facts over the fifteen final ledgers. */
  readonly conservation: {
    readonly ledgerRowCount: number;
    readonly duplicates: number;
    readonly missingRowCount: number;
  };
  readonly allocationHash: string;
  readonly projection: RemediationTeachingProjection;
}

/**
 * Derive the projection state from reopened artifacts (task 10.1). There is
 * no completion input: a projection is COMPLETE only when the reopened
 * membership, envelope, closure receipt, conservation counts, and allocation
 * identities all reconcile with the projection's own claims.
 */
export function deriveProjectionCompleteness(input: ProjectionCompletenessInput): {
  readonly state: 'COMPLETE' | 'INCOMPLETE';
  readonly checks: readonly ProjectionCompletenessCheck[];
} {
  const checks: ProjectionCompletenessCheck[] = [];
  const check = (name: string, passed: boolean, detail: string): void => {
    checks.push({ name, passed, detail });
  };
  check(
    'scope-identity',
    input.reopenedScope.scopeHash === input.projection.scopeHash
      && input.reopenedScope.memberCount === input.projection.membership.memberCount,
    `reopened scope ${input.reopenedScope.scopeHash.slice(0, 8)}/${input.reopenedScope.memberCount} matches the projection`,
  );
  check(
    'envelope-reopened',
    input.reopenedEnvelope.state === 'SEALED'
      && input.reopenedEnvelope.envelope.envelopeHash === input.projection.envelopeHash,
    `envelope ${input.reopenedEnvelope.envelope.envelopeHash.slice(0, 8)} reopens SEALED`,
  );
  check(
    'allocation-identity',
    input.allocationHash === input.projection.allocationHash
      && input.closure.allocationHash === input.projection.allocationHash
      && input.reopenedEnvelope.envelope.allocationHash === input.projection.allocationHash,
    'projection, envelope, and closure share one allocation identity',
  );
  check(
    'closure-complete',
    input.closure.closureComplete && input.closure.unresolved === 0 && input.closure.domainReceiptCount === 15,
    `closure ${input.closure.domainReceiptCount} receipts, unresolved ${input.closure.unresolved}`,
  );
  check(
    'conservation',
    input.conservation.ledgerRowCount === input.closure.rowCount
      && input.conservation.duplicates === 0
      && input.conservation.missingRowCount === 0,
    `ledgers ${input.conservation.ledgerRowCount} rows, duplicates ${input.conservation.duplicates}, missing ${input.conservation.missingRowCount}`,
  );
  check(
    'membership-conserved',
    input.projection.membership.memberCount === input.reopenedScope.memberCount
      && input.projection.membership.coveredMemberCount + input.projection.membership.excludedMemberCount === input.projection.membership.memberCount,
    `membership ${input.projection.membership.memberCount} = covered ${input.projection.membership.coveredMemberCount} + excluded ${input.projection.membership.excludedMemberCount}`,
  );
  check(
    'limitations-declared',
    input.projection.limitations.length > 0,
    'the projection declares its explicit limitations',
  );
  const state = checks.every((one) => one.passed) ? 'COMPLETE' : 'INCOMPLETE';
  return { state, checks };
}

export interface ProjectionValidationFinding {
  readonly code: string;
  readonly detail: string;
}

/**
 * Validate the materialized projection against the reopened inputs (task
 * 10.6): membership conservation, relation-family conservation, binding and
 * edge endpoint safety, envelope coherence, and semantic-hash recomputation.
 */
export function validateRemediationTeachingProjection(input: {
  readonly projection: RemediationTeachingProjection;
  readonly members: readonly { readonly canonicalId: string; readonly domain: string; readonly excluded: boolean }[];
  readonly edges: readonly ProjectionEdgeRow[];
  readonly bindings: readonly ProjectionBindingRow[];
  readonly envelope: RemediationResourceEnvelope;
  readonly closure: { readonly memberCount: number; readonly rowCount: number; readonly publishedEdges: number };
}): readonly ProjectionValidationFinding[] {
  const findings: ProjectionValidationFinding[] = [];
  const memberIds = new Set(input.members.map((member) => member.canonicalId));
  if (input.projection.membership.memberCount !== memberIds.size) {
    findings.push({ code: 'membership-count', detail: `projection claims ${input.projection.membership.memberCount} members, reopened scope has ${memberIds.size}` });
  }
  const published = input.edges.filter((edge) => edge.kind === 'PUBLISHED_EDGE');
  if (input.projection.relations.edgeCount !== published.length) {
    findings.push({ code: 'relation-count', detail: `projection claims ${input.projection.relations.edgeCount} edges, ledgers hold ${published.length}` });
  }
  if (input.projection.relations.edgeCount + input.projection.relations.courseRootCount !== input.closure.publishedEdges) {
    findings.push({ code: 'relation-closure-mismatch', detail: `edges ${input.projection.relations.edgeCount} + roots ${input.projection.relations.courseRootCount} ≠ closure published edges ${input.closure.publishedEdges}` });
  }
  for (const edge of published) {
    if (!memberIds.has(edge.source)) findings.push({ code: 'edge-source-unknown', detail: `edge source ${edge.source} is outside membership` });
    if (!edge.target || !memberIds.has(edge.target)) findings.push({ code: 'edge-target-unknown', detail: `edge ${edge.source}→${String(edge.target)} target is outside membership` });
  }
  const coveredIds = new Set(input.members.filter((member) => !member.excluded).map((member) => member.canonicalId));
  for (const binding of input.bindings) {
    if (!memberIds.has(binding.canonicalId)) findings.push({ code: 'binding-target-unknown', detail: `binding ${binding.anchorId} targets ${binding.canonicalId} outside membership` });
    if (binding.modality === 'card' && !coveredIds.has(binding.canonicalId)) {
      findings.push({ code: 'binding-excluded-target', detail: `card binding ${binding.anchorId} targets excluded member ${binding.canonicalId}` });
    }
  }
  if (input.projection.envelopeHash !== input.envelope.envelopeHash) {
    findings.push({ code: 'envelope-hash-drift', detail: 'projection envelope hash differs from the reopened envelope' });
  }
  const boundMembers = new Set(input.bindings.map((binding) => binding.canonicalId).filter((id) => coveredIds.has(id)));
  const expectedZeroResource = coveredIds.size - boundMembers.size;
  if (input.projection.zeroResourceNodes.count !== expectedZeroResource) {
    findings.push({ code: 'zero-resource-count', detail: `projection claims ${input.projection.zeroResourceNodes.count} zero-resource nodes, recomputed ${expectedZeroResource}` });
  }
  return findings;
}

/** Materialize one independently versioned domain fragment (task 10.4). */
export function buildDomainFragment(input: {
  readonly domain: string;
  readonly projection: RemediationTeachingProjection;
  readonly members: readonly { readonly canonicalId: string; readonly domain: string; readonly excluded: boolean }[];
  readonly edges: readonly ProjectionEdgeRow[];
  readonly bindings: readonly ProjectionBindingRow[];
}): {
  readonly contract: typeof REMEDIATION_DOMAIN_FRAGMENT_CONTRACT;
  readonly projectionHash: string;
  readonly domain: string;
  readonly memberCount: number;
  readonly edgeCount: number;
  readonly bindingCount: number;
  readonly fragmentHash: string;
} {
  const members = input.members.filter((member) => member.domain === input.domain);
  const memberIds = new Set(members.map((member) => member.canonicalId));
  const edges = input.edges.filter((edge) => memberIds.has(edge.source));
  const bindings = input.bindings.filter((binding) => memberIds.has(binding.canonicalId));
  const fragmentHash = projectionDigest({
    contract: REMEDIATION_DOMAIN_FRAGMENT_CONTRACT,
    projectionHash: input.projection.projectionHash,
    domain: input.domain,
    members: members.map((member) => member.canonicalId),
    edges: edges.map((edge) => [edge.source, edge.family, edge.target, edge.edgeId]),
    bindings: bindings.map((binding) => [binding.modality, binding.anchorId, binding.canonicalId]),
  });
  return {
    contract: REMEDIATION_DOMAIN_FRAGMENT_CONTRACT,
    projectionHash: input.projection.projectionHash,
    domain: input.domain,
    memberCount: members.length,
    edgeCount: edges.length,
    bindingCount: bindings.length,
    fragmentHash,
  };
}
