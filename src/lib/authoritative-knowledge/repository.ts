import { prisma } from '@/lib/prisma';

import {
  CURRENT_AGGREGATE_RELEASE_SET_ID,
  CTKG_0_2_SCHEMA_VERSION,
  isAggregateReleaseProtocol,
  type AuthoritySelector,
  type AuthoritativeEvidenceRecord,
  type AuthoritativeImportReceiptRecord,
  type AuthoritativeKnowledgeSnapshot,
  type AuthoritativeObjectRecord,
  type AuthoritativeProjectionLinkRecord,
  type AuthoritativeProjectionNodeRecord,
  type AuthoritativeRelationRecord,
  type AuthoritativeReleaseArtifactRecord,
  type AuthoritativeReleaseComponentRecord,
  type AuthoritativeReleaseEntryRecord,
  type AuthoritativeReleaseRecord,
  type AuthoritativeReleaseSetRecord,
  type AuthoritativeSourceMappingRecord,
  type AuthoritativeSourceObjectRecord,
  type AuthoritativeUpstreamRagReferenceRecord,
  type CourseCoverageAuditIdentity,
  type CourseCoverageDiagnostic,
  type CourseCoverageRecord,
  type CourseCoverageResult,
  type CourseCoverageRole,
  type CourseCoverageSelector,
  type RepositoryDiagnostic,
  type RepositoryResult,
} from './contracts';

interface Delegate {
  findUnique(args: unknown): Promise<unknown>;
  findMany(args: unknown): Promise<unknown[]>;
}

export interface AuthoritativeKnowledgeTransaction {
  actkgReleaseSet: Delegate;
  actkgRelease: Delegate;
  actkgImportReceipt: Delegate;
  actkgAuthoritativeObject: Delegate;
  actkgAuthoritativeRelation: Delegate;
  actkgSourceMapping: Delegate;
  actkgSourceObject: Delegate;
  actkgEvidenceSegment: Delegate;
  actkgReleaseArtifact: Delegate;
  actkgReleaseComponent: Delegate;
  actkgReleaseEntry: Delegate;
  actkgProjectionNode: Delegate;
  actkgProjectionLink: Delegate;
  actkgUpstreamRagReference: Delegate;
  courseCoverageOverlayVersion: Delegate;
  courseCoverageOverlayEntry: Delegate;
  courseCoverageImportReceipt: Delegate;
}

export interface AuthoritativeKnowledgeDatabase {
  $transaction<T>(
    callback: (transaction: AuthoritativeKnowledgeTransaction) => Promise<T>,
    options: { isolationLevel: 'RepeatableRead' },
  ): Promise<T>;
}

const SHA256 = /^[a-f0-9]{64}$/u;
const GIT_COMMIT = /^[a-f0-9]{40}$/u;

function byOrdinalAndId<T extends { ordinal: number }>(
  rows: T[],
  identity: (row: T) => string,
): T[] {
  return [...rows].sort((left, right) => (
    left.ordinal - right.ordinal || identity(left).localeCompare(identity(right))
  ));
}

function compare(
  diagnostics: RepositoryDiagnostic[],
  input: {
    code: RepositoryDiagnostic['code'];
    field: string;
    expected: string | number;
    actual: string | number | null;
  },
): void {
  if (input.expected !== input.actual) diagnostics.push(input);
}

function compareNullable(
  diagnostics: RepositoryDiagnostic[],
  input: {
    code: RepositoryDiagnostic['code'];
    field: string;
    expected: string | number | null;
    actual: string | number | null;
  },
): void {
  if (input.expected !== input.actual) {
    diagnostics.push({
      code: input.code,
      field: input.field,
      expected: input.expected ?? '(missing)',
      actual: input.actual,
    });
  }
}

