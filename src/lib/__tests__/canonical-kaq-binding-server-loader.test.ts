/**
 * Focused server-loader regression for #1113 loadKaqPinnedContextFromDb.
 * Mocks Prisma only — does not expose production row/result injection APIs.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  PINNED_KAQ_AGGREGATE_RELEASE_ID,
  PINNED_KAQ_AGGREGATE_RELEASE_SET_ID,
  PINNED_KAQ_COVERAGE_OVERLAY_ID,
} from '@/lib/canonical-kaq-binding';
import { KaqAuthorityInputError } from '@/lib/canonical-kaq-binding/authority-capability';

const releaseHash = 'a'.repeat(64);
const sourceDatasetHash = 'b'.repeat(64);
const coverageSourceHash = 'c'.repeat(64);
const captureRevision = 'd'.repeat(40);
const deltaReceiptId = 'delta-receipt:accepted-aggregate-v1';
const coverageVersionId = 'agg-cov:automatic-control@1';
const governanceReceiptId = 'agg-gov:receipt-v1';
const outputDigest = 'e'.repeat(64);

const mockPrisma = {
  actkgReleaseSetDeltaReceipt: {
    findUnique: vi.fn(),
  },
  aggregateCourseCoverageVersion: {
    findUnique: vi.fn(),
  },
  aggregateCourseCoverageEntry: {
    findMany: vi.fn(),
  },
  aggregateGovernanceReceipt: {
    findFirst: vi.fn(),
  },
};

vi.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}));

const selector = {
  courseId: 'automatic-control',
  overlayId: PINNED_KAQ_COVERAGE_OVERLAY_ID,
  overlayVersion: '1',
  releaseSetId: PINNED_KAQ_AGGREGATE_RELEASE_SET_ID,
  releaseId: PINNED_KAQ_AGGREGATE_RELEASE_ID,
};

function acceptedDeltaRow(overrides: Record<string, unknown> = {}) {
  return {
    id: deltaReceiptId,
    authorizationState: 'ACCEPTED',
    candidateReleaseSetId: PINNED_KAQ_AGGREGATE_RELEASE_SET_ID,
    candidateReleaseId: PINNED_KAQ_AGGREGATE_RELEASE_ID,
    candidateReleaseHash: releaseHash,
    candidateSourceDatasetHash: sourceDatasetHash,
    outputDigest,
    captureRevision,
    ...overrides,
  };
}

function currentCoverageVersion(overrides: Record<string, unknown> = {}) {
  return {
    id: coverageVersionId,
    courseId: selector.courseId,
    overlayId: selector.overlayId,
    overlayVersion: selector.overlayVersion,
    releaseSetId: selector.releaseSetId,
    releaseId: selector.releaseId,
    releaseHash,
    sourceDatasetHash,
    deltaReceiptId,
    authoringRevision: captureRevision,
    captureRevision,
    sourceHash: coverageSourceHash,
    lifecycleState: 'CURRENT',
    ...overrides,
  };
}

function currentEntries() {
  return [
    {
      canonicalId: 'ctr:object:feedback-loop',
      role: 'formal_objective',
      ordinal: 0,
      lifecycleState: 'CURRENT',
    },
    {
      canonicalId: 'ctr:object:transfer-function',
      role: 'necessary_prerequisite',
      ordinal: 1,
      lifecycleState: 'CURRENT',
    },
    {
      canonicalId: 'ctr:object:excluded',
      role: 'excluded_with_rationale',
      ordinal: 2,
      lifecycleState: 'CURRENT',
    },
  ];
}

function shadowGovernance(overrides: Record<string, unknown> = {}) {
  return {
    id: governanceReceiptId,
    coverageVersionId,
    releaseSetId: selector.releaseSetId,
    releaseId: selector.releaseId,
    releaseHash,
    sourceDatasetHash,
    deltaReceiptId,
    deltaOutputDigest: outputDigest,
    deltaCaptureRevision: captureRevision,
    coverageSourceHash,
    captureRevision,
    authoringRevision: captureRevision,
    authorityState: 'SHADOW',
    productionAuthoritative: false,
    ...overrides,
  };
}

describe('loadKaqPinnedContextFromDb aggregate authority', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('mints verified pinned context from CURRENT aggregate coverage + SHADOW governance', async () => {
    mockPrisma.actkgReleaseSetDeltaReceipt.findUnique.mockResolvedValue(acceptedDeltaRow());
    mockPrisma.aggregateCourseCoverageVersion.findUnique.mockResolvedValue(currentCoverageVersion());
    mockPrisma.aggregateCourseCoverageEntry.findMany.mockResolvedValue(currentEntries());
    mockPrisma.aggregateGovernanceReceipt.findFirst.mockResolvedValue(shadowGovernance());

    const { loadKaqPinnedContextFromDb } = await import(
      '@/lib/canonical-kaq-binding/authority-capability'
    );
    const pinned = await loadKaqPinnedContextFromDb({
      deltaReceiptId,
      coverageSelector: selector,
    });

    expect(pinned.releaseSetId).toBe(PINNED_KAQ_AGGREGATE_RELEASE_SET_ID);
    expect(pinned.releaseId).toBe(PINNED_KAQ_AGGREGATE_RELEASE_ID);
    expect(pinned.deltaReceiptId).toBe(deltaReceiptId);
    expect(pinned.coverageOverlayId).toBe(PINNED_KAQ_COVERAGE_OVERLAY_ID);
    expect(pinned.coverageSourceHash).toBe(coverageSourceHash);
    expect(pinned.coverageCaptureRevision).toBe(captureRevision);
    // excluded_with_rationale must not admit.
    expect(pinned.admittedCanonicalIds).toEqual([
      'ctr:object:feedback-loop',
      'ctr:object:transfer-function',
    ]);
    expect(pinned.contextDigest).toMatch(/^[a-f0-9]{64}$/);

    // Loader queries aggregate tables, not legacy CourseCoverageOverlayVersion.
    expect(mockPrisma.aggregateCourseCoverageVersion.findUnique).toHaveBeenCalled();
    expect(mockPrisma.aggregateCourseCoverageEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          versionId: coverageVersionId,
          lifecycleState: 'CURRENT',
        }),
      }),
    );
    expect(mockPrisma.aggregateGovernanceReceipt.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          coverageVersionId,
          deltaReceiptId,
          authorityState: 'SHADOW',
          productionAuthoritative: false,
        }),
      }),
    );
  });

  it('fails closed when AggregateGovernanceReceipt is missing', async () => {
    mockPrisma.actkgReleaseSetDeltaReceipt.findUnique.mockResolvedValue(acceptedDeltaRow());
    mockPrisma.aggregateCourseCoverageVersion.findUnique.mockResolvedValue(currentCoverageVersion());
    mockPrisma.aggregateCourseCoverageEntry.findMany.mockResolvedValue(currentEntries());
    mockPrisma.aggregateGovernanceReceipt.findFirst.mockResolvedValue(null);

    const { loadKaqPinnedContextFromDb } = await import(
      '@/lib/canonical-kaq-binding/authority-capability'
    );
    await expect(loadKaqPinnedContextFromDb({
      deltaReceiptId,
      coverageSelector: selector,
    })).rejects.toMatchObject({
      name: 'KaqAuthorityInputError',
      code: 'coverage-not-available',
    } satisfies Partial<KaqAuthorityInputError>);
  });

  it('fails closed when governance coverage identity drifts from accepted Delta', async () => {
    mockPrisma.actkgReleaseSetDeltaReceipt.findUnique.mockResolvedValue(acceptedDeltaRow());
    mockPrisma.aggregateCourseCoverageVersion.findUnique.mockResolvedValue(currentCoverageVersion());
    mockPrisma.aggregateCourseCoverageEntry.findMany.mockResolvedValue(currentEntries());
    mockPrisma.aggregateGovernanceReceipt.findFirst.mockResolvedValue(
      shadowGovernance({
        releaseHash: '9'.repeat(64),
      }),
    );

    const { loadKaqPinnedContextFromDb } = await import(
      '@/lib/canonical-kaq-binding/authority-capability'
    );
    await expect(loadKaqPinnedContextFromDb({
      deltaReceiptId,
      coverageSelector: selector,
    })).rejects.toMatchObject({
      name: 'KaqAuthorityInputError',
      code: 'coverage-identity-mismatch',
    });
  });

  it('fails closed when coverage version lifecycle is not CURRENT', async () => {
    mockPrisma.actkgReleaseSetDeltaReceipt.findUnique.mockResolvedValue(acceptedDeltaRow());
    mockPrisma.aggregateCourseCoverageVersion.findUnique.mockResolvedValue(
      currentCoverageVersion({ lifecycleState: 'SUPERSEDED' }),
    );
    mockPrisma.aggregateCourseCoverageEntry.findMany.mockResolvedValue(currentEntries());
    mockPrisma.aggregateGovernanceReceipt.findFirst.mockResolvedValue(shadowGovernance());

    const { loadKaqPinnedContextFromDb } = await import(
      '@/lib/canonical-kaq-binding/authority-capability'
    );
    await expect(loadKaqPinnedContextFromDb({
      deltaReceiptId,
      coverageSelector: selector,
    })).rejects.toMatchObject({
      name: 'KaqAuthorityInputError',
      code: 'coverage-not-available',
    });
  });

  it('fails closed when selector does not match aggregate coverage version', async () => {
    mockPrisma.actkgReleaseSetDeltaReceipt.findUnique.mockResolvedValue(acceptedDeltaRow());
    mockPrisma.aggregateCourseCoverageVersion.findUnique.mockResolvedValue(
      currentCoverageVersion({ courseId: 'other-course' }),
    );
    mockPrisma.aggregateCourseCoverageEntry.findMany.mockResolvedValue(currentEntries());
    mockPrisma.aggregateGovernanceReceipt.findFirst.mockResolvedValue(shadowGovernance());

    const { loadKaqPinnedContextFromDb } = await import(
      '@/lib/canonical-kaq-binding/authority-capability'
    );
    await expect(loadKaqPinnedContextFromDb({
      deltaReceiptId,
      coverageSelector: selector,
    })).rejects.toMatchObject({
      name: 'KaqAuthorityInputError',
      code: 'coverage-identity-mismatch',
    });
  });
});
