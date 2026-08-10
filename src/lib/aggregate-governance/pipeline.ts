import type {
  CanonicalObjectIndexEntry,
  CanonicalResourceBindingDecision,
  ResourceSegmentIndexEntry,
} from '@/lib/canonical-resource-binding';
import { selectResourceKnowledgeAuthority } from '@/lib/canonical-resource-binding';

import {
  AGGREGATE_SEMANTIC_ALIGNMENT_GENERATOR_PROMPT_VERSION,
  acceptSemanticAlignment,
  attemptDeterministicAlignment,
  crosswalkCaptureIdentityDrift,
  crosswalkStructuralComparable,
  generateSemanticAlignmentCandidates,
  invalidateCrosswalks,
  markCrosswalkStale,
  priorFromCrosswalk,
  rebindValidatedCrosswalkToCapture,
  referenceOpaqueUpstream,
  resolveCurrentIncludedStructuralTuple,
  semanticAlignmentCandidateId,
  validateCrosswalkForShadowPublication,
} from './act-crosswalk';
import {
  isExactBaselineGovernanceReplay,
  requireCoherentCapture,
  type ObservedCaptureFields,
  type PriorGovernanceReceiptIdentity,
} from './capture';
import type {
  ActStructuralUnitCrosswalkRecord,
  AggregateGovernanceReceipt,
  CaptureIdentity,
  CourseCoverageDisposition,
  GovernanceWorkManifest,
  OpaqueUpstreamRagReference,
  RevalidationReceipt,
  StructuralUnitIndexEntry,
} from './contracts';
import {
  admittedCanonicalIds,
  courseRoleCreatesTeachingProjectionEdge,
  mergeIncrementalCoverage,
  validateCourseCoverageAuthoring,
} from './course-coverage';
import { sha256Canonical, tripleKey } from './hash';
import { buildDownstreamReadinessDiagnostics } from './readiness';
import {
  buildResourceIndexFromValidatedCrosswalks,
  deriveChangedResourceSegments,
  enrichResourceIndexWithChangedSegmentCandidates,
} from './resource-index';
import {
  assertFormalSelectorsRemainLegacy,
  buildBindingPublicationGateContext,
  governResourceBindings,
  type BindingReviewAuthoringEntry,
} from './resource-bindings';
import { evaluateSemanticRevalidation, packagingNoopRevalidation } from './revalidation';
import { buildAggregateGovernanceSummary } from './summary';
import { classifyUpstreamReference } from './upstream-classification';
import {
  buildGovernanceWorkManifest,
  expandBaselineCrosswalkWork,
  type DeltaSignalLike,
} from './work-manifest';

