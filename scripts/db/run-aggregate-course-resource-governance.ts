#!/usr/bin/env tsx
/**
 * Run aggregate CourseCoverage + ACT Crosswalk + resource-binding governance (#1126).
 *
 * Production path:
 * - accepted candidate + accepted #1132 Delta Receipt
 * - controlled ACTIVE authoring (Git-tracked, clean, non-null deltaReceiptId)
 * - real #1124 inventory / structural index
 * - three capture identities (governance / import / delta)
 *
 * Does not silently synthesize authoritative review decisions.
 */
import 'dotenv/config';

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  AggregateGovernanceRepository,
  buildStructuralUnitIndexFromInventory,
  deriveChangedResourceSegments,
  runAggregateGovernance,
  selectAggregateGovernanceBaselineSource,
  selectCanonicalObjectMembership,
  toChangedResourceSegmentWorkItems,
  type CaptureIdentity,
  type ObservedCaptureFields,
  type OpaqueUpstreamRagReference,
  type PackagingNoopAncestryNode,
} from '../../src/lib/aggregate-governance';
import {
  loadVerifiedPersistedCurrentInventory,
  type CanonicalObjectIndexEntry,
  type CanonicalResourceBindingDecision,
} from '../../src/lib/canonical-resource-binding';
import { createPrismaClient } from '../../src/lib/prisma-client';
import {
  AGGREGATE_COVERAGE_ACTIVE_PATH,
  loadTrackedActiveCoverageAuthoring,
  loadTrackedBindingReviews,
  loadTrackedCrosswalkSemanticReviews,
} from '../course-coverage/aggregate-coverage';

function argValue(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index < 0) return undefined;
  return process.argv[index + 1];
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

/**
 * Load DB-computed public Projection membership revisions for the release.
 * Standard public Bundles persist membership in ActkgProjectionNode and have
 * zero private ActkgAuthoritativeObject rows. Governed SHADOW publication must
 * use actkg_authoritative_object_revision(projection.payload) so objectRevision
 * matches the publication trigger join. Missing / ambiguous membership fails
 * closed — never fall back to a local JSON hash that can diverge from the DB.
 */
async function loadPublicProjectionMembershipRevisions(
  db: ReturnType<typeof createPrismaClient>,
  releaseId: string,
): Promise<Map<string, string>> {
  const rows = await db.$queryRaw<Array<{ canonicalId: string; objectRevision: string }>>`
    SELECT
      "entityId" AS "canonicalId",
      actkg_authoritative_object_revision("payload") AS "objectRevision"
    FROM "ActkgProjectionNode"
    WHERE "releaseId" = ${releaseId}
  `;
  const revisions = new Map<string, string>();
  for (const row of rows) {
    if (revisions.has(row.canonicalId)) {
      throw new Error(
        `Aggregate governance rejected: ambiguous public Projection membership `
        + `for canonical ${row.canonicalId} in release ${releaseId}`,
      );
    }
    revisions.set(row.canonicalId, row.objectRevision);
  }
  return revisions;
}