function diagnoseSnapshot(snapshot: AuthoritativeKnowledgeSnapshot): RepositoryDiagnostic[] {
  const diagnostics: RepositoryDiagnostic[] = [];
  const { releaseSet, release, receipt } = snapshot;
  const aggregate = isAggregateReleaseProtocol(release.protocol);

  compare(diagnostics, {
    code: 'candidate-state-mismatch',
    field: 'releaseSet.candidateState',
    expected: 'CANDIDATE',
    actual: releaseSet.candidateState,
  });
  compare(diagnostics, {
    code: 'release-set-identity-mismatch',
    field: 'release.releaseSetId',
    expected: releaseSet.id,
    actual: release.releaseSetId,
  });
  if (!GIT_COMMIT.test(release.captureRevision)) {
    diagnostics.push({
      code: 'capture-revision-invalid',
      field: 'release.captureRevision',
      expected: '40 lowercase hexadecimal characters',
      actual: release.captureRevision,
    });
  }
  for (const [field, value] of [
    ['release.contractHash', release.contractHash],
    ['release.releaseHash', release.releaseHash],
    ['release.schemaRawHash', release.schemaRawHash],
    ['release.releaseRawHash', release.releaseRawHash],
    ['release.notesRawHash', release.notesRawHash],
    ['release.lockRawHash', release.lockRawHash],
  ] as const) {
    if (!SHA256.test(value)) {
      diagnostics.push({
        code: 'hash-invalid',
        field,
        expected: '64 lowercase hexadecimal characters',
        actual: value,
      });
    }
  }

  if (aggregate) {
    compareNullable(diagnostics, {
      code: 'release-identity-mismatch',
      field: 'release.schemaVersion',
      expected: CTKG_0_2_SCHEMA_VERSION,
      actual: release.schemaVersion ?? null,
    });
    for (const [field, value] of [
      ['release.projectionDigest', release.projectionDigest],
      ['release.sourceDatasetHash', release.sourceDatasetHash],
    ] as const) {
      if (typeof value !== 'string' || !SHA256.test(value)) {
        diagnostics.push({
          code: 'hash-invalid',
          field,
          expected: '64 lowercase hexadecimal characters',
          actual: value ?? null,
        });
      }
    }
    for (const [field, value] of [
      ['release.upstreamPublicationCommit', release.upstreamPublicationCommit],
      ['release.upstreamClosedCommit', release.upstreamClosedCommit],
    ] as const) {
      if (typeof value !== 'string' || !GIT_COMMIT.test(value)) {
        diagnostics.push({
          code: 'capture-revision-invalid',
          field,
          expected: '40 lowercase hexadecimal characters',
          actual: value ?? null,
        });
      }
    }
  }

  if (!receipt) {
    diagnostics.push({
      code: 'receipt-missing',
      field: 'receipt',
      expected: 'present',
      actual: null,
    });
    return diagnostics;
  }

  compare(diagnostics, {
    code: 'receipt-identity-mismatch',
    field: 'receipt.releaseSetId',
    expected: releaseSet.id,
    actual: receipt.releaseSetId,
  });
  compare(diagnostics, {
    code: 'receipt-identity-mismatch',
    field: 'receipt.releaseId',
    expected: release.id,
    actual: receipt.releaseId,
  });
  compare(diagnostics, {
    code: 'candidate-state-mismatch',
    field: 'receipt.candidateState',
    expected: 'CANDIDATE',
    actual: receipt.candidateState,
  });
  compare(diagnostics, {
    code: 'capture-revision-mismatch',
    field: 'receipt.captureRevision',
    expected: release.captureRevision,
    actual: receipt.captureRevision,
  });
  compare(diagnostics, {
    code: 'lock-hash-mismatch',
    field: 'receipt.lockRawHash',
    expected: release.lockRawHash,
    actual: receipt.lockRawHash,
  });

  const actualCounts = {
    objectCount: snapshot.objects.length,
    sourceMappingCount: snapshot.sourceMappings.length,
    goldRelationCount: snapshot.relations.filter((row) => row.qualityTier === 'GOLD').length,
    silverRelationCount: snapshot.relations.filter((row) => row.qualityTier === 'SILVER').length,
    sourceObjectCount: snapshot.sourceObjects.length,
    evidenceSegmentCount: snapshot.evidence.length,
  };
  for (const [field, actual] of Object.entries(actualCounts)) {
    compare(diagnostics, {
      code: 'receipt-count-mismatch',
      field: `receipt.${field}`,
      expected: receipt[field as keyof typeof actualCounts],
      actual,
    });
  }

  if (aggregate) {
    for (const [field, expected, actual] of [
      ['receipt.schemaVersion', release.schemaVersion, receipt.schemaVersion],
      ['receipt.upstreamReleaseId', release.upstreamReleaseId, receipt.upstreamReleaseId],
      ['receipt.projectionId', release.projectionId, receipt.projectionId],
      ['receipt.projectionDigest', release.projectionDigest, receipt.projectionDigest],
      ['receipt.sourceDatasetHash', release.sourceDatasetHash, receipt.sourceDatasetHash],
      ['receipt.upstreamPublicationCommit', release.upstreamPublicationCommit, receipt.upstreamPublicationCommit],
      ['receipt.upstreamClosedCommit', release.upstreamClosedCommit, receipt.upstreamClosedCommit],
    ] as const) {
      compareNullable(diagnostics, {
        code: 'receipt-identity-mismatch',
        field,
        expected: expected ?? null,
        actual: actual ?? null,
      });
    }
    const aggregateCounts = {
      releaseEntryCount: snapshot.releaseEntries?.length ?? 0,
      projectionNodeCount: snapshot.projectionNodes?.length ?? 0,
      projectionLinkCount: snapshot.projectionLinks?.length ?? 0,
      upstreamRagReferenceCount: snapshot.upstreamRagReferences?.length ?? 0,
      artifactCount: snapshot.releaseArtifacts?.length ?? 0,
      componentCount: snapshot.releaseComponents?.length ?? 0,
    } as const;
    for (const [field, actual] of Object.entries(aggregateCounts)) {
      const expected = receipt[field as keyof typeof aggregateCounts];
      if (typeof expected === 'number') {
        compare(diagnostics, {
          code: 'receipt-count-mismatch',
          field: `receipt.${field}`,
          expected,
          actual,
        });
      } else {
        diagnostics.push({
          code: 'receipt-count-mismatch',
          field: `receipt.${field}`,
          expected: 'present',
          actual: null,
        });
      }
    }
  }
  return diagnostics;
}