export interface AggregateGovernanceRunInput {
  capture: CaptureIdentity;
  /**
   * Independently observed capture fields. Must not be the same object as
   * `capture`. Drift fails before any semantic work or persistence.
   */
  observedCapture: ObservedCaptureFields;
  hasGovernedCoverageBaseline: boolean;
  /**
   * Latest persisted governance receipt identity for this ReleaseSet lineage.
   * Used only for fail-closed exact same-input baseline replay detection.
   */
  priorGovernanceReceipt?: PriorGovernanceReceiptIdentity | null;
  deltaClassification: string;
  currentCanonicalIds: readonly string[];
  signals: readonly DeltaSignalLike[];
  upstreamReferences: readonly OpaqueUpstreamRagReference[];
  structuralUnitIndex: readonly StructuralUnitIndexEntry[];
  /** Optional stable id/hash hints keyed by tripleKey. */
  alignmentHints?: Readonly<Record<string, {
    stableIds?: string[];
    contentHashes?: string[];
  }>>;
  coverageAuthoring: unknown | null;
  currentCoverageEntries?: readonly CourseCoverageDisposition[];
  previousCrosswalks?: readonly ActStructuralUnitCrosswalkRecord[];
  previousDecisions?: readonly CanonicalResourceBindingDecision[];
  canonicalIndex?: readonly CanonicalObjectIndexEntry[];
  resourceIndex?: readonly ResourceSegmentIndexEntry[];
  changedResourceSegments?: ReadonlyArray<{
    resourceId: string;
    structuralUnitId: string;
    segmentId: string;
    resourceSegmentHash: string;
    candidateCanonicalIds?: string[];
  }>;
  /**
   * Prior coverage / Crosswalk / binding publication identity required for
   * packaging no-op. Must not be the new Delta or Release identity.
   */
  priorSemanticPublicationIdentity?: string | null;
  generatorPromptVersion?: string;
  /**
   * Controlled Crosswalk semantic reviews keyed by
   * publishedEntityId\x1fretrievalChunkId\x1fcitationTargetId.
   * Production CLI loads these from Git-tracked authoring.
   */
  semanticReviews?: Readonly<Record<string, {
    outcome: 'ACCEPT' | 'REJECT' | 'AMBIGUOUS' | 'UNSUPPORTED' | 'HIGH_IMPACT';
    reviewIdentity: string;
    reviewerPromptVersion: string;
    evidenceDigest: string;
    rationale: string;
    candidateId?: string;
  }>>;
  /**
   * Controlled #1124 binding reviews keyed by pairId.
   * Absent entries leave candidates pending — never auto-accepted.
   */
  bindingReviews?: Readonly<Record<string, BindingReviewAuthoringEntry>>;
}

export interface AggregateGovernanceRunResult {
  manifest: GovernanceWorkManifest;
  coverageEntries: CourseCoverageDisposition[];
  coverageVersionId: string | null;
  crosswalks: ActStructuralUnitCrosswalkRecord[];
  /** Validated CURRENT shadow publications only. */
  publishedCrosswalks: ActStructuralUnitCrosswalkRecord[];
  unresolvedCrosswalkDiagnostics: ActStructuralUnitCrosswalkRecord[];
  invalidatedCrosswalks: ActStructuralUnitCrosswalkRecord[];
  binding: ReturnType<typeof governResourceBindings> | null;
  revalidationReceipts: RevalidationReceipt[];
  receipt: AggregateGovernanceReceipt;
  admittedCanonicalIds: string[];
  teachingProjectionEdgesCreated: false;
  selectorsLegacy: true;
}

