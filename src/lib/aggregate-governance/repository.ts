import type {
  ActStructuralUnitCrosswalkRecord,
  AggregateGovernanceReceipt,
  CourseCoverageDisposition,
  RevalidationReceipt,
} from './contracts';
import { sha256Canonical } from './hash';
import type { AggregateGovernanceRunResult } from './pipeline';

interface CreateDelegate {
  create(args: unknown): Promise<unknown>;
  createMany?(args: unknown): Promise<unknown>;
  findUnique?(args: unknown): Promise<unknown>;
  findFirst?(args: unknown): Promise<unknown>;
  findMany?(args: unknown): Promise<unknown[]>;
  updateMany?(args: unknown): Promise<unknown>;
}

export interface AggregateGovernanceTransaction {
  aggregateGovernanceReceipt: CreateDelegate;
  aggregateCourseCoverageVersion: CreateDelegate;
  aggregateCourseCoverageEntry: CreateDelegate;
  actGovernedStructuralUnitCrosswalk: CreateDelegate;
  aggregateRevalidationReceipt: CreateDelegate;
  canonicalResourceBindingDecision?: CreateDelegate;
  canonicalResourceBindingHumanQueueItem?: CreateDelegate;
}

export interface AggregateGovernanceDatabase {
  $transaction<T>(
    callback: (tx: AggregateGovernanceTransaction) => Promise<T>,
    options: { isolationLevel: 'Serializable' },
  ): Promise<T>;
  aggregateCourseCoverageVersion?: CreateDelegate;
  actGovernedStructuralUnitCrosswalk?: CreateDelegate;
  aggregateGovernanceReceipt?: CreateDelegate;
  canonicalResourceBindingDecision?: CreateDelegate;
}

function coverageEntryData(
  versionId: string,
  releaseId: string,
  entry: CourseCoverageDisposition,
  ordinal: number,
) {
  return {
    versionId,
    releaseId,
    canonicalId: entry.canonicalId,
    role: entry.role,
    ordinal,
    rationale: entry.rationale,
    evidenceRefs: entry.evidenceRefs,
    reviewIdentity: entry.reviewIdentity,
    sourceEvidenceDigest: entry.sourceEvidenceDigest,
    lifecycleState: 'CURRENT',
  };
}

function crosswalkData(row: ActStructuralUnitCrosswalkRecord) {
  return {
    id: row.id,
    releaseSetId: row.releaseSetId,
    releaseId: row.releaseId,
    deltaReceiptId: row.deltaReceiptId,
    publishedEntityId: row.publishedEntityId,
    retrievalChunkId: row.retrievalChunkId,
    citationTargetId: row.citationTargetId,
    canonicalId: row.canonicalId,
    sourceEditionId: row.sourceEditionId,
    sourceVersion: row.sourceVersion,
    structuralUnitId: row.structuralUnitId,
    structuralUnitVersion: row.structuralUnitVersion,
    structuralUnitHash: row.structuralUnitHash,
    evidenceContentHash: row.evidenceContentHash,
    inventoryRunId: row.inventoryRunId,
    atomicResourceId: row.atomicResourceId,
    resourceId: row.resourceId,
    segmentId: row.segmentId,
    resourceSegmentHash: row.resourceSegmentHash,
    captureRevision: row.captureRevision,
    resolutionState: row.resolutionState,
    validationState: row.validationState,
    validationDigest: row.validationDigest,
    reviewIdentity: row.reviewIdentity,
    evidenceDigest: row.evidenceDigest,
    lifecycleState: row.lifecycleState,
  };
}

function revalidationData(row: RevalidationReceipt) {
  return {
    id: row.id,
    kind: row.kind,
    priorPublicationIdentity: row.priorPublicationIdentity,
    newReleaseSetId: row.newReleaseSetId,
    newReleaseId: row.newReleaseId,
    newDeltaReceiptId: row.newDeltaReceiptId,
    outcome: row.outcome,
    identityDigest: row.identityDigest,
    captureRevision: row.captureRevision,
    copiesPriorPublication: false,
  };
}

