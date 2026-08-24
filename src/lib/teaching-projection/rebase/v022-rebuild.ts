/** Complete inactive v0.22 projection + prerequisite rebuild. */

import { buildTeachingProjection } from '../builder';
import type {
  AuthorityNodeIndexEntry,
  TeachingBindingAuthoring,
  TeachingCardAuthoring,
  TeachingCoreNodeAuthoring,
  TeachingPrerequisiteAuthoring,
  TeachingProjectionArtifacts,
  TeachingProjectionAuthoringInput,
  TeachingResourceAuthoring,
} from '../contracts';
import {
  buildPrerequisitePublicationFailClosed,
} from '../prerequisites/builder';
import type {
  CoreNodeAuthoringRow,
  PrerequisiteAuthorDecision,
  PrerequisiteEdgeAuthoring,
  PrerequisitePublicationArtifacts,
} from '../prerequisites/contracts';
import { computeDecisionInputDigest, deriveAuthorDecisionId } from '../prerequisites/publication';
import { edgeIdentityKey } from '../prerequisites/edges';
import { projectionDigest } from '../hash';
import {
  assertV022MappingsResolved,
  buildV022ImpactEvidence,
  classifyV022IdentityMappings,
  referencedCanonicalIdsFromProjection,
  resolveV022CanonicalId,
  type V022IdentityMappingInput,
} from './v022-mapping';
import type {
  V022AuthorityBinding,
  V022AuthorityNodeRecord,
  V022ImpactEvidence,
  V022ReferenceRecord,
  V022RebaseArtifacts,
} from './v022-contracts';

export class V022RebuildError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'V022RebuildError';
    this.code = code;
  }
}

function stripUndefined(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripUndefined);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, item]) => item !== undefined)
        .map(([key, item]) => [key, stripUndefined(item)]),
    );
  }
  return value;
}

export interface V022PrerequisiteInput {
  coreNodes: readonly CoreNodeAuthoringRow[];
  edges: readonly PrerequisiteEdgeAuthoring[];
  decisions: readonly PrerequisiteAuthorDecision[];
  candidates?: readonly import('../prerequisites/contracts').PrerequisiteCandidateRecord[];
}

export interface BuildV022RebaseInput {
  authority: V022AuthorityBinding;
  sourceNodes: readonly V022AuthorityNodeRecord[];
  targetNodes: readonly V022AuthorityNodeRecord[];
  priorArtifacts: TeachingProjectionArtifacts;
  prerequisiteInput: V022PrerequisiteInput;
  references: readonly V022ReferenceRecord[];
  /** Optional explicitly reviewed identity mappings; never labels/names. */
  reviewedMappings?: V022IdentityMappingInput['reviewedMappings'];
  upstreamImpactEvidence?: {
    status: 'REJECTED_UPSTREAM';
    path: string;
    digest: string;
  };
}

function resourceAuthoring(artifacts: TeachingProjectionArtifacts): TeachingResourceAuthoring[] {
  return artifacts.resources.map((resource) => ({
    resourceId: resource.resourceId,
    resourceType: resource.resourceType,
    projectionMode: resource.projectionMode,
    scopeId: resource.scopeId,
    title: resource.title ?? undefined,
    sourcePath: resource.sourcePath ?? undefined,
    legacyCrosswalkRef: resource.legacyCrosswalkRef,
  }));
}

function bindingAuthoring(artifacts: TeachingProjectionArtifacts, mapping: V022ImpactEvidence): TeachingBindingAuthoring[] {
  return artifacts.bindings.map((binding) => ({
    resourceId: binding.resourceId,
    canonicalId: resolveV022CanonicalId(binding.canonicalId, mapping),
    role: binding.role,
    scopeId: binding.scopeId,
    sourcePath: binding.sourcePath ?? undefined,
    primary: binding.primary,
    rationale: binding.rationale ?? undefined,
  }));
}

function cardAuthoring(artifacts: TeachingProjectionArtifacts, mapping: V022ImpactEvidence): TeachingCardAuthoring[] {
  return artifacts.cardsIndex.cards.map((card) => ({
    cardId: card.cardId,
    canonicalId: resolveV022CanonicalId(card.canonicalId, mapping),
    active: card.active,
    required: card.required,
    sourcePath: card.sourcePath ?? undefined,
    title: card.title ?? undefined,
  }));
}

