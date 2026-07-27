import { prisma } from '@/lib/prisma';

import type {
  AuthoritySelector,
  AuthoritativeEvidenceRecord,
  AuthoritativeImportReceiptRecord,
  AuthoritativeKnowledgeSnapshot,
  AuthoritativeObjectRecord,
  AuthoritativeRelationRecord,
  AuthoritativeReleaseRecord,
  AuthoritativeReleaseSetRecord,
  AuthoritativeSourceMappingRecord,
  AuthoritativeSourceObjectRecord,
  CourseCoverageAuditIdentity,
  CourseCoverageDiagnostic,
  CourseCoverageRecord,
  CourseCoverageResult,
  CourseCoverageRole,
  CourseCoverageSelector,
  RepositoryDiagnostic,
  RepositoryResult,
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

function diagnoseSnapshot(snapshot: AuthoritativeKnowledgeSnapshot): RepositoryDiagnostic[] {
  const diagnostics: RepositoryDiagnostic[] = [];
  const { releaseSet, release, receipt } = snapshot;

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
