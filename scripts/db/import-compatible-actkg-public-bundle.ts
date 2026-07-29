import 'dotenv/config';

import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { createPrismaClient } from '../../src/lib/prisma-client';
import {
  AuthoritativeKnowledgeRepository,
  type AuthoritativeKnowledgeDatabase,
} from '../../src/lib/authoritative-knowledge';
import { loadAndValidatePublicBundleV1 } from '../actkg-release/public-bundle-v1';
import {
  ACCEPTED_CANDIDATE_STATE,
  importValidatedActKGBundle,
  reconstructBundleArtifacts,
} from '../actkg-release/standard-bundle-import';

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

  const db = createPrismaClient({ log: ['warn', 'error'] });
  try {
    const captureRevision = await imageRevision();
    const validated = await loadAndValidatePublicBundleV1({
      lockPath,
      ...(captureRevision ? { captureRevision } : {}),
    });

    const counts = verifyOnly
      ? undefined
      : await importValidatedActKGBundle(db, validated);

    const receipt = await db.actkgBundleReceipt.findUniqueOrThrow({
      where: { bundleDigest: validated.bundleIdentity.bundleDigest },
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

    // Default candidate and production selectors must remain unchanged.
    const defaultCandidate = await db.actkgReleaseSet.findUnique({
      where: { id: 'actkg-authoritative-candidate-v2' },
      select: { id: true, candidateState: true },
    });

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
    }));
  } finally {
    await db.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
