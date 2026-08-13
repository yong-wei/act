/**
 * Build immutable domain teaching fragments (#1370).
 */

import { projectionDigest } from '../hash';
import { projectionIdFromHash } from '../identity';
import {
  ACT_TEACHING_LAYER,
  DOMAIN_TEACHING_FRAGMENT_BUILDER_VERSION,
  DOMAIN_TEACHING_FRAGMENT_CONTRACT,
  TEACHING_RELATION_PRESENTATION_REGISTRY,
  type DomainFragmentCoreNodePublished,
  type DomainFragmentRelationPublished,
  type DomainFragmentAuthoritySelection,
  type DomainTeachingAuthorityEnvelope,
  type DomainTeachingFragment,
  type DomainTeachingFragmentAuthoring,
  type DomainTeachingCompositionGateFinding,
  type RegisteredTeachingRelationType,
} from './contracts';
import {
  sortDomainKeys,
  validateDomainFragmentAuthoring,
  validateDomainKeys,
  assertNonEmpty,
  assertCompleteAuthorityBinding,
  assertAuthoringMatchesEnvelope,
  assertDomainTeachingAuthorityEnvelope,
  assertPublishedAuthoritySelection,
  computeImmutableAuthorityDigest,
  domainFragmentEdgeIdentityKey,
  DomainFragmentValidationError,
} from './validate';

export class DomainFragmentBuildError extends Error {
  readonly code: string;
  readonly findings: DomainTeachingCompositionGateFinding[];

  constructor(
    code: string,
    message: string,
    findings: DomainTeachingCompositionGateFinding[] = [],
  ) {
    super(message);
    this.name = 'DomainFragmentBuildError';
    this.code = code;
    this.findings = findings;
  }
}