function resolveOneCrosswalk(input: {
  upstream: OpaqueUpstreamRagReference;
  /** Null for relation-type upstream. */
  canonicalId: string | null;
  capture: CaptureIdentity;
  index: readonly StructuralUnitIndexEntry[];
  hints?: { stableIds?: string[]; contentHashes?: string[] };
  semanticReviews?: AggregateGovernanceRunInput['semanticReviews'];
}): ActStructuralUnitCrosswalkRecord {
  const deterministic = attemptDeterministicAlignment({
    upstream: input.upstream,
    canonicalId: input.canonicalId,
    capture: input.capture,
    index: input.index,
    stableIds: input.hints?.stableIds,
    contentHashes: input.hints?.contentHashes,
  });
  if (deterministic.validationState === 'VALIDATED') return deterministic;

  // Relation/other upstream never enters semantic object alignment.
  if (!input.canonicalId) return deterministic;

  // Semantic alignment acceptance requires an explicit evidence-bearing
  // isolated review. Without it, remain unresolved.
  const reviewKey = [
    input.upstream.publishedEntityId,
    input.upstream.retrievalChunkId,
    input.upstream.citationTargetId,
  ].join('\u001f');
  const review = input.semanticReviews?.[reviewKey];
  if (!review) return deterministic;
  if (input.index.length === 0) return deterministic;

  // Must match worklist generator version — candidateId digests include it.
  const generatorPromptVersion = AGGREGATE_SEMANTIC_ALIGNMENT_GENERATOR_PROMPT_VERSION;
  // Ranked shortlist for diagnostics; acceptance never falls back to first.
  const candidates = generateSemanticAlignmentCandidates({
    upstream: input.upstream,
    canonicalId: input.canonicalId,
    canonicalProfileDigest: sha256Canonical({ canonicalId: input.canonicalId }),
    index: input.index,
    generatorPromptVersion,
    profileText: input.canonicalId,
  });
  if (candidates.length === 0 && input.index.length === 0) return deterministic;

  // Never auto-accept first candidate. ACCEPT requires exact candidateId.
  if (!review.candidateId?.trim()) {
    return acceptSemanticAlignment({
      candidate: candidates[0] ?? {
        candidateId: 'missing',
        upstream: input.upstream,
        canonicalId: input.canonicalId,
        structuralUnitId: '',
        structuralUnitVersion: '',
        structuralUnitHash: '',
        sourceEditionId: '',
        sourceVersion: '',
        rationale: 'missing-candidate',
        generatorPromptVersion,
      },
      review: {
        ...review,
        outcome: review.outcome === 'ACCEPT' ? 'UNSUPPORTED' : review.outcome,
      },
      capture: input.capture,
    });
  }

  // Resolve candidateId against the FULL index (not only top-N shortlist) so
  // controlled reviews can accept a specific unit without rank-position coupling.
  // Uses the same candidateId contract as worklist generation.
  let candidate = candidates.find((row) => row.candidateId === review.candidateId) ?? null;
  if (!candidate) {
    for (const entry of input.index) {
      if (
        !entry.sourceEditionId
        || !entry.sourceVersion
        || !entry.structuralUnitId
        || !entry.structuralUnitVersion
        || !entry.structuralUnitHash
      ) {
        continue;
      }
      const candidateId = semanticAlignmentCandidateId({
        upstream: input.upstream,
        canonicalId: input.canonicalId,
        structuralUnitId: entry.structuralUnitId,
        structuralUnitHash: entry.structuralUnitHash,
        generatorPromptVersion,
      });
      if (candidateId !== review.candidateId) continue;
      candidate = {
        candidateId,
        upstream: input.upstream,
        canonicalId: input.canonicalId,
        structuralUnitId: entry.structuralUnitId,
        structuralUnitVersion: entry.structuralUnitVersion,
        structuralUnitHash: entry.structuralUnitHash,
        sourceEditionId: entry.sourceEditionId,
        sourceVersion: entry.sourceVersion,
        rationale: `resolved-from-index:${entry.structuralUnitId}`,
        generatorPromptVersion,
      };
      break;
    }
  }
  if (!candidate) {
    return acceptSemanticAlignment({
      candidate: candidates[0] ?? {
        candidateId: review.candidateId,
        upstream: input.upstream,
        canonicalId: input.canonicalId,
        structuralUnitId: '',
        structuralUnitVersion: '',
        structuralUnitHash: '',
        sourceEditionId: '',
        sourceVersion: '',
        rationale: 'candidateId-not-in-index',
        generatorPromptVersion,
      },
      review: {
        ...review,
        outcome: 'UNSUPPORTED',
        rationale: `${review.rationale}; candidateId not present in structural index`,
      },
      capture: input.capture,
    });
  }
  const indexEntry = input.index.find((row) => (
    row.structuralUnitId === candidate!.structuralUnitId
    && row.structuralUnitVersion === candidate!.structuralUnitVersion
    && row.structuralUnitHash === candidate!.structuralUnitHash
  ));
  return acceptSemanticAlignment({
    candidate,
    review,
    capture: input.capture,
    inventoryAtomic: indexEntry
      ? {
          atomicResourceId: indexEntry.atomicResourceId,
          resourceId: indexEntry.resourceId,
          segmentId: indexEntry.segmentId,
          resourceSegmentHash: indexEntry.resourceSegmentHash,
        }
      : undefined,
  });
}

