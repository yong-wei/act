/**
 * Deterministic composition of domain teaching fragments (#1370).
 *
 * Ordered fragment identities + digests → one projection identity.
 * Adding/removing/replacing a fragment creates a new version; prior fragment
 * bytes are never rewritten.
 */

import { projectionDigest } from '../hash';
import {
  DOMAIN_TEACHING_COMPOSED_MANIFEST_CONTRACT,
  DOMAIN_TEACHING_COMPOSITION_BUILDER_VERSION,
  type DomainFragmentAuthorityBinding,
  type DomainFragmentAuthorityBindingComplete,
  type DomainFragmentAuthoritySelection,
  type DomainFragmentCoreNodePublished,
  type DomainFragmentRef,
  type DomainFragmentRelationPublished,
  type DomainTeachingComposedArtifacts,
  type DomainTeachingAuthorityEnvelope,
  type DomainTeachingComposedManifest,
  type DomainTeachingCompositionGate,
  type DomainTeachingCompositionGateFinding,
  type DomainTeachingFragment,
} from './contracts';
import { buildDomainCoverageReport } from './coverage';
import {
  DomainFragmentBuildError,
  projectionIdFromDigest,
  verifyDomainTeachingFragment,
} from './builder';
import {
  assertCompleteAuthorityBinding,
  authorityBindingMismatchFields,
  authoritySelectionFromEnvelope,
  authoritySelectionMismatchFields,
  assertDomainTeachingAuthorityEnvelope,
  assertPublishedAuthoritySelection,
  computeImmutableAuthorityDigest,
  domainFragmentEdgeSemanticKey,
  DomainFragmentValidationError,
  validateComposedRelations,
} from './validate';

export class DomainCompositionError extends Error {
  readonly code: string;
  readonly findings: DomainTeachingCompositionGateFinding[];
  /** Prior composed artifacts preserved on fail-closed rejection. */
  readonly priorArtifacts: DomainTeachingComposedArtifacts | null;