function receiptData(receipt: AggregateGovernanceReceipt) {
  return {
    id: receipt.id,
    schemaVersion: receipt.schemaVersion,
    mode: receipt.mode,
    captureRevision: receipt.capture.captureRevision,
    importCaptureRevision: receipt.capture.importCaptureRevision,
    deltaCaptureRevision: receipt.capture.deltaCaptureRevision,
    dbWatermark: receipt.capture.dbWatermark,
    releaseSetId: receipt.capture.releaseSetId,
    releaseId: receipt.capture.releaseId,
    releaseHash: receipt.capture.releaseHash,
    sourceDatasetHash: receipt.capture.sourceDatasetHash,
    deltaReceiptId: receipt.capture.deltaReceiptId,
    deltaOutputDigest: receipt.capture.deltaOutputDigest,
    deltaClassification: receipt.capture.deltaClassification,
    runtimeProjectionId: receipt.capture.runtimeProjectionId,
    runtimeProjectionDigest: receipt.capture.runtimeProjectionDigest,
    inventoryRunId: receipt.capture.inventoryRunId,
    structuralUnitIndexVersion: receipt.capture.structuralUnitIndexVersion,
    authoringRevision: receipt.capture.authoringRevision,
    coverageSourceHash: receipt.capture.coverageSourceHash,
    coverageVersionId: receipt.coverageVersionId,
    inputDigest: receipt.inputDigest,
    outputDigest: receipt.outputDigest,
    summary: receipt.summary,
    authorityState: 'SHADOW' as const,
    productionAuthoritative: false as const,
  };
}

function mapCoverageEntry(row: {
  canonicalId: string;
  role: string;
  rationale: string | null;
  evidenceRefs: unknown;
  reviewIdentity: string;
  sourceEvidenceDigest: string;
}): CourseCoverageDisposition {
  return {
    canonicalId: row.canonicalId,
    role: row.role as CourseCoverageDisposition['role'],
    rationale: row.rationale,
    evidenceRefs: Array.isArray(row.evidenceRefs)
      ? row.evidenceRefs.map(String)
      : [],
    reviewIdentity: row.reviewIdentity,
    sourceEvidenceDigest: row.sourceEvidenceDigest,
  };
}

function mapCrosswalk(row: Record<string, unknown>): ActStructuralUnitCrosswalkRecord {
  return {
    id: String(row.id),
    releaseSetId: String(row.releaseSetId),
    releaseId: String(row.releaseId),
    deltaReceiptId: String(row.deltaReceiptId),
    publishedEntityId: String(row.publishedEntityId),
    retrievalChunkId: String(row.retrievalChunkId),
    citationTargetId: String(row.citationTargetId),
    canonicalId: row.canonicalId == null ? null : String(row.canonicalId),
    sourceEditionId: row.sourceEditionId == null ? null : String(row.sourceEditionId),
    sourceVersion: row.sourceVersion == null ? null : String(row.sourceVersion),
    structuralUnitId: row.structuralUnitId == null ? null : String(row.structuralUnitId),
    structuralUnitVersion: row.structuralUnitVersion == null
      ? null
      : String(row.structuralUnitVersion),
    structuralUnitHash: row.structuralUnitHash == null ? null : String(row.structuralUnitHash),
    evidenceContentHash: row.evidenceContentHash == null ? null : String(row.evidenceContentHash),
    inventoryRunId: row.inventoryRunId == null ? null : String(row.inventoryRunId),
    atomicResourceId: row.atomicResourceId == null ? null : String(row.atomicResourceId),
    resourceId: row.resourceId == null ? null : String(row.resourceId),
    segmentId: row.segmentId == null ? null : String(row.segmentId),
    resourceSegmentHash: row.resourceSegmentHash == null
      ? null
      : String(row.resourceSegmentHash),
    captureRevision: String(row.captureRevision),
    resolutionState: row.resolutionState as ActStructuralUnitCrosswalkRecord['resolutionState'],
    validationState: row.validationState as ActStructuralUnitCrosswalkRecord['validationState'],
    validationDigest: row.validationDigest == null ? null : String(row.validationDigest),
    reviewIdentity: row.reviewIdentity == null ? null : String(row.reviewIdentity),
    evidenceDigest: row.evidenceDigest == null ? null : String(row.evidenceDigest),
    lifecycleState: row.lifecycleState as ActStructuralUnitCrosswalkRecord['lifecycleState'],
  };
}