export class AuthoritativeKnowledgeRepository {
  constructor(
    private readonly database: AuthoritativeKnowledgeDatabase =
      prisma as unknown as AuthoritativeKnowledgeDatabase,
  ) {}

  async read(selector: AuthoritySelector): Promise<RepositoryResult> {
    if (selector.authorityState === 'active') {
      return {
        status: 'unavailable',
        selector,
        reason: 'active-pointer-unavailable',
        diagnostics: [],
      };
    }
    if (selector.authorityState === 'legacy') {
      return {
        status: 'unavailable',
        selector,
        reason: 'legacy-outside-repository',
        diagnostics: [],
      };
    }

    return this.database.$transaction(async (transaction) => {
      const releaseSet = await transaction.actkgReleaseSet.findUnique({
        where: { id: selector.releaseSetId },
      }) as AuthoritativeReleaseSetRecord | null;
      const release = await transaction.actkgRelease.findUnique({
        where: { id: selector.releaseId },
      }) as AuthoritativeReleaseRecord | null;
      if (!releaseSet || !release || release.releaseSetId !== selector.releaseSetId) {
        return {
          status: 'unavailable',
          selector,
          reason: 'candidate-not-found',
          diagnostics: [],
        };
      }

      const historical = releaseSet.id !== CURRENT_AGGREGATE_RELEASE_SET_ID;

      if (isAggregateReleaseProtocol(release.protocol)) {
        // Aggregate branch: read only CTKG 0.2 public release/projection rows.
        // Historical CTKG 0.1 tables are never queried for this release.
        const [
          receipt,
          releaseArtifacts,
          releaseComponents,
          releaseEntries,
          projectionNodes,
          projectionLinks,
          upstreamRagReferences,
        ] = await Promise.all([
          transaction.actkgImportReceipt.findUnique({ where: { releaseId: selector.releaseId } }),
          transaction.actkgReleaseArtifact.findMany({
            where: { releaseId: selector.releaseId },
            select: {
              releaseId: true,
              relativePath: true,
              ordinal: true,
              mediaType: true,
              sha256: true,
              byteLength: true,
            },
            orderBy: [{ ordinal: 'asc' }, { relativePath: 'asc' }],
          }),
          transaction.actkgReleaseComponent.findMany({
            where: { releaseId: selector.releaseId },
            orderBy: [{ ordinal: 'asc' }, { componentReleaseId: 'asc' }],
          }),
          transaction.actkgReleaseEntry.findMany({
            where: { releaseId: selector.releaseId },
            orderBy: [{ ordinal: 'asc' }, { entityId: 'asc' }],
          }),
          transaction.actkgProjectionNode.findMany({
            where: { releaseId: selector.releaseId },
            orderBy: [{ ordinal: 'asc' }, { nodeId: 'asc' }],
          }),
          transaction.actkgProjectionLink.findMany({
            where: { releaseId: selector.releaseId },
            orderBy: [{ ordinal: 'asc' }, { linkId: 'asc' }],
          }),
          transaction.actkgUpstreamRagReference.findMany({
            where: { releaseId: selector.releaseId },
            orderBy: [{ ordinal: 'asc' }, { publishedEntityId: 'asc' }],
          }),
        ]);

        const snapshot: AuthoritativeKnowledgeSnapshot = {
          authorityState: 'candidate',
          productionAuthoritative: false,
          historical,
          releaseSet,
          release,
          receipt: receipt as AuthoritativeImportReceiptRecord | null,
          objects: [],
          relations: [],
          sourceMappings: [],
          sourceObjects: [],
          evidence: [],
          releaseArtifacts: byOrdinalAndId(
            releaseArtifacts as AuthoritativeReleaseArtifactRecord[],
            (row) => row.relativePath,
          ),
          releaseComponents: byOrdinalAndId(
            releaseComponents as AuthoritativeReleaseComponentRecord[],
            (row) => row.componentReleaseId,
          ),
          releaseEntries: byOrdinalAndId(
            releaseEntries as AuthoritativeReleaseEntryRecord[],
            (row) => row.entityId,
          ),
          projectionNodes: byOrdinalAndId(
            projectionNodes as AuthoritativeProjectionNodeRecord[],
            (row) => row.nodeId,
          ),
          projectionLinks: byOrdinalAndId(
            projectionLinks as AuthoritativeProjectionLinkRecord[],
            (row) => row.linkId,
          ),
          upstreamRagReferences: byOrdinalAndId(
            upstreamRagReferences as AuthoritativeUpstreamRagReferenceRecord[],
            (row) => `${row.publishedEntityId}${row.retrievalChunkId}${row.citationTargetId}`,
          ),
        };
        const diagnostics = diagnoseSnapshot(snapshot);
        return diagnostics.length === 0
          ? { status: 'available', selector, snapshot, diagnostics: [] }
          : { status: 'drift', selector, snapshot, diagnostics };
      }

      const [
        receipt,
        objects,
        relations,
        sourceMappings,
        sourceObjects,
        evidence,
      ] = await Promise.all([
        transaction.actkgImportReceipt.findUnique({ where: { releaseId: selector.releaseId } }),
        transaction.actkgAuthoritativeObject.findMany({
          where: { releaseId: selector.releaseId },
          orderBy: [{ ordinal: 'asc' }, { canonicalId: 'asc' }],
        }),
        transaction.actkgAuthoritativeRelation.findMany({
          where: { releaseId: selector.releaseId },
          orderBy: [{ qualityTier: 'asc' }, { ordinal: 'asc' }, { relationId: 'asc' }],
        }),
        transaction.actkgSourceMapping.findMany({
          where: { releaseId: selector.releaseId },
          orderBy: [{ ordinal: 'asc' }, { mappingId: 'asc' }],
        }),
        transaction.actkgSourceObject.findMany({
          where: { releaseId: selector.releaseId },
          orderBy: [{ ordinal: 'asc' }, { sourceObjectId: 'asc' }],
        }),
        transaction.actkgEvidenceSegment.findMany({
          where: { releaseId: selector.releaseId },
          orderBy: [{ ordinal: 'asc' }, { evidenceId: 'asc' }],
        }),
      ]);

      const snapshot: AuthoritativeKnowledgeSnapshot = {
        authorityState: 'candidate',
        productionAuthoritative: false,
        historical,
        releaseSet,
        release,
        receipt: receipt as AuthoritativeImportReceiptRecord | null,
        objects: byOrdinalAndId(objects as AuthoritativeObjectRecord[], (row) => row.canonicalId),
        relations: byOrdinalAndId(relations as AuthoritativeRelationRecord[], (row) => (
          `${row.qualityTier}\u001f${row.relationId}`
        )),
        sourceMappings: byOrdinalAndId(
          sourceMappings as AuthoritativeSourceMappingRecord[],
          (row) => row.mappingId,
        ),
        sourceObjects: byOrdinalAndId(
          sourceObjects as AuthoritativeSourceObjectRecord[],
          (row) => row.sourceObjectId,
        ),
        evidence: byOrdinalAndId(evidence as AuthoritativeEvidenceRecord[], (row) => row.evidenceId),
      };
      const diagnostics = diagnoseSnapshot(snapshot);
      return diagnostics.length === 0
        ? { status: 'available', selector, snapshot, diagnostics: [] }
        : { status: 'drift', selector, snapshot, diagnostics };
    }, { isolationLevel: 'RepeatableRead' });
  }

