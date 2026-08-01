import 'dotenv/config';

import { createPrismaClient } from '../../src/lib/prisma-client';
import {
  CURRENT_AGGREGATE_RELEASE_ID,
  CURRENT_AGGREGATE_RELEASE_SET_ID,
} from '../../src/lib/authoritative-knowledge';
import { computeAndPersistReleaseSetDelta } from '../actkg-release/release-set-delta';

function argValue(prefix: string): string | undefined {
  const hit = process.argv.find((arg) => arg.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL?.trim()) {
    throw new Error('DATABASE_URL is required');
  }

  const verifyOnly = process.argv.includes('--verify-only');
  const candidateReleaseId = argValue('--candidate-release-id=')
    ?? argValue('--release-id=');
  const candidateBundleDigest = argValue('--bundle-digest=');
  const candidateBundleReceiptId = argValue('--bundle-receipt-id=');
  const expectedCaptureRevision = argValue('--capture-revision=')
    ?? process.env.APP_REVISION?.trim();

  if (!candidateReleaseId && !candidateBundleReceiptId && !candidateBundleDigest) {
    throw new Error(
      'provide --candidate-release-id=<id> and/or --bundle-digest= / --bundle-receipt-id=',
    );
  }

  const db = createPrismaClient({ log: ['warn', 'error'] });
  try {
    const defaultCandidate = await db.actkgReleaseSet.findUnique({
      where: { id: CURRENT_AGGREGATE_RELEASE_SET_ID },
      select: { id: true, candidateState: true },
    });

    const resolvedReleaseId = candidateReleaseId
      ?? (candidateBundleReceiptId
        ? (await db.actkgBundleReceipt.findUniqueOrThrow({
          where: { id: candidateBundleReceiptId },
          select: { releaseId: true },
        })).releaseId
        : (await db.actkgBundleReceipt.findUniqueOrThrow({
          where: { bundleDigest: candidateBundleDigest! },
          select: { releaseId: true },
        })).releaseId);

    const { computed, persisted } = await computeAndPersistReleaseSetDelta(db, {
      candidateReleaseId: resolvedReleaseId,
      candidateBundleDigest,
      candidateBundleReceiptId,
      verifyOnly,
      expectedCaptureRevision,
    });

    const defaultCandidateAfter = await db.actkgReleaseSet.findUnique({
      where: { id: CURRENT_AGGREGATE_RELEASE_SET_ID },
      select: { id: true, candidateState: true },
    });
    const defaultRelease = await db.actkgRelease.findUnique({
      where: { id: CURRENT_AGGREGATE_RELEASE_ID },
      select: { id: true },
    });

    if (
      defaultCandidate?.id !== defaultCandidateAfter?.id
      || defaultCandidate?.candidateState !== defaultCandidateAfter?.candidateState
    ) {
      throw new Error('delta processing mutated the default candidate selector');
    }

    console.log(JSON.stringify({
      mode: verifyOnly ? 'verify-only' : persisted.mode,
      algorithmVersion: computed.algorithmVersion,
      classification: computed.classification,
      authorizationState: computed.authorizationState,
      receiptId: persisted.receiptId,
      naturalKey: persisted.naturalKey,
      inputDigest: persisted.inputDigest,
      outputDigest: persisted.outputDigest,
      signalCount: persisted.signalCount,
      upstreamCrosscheckStatus: persisted.upstreamCrosscheckStatus,
      captureRevision: computed.captureRevision,
      summary: computed.summary,
      identityViolations: computed.identityViolations,
      base: {
        kind: computed.baseEvidence.kind,
        releaseSetId: computed.baseEvidence.releaseSetId,
        releaseId: computed.baseEvidence.releaseId,
        releaseVersion: computed.baseEvidence.releaseVersion,
        bundleId: computed.baseEvidence.bundleId,
        bundleRevision: computed.baseEvidence.bundleRevision,
        bundleDigest: computed.baseEvidence.bundleDigest,
        semanticSnapshotDigest: computed.baseSemanticSnapshotDigest,
      },
      candidate: {
        kind: computed.candidateEvidence.kind,
        releaseSetId: computed.candidateEvidence.releaseSetId,
        releaseId: computed.candidateEvidence.releaseId,
        releaseVersion: computed.candidateEvidence.releaseVersion,
        bundleId: computed.candidateEvidence.bundleId,
        bundleRevision: computed.candidateEvidence.bundleRevision,
        bundleDigest: computed.candidateEvidence.bundleDigest,
        semanticSnapshotDigest: computed.candidateSemanticSnapshotDigest,
      },
      selectorsUnchanged: true,
      defaultCandidateUnchanged: defaultCandidate?.id === CURRENT_AGGREGATE_RELEASE_SET_ID,
      defaultReleasePresent: defaultRelease?.id === CURRENT_AGGREGATE_RELEASE_ID,
    }, null, 2));

    if (computed.authorizationState !== 'ACCEPTED') {
      process.exitCode = 2;
    }
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