function identityDigest(value: unknown): string {
  return sha256Canonical(value);
}

function assertSameIdentity(
  kind: string,
  id: string,
  expected: unknown,
  actual: unknown,
): void {
  if (identityDigest(expected) !== identityDigest(actual)) {
    throw new Error(
      `Aggregate governance rejected: ${kind} ${id} exists with conflicting immutable content`,
    );
  }
}

function normalizeCoverageEntries(
  entries: ReadonlyArray<{
    canonicalId: string;
    role: string;
    ordinal?: number;
    rationale: string | null;
    evidenceRefs: unknown;
    reviewIdentity: string;
    sourceEvidenceDigest: string;
    lifecycleState?: string;
  }>,
) {
  return [...entries]
    .map((row, index) => ({
      canonicalId: row.canonicalId,
      role: row.role,
      ordinal: row.ordinal ?? index,
      rationale: row.rationale,
      evidenceRefs: Array.isArray(row.evidenceRefs)
        ? [...row.evidenceRefs].map(String).sort()
        : [],
      reviewIdentity: row.reviewIdentity,
      sourceEvidenceDigest: row.sourceEvidenceDigest,
      lifecycleState: row.lifecycleState ?? 'CURRENT',
    }))
    .sort((a, b) => a.canonicalId.localeCompare(b.canonicalId));
}

function coverageVersionIdentity(input: {
  id: string;
  schemaVersion: string;
  overlayId: string;
  overlayVersion: string;
  courseId: string;
  releaseSetId: string;
  releaseId: string;
  releaseHash: string;
  sourceDatasetHash: string | null;
  deltaReceiptId: string;
  mode: string;
  authoringRevision: string;
  captureRevision: string;
  sourceHash: string;
  lifecycleState: string;
  entries: ReturnType<typeof normalizeCoverageEntries>;
}) {
  return {
    id: input.id,
    schemaVersion: input.schemaVersion,
    overlayId: input.overlayId,
    overlayVersion: input.overlayVersion,
    courseId: input.courseId,
    releaseSetId: input.releaseSetId,
    releaseId: input.releaseId,
    releaseHash: input.releaseHash,
    sourceDatasetHash: input.sourceDatasetHash,
    deltaReceiptId: input.deltaReceiptId,
    mode: input.mode,
    authoringRevision: input.authoringRevision,
    captureRevision: input.captureRevision,
    sourceHash: input.sourceHash,
    lifecycleState: input.lifecycleState,
    entries: input.entries,
  };
}

function crosswalkEndpointKey(row: {
  releaseSetId: string;
  releaseId: string;
  publishedEntityId: string;
  retrievalChunkId: string;
  citationTargetId: string;
  captureRevision: string;
}): string {
  return [
    row.releaseSetId,
    row.releaseId,
    row.publishedEntityId,
    row.retrievalChunkId,
    row.citationTargetId,
    row.captureRevision,
  ].join('\u001f');
}

function normalizeCrosswalkPersisted(
  row: ActStructuralUnitCrosswalkRecord | Record<string, unknown>,
) {
  return crosswalkData(mapCrosswalk(row as Record<string, unknown>));
}

function normalizeRevalidationPersisted(
  row: RevalidationReceipt | Record<string, unknown>,
) {
  const r = row as {
    id: unknown;
    kind: unknown;
    priorPublicationIdentity: unknown;
    newReleaseSetId: unknown;
    newReleaseId: unknown;
    newDeltaReceiptId: unknown;
    outcome: unknown;
    identityDigest: unknown;
    captureRevision: unknown;
  };
  return {
    id: String(r.id),
    kind: String(r.kind),
    priorPublicationIdentity: String(r.priorPublicationIdentity),
    newReleaseSetId: String(r.newReleaseSetId),
    newReleaseId: String(r.newReleaseId),
    newDeltaReceiptId: String(r.newDeltaReceiptId),
    outcome: String(r.outcome),
    identityDigest: String(r.identityDigest),
    captureRevision: String(r.captureRevision),
    copiesPriorPublication: false as const,
  };
}