function partitionCrosswalks(rows: readonly ActStructuralUnitCrosswalkRecord[]): {
  published: ActStructuralUnitCrosswalkRecord[];
  unresolved: ActStructuralUnitCrosswalkRecord[];
} {
  const published: ActStructuralUnitCrosswalkRecord[] = [];
  const unresolved: ActStructuralUnitCrosswalkRecord[] = [];
  for (const row of rows) {
    if (
      row.lifecycleState === 'CURRENT'
      && row.validationState === 'VALIDATED'
    ) {
      published.push(row);
    } else if (row.lifecycleState === 'CURRENT') {
      unresolved.push(row);
    }
  }
  return { published, unresolved };
}

/**
 * Pure orchestration for baseline / incremental / packaging-no-op governance.
 * Persistence is handled by the repository layer.
 */
export function runAggregateGovernance(
  input: AggregateGovernanceRunInput,
): AggregateGovernanceRunResult {
  requireCoherentCapture({
    expected: input.capture,
    observed: input.observedCapture,
  });

  if (!input.capture.inventoryRunId) {
    throw new Error('Aggregate governance rejected: inventoryRunId is required');
  }
  if (!input.capture.structuralUnitIndexVersion) {
    throw new Error('Aggregate governance rejected: structuralUnitIndexVersion is required');
  }
  if (!input.capture.authoringRevision || !input.capture.coverageSourceHash) {
    // packaging no-op may inherit authoring from prior baseline via capture
    // fields already set by the caller.
    if (input.deltaClassification !== 'COMPATIBLE_PACKAGING_REVISION') {
      throw new Error(
        'Aggregate governance rejected: authoringRevision and coverageSourceHash are required',
      );
    }
  }

  const exactBaselineReplay = isExactBaselineGovernanceReplay({
    prior: input.priorGovernanceReceipt,
    capture: input.capture,
    deltaClassification: input.deltaClassification,
  });
  let manifest = buildGovernanceWorkManifest({
    capture: input.capture,
    hasGovernedCoverageBaseline: input.hasGovernedCoverageBaseline,
    exactBaselineReplay,
    deltaClassification: input.deltaClassification,
    currentCanonicalIds: input.currentCanonicalIds,
    signals: input.signals,
    changedResourceSegments: input.changedResourceSegments,
  });
  if (manifest.mode === 'baseline') {
    manifest = expandBaselineCrosswalkWork(manifest, input.upstreamReferences);
  }

  const revalidationReceipts: RevalidationReceipt[] = [];

  if (manifest.packagingNoop) {
    if (!input.hasGovernedCoverageBaseline) {
      throw new Error(
        'Aggregate governance rejected: packaging no-op requires an eligible prior semantic baseline',
      );
    }
    const priorIdentity = input.priorSemanticPublicationIdentity?.trim() ?? '';
    if (!priorIdentity) {
      throw new Error(
        'Aggregate governance rejected: packaging no-op requires prior coverage/Crosswalk/binding publication identity',
      );
    }

    const coverageEntries = [...(input.currentCoverageEntries ?? [])];
    if (coverageEntries.length === 0) {
      throw new Error(
        'Aggregate governance rejected: packaging no-op requires preserved coverage dispositions',
      );
    }
    const previous = [...(input.previousCrosswalks ?? [])];
    const { published, unresolved } = partitionCrosswalks(previous);
    const shadowPublishedBindingCount = (input.previousDecisions ?? []).filter(
      (row) => row.publicationState === 'SHADOW_PUBLISHED' && row.lifecycleState === 'CURRENT',
    ).length;
    const packagingReceipt = packagingNoopRevalidation({
      priorPublicationIdentity: priorIdentity,
      newReleaseSetId: input.capture.releaseSetId,
      newReleaseId: input.capture.releaseId,
      newDeltaReceiptId: input.capture.deltaReceiptId,
      captureRevision: input.capture.captureRevision,
    });
    revalidationReceipts.push(packagingReceipt);
    const readiness = buildDownstreamReadinessDiagnostics({
      capture: input.capture,
      coverageEntries,
      crosswalks: previous,
      unresolvedUpstreamCount: unresolved.length,
      shadowPublishedBindingCount,
    });
    const summary = buildAggregateGovernanceSummary({
      mode: 'packaging_noop',
      captureRevision: input.capture.captureRevision,
      releaseSetId: input.capture.releaseSetId,
      releaseId: input.capture.releaseId,
      deltaReceiptId: input.capture.deltaReceiptId,
      coverageEntries,
      crosswalks: previous,
      bindings: {
        revalidated: 0,
        invalidated: 0,
        reviewed: 0,
        shadowPublished: shadowPublishedBindingCount,
        candidatesGenerated: 0,
        decisionsStaged: 0,
        pendingReviewCount: 0,
      },
      revalidationReceipts,
      packagingNoop: true,
      readiness,
    });
    const outputDigest = sha256Canonical({
      mode: 'packaging_noop',
      inputDigest: manifest.inputDigest,
      summary,
      packagingReceiptId: packagingReceipt.id,
      priorPublicationIdentity: priorIdentity,
    });
    assertFormalSelectorsRemainLegacy({
      selectAuthority: selectResourceKnowledgeAuthority,
    });
    return {
      manifest,
      coverageEntries,
      coverageVersionId: null,
      crosswalks: previous,
      publishedCrosswalks: published,
      unresolvedCrosswalkDiagnostics: unresolved,
      invalidatedCrosswalks: [],
      binding: null,
      revalidationReceipts,
      receipt: {
        id: `agg-gov:${outputDigest}`,
        schemaVersion: 'act-aggregate-course-resource-governance/v1',
        mode: 'packaging_noop',
        capture: input.capture,
        coverageVersionId: null,
        inputDigest: manifest.inputDigest,
        outputDigest,
        summary,
        authorityState: 'SHADOW',
        productionAuthoritative: false,
      },
      admittedCanonicalIds: admittedCanonicalIds(coverageEntries),
      teachingProjectionEdgesCreated: false,
      selectorsLegacy: true,
    };
  }

  if (!input.coverageAuthoring) {
    throw new Error('Aggregate governance rejected: coverage authoring is required');
  }
  const coverageMode = manifest.mode === 'baseline' ? 'baseline' : 'incremental';
  const validatedCoverage = validateCourseCoverageAuthoring(input.coverageAuthoring, {
    currentCanonicalIds: input.currentCanonicalIds,
    releaseSetId: input.capture.releaseSetId,
    releaseId: input.capture.releaseId,
    releaseHash: input.capture.releaseHash,
    sourceDatasetHash: input.capture.sourceDatasetHash,
    mode: coverageMode,
    // Historical aggregate packaging still may pass full membership; ACT teaching
    // selectors use coverageDenominator: 'act-teaching' and must not treat this
    // path as an Engineering Authority gate (#1265).
    coverageDenominator: 'historical-release',
    requireExhaustive: coverageMode === 'baseline',
  });

  // Authoring identity must match the coherent capture.
  requireCoherentCapture({
    expected: input.capture,
    observed: {
      ...input.observedCapture,
      authoringRevision: validatedCoverage.overlay.authoringRevision,
      coverageSourceHash: validatedCoverage.overlay.sourceHash,
    },
  });

  let coverageEntries = validatedCoverage.entries;
  if (coverageMode === 'incremental') {
    const invalidateIds = manifest.objects
      .filter((row) => row.action === 'invalidate')
      .map((row) => row.canonicalId);
    const patchIds = new Set(
      manifest.objects
        .filter((row) => row.action === 'review')
        .map((row) => row.canonicalId),
    );
    const patch = validatedCoverage.entries.filter((row) => patchIds.has(row.canonicalId));
    coverageEntries = mergeIncrementalCoverage({
      current: input.currentCoverageEntries ?? [],
      patch: patch.length > 0 ? patch : validatedCoverage.entries,
      invalidateCanonicalIds: invalidateIds,
      currentCanonicalIds: input.currentCanonicalIds,
    });
  }

  for (const entry of coverageEntries) {
    if (courseRoleCreatesTeachingProjectionEdge(entry.role) !== false) {
      throw new Error('Course coverage must not create Teaching Projection edges');
    }
  }

  const removedObjectIds = manifest.objects
    .filter((row) => row.action === 'invalidate')
    .map((row) => row.canonicalId);
  const removedTripleKeys = manifest.crosswalks
    .filter((row) => row.action === 'invalidate')
    .map((row) => row.tripleKey);
  const { retained, invalidated: signalInvalidatedCrosswalks } = invalidateCrosswalks({
    current: input.previousCrosswalks ?? [],
    removedObjectIds,
    removedTripleKeys,
  });

  const membershipSet = new Set(input.currentCanonicalIds);
  const workCrosswalks = manifest.crosswalks.filter((row) => row.action !== 'invalidate');
  const workTripleKeys = new Set(workCrosswalks.map((row) => row.tripleKey));
  const invalidatedCrosswalks: ActStructuralUnitCrosswalkRecord[] = [
    ...signalInvalidatedCrosswalks,
  ];

  // Exact same-input baseline replay re-derives CURRENT rows from exhaustive work
  // (first publication had empty previous). Ordinary first baseline still starts
  // empty. Incremental must not seed prior publication identity as CURRENT
  // VALIDATED for a new Release/Delta/capture — revalidate and rebind instead.
  const resolved: ActStructuralUnitCrosswalkRecord[] = [];
  if (!exactBaselineReplay) {
    for (const row of retained) {
      const key = tripleKey(row);
      const drift = crosswalkCaptureIdentityDrift(row, input.capture);

      // Work-path triples are re-resolved below under the candidate capture.
      // Close out same-ReleaseSet prior rows so old identity cannot remain CURRENT.
      if (workTripleKeys.has(key)) {
        if (row.releaseSetId === input.capture.releaseSetId) {
          invalidatedCrosswalks.push(markCrosswalkStale(row));
        }
        continue;
      }

      if (!drift) {
        // Same immutable publication capture — retain without re-issuing.
        resolved.push(row);
        continue;
      }

      // Unaffected-by-Delta retained rows still need an audit-visible revalidation
      // under the new candidate capture. Never copy prior publication identity.
      // Current comparable MUST come from the live structural index (not the old
      // row), so hash/disposition drift cannot auto-REVALIDATE.
      if (row.validationState === 'VALIDATED' && row.canonicalId) {
        if (row.releaseSetId === input.capture.releaseSetId) {
          invalidatedCrosswalks.push(markCrosswalkStale(row));
        }

        const currentTuple = resolveCurrentIncludedStructuralTuple({
          prior: row,
          structuralUnitIndex: input.structuralUnitIndex,
        });
        if (!currentTuple) {
          // Missing / multi-hit / non-INCLUDED / incomplete — unavailable.
          revalidationReceipts.push(evaluateSemanticRevalidation({
            prior: priorFromCrosswalk(row),
            current: {
              canonicalDigest: null,
              resourceSegmentHash: null,
              role: null,
              promptReviewerVersion: null,
              evidenceDigest: null,
              structuralGateDigest: null,
            },
            newReleaseSetId: input.capture.releaseSetId,
            newReleaseId: input.capture.releaseId,
            newDeltaReceiptId: input.capture.deltaReceiptId,
            captureRevision: input.capture.captureRevision,
            kind: 'crosswalk',
          }));
          continue;
        }

        const currentComparable = crosswalkStructuralComparable({
          canonicalId: row.canonicalId,
          publishedEntityId: row.publishedEntityId,
          retrievalChunkId: row.retrievalChunkId,
          citationTargetId: row.citationTargetId,
          resourceSegmentHash: currentTuple.resourceSegmentHash,
          reviewIdentity: row.reviewIdentity,
          evidenceDigest: row.evidenceDigest,
          resolutionState: row.resolutionState,
          structuralUnitId: currentTuple.structuralUnitId,
          structuralUnitHash: currentTuple.structuralUnitHash,
          sourceEditionId: currentTuple.sourceEditionId,
          atomicResourceId: currentTuple.atomicResourceId,
          resourceId: currentTuple.resourceId,
          segmentId: currentTuple.segmentId,
        });
        const receipt = evaluateSemanticRevalidation({
          prior: priorFromCrosswalk(row),
          current: currentComparable,
          newReleaseSetId: input.capture.releaseSetId,
          newReleaseId: input.capture.releaseId,
          newDeltaReceiptId: input.capture.deltaReceiptId,
          captureRevision: input.capture.captureRevision,
          kind: 'crosswalk',
        });
        revalidationReceipts.push(receipt);

        if (receipt.outcome !== 'REVALIDATED') {
          // Hash drift or other structural change — leave unavailable/stale.
          continue;
        }

        const rebound = rebindValidatedCrosswalkToCapture(
          row,
          input.capture,
          currentTuple,
        );
        const gate = validateCrosswalkForShadowPublication({
          crosswalk: rebound,
          capture: input.capture,
          existingCurrent: resolved,
        });
        if (gate.ok) {
          resolved.push(gate.crosswalk);
        }
        // Gate failure: unavailable under candidate; do not keep old identity.
        continue;
      }

      // Non-validated diagnostics: do not promote old identity into the new
      // capture. Same-ReleaseSet prior diagnostics become STALE.
      if (row.releaseSetId === input.capture.releaseSetId) {
        invalidatedCrosswalks.push(markCrosswalkStale(row));
      }
    }
  }

  for (const item of workCrosswalks) {
    const upstream = referenceOpaqueUpstream({
      publishedEntityId: item.publishedEntityId,
      retrievalChunkId: item.retrievalChunkId,
      citationTargetId: item.citationTargetId,
    });
    const classified = classifyUpstreamReference(upstream, membershipSet);
    const hints = input.alignmentHints?.[item.tripleKey];
    const crosswalk = resolveOneCrosswalk({
      upstream,
      canonicalId: classified.canonicalId,
      capture: input.capture,
      index: input.structuralUnitIndex,
      hints,
      semanticReviews: input.semanticReviews,
    });
    const gate = validateCrosswalkForShadowPublication({
      crosswalk,
      capture: input.capture,
      existingCurrent: resolved,
    });
    if (gate.ok) {
      resolved.push(gate.crosswalk);
    } else {
      // Keep as unresolved diagnostic — never publish without gates.
      // Relation-type upstream keeps null canonicalId (no fabricated object id).
      resolved.push({
        ...crosswalk,
        canonicalId: classified.canonicalId,
        validationState: crosswalk.validationState === 'VALIDATED'
          ? 'UNRESOLVED'
          : crosswalk.validationState,
        lifecycleState: 'CURRENT',
      });
    }
  }

  const { published: publishedCrosswalks, unresolved: unresolvedCrosswalkDiagnostics } =
    partitionCrosswalks(resolved);

  // Same-run reverse index: after Crosswalk publication gates, rebuild
  // candidateCanonicalIds from all current VALIDATED Crosswalks (prior retained
  // + this run). Callers must not freeze the reverse map from previous-only rows.
  const baseSegments = (input.resourceIndex ?? []).map((row) => ({
    resourceId: row.resourceId,
    structuralUnitId: row.structuralUnitId,
    segmentId: row.segmentId,
    resourceSegmentHash: row.resourceSegmentHash,
  }));
  const reverseFromCrosswalks = buildResourceIndexFromValidatedCrosswalks({
    inventoryItems: baseSegments,
    validatedCrosswalks: publishedCrosswalks,
  });
  // Resource-side hash changes: merge current reverse map with CURRENT prior
  // bindings on the same endpoint so candidates stay endpoint-scoped (never
  // full-object review). Removals contribute no candidates.
  const resourceSideChanges = deriveChangedResourceSegments({
    previousDecisions: input.previousDecisions ?? [],
    currentResourceIndex: reverseFromCrosswalks,
  });
  const effectiveResourceIndex = enrichResourceIndexWithChangedSegmentCandidates({
    resourceIndex: reverseFromCrosswalks,
    changedSegments: resourceSideChanges,
  });

  const publicationGateContext = buildBindingPublicationGateContext({
    capture: input.capture,
    canonicalIndex: input.canonicalIndex ?? [],
    validatedCrosswalks: publishedCrosswalks,
    existingPublished: (input.previousDecisions ?? []).filter(
      (row) => row.publicationState === 'SHADOW_PUBLISHED' && row.lifecycleState === 'CURRENT',
    ),
  });
  const binding = governResourceBindings({
    capture: input.capture,
    work: manifest.resourceBindings,
    previousDecisions: input.previousDecisions ?? [],
    canonicalIndex: input.canonicalIndex ?? [],
    resourceIndex: effectiveResourceIndex,
    generatorPromptVersion: input.generatorPromptVersion ?? 'aggregate-binding/v1',
    bindingReviews: input.bindingReviews,
    publicationGateContext,
  });
  revalidationReceipts.push(...binding.revalidationReceipts);

  const readiness = buildDownstreamReadinessDiagnostics({
    capture: input.capture,
    coverageEntries,
    crosswalks: resolved,
    unresolvedUpstreamCount: unresolvedCrosswalkDiagnostics.length,
    shadowPublishedBindingCount: binding.shadowPublishedCount,
  });
  const summary = buildAggregateGovernanceSummary({
    mode: manifest.mode,
    captureRevision: input.capture.captureRevision,
    releaseSetId: input.capture.releaseSetId,
    releaseId: input.capture.releaseId,
    deltaReceiptId: input.capture.deltaReceiptId,
    coverageEntries,
    crosswalks: [...resolved, ...invalidatedCrosswalks],
    bindings: {
      revalidated: binding.revalidationReceipts.filter((r) => r.outcome === 'REVALIDATED').length,
      invalidated: binding.invalidated.length,
      reviewed: binding.decisions.length,
      shadowPublished: binding.shadowPublishedCount,
      candidatesGenerated: binding.candidatesGenerated,
      decisionsStaged: binding.decisions.length,
      pendingReviewCount: binding.pendingReviewCandidates.length,
    },
    revalidationReceipts,
    packagingNoop: false,
    readiness,
  });
  const outputDigest = sha256Canonical({
    mode: manifest.mode,
    inputDigest: manifest.inputDigest,
    coverageVersionId: validatedCoverage.versionId,
    coverageEntryCount: coverageEntries.length,
    publishedCrosswalkDigests: publishedCrosswalks
      .map((row) => row.validationDigest ?? row.id)
      .sort(),
    unresolvedCount: unresolvedCrosswalkDiagnostics.length,
    bindingRevalidated: binding.revalidationReceipts.length,
    bindingInvalidated: binding.invalidated.length,
    bindingCandidatesGenerated: binding.candidatesGenerated,
    bindingDecisionsStaged: binding.decisions.length,
    bindingPendingReviewCount: binding.pendingReviewCandidates.length,
    summary,
  });

  assertFormalSelectorsRemainLegacy({
    selectAuthority: selectResourceKnowledgeAuthority,
  });

  return {
    manifest,
    coverageEntries,
    coverageVersionId: validatedCoverage.versionId,
    crosswalks: resolved,
    publishedCrosswalks,
    unresolvedCrosswalkDiagnostics,
    invalidatedCrosswalks,
    binding,
    revalidationReceipts,
    receipt: {
      id: `agg-gov:${outputDigest}`,
      schemaVersion: 'act-aggregate-course-resource-governance/v1',
      mode: manifest.mode,
      capture: input.capture,
      coverageVersionId: validatedCoverage.versionId,
      inputDigest: manifest.inputDigest,
      outputDigest,
      summary,
      authorityState: 'SHADOW',
      productionAuthoritative: false,
    },
    admittedCanonicalIds: admittedCanonicalIds(coverageEntries),
    teachingProjectionEdgesCreated: false,
    selectorsLegacy: true,
  };
}