  async readCourseCoverage(
    selector?: CourseCoverageSelector,
  ): Promise<CourseCoverageResult> {
    if (!selector) {
      return {
        status: 'unavailable',
        selector: null,
        reason: 'missing-selector',
        diagnostics: [],
        productionAuthoritative: false,
      };
    }

    return this.database.$transaction(async (transaction) => {
      const version = await transaction.courseCoverageOverlayVersion.findUnique({
        where: {
          overlayId_overlayVersion: {
            overlayId: selector.overlayId,
            overlayVersion: selector.overlayVersion,
          },
        },
      }) as (CourseCoverageAuditIdentity & {
        id: string;
        schemaVersion: string;
      }) | null;
      if (!version) {
        return {
          status: 'unavailable',
          selector,
          reason: 'coverage-not-found',
          diagnostics: [],
          productionAuthoritative: false,
        };
      }
      const [releaseSet, release, receipt, rawEntries] = await Promise.all([
        transaction.actkgReleaseSet.findUnique({ where: { id: version.releaseSetId } }),
        transaction.actkgRelease.findUnique({ where: { id: version.releaseId } }),
        transaction.courseCoverageImportReceipt.findUnique({
          where: { overlayVersionId: version.id },
        }),
        transaction.courseCoverageOverlayEntry.findMany({
          where: { overlayVersionId: version.id },
          orderBy: [{ ordinal: 'asc' }, { canonicalId: 'asc' }, { role: 'asc' }],
        }),
      ]);
      const entries = rawEntries as CourseCoverageRecord[];
      const coveredObjects = await transaction.actkgAuthoritativeObject.findMany({
        where: {
          releaseId: version.releaseId,
          canonicalId: { in: [...new Set(entries.map((entry) => entry.canonicalId))] },
        },
        orderBy: [{ ordinal: 'asc' }, { canonicalId: 'asc' }],
      }) as AuthoritativeObjectRecord[];
      const audit: CourseCoverageAuditIdentity = {
        courseId: version.courseId,
        overlayId: version.overlayId,
        overlayVersion: version.overlayVersion,
        overlayVersionId: version.id,
        authoringRevision: version.authoringRevision,
        captureRevision: version.captureRevision,
        sourceHash: version.sourceHash,
        releaseSetId: version.releaseSetId,
        releaseId: version.releaseId,
        releaseHash: version.releaseHash,
        lockRawHash: version.lockRawHash,
        productionAuthoritative: false,
      };
      const diagnostics: CourseCoverageDiagnostic[] = [];
      const compareCoverage = (
        code: CourseCoverageDiagnostic['code'],
        field: string,
        expected: string | number,
        actual: string | number | null,
      ): void => {
        if (expected !== actual) diagnostics.push({ code, field, expected, actual });
      };
      compareCoverage('selector-mismatch', 'courseId', selector.courseId, version.courseId);
      compareCoverage('selector-mismatch', 'overlayId', selector.overlayId, version.overlayId);
      compareCoverage('selector-mismatch', 'overlayVersion', selector.overlayVersion, version.overlayVersion);
      compareCoverage('selector-mismatch', 'releaseSetId', selector.releaseSetId, version.releaseSetId);
      compareCoverage('selector-mismatch', 'releaseId', selector.releaseId, version.releaseId);
      compareCoverage(
        'release-drift',
        'releaseSet.id',
        version.releaseSetId,
        (releaseSet as { id?: string } | null)?.id ?? null,
      );
      compareCoverage(
        'release-drift',
        'releaseSet.candidateState',
        'CANDIDATE',
        (releaseSet as { candidateState?: string } | null)?.candidateState ?? null,
      );
      compareCoverage(
        'release-drift',
        'release.releaseSetId',
        version.releaseSetId,
        (release as { releaseSetId?: string } | null)?.releaseSetId ?? null,
      );
      compareCoverage(
        'release-drift',
        'release.releaseHash',
        version.releaseHash,
        (release as { releaseHash?: string } | null)?.releaseHash ?? null,
      );
      compareCoverage(
        'release-drift',
        'release.lockRawHash',
        version.lockRawHash,
        (release as { lockRawHash?: string } | null)?.lockRawHash ?? null,
      );
      if (!receipt) {
        diagnostics.push({
          code: 'receipt-missing',
          field: 'receipt',
          expected: 'present',
          actual: null,
        });
      } else {
        const typedReceipt = receipt as {
          authoringRevision: string;
          captureRevision: string;
          sourceHash: string;
          releaseHash: string;
          lockRawHash: string;
          entryCount: number;
        };
        compareCoverage(
          'receipt-identity-mismatch',
          'receipt.authoringRevision',
          version.authoringRevision,
          typedReceipt.authoringRevision,
        );
        compareCoverage(
          'receipt-identity-mismatch',
          'receipt.sourceHash',
          version.sourceHash,
          typedReceipt.sourceHash,
        );
        compareCoverage(
          'receipt-identity-mismatch',
          'receipt.captureRevision',
          version.captureRevision,
          typedReceipt.captureRevision,
        );
        compareCoverage(
          'receipt-identity-mismatch',
          'receipt.releaseHash',
          version.releaseHash,
          typedReceipt.releaseHash,
        );
        compareCoverage(
          'receipt-identity-mismatch',
          'receipt.lockRawHash',
          version.lockRawHash,
          typedReceipt.lockRawHash,
        );
        compareCoverage(
          'receipt-count-mismatch',
          'receipt.entryCount',
          entries.length,
          typedReceipt.entryCount,
        );
      }
      compareCoverage(
        'covered-object-missing',
        'coveredObjectCount',
        new Set(entries.map((entry) => entry.canonicalId)).size,
        coveredObjects.length,
      );
      const allowedRoles = new Set<CourseCoverageRole>([
        'formal_objective',
        'necessary_prerequisite',
        'explicit_extension',
      ]);
      entries.forEach((entry) => {
        if (!allowedRoles.has(entry.role)) {
          diagnostics.push({
            code: 'unsupported-role',
            field: `entry.${entry.canonicalId}.role`,
            expected: 'registered CourseCoverageRole',
            actual: entry.role,
          });
        }
      });
      return diagnostics.length === 0
        ? {
            status: 'available',
            selector,
            audit,
            entries,
            diagnostics: [],
            productionAuthoritative: false,
          }
        : {
            status: 'drift',
            selector,
            audit,
            entries,
            diagnostics,
            productionAuthoritative: false,
          };
    }, { isolationLevel: 'RepeatableRead' });
  }
}