function normalizeReceiptPersisted(
  row: AggregateGovernanceReceipt | Record<string, unknown>,
) {
  if ('capture' in row && row.capture && typeof row.capture === 'object') {
    return receiptData(row as unknown as AggregateGovernanceReceipt);
  }
  const r = row as Record<string, unknown>;
  return {
    id: String(r.id),
    schemaVersion: String(r.schemaVersion),
    mode: String(r.mode),
    captureRevision: String(r.captureRevision),
    importCaptureRevision: String(r.importCaptureRevision),
    deltaCaptureRevision: String(r.deltaCaptureRevision),
    dbWatermark: String(r.dbWatermark),
    releaseSetId: String(r.releaseSetId),
    releaseId: String(r.releaseId),
    releaseHash: String(r.releaseHash),
    sourceDatasetHash: r.sourceDatasetHash == null ? null : String(r.sourceDatasetHash),
    deltaReceiptId: String(r.deltaReceiptId),
    deltaOutputDigest: String(r.deltaOutputDigest),
    deltaClassification: String(r.deltaClassification),
    runtimeProjectionId: r.runtimeProjectionId == null ? null : String(r.runtimeProjectionId),
    runtimeProjectionDigest: r.runtimeProjectionDigest == null
      ? null
      : String(r.runtimeProjectionDigest),
    inventoryRunId: r.inventoryRunId == null ? null : String(r.inventoryRunId),
    structuralUnitIndexVersion: r.structuralUnitIndexVersion == null
      ? null
      : String(r.structuralUnitIndexVersion),
    authoringRevision: r.authoringRevision == null ? null : String(r.authoringRevision),
    coverageSourceHash: r.coverageSourceHash == null ? null : String(r.coverageSourceHash),
    coverageVersionId: r.coverageVersionId == null ? null : String(r.coverageVersionId),
    inputDigest: String(r.inputDigest),
    outputDigest: String(r.outputDigest),
    summary: r.summary,
    authorityState: 'SHADOW' as const,
    productionAuthoritative: false as const,
  };
}

/**
 * Persist a governance run transactionally as shadow-only records.
 *
 * - CURRENT Crosswalks of every validationState are stored (VALIDATED =
 *   shadow publication; UNRESOLVED/REJECTED = non-published diagnostics).
 * - STALE rows are never re-written as CURRENT.
 * - Existing immutable identities are compared field-wise; content conflicts
 *   fail closed inside the Serializable transaction.
 */
export class AggregateGovernanceRepository {
  constructor(private readonly db: AggregateGovernanceDatabase) {}