function compareCodePoint(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function sortBy<T>(items: readonly T[], keyFn: (item: T) => string): T[] {
  return [...items].sort((a, b) => compareCodePoint(keyFn(a), keyFn(b)));
}

export function deriveDomainTeachingEdgeId(input: {
  sourceNodeId: string;
  targetNodeId: string;
  relationType: string;
  strength: string;
}): string {
  const digest = projectionDigest({
    sourceNodeId: input.sourceNodeId,
    targetNodeId: input.targetNodeId,
    relationType: input.relationType,
    strength: input.strength,
    layer: ACT_TEACHING_LAYER,
  });
  return `dt-edge-${digest.slice(0, 24)}`;
}

function publishCoreNode(
  node: DomainTeachingFragmentAuthoring['coreNodes'][number],
): DomainFragmentCoreNodePublished {
  const domainKeys = sortDomainKeys(
    validateDomainKeys(node.domainKeys as string[], `core ${node.canonicalId}`),
  );
  const sourceEvidence = [...node.sourceEvidence].map(String).sort(compareCodePoint);
  const published: Omit<DomainFragmentCoreNodePublished, 'nodeDigest'> = {
    canonicalId: node.canonicalId,
    domainKeys,
    pathEligible: node.pathEligible === true,
    cardPolicy: node.cardPolicy,
    moduleId: node.moduleId ?? null,
    rationale: node.rationale.trim(),
    sourceKind: node.sourceKind,
    sourceEvidence,
  };
  return {
    ...published,
    nodeDigest: projectionDigest(published),
  };
}

function publishRelation(
  relation: DomainTeachingFragmentAuthoring['relations'][number],
): DomainFragmentRelationPublished {
  const relationType = relation.relationType as RegisteredTeachingRelationType;
  const presentation = TEACHING_RELATION_PRESENTATION_REGISTRY[relationType];
  const domainKeys = sortDomainKeys(
    validateDomainKeys(
      relation.domainKeys as string[],
      `relation ${relation.sourceNodeId}->${relation.targetNodeId}`,
    ),
  );
  const evidenceRefs = [...(relation.evidenceRefs ?? [])]
    .map(String)
    .sort(compareCodePoint);
  const edgeId =
    relation.edgeId?.trim()
    || deriveDomainTeachingEdgeId({
      sourceNodeId: relation.sourceNodeId,
      targetNodeId: relation.targetNodeId,
      relationType,
      strength: relation.strength,
    });

  const body: Omit<DomainFragmentRelationPublished, 'edgeDigest'> = {
    edgeId,
    sourceNodeId: relation.sourceNodeId,
    targetNodeId: relation.targetNodeId,
    layer: ACT_TEACHING_LAYER,
    relationType,
    strength: relation.strength,
    domainKeys,
    evidenceRefs,
    curatorId: relation.curatorId?.trim() || null,
    curatorRationale: relation.curatorRationale?.trim() || null,
    authorDecisionId: relation.authorDecisionId?.trim() || null,
    presentationFamily: presentation.presentationFamily,
  };

  return {
    ...body,
    edgeDigest: projectionDigest(body),
  };
}

/**
 * Compute the immutable digest of a published fragment body (without identity fields).
 */
export function computeFragmentBodyDigest(input: {
  fragmentKey: string;
  fragmentVersion: string;
  domainKeys: readonly string[];
  authorityBinding: DomainTeachingFragment['authorityBinding'];
  authoritySelection: DomainFragmentAuthoritySelection;
  authoringRevision: string;
  sourceInventoryDigest: string;
  authorityDigest: string;
  evidenceRefs: readonly string[];
  coreNodes: readonly DomainFragmentCoreNodePublished[];
  relations: readonly DomainFragmentRelationPublished[];
}): string {
  return projectionDigest({
    contract: DOMAIN_TEACHING_FRAGMENT_CONTRACT,
    builderVersion: DOMAIN_TEACHING_FRAGMENT_BUILDER_VERSION,
    fragmentKey: input.fragmentKey,
    fragmentVersion: input.fragmentVersion,
    domainKeys: sortDomainKeys(input.domainKeys as never),
    authorityBinding: input.authorityBinding,
    authoritySelection: input.authoritySelection,
    authoringRevision: input.authoringRevision,
    sourceInventoryDigest: input.sourceInventoryDigest,
    authorityDigest: input.authorityDigest,
    evidenceRefs: [...input.evidenceRefs].sort(compareCodePoint),
    coreNodes: sortBy(input.coreNodes, (n) => n.canonicalId),
    relations: sortBy(input.relations, (r) => r.edgeId),
  });
}

/**
 * Digest the normalized source members that actually produced a fragment.
 * This is deliberately computed from materialized input rather than accepted
 * as an authoring assertion.
 */
export function computeDomainTeachingSourceInventoryDigest(input: {
  coreNodes: readonly {
    canonicalId: string;
    sourceKind: string;
    sourceEvidence: readonly string[];
    moduleId?: string | null;
    pathEligible?: boolean;
    cardPolicy?: string;
  }[];
  relations: readonly {
    sourceNodeId: string;
    targetNodeId: string;
    relationType: string;
    strength: string;
    evidenceRefs?: readonly string[];
    edgeId?: string | null;
    authorDecisionId?: string | null;
  }[];
}): string {
  return projectionDigest({
    kind: 'act-domain-teaching-source-inventory',
    nodes: sortBy(input.coreNodes, (node) => node.canonicalId).map((node) => ({
      canonicalId: node.canonicalId,
      sourceKind: node.sourceKind,
      sourceEvidence: [...node.sourceEvidence].map(String).sort(compareCodePoint),
      moduleId: node.moduleId ?? null,
      pathEligible: node.pathEligible === true,
      cardPolicy: node.cardPolicy ?? null,
    })),
    relations: sortBy(
      input.relations,
      (relation) =>
        `${relation.sourceNodeId}\u001f${relation.targetNodeId}\u001f${relation.relationType}\u001f${relation.strength}`,
    ).map((relation) => ({
      edgeId: relation.edgeId ?? null,
      sourceNodeId: relation.sourceNodeId,
      targetNodeId: relation.targetNodeId,
      relationType: relation.relationType,
      strength: relation.strength,
      evidenceRefs: [...(relation.evidenceRefs ?? [])].map(String).sort(compareCodePoint),
      authorDecisionId: relation.authorDecisionId ?? null,
    })),
  });
}

/**
 * Build one immutable domain fragment from reviewed authoring.
 * Fail closed on validity errors; does not mutate prior fragments.
 */
export function buildDomainTeachingFragment(
  authoring: DomainTeachingFragmentAuthoring,
  authority: DomainTeachingAuthorityEnvelope,
): DomainTeachingFragment {
  let envelope: DomainTeachingAuthorityEnvelope;
  try {
    envelope = assertDomainTeachingAuthorityEnvelope(authority, 'build.authority');
  } catch (error) {
    if (error instanceof DomainFragmentValidationError) {
      throw new DomainFragmentBuildError(error.code, error.message, error.findings);
    }
    throw error;
  }

  const findings = validateDomainFragmentAuthoring(authoring, envelope);
  const errors = findings.filter((f) => f.severity === 'error');
  if (errors.length > 0) {
    throw new DomainFragmentBuildError(
      'fragment-rejected',
      `domain fragment rejected: ${errors.map((f) => f.code).join(', ')}`,
      findings,
    );
  }

  const fragmentKey = assertNonEmpty(authoring.fragmentKey, 'fragmentKey');
  const fragmentVersion = assertNonEmpty(
    authoring.fragmentVersion,
    'fragmentVersion',
  );
  const authoringRevision = assertNonEmpty(
    authoring.authoringRevision,
    'authoringRevision',
  );
  const domainKeys = sortDomainKeys(
    validateDomainKeys(authoring.domainKeys as string[], 'fragment.domainKeys'),
  );
  let authorityBinding;
  let authoritySelection: DomainFragmentAuthoritySelection;
  try {
    authorityBinding = assertCompleteAuthorityBinding(
      authoring.authorityBinding,
      'authorityBinding',
    );
    authoritySelection = assertAuthoringMatchesEnvelope(authoring, envelope);
  } catch (error) {
    if (error instanceof DomainFragmentValidationError) {
      throw new DomainFragmentBuildError(error.code, error.message, error.findings);
    }
    throw error;
  }
  const evidenceRefs = [...(authoring.evidenceRefs ?? [])]
    .map(String)
    .sort(compareCodePoint);

  const coreNodes = sortBy(
    (authoring.coreNodes ?? []).map(publishCoreNode),
    (n) => n.canonicalId,
  );
  const relations = sortBy(
    (authoring.relations ?? []).map(publishRelation),
    (r) => r.edgeId,
  );
  const sourceInventoryDigest = computeDomainTeachingSourceInventoryDigest({
    coreNodes,
    relations,
  });
  if (
    authoring.sourceInventoryDigest
    && authoring.sourceInventoryDigest !== sourceInventoryDigest
  ) {
    throw new DomainFragmentBuildError(
      'source-digest-mismatch',
      'source-digest-mismatch: authoring.sourceInventoryDigest does not match the recomputed source inventory digest',
    );
  }
  const authorityDigest = computeImmutableAuthorityDigest({
    binding: envelope.binding,
    sourceDatasetHash: envelope.sourceDatasetHash,
    captureRevision: envelope.captureRevision,
    authoringRevision: envelope.authoringRevision,
    nodeIndexDigest: envelope.nodeIndexDigest,
  });

  // Deduplicate by edge identity after materialization (should already be clean).
  const seen = new Set<string>();
  for (const relation of relations) {
    const key = domainFragmentEdgeIdentityKey(relation);
    if (seen.has(key)) {
      throw new DomainFragmentBuildError(
        'duplicate-edge',
        `duplicate edge after publish: ${relation.edgeId}`,
        [
          {
            code: 'duplicate-edge',
            severity: 'error',
            message: `duplicate edge ${relation.edgeId}`,
            edgeId: relation.edgeId,
          },
        ],
      );
    }
    seen.add(key);
  }

  const fragmentDigest = computeFragmentBodyDigest({
    fragmentKey,
    fragmentVersion,
    domainKeys,
    authorityBinding,
    authoritySelection,
    authoringRevision,
    sourceInventoryDigest,
    authorityDigest,
    evidenceRefs,
    coreNodes,
    relations,
  });
  const fragmentId = `dtf-${fragmentDigest}`;

  return {
    contract: DOMAIN_TEACHING_FRAGMENT_CONTRACT,
    builderVersion: DOMAIN_TEACHING_FRAGMENT_BUILDER_VERSION,
    fragmentId,
    fragmentKey,
    fragmentVersion,
    fragmentDigest,
    domainKeys,
    authorityBinding,
    authoritySelection,
    authoringRevision,
    sourceInventoryDigest,
    authorityDigest,
    evidenceRefs,
    coreNodes,
    relations,
    coreNodeCount: coreNodes.length,
    relationCount: relations.length,
  };
}

/**
 * Recompute digest and verify an already-built fragment has not drifted.
 */
export function verifyDomainTeachingFragment(
  fragment: DomainTeachingFragment,
): void {
  if (fragment.contract !== DOMAIN_TEACHING_FRAGMENT_CONTRACT) {
    throw new DomainFragmentBuildError(
      'fragment-identity-drift',
      `unexpected fragment contract ${fragment.contract}`,
    );
  }
  const recomputed = computeFragmentBodyDigest({
    fragmentKey: fragment.fragmentKey,
    fragmentVersion: fragment.fragmentVersion,
    domainKeys: fragment.domainKeys,
    authorityBinding: fragment.authorityBinding,
    authoritySelection: fragment.authoritySelection,
    authoringRevision: fragment.authoringRevision,
    sourceInventoryDigest: fragment.sourceInventoryDigest,
    authorityDigest: fragment.authorityDigest,
    evidenceRefs: fragment.evidenceRefs,
    coreNodes: fragment.coreNodes,
    relations: fragment.relations,
  });
  if (recomputed !== fragment.fragmentDigest) {
    throw new DomainFragmentBuildError(
      'fragment-identity-drift',
      `fragment-identity-drift: fragment ${fragment.fragmentId} digest drift`,
      [
        {
          code: 'fragment-identity-drift',
          severity: 'error',
          message: `fragment ${fragment.fragmentId} digest mismatch`,
          fragmentId: fragment.fragmentId,
        },
      ],
    );
  }
  const expectedId = `dtf-${recomputed}`;
  if (fragment.fragmentId !== expectedId) {
    throw new DomainFragmentBuildError(
      'fragment-identity-drift',
      `fragment id mismatch for ${fragment.fragmentKey}`,
    );
  }

  try {
    assertCompleteAuthorityBinding(fragment.authorityBinding, 'fragment.authorityBinding');
    assertPublishedAuthoritySelection(
      fragment.authoritySelection,
      fragment.authorityBinding,
      fragment.authoritySelection.captureRevision,
      'fragment.authoritySelection',
    );
  } catch (error) {
    if (error instanceof DomainFragmentValidationError) {
      throw new DomainFragmentBuildError(error.code, error.message, error.findings);
    }
    throw error;
  }

  const expectedSourceInventoryDigest = computeDomainTeachingSourceInventoryDigest({
    coreNodes: fragment.coreNodes,
    relations: fragment.relations,
  });
  if (fragment.sourceInventoryDigest !== expectedSourceInventoryDigest) {
    throw new DomainFragmentBuildError(
      'source-inventory-drift',
      `fragment ${fragment.fragmentId} source inventory digest drift`,
    );
  }

  const expectedAuthorityDigest = computeImmutableAuthorityDigest({
    binding: fragment.authoritySelection.authorityBinding,
    sourceDatasetHash: fragment.authoritySelection.sourceDatasetHash,
    captureRevision: fragment.authoritySelection.captureRevision,
    authoringRevision: fragment.authoringRevision,
    nodeIndexDigest: fragment.authoritySelection.nodeIndexDigest,
  });
  if (fragment.authorityDigest !== expectedAuthorityDigest) {
    throw new DomainFragmentBuildError(
      'authority-digest-mismatch',
      `fragment ${fragment.fragmentId} authority digest drift`,
    );
  }

  if (fragment.coreNodeCount !== fragment.coreNodes.length) {
    throw new DomainFragmentBuildError(
      'count-mismatch',
      `fragment ${fragment.fragmentId} coreNodeCount ${fragment.coreNodeCount} != coreNodes.length ${fragment.coreNodes.length}`,
      [
        {
          code: 'count-mismatch',
          severity: 'error',
          message: 'coreNodeCount does not match coreNodes array length',
          fragmentId: fragment.fragmentId,
        },
      ],
    );
  }
  if (fragment.relationCount !== fragment.relations.length) {
    throw new DomainFragmentBuildError(
      'count-mismatch',
      `fragment ${fragment.fragmentId} relationCount ${fragment.relationCount} != relations.length ${fragment.relations.length}`,
      [
        {
          code: 'count-mismatch',
          severity: 'error',
          message: 'relationCount does not match relations array length',
          fragmentId: fragment.fragmentId,
        },
      ],
    );
  }
}

/** Stable id helper re-export for compose. */
export function projectionIdFromDigest(digest: string): string {
  return projectionIdFromHash(digest);
}
