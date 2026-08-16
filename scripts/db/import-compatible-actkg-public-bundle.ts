import 'dotenv/config';

import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { createPrismaClient } from '../../src/lib/prisma-client';
import {
  AuthoritativeKnowledgeRepository,
  DEFAULT_AUTHORITY_ROOT_RELATIVE,
  resolveAuthorityStorePaths,
  shouldStageAuthorityAfterDelta,
  stageAuthorityAfterValidatedBundleImport,
  STANDARD_PUBLIC_BUNDLE_PROTOCOL,
  type AuthoritativeKnowledgeDatabase,
} from '../../src/lib/authoritative-knowledge';
import { loadAndValidatePublicBundleV1 } from '../actkg-release/public-bundle-v1';
import {
  ACCEPTED_CANDIDATE_STATE,
  importValidatedActKGBundle,
  reconstructBundleArtifacts,
} from '../actkg-release/standard-bundle-import';
import { computeAndPersistReleaseSetDelta } from '../actkg-release/release-set-delta';

const COMMIT = /^[a-f0-9]{40}$/u;

async function imageRevision(): Promise<string | undefined> {
  const environmentRevision = process.env.APP_REVISION?.trim();
  const revisionPath = path.resolve(process.env.APP_REVISION_FILE ?? '.app-revision');
  const fileRevision = await readFile(revisionPath, 'utf8')
    .then((value) => value.trim())
    .catch((error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') return undefined;
      throw error;
    });
  if (environmentRevision && fileRevision && environmentRevision !== fileRevision) {
    throw new Error('APP_REVISION does not match the immutable image revision file');
  }
  const revision = fileRevision ?? environmentRevision;
  if (revision !== undefined && !COMMIT.test(revision)) {
    throw new Error('image APP_REVISION must be 40 lowercase hexadecimal characters');
  }
  return revision;
}

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL?.trim()) throw new Error('DATABASE_URL is required');
  const verifyOnly = process.argv.includes('--verify-only');
  const lockPathArg = process.argv.find((arg) => arg.startsWith('--lock-path='));
  const lockPath = lockPathArg?.slice('--lock-path='.length)
    ?? 'course-content/authoring/knowledge/releases/release-set.lock.v3.control-theory-engineering-v0.3-r2.json';
  const root = process.cwd();

  const db = createPrismaClient({ log: ['warn', 'error'] });
  try {
    const captureRevision = await imageRevision();
    const validated = await loadAndValidatePublicBundleV1({
      root,
      lockPath,
      gitRoot: root,
      ...(captureRevision ? { captureRevision } : {}),
    });

    const counts = verifyOnly
      ? undefined
      : await importValidatedActKGBundle(db, validated);

    const receipt = await db.actkgBundleReceipt.findUniqueOrThrow({
      where: {
        bundleContractVersion_bundleDigest: {
          bundleContractVersion: STANDARD_PUBLIC_BUNDLE_PROTOCOL,
          bundleDigest: validated.bundleIdentity.bundleDigest,
        },
      },
    });
    if (receipt.candidateState !== ACCEPTED_CANDIDATE_STATE) {
      throw new Error('standard Bundle receipt is not ACCEPTED_CANDIDATE');
    }
    const reconstructed = await reconstructBundleArtifacts(db, receipt.id);
    if (reconstructed.length !== validated.rawArtifacts.length) {
      throw new Error('standard Bundle Artifact round-trip count mismatch');
    }
    for (const artifact of reconstructed) {
      const original = validated.rawArtifacts.find((row) => row.descriptor.path === artifact.relativePath);
      if (!original || !artifact.bytes.equals(original.bytes) || artifact.sha256 !== original.descriptor.sha256) {
        throw new Error(`standard Bundle Artifact round-trip mismatch for ${artifact.relativePath}`);
      }
    }
    // Explicit reserved public package members (Manifest + SHA256SUMS).
    for (const reservedPath of ['bundle-manifest.json', 'SHA256SUMS'] as const) {
      const original = validated.rawArtifacts.find((row) => row.descriptor.path === reservedPath);
      const persisted = reconstructed.find((row) => row.relativePath === reservedPath);
      if (!original || !persisted) {
        throw new Error(`standard Bundle missing reserved public file ${reservedPath}`);
      }
      if (
        !persisted.bytes.equals(original.bytes)
        || persisted.sha256 !== original.descriptor.sha256
        || persisted.role !== original.descriptor.role
        || persisted.contractVersion !== original.descriptor.contractVersion
      ) {
        throw new Error(`standard Bundle reserved file round-trip mismatch for ${reservedPath}`);
      }
    }

    const repository = new AuthoritativeKnowledgeRepository(
      db as unknown as AuthoritativeKnowledgeDatabase,
    );
    const result = await repository.read({
      authorityState: 'candidate',
      releaseSetId: validated.releaseSetIdentity.releaseSetId,
      releaseId: validated.releaseIdentity.releaseId,
    });
    if (result.status !== 'available' || result.diagnostics.length !== 0) {
      throw new Error(`standard Bundle repository verification failed: ${JSON.stringify(result)}`);
    }
    // After a write, Repository must surface this packaging evidence as latest
    // (not an older accepted receipt from a higher bundleRevision under another
    // bundleId). verify-only may inspect an older lock without claiming latest.
    if (
      !verifyOnly
      && result.status === 'available'
      && (
        result.snapshot.bundleReceipt?.bundleDigest !== validated.bundleIdentity.bundleDigest
        || result.snapshot.bundleReceipt?.bundleId !== validated.bundleIdentity.bundleId
      )
    ) {
      throw new Error(
        'standard Bundle repository verification selected a non-matching packaging receipt: '
        + JSON.stringify({
          expected: {
            bundleId: validated.bundleIdentity.bundleId,
            bundleDigest: validated.bundleIdentity.bundleDigest,
          },
          actual: {
            bundleId: result.snapshot.bundleReceipt?.bundleId ?? null,
            bundleDigest: result.snapshot.bundleReceipt?.bundleDigest ?? null,
          },
        }),
      );
    }

    // Default candidate and production selectors must remain unchanged.
    const defaultCandidate = await db.actkgReleaseSet.findUnique({
      where: { id: 'actkg-authoritative-candidate-v2' },
      select: { id: true, candidateState: true },
    });

    // After successful import/verify of an ACCEPTED_CANDIDATE Bundle, recompute
    // the ACT-owned ReleaseSet Delta. verify-only never writes the delta either.
    // Capture revision is the trusted ACT delta implementation HEAD; an explicit
    // expected value may only equal that HEAD (never a fallback source).
    const delta = await computeAndPersistReleaseSetDelta(db, {
      candidateReleaseId: validated.releaseIdentity.releaseId,
      candidateBundleDigest: validated.bundleIdentity.bundleDigest,
      verifyOnly,
      expectedCaptureRevision: captureRevision ?? validated.captureRevision,
    });

    // After successful DB import + Repository validation + ACCEPTED Delta only,
    // stage the immutable Authority Snapshot. Rejected Delta receipts must not
    // produce an activatable snapshot. Import never activates the current pointer.
    let authorityStage: {
      snapshotId: string;
      snapshotHash: string;
      reused: boolean;
      releaseDir: string;
      pointerUnchanged: true;
      skippedReason?: string;
    } | null = null;
    if (!verifyOnly && result.status === 'available') {
      if (!shouldStageAuthorityAfterDelta(delta.computed.authorizationState)) {
        authorityStage = {
          snapshotId: '',
          snapshotHash: '',
          reused: false,
          releaseDir: '',
          pointerUnchanged: true,
          skippedReason: `delta-not-accepted:${delta.computed.authorizationState}`,
        };
      } else {
        const authorityPaths = resolveAuthorityStorePaths(
          path.resolve(root, DEFAULT_AUTHORITY_ROOT_RELATIVE),
        );
        const staged = stageAuthorityAfterValidatedBundleImport({
          paths: authorityPaths,
          repositorySnapshot: result.snapshot,
          deltaReceiptIds: [delta.persisted.receiptId],
          captureRevision: captureRevision ?? validated.captureRevision,
        });
        authorityStage = {
          snapshotId: staged.snapshotId,
          snapshotHash: staged.snapshotHash,
          reused: staged.reused,
          releaseDir: path.join(authorityPaths.releasesDir, staged.snapshotId),
          pointerUnchanged: true,
        };
      }
    }

    console.log(JSON.stringify({
      mode: verifyOnly ? 'verify-only' : 'import',
      import: counts ?? null,
      bundleId: validated.bundleIdentity.bundleId,
      bundleRevision: validated.bundleIdentity.bundleRevision,
      bundleDigest: validated.bundleIdentity.bundleDigest,
      releaseSetId: validated.releaseSetIdentity.releaseSetId,
      releaseId: validated.releaseIdentity.releaseId,
      candidateState: ACCEPTED_CANDIDATE_STATE,
      defaultCandidateUnchanged: defaultCandidate?.id === 'actkg-authoritative-candidate-v2',
      captureRevision: validated.captureRevision,
      delta: {
        mode: delta.persisted.mode,
        classification: delta.computed.classification,
        authorizationState: delta.computed.authorizationState,
        receiptId: delta.persisted.receiptId,
        signalCount: delta.persisted.signalCount,
        upstreamCrosscheckStatus: delta.persisted.upstreamCrosscheckStatus,
        selectorsUnchanged: delta.persisted.selectorsUnchanged,
      },
      authorityStage,
    }));

    if (delta.computed.authorizationState !== 'ACCEPTED') {
      process.exitCode = 2;
    }
  } finally {
    await db.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