  async readCurrentCoverage(releaseSetId: string): Promise<{
    versionId: string;
    publicationIdentity: string;
    entries: CourseCoverageDisposition[];
  } | null> {
    const version = await this.db.aggregateCourseCoverageVersion?.findFirst?.({
      where: { releaseSetId, lifecycleState: 'CURRENT' },
      include: { entries: { orderBy: { ordinal: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    }) as {
      id: string;
      entries: Array<{
        canonicalId: string;
        role: string;
        rationale: string | null;
        evidenceRefs: unknown;
        reviewIdentity: string;
        sourceEvidenceDigest: string;
      }>;
    } | null;
    if (!version) return null;
    return {
      versionId: version.id,
      publicationIdentity: version.id,
      entries: version.entries.map(mapCoverageEntry),
    };
  }

  /**
   * All CURRENT Crosswalks for the ReleaseSet, including unresolved diagnostics.
   * Callers partition VALIDATED vs unresolved via pipeline helpers.
   */
  async readCurrentCrosswalks(releaseSetId: string): Promise<ActStructuralUnitCrosswalkRecord[]> {
    const rows = await this.db.actGovernedStructuralUnitCrosswalk?.findMany?.({
      where: {
        releaseSetId,
        lifecycleState: 'CURRENT',
      },
      orderBy: { createdAt: 'asc' },
    }) as Array<Record<string, unknown>> | undefined;
    return (rows ?? []).map(mapCrosswalk);
  }

  async readLatestGovernanceReceipt(releaseSetId: string): Promise<{
    id: string;
    outputDigest: string;
    coverageVersionId: string | null;
  } | null> {
    const row = await this.db.aggregateGovernanceReceipt?.findFirst?.({
      where: { releaseSetId },
      orderBy: { createdAt: 'desc' },
    }) as {
      id: string;
      outputDigest: string;
      coverageVersionId: string | null;
    } | null;
    return row;
  }

  async persistRun(result: AggregateGovernanceRunResult): Promise<{
    mode: 'created' | 'idempotent';
    receiptId: string;
    bindingDecisionsPersisted?: number;
    bindingCandidatesRetained?: number;
  }> {
    return this.db.$transaction(async (tx) => {
      const existingReceipt = await tx.aggregateGovernanceReceipt.findUnique?.({
        where: { id: result.receipt.id },
      }) as Record<string, unknown> | null;
      if (existingReceipt) {
        assertSameIdentity(
          'governance receipt',
          result.receipt.id,
          normalizeReceiptPersisted(result.receipt),
          normalizeReceiptPersisted(existingReceipt),
        );
        return {
          mode: 'idempotent' as const,
          receiptId: result.receipt.id,
          bindingCandidatesRetained: result.binding?.candidatesGenerated ?? 0,
        };
      }

      if (result.coverageVersionId) {
        const expectedMode = result.manifest.mode === 'packaging_noop'
          ? 'incremental'
          : result.manifest.mode;
        const expectedVersion = coverageVersionIdentity({
          id: result.coverageVersionId,
          schemaVersion: 'act-course-coverage-overlay/v2',
          overlayId: 'automatic-control-aggregate-coverage-v1',
          overlayVersion: result.coverageVersionId.split('@')[1] ?? '1',
          courseId: 'automatic-control',
          releaseSetId: result.receipt.capture.releaseSetId,
          releaseId: result.receipt.capture.releaseId,
          releaseHash: result.receipt.capture.releaseHash,
          sourceDatasetHash: result.receipt.capture.sourceDatasetHash,
          deltaReceiptId: result.receipt.capture.deltaReceiptId,
          mode: expectedMode,
          authoringRevision: result.receipt.capture.authoringRevision
            ?? result.receipt.capture.captureRevision,
          captureRevision: result.receipt.capture.captureRevision,
          sourceHash: result.receipt.capture.coverageSourceHash
            ?? result.receipt.inputDigest,
          lifecycleState: 'CURRENT',
          entries: normalizeCoverageEntries(
            result.coverageEntries.map((entry, ordinal) => ({
              ...entry,
              ordinal,
              lifecycleState: 'CURRENT',
            })),
          ),
        });

        const existingVersion = await tx.aggregateCourseCoverageVersion.findUnique?.({
          where: { id: result.coverageVersionId },
          include: { entries: { orderBy: { ordinal: 'asc' } } },
        }) as (Record<string, unknown> & {
          entries?: Array<Record<string, unknown>>;
        }) | null;

        if (existingVersion) {
          const actualVersion = coverageVersionIdentity({
            id: String(existingVersion.id),
            schemaVersion: String(existingVersion.schemaVersion),
            overlayId: String(existingVersion.overlayId),
            overlayVersion: String(existingVersion.overlayVersion),
            courseId: String(existingVersion.courseId),
            releaseSetId: String(existingVersion.releaseSetId),
            releaseId: String(existingVersion.releaseId),
            releaseHash: String(existingVersion.releaseHash),
            sourceDatasetHash: existingVersion.sourceDatasetHash == null
              ? null
              : String(existingVersion.sourceDatasetHash),
            deltaReceiptId: String(existingVersion.deltaReceiptId),
            mode: String(existingVersion.mode),
            authoringRevision: String(existingVersion.authoringRevision),
            captureRevision: String(existingVersion.captureRevision),
            sourceHash: String(existingVersion.sourceHash),
            lifecycleState: String(existingVersion.lifecycleState),
            entries: normalizeCoverageEntries(
              (existingVersion.entries ?? []).map((entry) => ({
                canonicalId: String(entry.canonicalId),
                role: String(entry.role),
                ordinal: Number(entry.ordinal),
                rationale: entry.rationale == null ? null : String(entry.rationale),
                evidenceRefs: entry.evidenceRefs,
                reviewIdentity: String(entry.reviewIdentity),
                sourceEvidenceDigest: String(entry.sourceEvidenceDigest),
                lifecycleState: entry.lifecycleState == null
                  ? 'CURRENT'
                  : String(entry.lifecycleState),
              })),
            ),
          });
          assertSameIdentity(
            'coverage version',
            result.coverageVersionId,
            expectedVersion,
            actualVersion,
          );
        } else {
          // Supersede prior CURRENT versions for the same release set.
          // If later steps throw, Serializable transaction rolls this back.
          await tx.aggregateCourseCoverageVersion.updateMany?.({
            where: {
              releaseSetId: result.receipt.capture.releaseSetId,
              lifecycleState: 'CURRENT',
            },
            data: { lifecycleState: 'SUPERSEDED' },
          });
          await tx.aggregateCourseCoverageVersion.create({
            data: {
              id: expectedVersion.id,
              schemaVersion: expectedVersion.schemaVersion,
              overlayId: expectedVersion.overlayId,
              overlayVersion: expectedVersion.overlayVersion,
              courseId: expectedVersion.courseId,
              releaseSetId: expectedVersion.releaseSetId,
              releaseId: expectedVersion.releaseId,
              releaseHash: expectedVersion.releaseHash,
              sourceDatasetHash: expectedVersion.sourceDatasetHash,
              deltaReceiptId: expectedVersion.deltaReceiptId,
              mode: expectedVersion.mode,
              authoringRevision: expectedVersion.authoringRevision,
              captureRevision: expectedVersion.captureRevision,
              sourceHash: expectedVersion.sourceHash,
              lifecycleState: 'CURRENT',
            },
          });
          const releaseId = result.receipt.capture.releaseId;
          for (const [ordinal, entry] of result.coverageEntries.entries()) {
            await tx.aggregateCourseCoverageEntry.create({
              data: coverageEntryData(result.coverageVersionId, releaseId, entry, ordinal),
            });
          }
        }
      }

      for (const row of result.invalidatedCrosswalks) {
        await tx.actGovernedStructuralUnitCrosswalk.updateMany?.({
          where: { id: row.id, lifecycleState: 'CURRENT' },
          data: {
            lifecycleState: 'STALE',
            resolutionState: 'STALE',
            validationState: 'STALE',
          },
        });
      }

      // Persist every CURRENT Crosswalk: VALIDATED publications and
      // UNRESOLVED/REJECTED diagnostics. Never re-write STALE as CURRENT.
      const crosswalkRows = result.crosswalks.filter((row) => row.lifecycleState === 'CURRENT');
      for (const row of crosswalkRows) {
        const expected = normalizeCrosswalkPersisted(row);
        const existingById = await tx.actGovernedStructuralUnitCrosswalk.findUnique?.({
          where: { id: row.id },
        }) as Record<string, unknown> | null;
        if (existingById) {
          assertSameIdentity(
            'crosswalk',
            row.id,
            expected,
            normalizeCrosswalkPersisted(existingById),
          );
          continue;
        }

        // Endpoint uniqueness: another CURRENT row with same endpoint but different id.
        const endpointCollision = await tx.actGovernedStructuralUnitCrosswalk.findFirst?.({
          where: {
            releaseSetId: row.releaseSetId,
            releaseId: row.releaseId,
            publishedEntityId: row.publishedEntityId,
            retrievalChunkId: row.retrievalChunkId,
            citationTargetId: row.citationTargetId,
            captureRevision: row.captureRevision,
            NOT: { id: row.id },
          },
        }) as { id?: string } | null;
        if (endpointCollision?.id) {
          throw new Error(
            `Aggregate governance rejected: crosswalk endpoint conflict `
            + `(existing=${endpointCollision.id}, attempted=${row.id}, `
            + `endpoint=${crosswalkEndpointKey(row)})`,
          );
        }

        await tx.actGovernedStructuralUnitCrosswalk.create({
          data: expected,
        });
      }

      for (const row of result.revalidationReceipts) {
        const expected = normalizeRevalidationPersisted(row);
        const existingRevalidation = await tx.aggregateRevalidationReceipt.findUnique?.({
          where: { id: row.id },
        }) as Record<string, unknown> | null;
        if (existingRevalidation) {
          assertSameIdentity(
            'revalidation receipt',
            row.id,
            expected,
            normalizeRevalidationPersisted(existingRevalidation),
          );
          continue;
        }
        await tx.aggregateRevalidationReceipt.create({
          data: expected,
        });
      }

      // Feed same-run #1124 binding decisions into decision/persistence.
      // Fail closed: any create/identity conflict rolls back the transaction.
      const bindingDecisions = result.binding?.decisions ?? [];
      let bindingDecisionsPersisted = 0;
      if (bindingDecisions.length > 0 && !tx.canonicalResourceBindingDecision) {
        throw new Error(
          'Aggregate governance rejected: binding decisions present but '
          + 'canonicalResourceBindingDecision delegate is unavailable',
        );
      }
      for (const decision of bindingDecisions) {
        const expectedDecision = {
          id: decision.id,
          pairId: decision.pairId,
          releaseSetId: decision.releaseSetId,
          releaseId: decision.releaseId,
          canonicalId: decision.canonicalId,
          objectRevision: decision.objectRevision,
          resourceId: decision.resourceId,
          structuralUnitId: decision.structuralUnitId,
          segmentId: decision.segmentId,
          resourceSegmentHash: decision.resourceSegmentHash,
          role: decision.role,
          evidenceId: decision.evidenceId,
          evidenceDigest: decision.evidenceDigest,
          generatorPromptVersion: decision.generatorPromptVersion,
          reviewerPromptVersion: decision.reviewerPromptVersion,
          generatorCacheKey: decision.generatorCacheKey,
          reviewerCacheKey: decision.reviewerCacheKey,
          reviewerRole: decision.reviewerRole,
          reviewerInputDigest: decision.reviewerInputDigest,
          candidateDigest: decision.candidateDigest,
          reviewProvider: decision.reviewProvider,
          reviewState: decision.reviewState,
          publicationState: decision.publicationState,
          lifecycleState: decision.lifecycleState,
          attemptSequence: decision.attemptSequence,
          supersedesDecisionId: decision.supersedesDecisionId,
          crosswalkId: decision.crosswalkId,
          inventoryRunId: decision.inventoryRunId,
          captureRevision: decision.captureRevision,
          structuralUnitVersion: decision.structuralUnitVersion,
          validationDigest: decision.validationDigest,
          highImpactPolicyVersion: decision.highImpactPolicyVersion,
          highImpactReasons: decision.highImpactReasons,
          reviewIdentity: decision.reviewIdentity ?? null,
          reviewRationale: decision.reviewRationale ?? null,
          governedCrosswalkId: decision.governedCrosswalkId ?? null,
          governedInventoryRunId: decision.governedInventoryRunId ?? null,
          governedCaptureRevision: decision.governedCaptureRevision ?? null,
          governedStructuralUnitVersion: decision.governedStructuralUnitVersion ?? null,
          governedValidationDigest: decision.governedValidationDigest ?? null,
        };
        const existing = await tx.canonicalResourceBindingDecision!.findUnique?.({
          where: { id: decision.id },
        }) as Record<string, unknown> | null;
        if (existing) {
          assertSameIdentity(
            'binding decision',
            decision.id,
            expectedDecision,
            {
              id: String(existing.id),
              pairId: String(existing.pairId),
              releaseSetId: String(existing.releaseSetId),
              releaseId: String(existing.releaseId),
              canonicalId: String(existing.canonicalId),
              objectRevision: String(existing.objectRevision),
              resourceId: String(existing.resourceId),
              structuralUnitId: String(existing.structuralUnitId),
              segmentId: String(existing.segmentId),
              resourceSegmentHash: String(existing.resourceSegmentHash),
              role: String(existing.role),
              evidenceId: existing.evidenceId == null ? null : String(existing.evidenceId),
              evidenceDigest: String(existing.evidenceDigest),
              generatorPromptVersion: String(existing.generatorPromptVersion),
              reviewerPromptVersion: String(existing.reviewerPromptVersion),
              generatorCacheKey: String(existing.generatorCacheKey),
              reviewerCacheKey: String(existing.reviewerCacheKey),
              reviewerRole: String(existing.reviewerRole),
              reviewerInputDigest: String(existing.reviewerInputDigest),
              candidateDigest: String(existing.candidateDigest),
              reviewProvider: String(existing.reviewProvider),
              reviewState: String(existing.reviewState),
              publicationState: String(existing.publicationState),
              lifecycleState: String(existing.lifecycleState),
              attemptSequence: Number(existing.attemptSequence),
              supersedesDecisionId: existing.supersedesDecisionId == null
                ? null
                : String(existing.supersedesDecisionId),
              crosswalkId: existing.crosswalkId == null ? null : String(existing.crosswalkId),
              inventoryRunId: existing.inventoryRunId == null
                ? null
                : String(existing.inventoryRunId),
              captureRevision: existing.captureRevision == null
                ? null
                : String(existing.captureRevision),
              structuralUnitVersion: existing.structuralUnitVersion == null
                ? null
                : String(existing.structuralUnitVersion),
              validationDigest: existing.validationDigest == null
                ? null
                : String(existing.validationDigest),
              highImpactPolicyVersion: String(existing.highImpactPolicyVersion),
              highImpactReasons: existing.highImpactReasons,
              reviewIdentity: existing.reviewIdentity == null
                ? null
                : String(existing.reviewIdentity),
              reviewRationale: existing.reviewRationale == null
                ? null
                : String(existing.reviewRationale),
              governedCrosswalkId: existing.governedCrosswalkId == null
                ? null
                : String(existing.governedCrosswalkId),
              governedInventoryRunId: existing.governedInventoryRunId == null
                ? null
                : String(existing.governedInventoryRunId),
              governedCaptureRevision: existing.governedCaptureRevision == null
                ? null
                : String(existing.governedCaptureRevision),
              governedStructuralUnitVersion: existing.governedStructuralUnitVersion == null
                ? null
                : String(existing.governedStructuralUnitVersion),
              governedValidationDigest: existing.governedValidationDigest == null
                ? null
                : String(existing.governedValidationDigest),
            },
          );
          bindingDecisionsPersisted += 1;
          continue;
        }
        await tx.canonicalResourceBindingDecision!.create({
          data: expectedDecision,
        });
        if (
          decision.publicationState === 'HUMAN_REQUIRED'
          && tx.canonicalResourceBindingHumanQueueItem
        ) {
          await tx.canonicalResourceBindingHumanQueueItem.create({
            data: {
              id: `${decision.id}:human`,
              bindingDecisionId: decision.id,
              reasonCodes: decision.highImpactReasons,
              contextDigest: decision.candidateDigest,
              inputDigest: decision.reviewerInputDigest,
              state: 'PENDING',
            },
          });
        }
        bindingDecisionsPersisted += 1;
      }

      // Receipt summary identity is fixed by the pure pipeline. Binding
      // retention/persist counts are returned to the caller only so re-persist
      // remains byte-stable for immutable receipt identity.
      await tx.aggregateGovernanceReceipt.create({
        data: receiptData(result.receipt),
      });

      return {
        mode: 'created' as const,
        receiptId: result.receipt.id,
        bindingDecisionsPersisted,
        bindingCandidatesRetained: result.binding?.candidatesGenerated ?? 0,
      };
    }, { isolationLevel: 'Serializable' });
  }
}