  constructor(
    code: string,
    message: string,
    options: {
      findings?: DomainTeachingCompositionGateFinding[];
      priorArtifacts?: DomainTeachingComposedArtifacts | null;
    } = {},
  ) {
    super(message);
    this.name = 'DomainCompositionError';
    this.code = code;
    this.findings = options.findings ?? [];
    this.priorArtifacts = options.priorArtifacts ?? null;
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

export interface ComposeDomainTeachingProjectionInput {
  /** Ordered accepted fragments. Order is part of projection identity. */
  fragments: readonly DomainTeachingFragment[];
  /**
   * Optional explicit authoring revision for the composition event.
   * Defaults to the lexicographically last fragment revision.
   */
  authoringRevision?: string;
  /**
   * Required for legal empty coverage composition when no prior exists.
   * Must be a complete coherent Authority binding — never fabricated/unbound.
   * When priorArtifacts exists, may be omitted and the prior binding is reused
   * only if it is complete and identical if both are supplied.
   */
  authorityBinding?: DomainFragmentAuthorityBinding | DomainFragmentAuthorityBindingComplete;
  /** Sealed Authority input identity for legal empty coverage. */
  authoritySelection?: DomainFragmentAuthoritySelection;
  /** Canonical envelope for empty coverage or extra composition-time checks. */
  authority?: DomainTeachingAuthorityEnvelope;
  /** Prior published composition preserved on fail-closed rejection. */
  priorArtifacts?: DomainTeachingComposedArtifacts | null;
}

function resolveEmptyCompositionSelection(input: {
  authorityBinding?: DomainFragmentAuthorityBinding | DomainFragmentAuthorityBindingComplete;
  authoritySelection?: DomainFragmentAuthoritySelection;
  prior: DomainTeachingComposedArtifacts | null;
}): DomainFragmentAuthoritySelection {
  const priorSelection = input.prior?.manifest.authoritySelection ?? null;
  let supplied: DomainFragmentAuthoritySelection | null = null;
  if (input.authoritySelection) {
    try {
      supplied = assertPublishedAuthoritySelection(
        input.authoritySelection,
        input.authoritySelection.authorityBinding,
        input.authoritySelection.captureRevision,
        'composition.authoritySelection',
      );
    } catch (error) {
      if (error instanceof DomainFragmentValidationError) {
        throw new DomainCompositionError(error.code, error.message, {
          findings: [
            {
              code: error.code,
              severity: 'error',
              message: error.message,
            },
          ],
          priorArtifacts: input.prior,
        });
      }
      throw error;
    }
  }

  if (supplied && priorSelection) {
    const priorComplete = assertPublishedAuthoritySelection(
      priorSelection,
      priorSelection.authorityBinding,
      priorSelection.captureRevision,
      'prior.authoritySelection',
    );
    const mismatch = authoritySelectionMismatchFields(supplied, priorComplete);
    if (mismatch.length > 0) {
      throw new DomainCompositionError(
        'authority-binding-mismatch',
        `empty composition authoritySelection mismatches prior on: ${mismatch.join(', ')}`,
        {
          findings: [
            {
              code: 'authority-selection-mismatch',
              severity: 'error',
              message: `authoritySelection mismatch: ${mismatch.join(', ')}`,
            },
          ],
          priorArtifacts: input.prior,
        },
      );
    }
    return supplied;
  }

  if (supplied) return supplied;

  if (priorSelection) {
    try {
      return assertPublishedAuthoritySelection(
        priorSelection,
        priorSelection.authorityBinding,
        priorSelection.captureRevision,
        'prior.authoritySelection',
      );
    } catch (error) {
      if (error instanceof DomainFragmentValidationError) {
        throw new DomainCompositionError(error.code, error.message, {
          findings: [
            {
              code: error.code,
              severity: 'error',
              message: error.message,
            },
          ],
          priorArtifacts: input.prior,
        });
      }
      throw error;
    }
  }

  throw new DomainCompositionError(
    'authority-selection-incomplete',
    'empty coverage composition requires a sealed Authority selection or a prior composed artifact with one',
    {
      findings: [
        {
          code: 'authority-selection-incomplete',
          severity: 'error',
          message:
            'empty composition must not emit an unsealed Authority identity',
        },
      ],
      priorArtifacts: input.prior,
    },
  );
}

function mergeCoreNodes(
  fragments: readonly DomainTeachingFragment[],
): DomainFragmentCoreNodePublished[] {
  const byId = new Map<string, DomainFragmentCoreNodePublished>();
  for (const fragment of fragments) {
    for (const node of fragment.coreNodes) {
      const existing = byId.get(node.canonicalId);
      if (!existing) {
        byId.set(node.canonicalId, {
          ...node,
          domainKeys: [...node.domainKeys],
          sourceEvidence: [...node.sourceEvidence],
        });
        continue;
      }
      // Merge domain memberships; conflicting digests with different policy fail.
      if (
        existing.pathEligible !== node.pathEligible
        || existing.cardPolicy !== node.cardPolicy
      ) {
        throw new DomainCompositionError(
          'core-node-conflict',
          `conflicting core node policy for ${node.canonicalId}`,
          {
            findings: [
              {
                code: 'core-node-conflict',
                severity: 'error',
                message: `conflicting core node policy for ${node.canonicalId}`,
                canonicalId: node.canonicalId,
              },
            ],
          },
        );
      }
      const domainSet = new Set([...existing.domainKeys, ...node.domainKeys]);
      const evidenceSet = new Set([
        ...existing.sourceEvidence,
        ...node.sourceEvidence,
      ]);
      const merged: Omit<DomainFragmentCoreNodePublished, 'nodeDigest'> = {
        canonicalId: existing.canonicalId,
        domainKeys: [...domainSet].sort(compareCodePoint) as DomainFragmentCoreNodePublished['domainKeys'],
        pathEligible: existing.pathEligible,
        cardPolicy: existing.cardPolicy,
        moduleId: existing.moduleId ?? node.moduleId,
        rationale: existing.rationale,
        sourceKind: existing.sourceKind,
        sourceEvidence: [...evidenceSet].sort(compareCodePoint),
      };
      byId.set(node.canonicalId, {
        ...merged,
        nodeDigest: projectionDigest(merged),
      });
    }
  }
  return sortBy([...byId.values()], (n) => n.canonicalId);
}

function pickStableNullable(left: string | null, right: string | null): string | null {
  if (left === right) return left;
  if (!left) return right;
  if (!right) return left;
  return compareCodePoint(left, right) <= 0 ? left : right;
}

function mergeRelations(
  fragments: readonly DomainTeachingFragment[],
): DomainFragmentRelationPublished[] {
  const bySemantic = new Map<string, DomainFragmentRelationPublished>();
  const edgeIdToSemantic = new Map<string, string>();

  for (const fragment of fragments) {
    for (const relation of fragment.relations) {
      const semanticKey = domainFragmentEdgeSemanticKey(relation);
      const existingSemanticForEdgeId = edgeIdToSemantic.get(relation.edgeId);
      if (existingSemanticForEdgeId && existingSemanticForEdgeId !== semanticKey) {
        throw new DomainCompositionError(
          'semantic-conflict',
          `edge ${relation.edgeId} has conflicting endpoints, direction or relation type`,
          {
            findings: [
              {
                code: 'semantic-conflict',
                severity: 'error',
                message: `edgeId ${relation.edgeId} conflicts on endpoints/direction/relation type`,
                edgeId: relation.edgeId,
              },
            ],
          },
        );
      }

      const existing = bySemantic.get(semanticKey);
      if (!existing) {
        bySemantic.set(semanticKey, {
          ...relation,
          domainKeys: [...relation.domainKeys],
          evidenceRefs: [...relation.evidenceRefs],
        });
        edgeIdToSemantic.set(relation.edgeId, semanticKey);
        continue;
      }

      if (existing.edgeId !== relation.edgeId) {
        throw new DomainCompositionError(
          'semantic-conflict',
          `semantic teaching edge uses conflicting edge ids ${existing.edgeId} vs ${relation.edgeId}`,
          {
            findings: [
              {
                code: 'semantic-conflict',
                severity: 'error',
                message: `edgeId conflict for ${relation.sourceNodeId}->${relation.targetNodeId}`,
                edgeId: relation.edgeId,
              },
            ],
          },
        );
      }
      if (
        existing.sourceNodeId !== relation.sourceNodeId
        || existing.targetNodeId !== relation.targetNodeId
      ) {
        throw new DomainCompositionError(
          'semantic-conflict',
          `edge ${relation.edgeId} has conflicting endpoints or direction`,
          {
            findings: [
              {
                code: 'semantic-conflict',
                severity: 'error',
                message: `endpoint/direction conflict for ${relation.edgeId}`,
                edgeId: relation.edgeId,
              },
            ],
          },
        );
      }
      if (existing.relationType !== relation.relationType) {
        throw new DomainCompositionError(
          'semantic-conflict',
          `edge ${relation.edgeId} has conflicting relation type`,
          {
            findings: [
              {
                code: 'semantic-conflict',
                severity: 'error',
                message: `relation type conflict for ${relation.edgeId}`,
                edgeId: relation.edgeId,
              },
            ],
          },
        );
      }
      if (existing.strength !== relation.strength) {
        throw new DomainCompositionError(
          'semantic-conflict',
          `edge ${relation.edgeId} has conflicting strength`,
          {
            findings: [
              {
                code: 'semantic-conflict',
                severity: 'error',
                message: `strength conflict for ${relation.edgeId}`,
                edgeId: relation.edgeId,
              },
            ],
          },
        );
      }
      if (
        existing.layer !== relation.layer
        || existing.presentationFamily !== relation.presentationFamily
      ) {
        throw new DomainCompositionError(
          'semantic-conflict',
          `edge ${relation.edgeId} has conflicting identity fields`,
          {
            findings: [
              {
                code: 'semantic-conflict',
                severity: 'error',
                message: `identity conflict for ${relation.edgeId}`,
                edgeId: relation.edgeId,
              },
            ],
          },
        );
      }

      const domainSet = new Set([
        ...existing.domainKeys,
        ...relation.domainKeys,
      ]);
      const evidenceSet = new Set([
        ...existing.evidenceRefs,
        ...relation.evidenceRefs,
      ]);
      const body: Omit<DomainFragmentRelationPublished, 'edgeDigest'> = {
        edgeId: existing.edgeId,
        sourceNodeId: existing.sourceNodeId,
        targetNodeId: existing.targetNodeId,
        layer: existing.layer,
        relationType: existing.relationType,
        strength: existing.strength,
        domainKeys: [...domainSet].sort(compareCodePoint) as DomainFragmentRelationPublished['domainKeys'],
        evidenceRefs: [...evidenceSet].sort(compareCodePoint),
        curatorId: pickStableNullable(existing.curatorId, relation.curatorId),
        curatorRationale: pickStableNullable(
          existing.curatorRationale,
          relation.curatorRationale,
        ),
        authorDecisionId: pickStableNullable(
          existing.authorDecisionId,
          relation.authorDecisionId,
        ),
        presentationFamily: existing.presentationFamily,
      };
      bySemantic.set(semanticKey, {
        ...body,
        edgeDigest: projectionDigest(body),
      });
    }
  }
  return sortBy([...bySemantic.values()], (r) => r.edgeId);
}

function evaluateGate(
  findings: DomainTeachingCompositionGateFinding[],
): DomainTeachingCompositionGate {
  const sorted = sortBy(
    findings,
    (f) => `${f.code}:${f.edgeId ?? f.canonicalId ?? f.fragmentId ?? f.message}`,
  );
  const hasErrors = sorted.some((f) => f.severity === 'error');
  return {
    status: hasErrors ? 'REVIEW_REQUIRED' : 'PUBLISHED',
    passed: !hasErrors,
    findings: sorted,
  };
}

/**
 * Compose ordered immutable fragments into one deterministic projection.
 */
export function composeDomainTeachingProjection(
  input: ComposeDomainTeachingProjectionInput,
): DomainTeachingComposedArtifacts {
  const prior = input.priorArtifacts ?? null;
  const findings: DomainTeachingCompositionGateFinding[] = [];

  try {
    if (!input.fragments || input.fragments.length === 0) {
      // Empty composition is legal: all domains empty coverage.
      // Must still carry a complete Authority binding (supplied or prior).
      const authoritySelection = resolveEmptyCompositionSelection({
        authorityBinding: input.authorityBinding,
        authoritySelection: input.authority
          ? authoritySelectionFromEnvelope(
              assertDomainTeachingAuthorityEnvelope(input.authority, 'composition.authority'),
            )
          : input.authoritySelection,
        prior,
      });
      const authorityBinding = authoritySelection.authorityBinding;
      const emptyFragments: DomainTeachingFragment[] = [];
      const coreNodes: DomainFragmentCoreNodePublished[] = [];
      const relations: DomainFragmentRelationPublished[] = [];
      const coverage = buildDomainCoverageReport({
        declaredDomainKeys: [],
        coreNodes,
        relations,
      });
      const gate = evaluateGate([]);
      const authoringRevision =
        input.authoringRevision
        ?? input.authority?.authoringRevision
        ?? prior?.manifest.authoringRevision
        ?? authoritySelection.captureRevision;
      const sourceInventoryDigest = projectionDigest({
        kind: 'act-domain-teaching-source-inventory',
        nodes: [],
        relations: [],
      });
      const authorityDigest = computeImmutableAuthorityDigest({
        binding: authorityBinding,
        sourceDatasetHash: authoritySelection.sourceDatasetHash,
        captureRevision: authoritySelection.captureRevision,
        authoringRevision,
        nodeIndexDigest: authoritySelection.nodeIndexDigest,
      });
      const fragmentRefs: DomainFragmentRef[] = [];
      const fragmentsHash = projectionDigest(fragmentRefs);
      const body = {
        contract: DOMAIN_TEACHING_COMPOSED_MANIFEST_CONTRACT,
        builderVersion: DOMAIN_TEACHING_COMPOSITION_BUILDER_VERSION,
        authorityBinding,
        authoritySelection,
        authoringRevision,
        sourceInventoryDigest,
        authorityDigest,
        fragments: fragmentRefs,
        domainCoverage: coverage,
        coreNodeCount: 0,
        relationCount: 0,
        gateStatus: gate.status,
        gatePassed: gate.passed,
        sourceHashes: {
          fragments: fragmentsHash,
          sourceInventory: sourceInventoryDigest,
        },
      };
      const bodyHash = projectionDigest(body);
      const projectionHash = projectionDigest({
        ...body,
        sourceHashes: {
          fragments: fragmentsHash,
          sourceInventory: sourceInventoryDigest,
          body: bodyHash,
        },
      });
      const manifest: DomainTeachingComposedManifest = {
        ...body,
        sourceHashes: {
          fragments: fragmentsHash,
          sourceInventory: sourceInventoryDigest,
          body: bodyHash,
        },
        projectionId: projectionIdFromDigest(projectionHash),
        projectionHash,
      };
      if (
        manifest.coreNodeCount !== coreNodes.length
        || manifest.relationCount !== relations.length
      ) {
        throw new DomainCompositionError(
          'count-mismatch',
          'empty composition count fields must match array lengths',
          { priorArtifacts: prior },
        );
      }
      return {
        fragments: emptyFragments,
        relations,
        coreNodes,
        coverage,
        gate,
        manifest,
      };
    }

    // Verify each fragment is immutable and undrifted.
    for (const fragment of input.fragments) {
      try {
        verifyDomainTeachingFragment(fragment);
      } catch (error) {
        if (error instanceof DomainFragmentBuildError) {
          findings.push(...error.findings);
          if (error.findings.length === 0) {
            findings.push({
              code: error.code,
              severity: 'error',
              message: error.message,
              fragmentId: fragment.fragmentId,
            });
          }
          continue;
        }
        throw error;
      }
    }

    // Authority binding must agree on every field across fragments.
    let sharedBinding: DomainFragmentAuthorityBindingComplete | null = null;
    let sharedSelection: DomainFragmentAuthoritySelection | null = null;
    for (const fragment of input.fragments) {
      let complete: DomainFragmentAuthorityBindingComplete;
      try {
        complete = assertCompleteAuthorityBinding(
          fragment.authorityBinding,
          `fragment:${fragment.fragmentKey}.authorityBinding`,
        );
      } catch (error) {
        if (error instanceof DomainFragmentValidationError) {
          findings.push({
            code: error.code,
            severity: 'error',
            message: error.message,
            fragmentId: fragment.fragmentId,
          });
          continue;
        }
        throw error;
      }
      if (!sharedBinding) {
        sharedBinding = complete;
      } else {
        const mismatch = authorityBindingMismatchFields(sharedBinding, complete);
        if (mismatch.length > 0) {
          findings.push({
            code: 'authority-binding-mismatch',
            severity: 'error',
            message: `fragment ${fragment.fragmentKey} authorityBinding mismatches on: ${mismatch.join(', ')}`,
            fragmentId: fragment.fragmentId,
          });
        }
      }
      let selection: DomainFragmentAuthoritySelection;
      try {
        selection = assertPublishedAuthoritySelection(
          fragment.authoritySelection,
          complete,
          fragment.authoringRevision,
          `fragment:${fragment.fragmentKey}.authoritySelection`,
        );
      } catch (error) {
        if (error instanceof DomainFragmentValidationError) {
          findings.push({
            code: error.code,
            severity: 'error',
            message: error.message,
            fragmentId: fragment.fragmentId,
          });
          continue;
        }
        throw error;
      }
      if (!sharedSelection) {
        sharedSelection = selection;
        continue;
      }
      const selectionMismatch = authoritySelectionMismatchFields(
        sharedSelection,
        selection,
      );
      if (selectionMismatch.length > 0) {
        findings.push({
          code: 'authority-selection-mismatch',
          severity: 'error',
          message: `fragment ${fragment.fragmentKey} authoritySelection mismatches on: ${selectionMismatch.join(', ')}`,
          fragmentId: fragment.fragmentId,
        });
      }
    }

    const fragmentKeys = new Set<string>();
    for (const fragment of input.fragments) {
      if (fragmentKeys.has(fragment.fragmentKey)) {
        findings.push({
          code: 'duplicate-fragment-key',
          severity: 'error',
          message: `duplicate fragmentKey ${fragment.fragmentKey}`,
          fragmentId: fragment.fragmentId,
        });
      }
      fragmentKeys.add(fragment.fragmentKey);
    }

    let coreNodes: DomainFragmentCoreNodePublished[] = [];
    let relations: DomainFragmentRelationPublished[] = [];
    try {
      coreNodes = mergeCoreNodes(input.fragments);
      relations = mergeRelations(input.fragments);
    } catch (error) {
      if (error instanceof DomainCompositionError) {
        findings.push(...error.findings);
      } else {
        throw error;
      }
    }

    findings.push(...validateComposedRelations(relations));

    const gate = evaluateGate(findings);
    if (!gate.passed) {
      throw new DomainCompositionError(
        'composition-rejected',
        `domain teaching composition rejected: ${
          gate.findings
            .filter((f) => f.severity === 'error')
            .map((f) => f.code)
            .join(', ') || 'validation failed'
        }`,
        { findings: gate.findings, priorArtifacts: prior },
      );
    }

    const declaredDomainKeys = [
      ...new Set(input.fragments.flatMap((f) => f.domainKeys)),
    ].sort(compareCodePoint) as DomainTeachingFragment['domainKeys'];

    const coverage = buildDomainCoverageReport({
      declaredDomainKeys,
      coreNodes,
      relations,
    });

    if (!sharedBinding) {
      throw new DomainCompositionError(
        'authority-binding-incomplete',
        'composition requires a complete Authority binding shared by all fragments',
        { findings: gate.findings, priorArtifacts: prior },
      );
    }
    if (!sharedSelection) {
      throw new DomainCompositionError(
        'authority-selection-incomplete',
        'composition requires a sealed Authority selection shared by all fragments',
        { findings: gate.findings, priorArtifacts: prior },
      );
    }

    // Optional composition-level binding must match fragment binding exactly.
    if (input.authorityBinding) {
      try {
        const supplied = assertCompleteAuthorityBinding(
          input.authorityBinding,
          'composition.authorityBinding',
        );
        const mismatch = authorityBindingMismatchFields(sharedBinding, supplied);
        if (mismatch.length > 0) {
          throw new DomainCompositionError(
            'authority-binding-mismatch',
            `composition authorityBinding mismatches fragments on: ${mismatch.join(', ')}`,
            {
              findings: [
                {
                  code: 'authority-binding-mismatch',
                  severity: 'error',
                  message: `authorityBinding mismatch: ${mismatch.join(', ')}`,
                },
              ],
              priorArtifacts: prior,
            },
          );
        }
      } catch (error) {
        if (error instanceof DomainCompositionError) throw error;
        if (error instanceof DomainFragmentValidationError) {
          throw new DomainCompositionError(error.code, error.message, {
            findings: [
              {
                code: error.code,
                severity: 'error',
                message: error.message,
              },
            ],
            priorArtifacts: prior,
          });
        }
        throw error;
      }
    }

    if (input.authoritySelection) {
      try {
        const supplied = assertPublishedAuthoritySelection(
          input.authoritySelection,
          input.authoritySelection.authorityBinding,
          input.authoritySelection.captureRevision,
          'composition.authoritySelection',
        );
        const mismatch = authoritySelectionMismatchFields(sharedSelection, supplied);
        if (mismatch.length > 0) {
          throw new DomainCompositionError(
            'authority-selection-mismatch',
            `composition authoritySelection mismatches fragments on: ${mismatch.join(', ')}`,
            {
              findings: [
                {
                  code: 'authority-selection-mismatch',
                  severity: 'error',
                  message: `authoritySelection mismatch: ${mismatch.join(', ')}`,
                },
              ],
              priorArtifacts: prior,
            },
          );
        }
      } catch (error) {
        if (error instanceof DomainCompositionError) throw error;
        if (error instanceof DomainFragmentValidationError) {
          throw new DomainCompositionError(error.code, error.message, {
            findings: [
              {
                code: error.code,
                severity: 'error',
                message: error.message,
              },
            ],
            priorArtifacts: prior,
          });
        }
        throw error;
      }
    }

    const authorityBinding = sharedBinding;
    const authoritySelection = sharedSelection;

    const authoringRevision =
      input.authoringRevision
      ?? [...input.fragments.map((f) => f.authoringRevision)].sort(compareCodePoint).at(-1)!;

    const fragmentRefs: DomainFragmentRef[] = input.fragments.map(
      (fragment, index) => ({
        order: index,
        fragmentId: fragment.fragmentId,
        fragmentKey: fragment.fragmentKey,
        fragmentVersion: fragment.fragmentVersion,
        fragmentDigest: fragment.fragmentDigest,
        sourceInventoryDigest: fragment.sourceInventoryDigest,
        domainKeys: [...fragment.domainKeys],
      }),
    );

    const fragmentsHash = projectionDigest(
      fragmentRefs.map((ref) => ({
        order: ref.order,
        fragmentId: ref.fragmentId,
        fragmentDigest: ref.fragmentDigest,
        sourceInventoryDigest: ref.sourceInventoryDigest,
      })),
    );
    const sourceInventoryDigest = projectionDigest(
      fragmentRefs.map((ref) => ({
        fragmentId: ref.fragmentId,
        sourceInventoryDigest: ref.sourceInventoryDigest,
      })),
    );
    const authorityDigest = computeImmutableAuthorityDigest({
      binding: authorityBinding,
      sourceDatasetHash: authoritySelection.sourceDatasetHash,
      captureRevision: authoritySelection.captureRevision,
      authoringRevision,
      nodeIndexDigest: authoritySelection.nodeIndexDigest,
    });

    const body = {
      contract: DOMAIN_TEACHING_COMPOSED_MANIFEST_CONTRACT,
      builderVersion: DOMAIN_TEACHING_COMPOSITION_BUILDER_VERSION,
      authorityBinding,
      authoritySelection,
      authoringRevision,
      sourceInventoryDigest,
      authorityDigest,
      fragments: fragmentRefs,
      domainCoverage: coverage,
      coreNodeCount: coreNodes.length,
      relationCount: relations.length,
      gateStatus: gate.status,
      gatePassed: gate.passed,
      sourceHashes: {
        fragments: fragmentsHash,
        sourceInventory: sourceInventoryDigest,
      },
    };
    const bodyHash = projectionDigest(body);
    const projectionHash = projectionDigest({
      ...body,
      sourceHashes: {
        fragments: fragmentsHash,
        sourceInventory: sourceInventoryDigest,
        body: bodyHash,
      },
    });

    const manifest: DomainTeachingComposedManifest = {
      ...body,
      sourceHashes: {
        fragments: fragmentsHash,
        sourceInventory: sourceInventoryDigest,
        body: bodyHash,
      },
      projectionId: projectionIdFromDigest(projectionHash),
      projectionHash,
    };

    if (
      manifest.coreNodeCount !== coreNodes.length
      || manifest.relationCount !== relations.length
    ) {
      throw new DomainCompositionError(
        'count-mismatch',
        'composed manifest counts must match derived coreNodes/relations lengths',
        { priorArtifacts: prior },
      );
    }

    // Fragment declared counts must also match their arrays (verified above via verify).
    for (const fragment of input.fragments) {
      if (
        fragment.coreNodeCount !== fragment.coreNodes.length
        || fragment.relationCount !== fragment.relations.length
      ) {
        throw new DomainCompositionError(
          'count-mismatch',
          `fragment ${fragment.fragmentId} count fields do not match arrays`,
          {
            findings: [
              {
                code: 'count-mismatch',
                severity: 'error',
                message: 'fragment count mismatch',
                fragmentId: fragment.fragmentId,
              },
            ],
            priorArtifacts: prior,
          },
        );
      }
    }

    return {
      fragments: [...input.fragments],
      relations,
      coreNodes,
      coverage,
      gate,
      manifest,
    };
  } catch (error) {
    if (error instanceof DomainCompositionError) {
      if (!error.priorArtifacts && prior) {
        throw new DomainCompositionError(error.code, error.message, {
          findings: error.findings,
          priorArtifacts: prior,
        });
      }
      throw error;
    }
    if (error instanceof Error) {
      throw new DomainCompositionError('composition-failed', error.message, {
        priorArtifacts: prior,
      });
    }
    throw new DomainCompositionError('composition-failed', 'unknown failure', {
      priorArtifacts: prior,
    });
  }
}

/**
 * Fail-closed composition: on rejection return prior artifacts unchanged.
 */
export function composeDomainTeachingProjectionFailClosed(
  input: ComposeDomainTeachingProjectionInput,
): {
  ok: boolean;
  artifacts: DomainTeachingComposedArtifacts | null;
  priorPreserved: boolean;
  findings: DomainTeachingCompositionGateFinding[];
  errorCode?: string;
  errorMessage?: string;
} {
  try {
    const artifacts = composeDomainTeachingProjection(input);
    return {
      ok: true,
      artifacts,
      priorPreserved: false,
      findings: artifacts.gate.findings,
    };
  } catch (error) {
    if (error instanceof DomainCompositionError) {
      return {
        ok: false,
        artifacts: error.priorArtifacts,
        priorPreserved: error.priorArtifacts != null,
        findings: error.findings,
        errorCode: error.code,
        errorMessage: error.message,
      };
    }
    return {
      ok: false,
      artifacts: input.priorArtifacts ?? null,
      priorPreserved: input.priorArtifacts != null,
      findings: [],
      errorCode: 'composition-failed',
      errorMessage: error instanceof Error ? error.message : 'unknown failure',
    };
  }
}

/**
 * Recompose from fragments and reject forged self-asserted identity.
 */
export function verifyDomainTeachingComposedArtifacts(
  artifacts: DomainTeachingComposedArtifacts,
): DomainTeachingComposedArtifacts {
  const recomputed = composeDomainTeachingProjection({
    fragments: artifacts.fragments,
    authoringRevision: artifacts.manifest.authoringRevision,
    authorityBinding: artifacts.manifest.authorityBinding,
    authoritySelection: artifacts.manifest.authoritySelection,
  });
  if (recomputed.manifest.projectionHash !== artifacts.manifest.projectionHash) {
    throw new DomainCompositionError(
      'projection-identity-drift',
      'composed projection hash does not match recomputed identity',
    );
  }
  if (recomputed.manifest.projectionId !== artifacts.manifest.projectionId) {
    throw new DomainCompositionError(
      'projection-identity-drift',
      'composed projection id does not match recomputed identity',
    );
  }
  if (
    artifacts.manifest.coreNodeCount !== recomputed.coreNodes.length
    || artifacts.manifest.relationCount !== recomputed.relations.length
    || artifacts.coreNodes.length !== recomputed.coreNodes.length
    || artifacts.relations.length !== recomputed.relations.length
  ) {
    throw new DomainCompositionError(
      'count-mismatch',
      'composed artifact counts do not match recomputed coreNodes/relations',
    );
  }
  if (artifacts.manifest.sourceHashes.body !== recomputed.manifest.sourceHashes.body) {
    throw new DomainCompositionError(
      'projection-identity-drift',
      'composed body digest does not match recomputed identity',
    );
  }
  return recomputed;
}
