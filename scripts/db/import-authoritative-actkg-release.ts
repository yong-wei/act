import 'dotenv/config';

import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { createPrismaClient } from '../../src/lib/prisma-client';
import {
  AuthoritativeKnowledgeRepository,
  type AuthoritativeKnowledgeDatabase,
} from '../../src/lib/authoritative-knowledge';
import {
  importValidatedRelease,
  loadAndValidateRelease,
  reconstructRelease,
  canonicalJson,
  sha256,
} from '../actkg-release/authoritative-release';

const RELEASE_SET_ID = 'actkg-authoritative-candidate-v1';
const RELEASE_ID = 'root-locus-engineering-v0.1';
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

async function verifyPersistedRelease(
  db: ReturnType<typeof createPrismaClient>,
  validated: Awaited<ReturnType<typeof loadAndValidateRelease>>,
): Promise<void> {
  const reconstructed = await reconstructRelease(db, validated.entry.release_id);
  const withoutHash = structuredClone(reconstructed);
  delete withoutHash.release_hash;
  if (sha256(canonicalJson(withoutHash)) !== validated.entry.release_hash) {
    throw new Error('persisted ActKG Release round-trip hash mismatch');
  }
  const result = await new AuthoritativeKnowledgeRepository(
    db as unknown as AuthoritativeKnowledgeDatabase,
  ).read({
    authorityState: 'candidate',
    releaseSetId: RELEASE_SET_ID,
    releaseId: RELEASE_ID,
  });
  if (result.status !== 'available' || result.diagnostics.length !== 0) {
    throw new Error(`persisted ActKG Release repository verification failed: ${JSON.stringify(result)}`);
  }
}

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL?.trim()) throw new Error('DATABASE_URL is required');
  const verifyOnly = process.argv.includes('--verify-only');
  const db = createPrismaClient({ log: ['warn', 'error'] });
  try {
    const existing = await db.actkgRelease.findUnique({
      where: { id: RELEASE_ID },
      select: { captureRevision: true },
    });
    const captureRevision = existing?.captureRevision ?? await imageRevision();
    const validated = await loadAndValidateRelease(
      captureRevision ? { captureRevision } : {},
    );
    const counts = verifyOnly
      ? undefined
      : await importValidatedRelease(db, validated);
    await verifyPersistedRelease(db, validated);
    console.log(JSON.stringify({
      mode: verifyOnly ? 'verify-only' : 'import',
      releaseId: validated.entry.release_id,
      captureRevision: validated.captureRevision,
      lockRawHash: validated.lockRawHash,
      candidateState: 'CANDIDATE',
      counts,
      roundTripHash: validated.entry.release_hash,
      repositoryStatus: 'available',
    }));
  } finally {
    await db.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'ActKG Release import failed');
  process.exitCode = 1;
});