async function main(): Promise<void> {
  const root = process.cwd();
  const releaseSetId = argValue('--release-set-id');
  const dryRun = hasFlag('--dry-run');

  if (argValue('--authoring')) {
    throw new Error(
      `Aggregate governance rejected: --authoring is forbidden; production loads only ${AGGREGATE_COVERAGE_ACTIVE_PATH}`,
    );
  }
  if (argValue('--write-authoring') || argValue('--write-candidate-authoring')) {
    throw new Error(
      'Aggregate governance rejected: candidate authoring flags are forbidden on the production CLI; use scripts/course-coverage/generate-aggregate-coverage-candidate.ts',
    );
  }

  const db = createPrismaClient({ log: ['warn', 'error'] });
  try {
    const candidate = releaseSetId
      ? await db.actkgReleaseSet.findUnique({
          where: { id: releaseSetId },
          include: {
            receipt: true,
            releases: {
              include: {
                entries: { orderBy: { ordinal: 'asc' } },
                upstreamRagReferences: { orderBy: { ordinal: 'asc' } },
                projectionNodes: { orderBy: { ordinal: 'asc' } },
                projectionIdentities: true,
                objects: { orderBy: { ordinal: 'asc' } },
              },
            },
          },
        })
      : await db.actkgReleaseSet.findFirst({
          where: { candidateState: 'CANDIDATE' },
          orderBy: { createdAt: 'desc' },
          include: {
            receipt: true,
            releases: {
              include: {
                entries: { orderBy: { ordinal: 'asc' } },
                upstreamRagReferences: { orderBy: { ordinal: 'asc' } },
                projectionNodes: { orderBy: { ordinal: 'asc' } },
                projectionIdentities: true,
                objects: { orderBy: { ordinal: 'asc' } },
              },
            },
          },
        });
    if (!candidate || candidate.releases.length === 0) {
      throw new Error('No accepted candidate ReleaseSet found');
    }
    const release = candidate.releases[0]!;
    const receipt = candidate.receipt;
    if (!receipt) throw new Error('Candidate import receipt missing');

    const delta = await db.actkgReleaseSetDeltaReceipt.findFirst({
      where: {
        candidateReleaseSetId: candidate.id,
        candidateReleaseId: release.id,
        authorizationState: 'ACCEPTED',
      },
      orderBy: { createdAt: 'desc' },
      include: { signals: true },
    });
    if (!delta) {
      throw new Error(
        'Accepted Delta Receipt missing for candidate — run #1132 compute-actkg-release-set-delta first',
      );
    }

    const membership = selectCanonicalObjectMembership({
      projectionNodes: release.projectionNodes.map((row) => ({ entityId: row.entityId })),
      releaseEntries: release.entries.map((row) => ({
        entityId: row.entityId,
        entityRole: row.entityRole,
      })),
    });

    // Real #1124 inventory: consume one operator-imported complete snapshot and
    // pin its immutable dbWatermark/capturedAt. Never mint a fresh WAL LSN here —
    // live rebuilds break dry-run/apply/exact-replay receipt identity.
    const inventory = await loadVerifiedPersistedCurrentInventory(db);
    const structural = buildStructuralUnitIndexFromInventory({ inventory });
    const runtime = release.projectionIdentities.find((row) => row.isRuntime)
      ?? release.projectionIdentities[0]
      ?? null;

    const authoringLoaded = await loadTrackedActiveCoverageAuthoring(root);
    const coverageAuthoringRaw = authoringLoaded.overlay as {
      authoringRevision?: string;
      sourceHash?: string;
      deltaReceiptId?: string;
    };
    if (coverageAuthoringRaw.sourceHash !== authoringLoaded.committedSourceHash) {
      throw new Error('Aggregate governance rejected: authoring sourceHash drift vs committed');
    }
    if (coverageAuthoringRaw.deltaReceiptId !== delta.id) {
      throw new Error(
        `Aggregate governance rejected: authoring deltaReceiptId ${coverageAuthoringRaw.deltaReceiptId} `
        + `does not match accepted Delta ${delta.id}`,
      );
    }

    // All Git revision slots must bind one clean ACT capture. Inventory,
    // authoring, import receipt and Delta capture are fail-closed together.
    if (inventory.captureRevision !== authoringLoaded.captureRevision) {
      throw new Error(
        `Aggregate governance rejected: inventory governance capture ${inventory.captureRevision} `
        + `drifts from authoring governance capture ${authoringLoaded.captureRevision}`,
      );
    }
    if (String(receipt.captureRevision) !== authoringLoaded.captureRevision) {
      throw new Error(
        `Aggregate governance rejected: import capture ${receipt.captureRevision} `
        + `drifts from clean ACT capture ${authoringLoaded.captureRevision}`,
      );
    }
    if (String(delta.captureRevision) !== authoringLoaded.captureRevision) {
      throw new Error(
        `Aggregate governance rejected: delta capture ${delta.captureRevision} `
        + `drifts from clean ACT capture ${authoringLoaded.captureRevision}`,
      );
    }
    if (
      coverageAuthoringRaw.authoringRevision != null
      && String(coverageAuthoringRaw.authoringRevision) !== authoringLoaded.captureRevision
    ) {
      throw new Error(
        `Aggregate governance rejected: authoringRevision ${coverageAuthoringRaw.authoringRevision} `
        + `drifts from clean ACT capture ${authoringLoaded.captureRevision}`,
      );
    }

    const repository = new AggregateGovernanceRepository(db as never);

    // Prefer the candidate's own governed baseline only when CURRENT coverage
    // exists (sufficient baseline). A packaging no-op receipt alone is not
    // enough — first packaging no-op persists a receipt without coverage, and
    // exact replay must keep using the accepted Delta base coverage/crosswalk/
    // decisions while remaining idempotent on the candidate receipt.
    //
    // When the accepted Delta base is packaging-only, walk verified
    // packaging_noop ancestry (receipt → Delta.baseReleaseSetId) until CURRENT
    // governed coverage is found. Never invent lineage.
    const candidateCoverage = await repository.readCurrentCoverage(candidate.id);
    const candidateReceipt = await repository.readLatestGovernanceReceipt(candidate.id);
    const ancestryCache = new Map<string, PackagingNoopAncestryNode | null>();
    const resolveAncestryNode = async (
      releaseSetId: string,
    ): Promise<PackagingNoopAncestryNode | null> => {
      if (ancestryCache.has(releaseSetId)) {
        return ancestryCache.get(releaseSetId) ?? null;
      }
      const coverage = await repository.readCurrentCoverage(releaseSetId);
      const receiptRow = await repository.readLatestGovernanceReceipt(releaseSetId);
      let acceptedDeltaBaseReleaseSetId: string | null = null;
      if (receiptRow?.deltaReceiptId) {
        const ancestryDelta = await db.actkgReleaseSetDeltaReceipt.findUnique({
          where: { id: receiptRow.deltaReceiptId },
          select: {
            baseReleaseSetId: true,
            candidateReleaseSetId: true,
            authorizationState: true,
          },
        });
        if (
          ancestryDelta
          && ancestryDelta.candidateReleaseSetId === releaseSetId
          && ancestryDelta.authorizationState === 'ACCEPTED'
        ) {
          acceptedDeltaBaseReleaseSetId = ancestryDelta.baseReleaseSetId ?? null;
        }
        // Unverified / non-accepted Delta links leave base null so the pure
        // selector fail-closes on packaging intermediates without inventing lineage.
      }
      const node: PackagingNoopAncestryNode = {
        releaseSetId,
        hasGovernedCoverage: Boolean(coverage),
        latestReceiptMode: receiptRow?.mode ?? null,
        acceptedDeltaBaseReleaseSetId,
      };
      ancestryCache.set(releaseSetId, node);
      return node;
    };

    // Prefetch the packaging ancestry chain so the pure selector stays sync.
    if (!candidateCoverage && delta.baseReleaseSetId) {
      let cursor: string | null = delta.baseReleaseSetId;
      const seen = new Set<string>();
      while (cursor && !seen.has(cursor) && seen.size < 16) {
        seen.add(cursor);
        const node = await resolveAncestryNode(cursor);
        if (!node || node.hasGovernedCoverage) break;
        if (node.latestReceiptMode !== 'packaging_noop') break;
        cursor = node.acceptedDeltaBaseReleaseSetId;
      }
    }

    const baselineSource = selectAggregateGovernanceBaselineSource({
      candidateReleaseSetId: candidate.id,
      baseReleaseSetId: delta.baseReleaseSetId ?? null,
      candidateHasGovernedCoverage: Boolean(candidateCoverage),
      // Walk only when an accepted Delta base exists; missing base keeps the
      // single-hop candidate fallback without inventing ancestry.
      resolveAncestryNode: delta.baseReleaseSetId
        ? (releaseSetId) => ancestryCache.get(releaseSetId) ?? null
        : undefined,
    });
    const priorReleaseSetId = baselineSource.baselineReleaseSetId;
    const usesCandidateSelfState = baselineSource.usesCandidateSelfState;

    const existingCoverage = usesCandidateSelfState
      ? candidateCoverage
      : priorReleaseSetId === candidate.id
        ? candidateCoverage
        : await repository.readCurrentCoverage(priorReleaseSetId);
    const previousCrosswalks = usesCandidateSelfState
      ? await repository.readCurrentCrosswalks(candidate.id)
      : await repository.readCurrentCrosswalks(priorReleaseSetId);
    const previousReceipt = usesCandidateSelfState
      ? candidateReceipt
      : priorReleaseSetId === candidate.id
        ? candidateReceipt
        : await repository.readLatestGovernanceReceipt(priorReleaseSetId);

    const previousDecisions = await db.canonicalResourceBindingDecision.findMany({
      where: {
        releaseSetId: priorReleaseSetId,
        lifecycleState: 'CURRENT',
      },
      orderBy: { createdAt: 'asc' },
    }) as unknown as CanonicalResourceBindingDecision[];

    // Standard public Bundles expose membership only via Projection nodes.
    // Prefer that public path even when private objects exist (legacy private
    // CTKG may still populate objects; governed identity remains Projection).
    const objectRows = release.projectionNodes.length > 0
      ? release.projectionNodes.map((row) => ({
          canonicalId: row.entityId,
          canonicalType: row.entityType,
          payload: row.payload,
        }))
      : release.objects.map((row) => ({
          canonicalId: row.canonicalId,
          canonicalType: row.canonicalType,
          payload: row.payload,
        }));
    // Require DB-computed public Projection revision so governed SHADOW
    // publication matches actkg_authoritative_object_revision(projection.payload).
    const projectionRevisions = await loadPublicProjectionMembershipRevisions(
      db,
      release.id,
    );
    const missingRevisions = objectRows
      .map((row) => row.canonicalId)
      .filter((canonicalId) => !projectionRevisions.has(canonicalId));
    if (missingRevisions.length > 0) {
      const preview = missingRevisions.slice(0, 8).join(', ');
      const more = missingRevisions.length > 8
        ? ` (+${missingRevisions.length - 8} more)`
        : '';
      throw new Error(
        `Aggregate governance rejected: ${missingRevisions.length} canonical object(s) `
        + `lack ActkgProjectionNode / actkg_authoritative_object_revision for `
        + `release ${release.id}: ${preview}${more}`,
      );
    }
    const canonicalIndex: CanonicalObjectIndexEntry[] = objectRows.map((row) => ({
      releaseSetId: candidate.id,
      releaseId: release.id,
      canonicalId: row.canonicalId,
      objectRevision: projectionRevisions.get(row.canonicalId)!,
      canonicalType: row.canonicalType,
    }));
    // Base inventory segments only. Pipeline rebuilds candidateCanonicalIds
    // from same-run VALIDATED Crosswalks (not previous-only reverse index).
    const resourceIndex = inventory.items
      .filter((item) => item.disposition === 'INCLUDED')
      .map((item) => ({
        resourceId: item.resourceId,
        structuralUnitId: item.structuralUnitId,
        segmentId: item.segmentId,
        resourceSegmentHash: item.resourceSegmentHash,
        candidateCanonicalIds: [] as string[],
        deterministicRole: null,
        evidenceIds: [] as string[],
      }));

    // Resource-side changes: previous CURRENT binding endpoints vs current
    // versioned inventory. Hash drift → invalidate + current-segment candidates
    // (pipeline reverse map); removals → invalidate only. Unchanged → no work.
    const changedResourceSegments = toChangedResourceSegmentWorkItems(
      deriveChangedResourceSegments({
        previousDecisions,
        currentResourceIndex: resourceIndex,
      }),
    );

    const expectedCapture: CaptureIdentity = {
      captureRevision: authoringLoaded.captureRevision,
      importCaptureRevision: receipt.captureRevision,
      deltaCaptureRevision: delta.captureRevision,
      dbWatermark: inventory.dbWatermark,
      releaseSetId: candidate.id,
      releaseId: release.id,
      releaseHash: release.releaseHash,
      sourceDatasetHash: receipt.sourceDatasetHash ?? null,
      deltaReceiptId: delta.id,
      deltaOutputDigest: delta.outputDigest,
      deltaClassification: delta.classification,
      runtimeProjectionId: runtime?.projectionId ?? receipt.projectionId ?? null,
      runtimeProjectionDigest: runtime?.versionDigest ?? receipt.projectionDigest ?? null,
      inventoryRunId: inventory.runId,
      structuralUnitIndexVersion: structural.version,
      authoringRevision: String(coverageAuthoringRaw.authoringRevision),
      coverageSourceHash: String(coverageAuthoringRaw.sourceHash),
    };

    const observedCapture: ObservedCaptureFields = {
      captureRevision: inventory.captureRevision,
      importCaptureRevision: String(receipt.captureRevision),
      deltaCaptureRevision: String(delta.captureRevision),
      dbWatermark: String(inventory.dbWatermark),
      releaseSetId: String(candidate.id),
      releaseId: String(release.id),
      releaseHash: String(release.releaseHash),
      sourceDatasetHash: receipt.sourceDatasetHash == null
        ? null
        : String(receipt.sourceDatasetHash),
      deltaReceiptId: String(delta.id),
      deltaOutputDigest: String(delta.outputDigest),
      runtimeProjectionDigest: runtime?.versionDigest ?? receipt.projectionDigest ?? null,
      inventoryRunId: String(inventory.runId),
      structuralUnitIndexVersion: String(structural.version),
      authoringRevision: String(coverageAuthoringRaw.authoringRevision),
      coverageSourceHash: String(coverageAuthoringRaw.sourceHash),
    };

    const upstream: OpaqueUpstreamRagReference[] = release.upstreamRagReferences.map((row) => ({
      publishedEntityId: row.publishedEntityId,
      retrievalChunkId: row.retrievalChunkId,
      citationTargetId: row.citationTargetId,
    }));

    // Current object-triple workset for fail-closed review key validation.
    const membershipSet = new Set(membership.canonicalIds);
    const allowedTripleKeys = new Set(
      upstream
        .filter((row) => membershipSet.has(row.publishedEntityId))
        .map((row) => [
          row.publishedEntityId,
          row.retrievalChunkId,
          row.citationTargetId,
        ].join('\u001f')),
    );

    // Controlled Git-tracked semantic review inputs (optional; empty is valid).
    // Unknown keys outside the current object-triple workset fail closed.
    const semanticReviews = await loadTrackedCrosswalkSemanticReviews(
      root,
      delta.id,
      allowedTripleKeys,
    );
    // Binding pair workset is enforced after candidates are generated inside the
    // pure pipeline; loader still rejects unknown pair ids when a workset is
    // supplied. Pass undefined here — runner validates after dry-run candidate
    // generation via governed bindingReviews keys ⊆ generated pairIds.
    const bindingReviews = await loadTrackedBindingReviews(root, delta.id);

    const result = runAggregateGovernance({
      capture: expectedCapture,
      observedCapture,
      hasGovernedCoverageBaseline: Boolean(existingCoverage),
      priorGovernanceReceipt: previousReceipt,
      deltaClassification: delta.classification,
      currentCanonicalIds: membership.canonicalIds,
      signals: delta.signals.map((row) => ({
        scope: row.scope,
        identity: row.identity,
        action: row.action,
        reason: row.reason,
      })),
      upstreamReferences: upstream,
      structuralUnitIndex: structural.entries,
      coverageAuthoring: existingCoverage && delta.classification === 'COMPATIBLE_PACKAGING_REVISION'
        ? null
        : authoringLoaded.overlay,
      currentCoverageEntries: existingCoverage?.entries,
      previousCrosswalks,
      previousDecisions,
      canonicalIndex,
      resourceIndex,
      changedResourceSegments,
      priorSemanticPublicationIdentity:
        previousReceipt?.id
        ?? existingCoverage?.publicationIdentity
        ?? null,
      semanticReviews,
      bindingReviews,
    });

    // Fail closed: every binding review pairId must be in generated candidates.
    const generatedPairIds = new Set(
      (result.binding?.candidates ?? []).map((row) => row.pairId),
    );
    for (const pairId of Object.keys(bindingReviews)) {
      if (!generatedPairIds.has(pairId)) {
        throw new Error(
          `Aggregate governance rejected: binding review pairId not in current `
          + `generated workset: ${pairId}`,
        );
      }
    }

    if (dryRun) {
      console.log(JSON.stringify({
        dryRun: true,
        mode: result.manifest.mode,
        membershipCount: membership.canonicalIds.length,
        governanceCaptureRevision: expectedCapture.captureRevision,
        importCaptureRevision: expectedCapture.importCaptureRevision,
        deltaCaptureRevision: expectedCapture.deltaCaptureRevision,
        inventoryRunId: inventory.runId,
        structuralUnitIndexVersion: structural.version,
        publishedCrosswalks: result.publishedCrosswalks.length,
        unresolvedCrosswalks: result.unresolvedCrosswalkDiagnostics.length,
        semanticReviewsLoaded: Object.keys(semanticReviews).length,
        bindingReviewsLoaded: Object.keys(bindingReviews).length,
        bindingCandidatesGenerated: result.binding?.candidatesGenerated ?? 0,
        bindingCandidatesRetained: result.binding?.candidates.length ?? 0,
        bindingDecisionsStaged: result.binding?.decisions.length ?? 0,
        bindingPendingReviewCount: result.binding?.pendingReviewCandidates.length ?? 0,
        receiptId: result.receipt.id,
        summary: result.receipt.summary,
      }, null, 2));
      return;
    }

    const persisted = await repository.persistRun(result);
    console.log(JSON.stringify({
      ok: true,
      persisted,
      mode: result.manifest.mode,
      membershipCount: membership.canonicalIds.length,
      governanceCaptureRevision: expectedCapture.captureRevision,
      importCaptureRevision: expectedCapture.importCaptureRevision,
      deltaCaptureRevision: expectedCapture.deltaCaptureRevision,
      inventoryRunId: inventory.runId,
      structuralUnitIndexVersion: structural.version,
      publishedCrosswalks: result.publishedCrosswalks.length,
      unresolvedCrosswalks: result.unresolvedCrosswalkDiagnostics.length,
      semanticReviewsLoaded: Object.keys(semanticReviews).length,
      bindingReviewsLoaded: Object.keys(bindingReviews).length,
      bindingCandidatesGenerated: result.binding?.candidatesGenerated ?? 0,
      bindingCandidatesRetained: result.binding?.candidates.length ?? 0,
      bindingDecisionsStaged: result.binding?.decisions.length ?? 0,
      bindingPendingReviewCount: result.binding?.pendingReviewCandidates.length ?? 0,
      receiptId: result.receipt.id,
      coverageVersionId: result.coverageVersionId,
      summary: result.receipt.summary,
    }, null, 2));
  } finally {
    await db.$disconnect();
  }
}

const isDirectExecution = (() => {
  try {
    const thisFile = fileURLToPath(import.meta.url);
    const entry = process.argv[1] ? path.resolve(process.argv[1]) : '';
    return entry.length > 0 && path.resolve(thisFile) === entry;
  } catch {
    return false;
  }
})();

if (isDirectExecution) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