function mapCoreNodes(rows: readonly CoreNodeAuthoringRow[], mapping: V022ImpactEvidence): CoreNodeAuthoringRow[] {
  return rows.map((row) => ({
    ...row,
    canonicalId: resolveV022CanonicalId(row.canonicalId, mapping),
    sourceEvidence: [...row.sourceEvidence].sort(),
  }));
}

function mapPrerequisiteEdges(rows: readonly PrerequisiteEdgeAuthoring[], mapping: V022ImpactEvidence): PrerequisiteEdgeAuthoring[] {
  return rows.map((row) => ({
    ...row,
    sourceNodeId: resolveV022CanonicalId(row.sourceNodeId, mapping),
    targetNodeId: resolveV022CanonicalId(row.targetNodeId, mapping),
  }));
}

function mapDecisions(
  decisions: readonly PrerequisiteAuthorDecision[],
  edges: readonly PrerequisiteEdgeAuthoring[],
  authority: V022AuthorityBinding,
): PrerequisiteAuthorDecision[] {
  const edgeByDecision = new Map(edges.map((edge) => [edge.authorDecisionId ?? '', edge]));
  return decisions.map((decision) => {
    const edge = edgeByDecision.get(decision.decisionId);
    if (!edge) throw new V022RebuildError('missing-prerequisite-decision-edge', `decision ${decision.decisionId} has no authored edge`);
    const evidenceRefs = [...(edge.evidenceRefs ?? [])].sort();
    const curatorRationale = edge.curatorRationale ?? null;
    const inputDigest = computeDecisionInputDigest({
      sourceNodeId: edge.sourceNodeId,
      targetNodeId: edge.targetNodeId,
      strength: edge.strength,
      scopeId: edge.scopeId,
      evidenceRefs,
      curatorRationale,
    });
    const edgeKey = edgeIdentityKey({
      sourceNodeId: edge.sourceNodeId,
      targetNodeId: edge.targetNodeId,
      strength: edge.strength,
      scopeId: edge.scopeId,
    });
    return {
      ...decision,
      edgeKey,
      inputDigest,
      authorityReleaseId: authority.releaseId,
      projectionCaptureId: authority.snapshotId,
      authoringRevision: authority.captureRevision,
      decisionId: decision.decisionId || deriveAuthorDecisionId({ edgeKey, scopeId: edge.scopeId, inputDigest }),
    };
  });
}

function mapPrerequisitePublication(
  input: V022PrerequisiteInput,
  mapping: V022ImpactEvidence,
  authority: V022AuthorityBinding,
  targetNodes: readonly V022AuthorityNodeRecord[],
): PrerequisitePublicationArtifacts {
  const coreNodes = mapCoreNodes(input.coreNodes, mapping);
  const edges = mapPrerequisiteEdges(input.edges, mapping);
  const decisions = mapDecisions(input.decisions, edges, authority);
  const result = buildPrerequisitePublicationFailClosed({
    scopeId: coreNodes[0]?.scopeId ?? 'act-control-theory-core',
    authoringRevision: authority.captureRevision,
    authorityReleaseId: authority.releaseId,
    projectionCaptureId: authority.snapshotId,
    authorityNodes: targetNodes,
    coreNodes,
    edges,
    decisions,
    candidates: input.candidates ?? [],
  });
  if (!result.ok || !result.artifacts) {
    throw new V022RebuildError(
      result.errorCode ?? 'prerequisite-build-failed',
      result.errorMessage ?? 'v0.22 prerequisite publication rejected',
    );
  }
  if (!result.artifacts.gate.passed) {
    throw new V022RebuildError('prerequisite-gate-failed', 'v0.22 prerequisite publication gate did not pass');
  }
  return result.artifacts;
}

function mapPrerequisiteAuthoring(
  input: V022PrerequisiteInput,
  mapping: V022ImpactEvidence,
  authority: V022AuthorityBinding,
): V022PrerequisiteInput {
  const edges = mapPrerequisiteEdges(input.edges, mapping);
  return {
    coreNodes: mapCoreNodes(input.coreNodes, mapping),
    edges,
    decisions: mapDecisions(input.decisions, edges, authority),
    candidates: input.candidates ?? [],
  };
}

function projectionAuthoring(
  prior: TeachingProjectionArtifacts,
  prerequisite: PrerequisitePublicationArtifacts,
  mapping: V022ImpactEvidence,
  authority: V022AuthorityBinding,
  targetNodes: readonly V022AuthorityNodeRecord[],
): TeachingProjectionAuthoringInput {
  const authorityNodes: AuthorityNodeIndexEntry[] = targetNodes.map((node) => ({
    canonicalId: node.canonicalId,
    lifecycleStatus: node.lifecycleStatus,
    successorCanonicalId: node.successorCanonicalId ?? null,
  }));
  return {
    contract: 'act-teaching-projection-authoring/v1',
    scopeId: prior.manifest.scopeId,
    authoringRevision: authority.captureRevision,
    authorityReleaseId: authority.releaseId,
    authorityReleaseSetId: authority.releaseSetId,
    authoritySnapshotId: authority.snapshotId,
    authoritySnapshotHash: authority.snapshotHash,
    resources: resourceAuthoring(prior),
    bindings: bindingAuthoring(prior, mapping),
    prerequisites: prerequisite.projectionPrerequisites,
    coreNodes: prerequisite.projectionCoreNodes,
    cards: cardAuthoring(prior, mapping),
    authorityNodes,
  };
}

export function buildV022IdentityRebase(input: BuildV022RebaseInput): V022RebaseArtifacts {
  const referencedCanonicalIds = referencedCanonicalIdsFromProjection(input.priorArtifacts);
  const identityRecords = classifyV022IdentityMappings({
    sourceNodes: input.sourceNodes,
    targetNodes: input.targetNodes,
    referencedCanonicalIds,
    reviewedMappings: input.reviewedMappings,
  });
  const mapping = buildV022ImpactEvidence({
    records: identityRecords,
    historicalExcludedCount: 4880,
    unreferencedExcludedCount: input.targetNodes.length - input.sourceNodes.length,
    upstreamImpactEvidence: input.upstreamImpactEvidence,
  });
  assertV022MappingsResolved(mapping);
  for (const reference of input.references) {
    if (reference.kind !== 'infograph') continue;
    if (reference.canonicalIds.length > 0) {
      for (const canonicalId of reference.canonicalIds) resolveV022CanonicalId(canonicalId, mapping);
    } else if (!reference.reviewedNonSemanticDisposition) {
      throw new V022RebuildError(
        'reference-unclosed',
        `captured infograph ${reference.referenceId} has no identity successor or reviewed non-semantic disposition`,
      );
    }
  }
  const prerequisite = mapPrerequisitePublication(
    input.prerequisiteInput,
    mapping,
    input.authority,
    input.targetNodes,
  );
  const mappedPrerequisiteInput = mapPrerequisiteAuthoring(
    input.prerequisiteInput,
    mapping,
    input.authority,
  );
  const authoring = stripUndefined(projectionAuthoring(
    input.priorArtifacts,
    prerequisite,
    mapping,
    input.authority,
    input.targetNodes,
  )) as TeachingProjectionAuthoringInput;
  const projection = buildTeachingProjection(authoring);
  if (!projection.gate.passed) {
    throw new V022RebuildError('projection-gate-failed', 'v0.22 Teaching Projection gate did not pass');
  }
  const expectedAuthorityDigest = projectionDigest(input.targetNodes.map((node) => ({
    canonicalId: node.canonicalId,
    canonicalType: node.canonicalType,
  })).sort((a, b) => a.canonicalId < b.canonicalId ? -1 : a.canonicalId > b.canonicalId ? 1 : 0));
  if (!expectedAuthorityDigest) throw new V022RebuildError('authority-empty', 'v0.22 Authority target is empty');
  return {
    authoring,
    projection,
    prerequisite,
    prerequisiteInput: {
      ...mappedPrerequisiteInput,
      candidates: mappedPrerequisiteInput.candidates ?? [],
    },
    references: [...input.references],
    capture: {
      contract: 'act-teaching-projection-capture-receipt/v1',
      captureRevision: input.authority.captureRevision,
      manifestDigest: input.authority.candidateReceiptDigest,
      inventoryDigest: projectionDigest(input.references),
      denominatorDigest: projectionDigest(input.references),
      referenceCount: input.references.length,
      excludedHistoricalCount: 4880,
      excludedUnreferencedCount: mapping.excludedUnreferencedCount,
      fileMembershipExecutionBound: true,
    },
    mapping,
  };
}
